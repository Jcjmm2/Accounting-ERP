using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Diagnostics;
using Tyted.API.Data;
using Tyted.API.Models;
using Tyted.API.Services;

namespace Tyted.Tests.Integracion;

/// <summary>
/// Pruebas de la contabilización de las RETENCIONES: ISLR al EMITIR (fecha =
/// documento origen ⇒ asiento en su periodo) e IVA «al momento del pago»
/// (CONTADO: asiento al emitir Debe Caja | Haber IVA Retenido por Entregar;
/// CRÉDITO: asiento de pago Debe Proveedores | Haber Caja + IVA Retenido).
/// </summary>
public class RetencionesContabilizacionTests
{
    private static TytedContext CrearContexto()
    {
        var options = new DbContextOptionsBuilder<TytedContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            // Los servicios usan transacciones SQL; InMemory las ignora con un
            // warning que se suprime aquí.
            .ConfigureWarnings(w => w.Ignore(InMemoryEventId.TransactionIgnoredWarning))
            .Options;

        return new TytedContext(options);
    }

    /// <summary>
    /// Periodos SEPTIEMBRE y OCTUBRE 2026 abiertos + proveedor + plan de cuentas
    /// de retenciones/pagos (caja, proveedores, ISLR, IVA retenido, IVA crédito,
    /// compras).
    /// </summary>
    private static async Task SembrarBaseAsync(TytedContext context, int empresaId = 1)
    {
        context.PeriodosContables.AddRange(
            new PeriodoContable
            {
                EmpresaId = empresaId,
                Anio = 2026,
                Mes = 9,
                TipoPeriodo = "Mensual",
                Nombre = "Septiembre 2026",
                FechaInicio = new DateTime(2026, 9, 1),
                FechaFin = new DateTime(2026, 9, 30, 23, 59, 59),
                Estado = "Abierto",
                Cerrado = false
            },
            new PeriodoContable
            {
                EmpresaId = empresaId,
                Anio = 2026,
                Mes = 10,
                TipoPeriodo = "Mensual",
                Nombre = "Octubre 2026",
                FechaInicio = new DateTime(2026, 10, 1),
                FechaFin = new DateTime(2026, 10, 31, 23, 59, 59),
                Estado = "Abierto",
                Cerrado = false
            });

        context.Proveedores.Add(new Proveedor
        {
            CodigoProv = 1,
            Razonsocial = "PROVEEDOR DE PRUEBA C.A.",
            RIF = "J-123456789"
        });

        var cuentas = new[]
        {
            ("1.1.1.1.01", "Caja General", "Activo", "D"),
            ("1.1.5.02", "IVA Crédito Fiscal", "Activo", "D"),
            ("2.1.1.01", "Proveedores", "Pasivo", "C"),
            ("2.1.1.02", "ISLR retenido por pagar", "Pasivo", "C"),
            ("2.1.5.01", "IVA Retenido por Entregar", "Pasivo", "C"),
            ("5.1.1", "Compras", "Gasto", "D")
        };
        foreach (var (codigo, nombre, tipo, naturaleza) in cuentas)
        {
            context.CuentasContables.Add(new CuentaContable
            {
                EmpresaId = empresaId,
                CodigoCuenta = codigo,
                NombreCuenta = nombre,
                TipoCuenta = tipo,
                Naturaleza = naturaleza,
                EsMovimiento = true,
                Nivel = 5,
                Activa = true
            });
        }

        await context.SaveChangesAsync();
    }

    /// <summary>Compra de septiembre: base 200 + IVA 32 = 232 Bs. (ext congelados).</summary>
    private static Compra CrearCompra(bool credito = true) => new()
    {
        EmpresaId = 1,
        CodigoProv = 1,
        FechaCompra = new DateTime(2026, 9, 7),
        NumeroFactura = "F-000456",
        NumeroControl = "00-000456",
        TipoTransaccion = "01",
        TipoMoneda = "USD",
        TasaDeCambio = 1m,
        SubtotalMonedaBase = 200m,
        IvaMonedaBase = 32m,
        TotalMonedaBase = 232m,
        SubtotalMonedaExt = 200m,
        IvaMonedaExt = 32m,
        TotalMonedaExt = 232m,
        EsCredito = credito
    };

    // --- ISLR: se emite y contabiliza en el PERIODO DEL DOCUMENTO ------------

    [Fact]
    public async Task Islr_EmitidoSobreGastoDeSeptiembre_AfectaAlPeriodoDeSeptiembre()
    {
        await using var context = CrearContexto();
        await SembrarBaseAsync(context);

        context.Gastos.Add(new Gasto
        {
            EmpresaId = 1,
            Fecha = new DateTime(2026, 9, 10),
            Concepto = "Servicio de consultoría",
            Categoria = "SERVICIO",
            CodigoProv = 1,
            NumeroFactura = "G-001",
            NumeroControl = "S/N",
            TipoTransaccion = "01",
            Monto = 100m,
            TasaDeCambio = 1m,
            MontoMonedaExt = 100m
        });
        await context.SaveChangesAsync();
        var gasto = await context.Gastos.SingleAsync();

        var serviceIslr = new RetencionIslrService(context, CrearMotor(context), new ConfigService(context));
        var retencion = await serviceIslr.EmitirAsync(
            empresaId: 1, baseImponible: 100m, porcentaje: 10m, tasaDeCambio: 1m, gastoId: gasto.Id);

        // Fecha de la retención = fecha del gasto (no la de hoy) y comprobante
        // SENIAT con el AAAAMM de septiembre.
        Assert.Equal(new DateTime(2026, 9, 10), retencion.FechaRetencion);
        Assert.StartsWith("202609", retencion.NumeroComprobante);
        Assert.Equal(10m, retencion.MontoRetenidoBs); // 10% de 100 sin sustraendo

        var r = await serviceIslr.ContabilizarAsync(
            await serviceIslr.GetPorIdAsync(retencion.Id) ?? throw new InvalidOperationException("no emitida"));
        Assert.True(r.Generada);

        var asiento = await context.AsientosContables.SingleAsync(a => a.Id == r.AsientoId);
        var septiembre = await context.PeriodosContables.SingleAsync(p => p.TipoPeriodo == "Mensual" && p.Mes == 9);
        Assert.Equal(septiembre.Id, asiento.PeriodoContableId);
        Assert.Equal(new DateTime(2026, 9, 10), asiento.FechaComprobante);

        // Partida doble: Debe Proveedores | Haber ISLR retenido por pagar
        var proveedores = await context.CuentasContables.SingleAsync(c => c.CodigoCuenta == "2.1.1.01");
        var islr = await context.CuentasContables.SingleAsync(c => c.CodigoCuenta == "2.1.1.02");
        Assert.Equal(10m, Assert.Single(asiento.Detalles, d => d.CuentaContableId == proveedores.Id).Debe);
        Assert.Equal(10m, Assert.Single(asiento.Detalles, d => d.CuentaContableId == islr.Id).Haber);

        var recargada = await context.RetencionesIslrEmitidas.SingleAsync(x => x.Id == retencion.Id);
        Assert.Equal(r.AsientoId, recargada.AsientoContableId);
    }

    [Fact]
    public async Task Islr_EmitidoSobreDocumentoSinPeriodoAbierto_SeRechaza()
    {
        await using var context = CrearContexto();
        await SembrarBaseAsync(context); // sólo septiembre y octubre 2026

        context.Gastos.Add(new Gasto
        {
            EmpresaId = 1,
            Fecha = new DateTime(2026, 8, 15), // agosto: sin periodo sembrado
            Concepto = "Servicio de agosto",
            Categoria = "SERVICIO",
            CodigoProv = 1,
            NumeroFactura = "G-002",
            NumeroControl = "S/N",
            TipoTransaccion = "01",
            Monto = 100m,
            TasaDeCambio = 1m,
            MontoMonedaExt = 100m
        });
        await context.SaveChangesAsync();
        var gasto = await context.Gastos.SingleAsync();

        var serviceIslr = new RetencionIslrService(context, CrearMotor(context), new ConfigService(context));
        var ex = await Assert.ThrowsAsync<InvalidOperationException>(() =>
            serviceIslr.EmitirAsync(empresaId: 1, baseImponible: 100m, porcentaje: 10m, tasaDeCambio: 1m, gastoId: gasto.Id));

        Assert.Contains("periodo contable ABIERTO", ex.Message);
        Assert.Equal(0, await context.RetencionesIslrEmitidas.CountAsync());
    }


    private static MotorAsientosAutomaticos CrearMotor(TytedContext context) =>
        new(context, new AsientoContableService(context), new MappingContable());

    // --- IVA EN CONTADO: el asiento nace AL EMITIR la retención --------------

    [Fact]
    public async Task Iva_Contado_ContabilizaAlEmitir_DebeCajaHaberIvaRetenido()
    {
        await using var context = CrearContexto();
        await SembrarBaseAsync(context);

        var compra = CrearCompra(credito: false);
        context.Compras.Add(compra);
        await context.SaveChangesAsync();

        var motor = CrearMotor(context);
        var compraDb = await context.Compras.SingleAsync();
        // La factura debe estar contabilizada antes que su retención.
        var rCompra = await motor.GenerarAsientoCompraAsync(compraDb);
        Assert.True(rCompra.Generada);

        var serviceIva = new RetencionIvaService(context, motor);
        var retencion = await serviceIva.EmitirAsync(compraDb.Id, 1, 75);

        // Fecha = fecha de la factura y AAAAMM de septiembre (no la de hoy).
        Assert.Equal(new DateTime(2026, 9, 7), retencion.FechaRetencion);
        Assert.StartsWith("202609", retencion.NumeroComprobante);
        Assert.Equal(24m, retencion.MontoRetenidoBs); // 75% de IVA 32

        var r = await serviceIva.ContabilizarAsync(retencion.Id);
        Assert.True(r.Generada);

        var asiento = await context.AsientosContables.SingleAsync(a => a.Id == r.AsientoId);
        var septiembre = await context.PeriodosContables.SingleAsync(p => p.TipoPeriodo == "Mensual" && p.Mes == 9);
        Assert.Equal(septiembre.Id, asiento.PeriodoContableId);

        // Partida doble: Debe Caja 24 | Haber IVA Retenido por Entregar 24
        var caja = await context.CuentasContables.SingleAsync(c => c.CodigoCuenta == "1.1.1.1.01");
        var ivaRetenido = await context.CuentasContables.SingleAsync(c => c.CodigoCuenta == "2.1.5.01");
        Assert.Equal(24m, Assert.Single(asiento.Detalles, d => d.CuentaContableId == caja.Id).Debe);
        Assert.Equal(24m, Assert.Single(asiento.Detalles, d => d.CuentaContableId == ivaRetenido.Id).Haber);

        var recargada = await context.RetencionesIvaEmitidas.SingleAsync(x => x.Id == retencion.Id);
        Assert.Equal(r.AsientoId, recargada.AsientoContableId);

        // Idempotencia: segunda contabilización no duplica.
        var segundo = await serviceIva.ContabilizarAsync(retencion.Id);
        Assert.False(segundo.Generada);
        Assert.Equal(2, await context.AsientosContables.CountAsync()); // compra + retención
    }

    [Fact]
    public async Task Iva_Credito_ContabilizarEnEmitir_SeRechaza()
    {
        await using var context = CrearContexto();
        await SembrarBaseAsync(context);

        var compra = CrearCompra(credito: true);
        context.Compras.Add(compra);
        await context.SaveChangesAsync();
        var compraDb = await context.Compras.SingleAsync();

        var motor = CrearMotor(context);
        await motor.GenerarAsientoCompraAsync(compraDb);

        var serviceIva = new RetencionIvaService(context, motor);
        var retencion = await serviceIva.EmitirAsync(compraDb.Id, 1, 75);

        var ex = await Assert.ThrowsAsync<InvalidOperationException>(
            () => serviceIva.ContabilizarAsync(retencion.Id));
        Assert.Contains("CRÉDITO", ex.Message);
        Assert.Null(retencion.AsientoContableId);
    }

    // --- IVA EN CRÉDITO: el asiento nace con el PAGO de la factura -----------

    [Fact]
    public async Task Pago_CreditoConRetencionesIvaYIslr_PartidaDobleCompleta()
    {
        await using var context = CrearContexto();
        await SembrarBaseAsync(context);

        var compra = CrearCompra(credito: true);
        context.Compras.Add(compra);
        await context.SaveChangesAsync();
        var compraDb = await context.Compras.SingleAsync();

        var motor = CrearMotor(context);
        Assert.True((await motor.GenerarAsientoCompraAsync(compraDb)).Generada);

        // Retenciones vigentes: IVA 75% (24) e ISLR 5% (10) sin contabilizar.
        var serviceIva = new RetencionIvaService(context, motor);
        var retIva = await serviceIva.EmitirAsync(compraDb.Id, 1, 75);
        var serviceIslr = new RetencionIslrService(context, motor, new ConfigService(context));
        var retIslr = await serviceIslr.EmitirAsync(
            empresaId: 1, baseImponible: 200m, porcentaje: 5m, tasaDeCambio: 1m, compraId: compraDb.Id);

        // Pago: el motor contabiliza ANTES el ISLR pendiente y luego el pago.
        var compraPago = await context.Compras.SingleAsync(c => c.Id == compraDb.Id);
        var r = await motor.GenerarAsientoPagoCompraAsync(compraPago, new DateTime(2026, 9, 15));
        Assert.True(r.Generada);

        // ISLR contabilizado automáticamente (10)…
        var retIslrDb = await context.RetencionesIslrEmitidas.SingleAsync(x => x.Id == retIslr.Id);
        Assert.NotNull(retIslrDb.AsientoContableId);

        // …y asiento de pago en el periodo de la fecha de pago.
        var pago = await context.AsientosContables
            .Include(a => a.Detalles)
            .SingleAsync(a => a.Id == r.AsientoId);
        var septiembre = await context.PeriodosContables.SingleAsync(p => p.TipoPeriodo == "Mensual" && p.Mes == 9);
        Assert.Equal(septiembre.Id, pago.PeriodoContableId);

        // Debe Proveedores 232 − ISLR 10 = 222 | Haber Caja (222 − IVA 24) = 198
        // | Haber IVA Retenido por Entregar 24.
        var proveedores = await context.CuentasContables.SingleAsync(c => c.CodigoCuenta == "2.1.1.01");
        var caja = await context.CuentasContables.SingleAsync(c => c.CodigoCuenta == "1.1.1.1.01");
        var ivaRetenido = await context.CuentasContables.SingleAsync(c => c.CodigoCuenta == "2.1.5.01");
        Assert.Equal(222m, Assert.Single(pago.Detalles, d => d.CuentaContableId == proveedores.Id).Debe);
        Assert.Equal(198m, Assert.Single(pago.Detalles, d => d.CuentaContableId == caja.Id).Haber);
        Assert.Equal(24m, Assert.Single(pago.Detalles, d => d.CuentaContableId == ivaRetenido.Id).Haber);
        Assert.Equal(pago.Detalles.Sum(d => d.Debe), pago.Detalles.Sum(d => d.Haber));

        // Vínculos: retención IVA contabilizada con el pago y pago único.
        var retIvaDb = await context.RetencionesIvaEmitidas.SingleAsync(x => x.Id == retIva.Id);
        Assert.Equal(r.AsientoId, retIvaDb.AsientoContableId);
        var compraFinal = await context.Compras.SingleAsync(c => c.Id == compraDb.Id);
        Assert.Equal(r.AsientoId, compraFinal.AsientoPagoId);
        Assert.Equal(new DateTime(2026, 9, 15), compraFinal.FechaPago);

        // Idempotencia: segundo pago rechazado sin asiento nuevo.
        var segundo = await motor.GenerarAsientoPagoCompraAsync(compraFinal, new DateTime(2026, 9, 20));
        Assert.False(segundo.Generada);
        Assert.Equal(3, await context.AsientosContables.CountAsync()); // compra + ISLR + pago
    }

    [Fact]
    public async Task Pago_SinPeriodoAbiertoParaLaFecha_SeRechaza()
    {
        await using var context = CrearContexto();
        await SembrarBaseAsync(context);

        var compra = CrearCompra(credito: true);
        context.Compras.Add(compra);
        await context.SaveChangesAsync();
        var compraDb = await context.Compras.SingleAsync();

        var motor = CrearMotor(context);
        await motor.GenerarAsientoCompraAsync(compraDb);

        var compraPago = await context.Compras.SingleAsync(c => c.Id == compraDb.Id);
        var ex = await Assert.ThrowsAsync<InvalidOperationException>(() =>
            motor.GenerarAsientoPagoCompraAsync(compraPago, new DateTime(2026, 8, 20))); // sin periodo de agosto

        Assert.Contains("periodo contable ABIERTO", ex.Message);
    }
}
