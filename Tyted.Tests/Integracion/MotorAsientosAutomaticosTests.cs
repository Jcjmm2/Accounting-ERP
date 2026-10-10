using Microsoft.EntityFrameworkCore;
using Tyted.API.Data;
using Tyted.API.Models;
using Tyted.API.Services;

namespace Tyted.Tests.Integracion;

/// <summary>
/// Pruebas de la integración administrativo-contable (plan BE-F4): el motor
/// de asientos automáticos convierte ventas y compras en comprobantes de
/// diario balanceados (partida doble), con idempotencia, validación de
/// periodo abierto y aviso (sin romper) cuando faltan cuentas del plan.
/// </summary>
public class MotorAsientosAutomaticosTests
{
    private static TytedContext CrearContexto()
    {
        var options = new DbContextOptionsBuilder<TytedContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;

        return new TytedContext(options);
    }

    private static async Task SembrarPeriodoYPlanAsync(TytedContext context, int empresaId = 1)
    {
        context.PeriodosContables.Add(new PeriodoContable
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

        // Cuentas del mapping VEN-NIF usadas por el motor
        var cuentas = new[]
        {
            ("1.1.1.1.01", "Caja General", "Activo", "D"),
            ("1.1.3.01", "Cuentas por Cobrar", "Activo", "D"),
            ("1.1.5.01", "IVA Débito Fiscal", "Activo", "D"),
            ("1.1.5.02", "IVA Crédito Fiscal", "Activo", "D"),
            ("4.1.1", "Ingresos por Ventas", "Ingreso", "C"),
            ("5.1.1", "Compras", "Gasto", "D"),
            ("5.1.2", "Gastos", "Gasto", "D"),
            ("2.1.1.01", "Proveedores", "Pasivo", "C")
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

    private static Venta CrearVenta(int empresaId = 1, decimal subtotal = 100m, decimal iva = 16m, bool credito = false) => new()
    {
        EmpresaId = empresaId,
        FechaVenta = new DateTime(2026, 10, 7),
        NumeroFactura = "000-000123",
        TipoMoneda = "USD",
        TasaDeCambio = 1m,
        SubtotalMonedaBase = subtotal,
        IvaMonedaBase = iva,
        TotalMonedaBase = subtotal + iva,
        ClienteId = 1,
        EsCredito = credito
    };

    private static Compra CrearCompra(int empresaId = 1, decimal subtotal = 200m, decimal iva = 32m, bool credito = true) => new()
    {
        EmpresaId = empresaId,
        // [Required] en el modelo: el FK del proveedor no puede ser null
        CodigoProv = 1,
        FechaCompra = new DateTime(2026, 10, 9),
        NumeroFactura = "F-000456",
        NumeroControl = "00-000456",
        TipoMoneda = "USD",
        TasaDeCambio = 1m,
        SubtotalMonedaBase = subtotal,
        IvaMonedaBase = iva,
        TotalMonedaBase = subtotal + iva,
        EsCredito = credito
    };

    private static MotorAsientosAutomaticos CrearMotor(TytedContext context) =>
        new(context, new AsientoContableService(context), new MappingContable());

    [Fact]
    public async Task VentaContado_GeneraAsientoBalanceado_YVinculaLaVenta()
    {
        await using var context = CrearContexto();
        await SembrarPeriodoYPlanAsync(context);

        context.Ventas.Add(CrearVenta()); // contado: 100 + 16 IVA = 116
        await context.SaveChangesAsync();
        var venta = await context.Ventas.SingleAsync();

        var motor = CrearMotor(context);
        var r = await motor.GenerarAsientoVentaAsync(venta, usuarioId: 1);

        Assert.True(r.Generada);
        Assert.False(string.IsNullOrEmpty(r.NumeroComprobante));
        Assert.Equal(116m, r.TotalDebe);
        Assert.Equal(116m, r.TotalHaber);

        var asiento = await context.AsientosContables
            .Include(a => a.Detalles)
            .SingleAsync(a => a.Id == r.AsientoId);

        // Partida doble: Debe = Haber
        Assert.Equal(asiento.Detalles.Sum(d => d.Debe), asiento.Detalles.Sum(d => d.Haber));
        Assert.Equal(116m, asiento.Detalles.Sum(d => d.Debe));

        // Estructura BE-TAX-401: Debe Caja (total) | Haber Ventas (base) + IVA Débito (16)
        var caja = await context.CuentasContables.SingleAsync(c => c.CodigoCuenta == "1.1.1.1.01");
        var ventas = await context.CuentasContables.SingleAsync(c => c.CodigoCuenta == "4.1.1");
        var ivaDebito = await context.CuentasContables.SingleAsync(c => c.CodigoCuenta == "1.1.5.01");
        Assert.Equal(116m, Assert.Single(asiento.Detalles, d => d.CuentaContableId == caja.Id).Debe);
        Assert.Equal(100m, Assert.Single(asiento.Detalles, d => d.CuentaContableId == ventas.Id).Haber);
        Assert.Equal(16m, Assert.Single(asiento.Detalles, d => d.CuentaContableId == ivaDebito.Id).Haber);

        // Vínculo persistido (idempotencia)
        Assert.Equal(r.AsientoId, venta.AsientoContableId);
        Assert.Equal(r.AsientoId, await context.Ventas.AsNoTracking().Select(v => v.AsientoContableId).SingleAsync());
    }

    [Fact]
    public async Task VentaCredito_DebeCuentasPorCobrar()
    {
        await using var context = CrearContexto();
        await SembrarPeriodoYPlanAsync(context);

        context.Ventas.Add(CrearVenta(credito: true));
        await context.SaveChangesAsync();
        var venta = await context.Ventas.SingleAsync();

        var r = await CrearMotor(context).GenerarAsientoVentaAsync(venta);

        Assert.True(r.Generada);
        var asiento = await context.AsientosContables.Include(a => a.Detalles).SingleAsync(a => a.Id == r.AsientoId);
        var cxc = await context.CuentasContables.SingleAsync(c => c.CodigoCuenta == "1.1.3.01");
        Assert.Equal(116m, Assert.Single(asiento.Detalles, d => d.CuentaContableId == cxc.Id).Debe);
    }

    [Fact]
    public async Task VentaYaContabilizada_NoDuplicaElComprobante()
    {
        await using var context = CrearContexto();
        await SembrarPeriodoYPlanAsync(context);

        context.Ventas.Add(CrearVenta());
        await context.SaveChangesAsync();
        var venta = await context.Ventas.SingleAsync();

        var motor = CrearMotor(context);
        var primero = await motor.GenerarAsientoVentaAsync(venta);
        var segundo = await motor.GenerarAsientoVentaAsync(venta);

        Assert.True(primero.Generada);
        Assert.False(segundo.Generada);
        Assert.NotNull(segundo.Advertencia);
        Assert.Equal(1, await context.AsientosContables.CountAsync());
    }

    [Fact]
    public async Task Venta_SinPeriodoAbierto_LanzaErrorControlado()
    {
        await using var context = CrearContexto();
        await SembrarPeriodoYPlanAsync(context);

        var venta = CrearVenta();
        venta.FechaVenta = new DateTime(2026, 11, 5); // fuera de octubre
        context.Ventas.Add(venta);
        await context.SaveChangesAsync();
        var ventaDb = await context.Ventas.SingleAsync();

        var ex = await Assert.ThrowsAsync<InvalidOperationException>(
            () => CrearMotor(context).GenerarAsientoVentaAsync(ventaDb));
        Assert.Contains("periodo contable ABIERTO", ex.Message);
        Assert.Equal(0, await context.AsientosContables.CountAsync());
    }

    [Fact]
    public async Task Venta_CuentasFaltantesEnElPlan_AdvertenciaSinAsiento()
    {
        await using var context = CrearContexto();
        // Sin plan de cuentas ni periodo para la empresa 2

        context.Ventas.Add(CrearVenta(empresaId: 2));
        await context.SaveChangesAsync();
        var venta = await context.Ventas.SingleAsync();

        var r = await CrearMotor(context).GenerarAsientoVentaAsync(venta);

        Assert.False(r.Generada);
        Assert.NotNull(r.Advertencia);
        Assert.Contains("1.1.1.1.01", r.Advertencia!); // cuenta faltante reportada
        Assert.Equal(0, await context.AsientosContables.CountAsync());
        Assert.Null(venta.AsientoContableId);
    }

    [Fact]
    public async Task Compra_GeneraAsientoBalanceado_YVinculaLaCompra()
    {
        await using var context = CrearContexto();
        await SembrarPeriodoYPlanAsync(context);

        context.Compras.Add(CrearCompra()); // crédito: 200 + 32 IVA = 232
        await context.SaveChangesAsync();
        var compra = await context.Compras.SingleAsync();

        var r = await CrearMotor(context).GenerarAsientoCompraAsync(compra);

        Assert.True(r.Generada);
        Assert.Equal(232m, r.TotalDebe);
        Assert.Equal(232m, r.TotalHaber);

        var asiento = await context.AsientosContables
            .Include(a => a.Detalles)
            .SingleAsync(a => a.Id == r.AsientoId);
        Assert.Equal(asiento.Detalles.Sum(d => d.Debe), asiento.Detalles.Sum(d => d.Haber));

        // Estructura BE-TAX-402: Debe Compras + IVA Crédito | Haber Proveedores
        var compras = await context.CuentasContables.SingleAsync(c => c.CodigoCuenta == "5.1.1");
        var ivaCredito = await context.CuentasContables.SingleAsync(c => c.CodigoCuenta == "1.1.5.02");
        var proveedores = await context.CuentasContables.SingleAsync(c => c.CodigoCuenta == "2.1.1.01");
        Assert.Equal(200m, Assert.Single(asiento.Detalles, d => d.CuentaContableId == compras.Id).Debe);
        Assert.Equal(32m, Assert.Single(asiento.Detalles, d => d.CuentaContableId == ivaCredito.Id).Debe);
        Assert.Equal(232m, Assert.Single(asiento.Detalles, d => d.CuentaContableId == proveedores.Id).Haber);

        Assert.Equal(r.AsientoId, compra.AsientoContableId);
    }

    [Fact]
    public async Task VentaService_FiltroPorEmpresaYRangoDeFechas_DelPeriodoActivo()
    {
        await using var context = CrearContexto();

        // El listado hace Include(Cliente): se siembra el cliente FK (existe en BD real)
        context.Clientes.Add(new Cliente { Id = 1, Rif = "J-000000000", Nombre = "CLIENTE EVENTUAL" });

        var ventaNoviembre = CrearVenta();
        ventaNoviembre.FechaVenta = new DateTime(2026, 11, 5);

        context.Ventas.AddRange(
            CrearVenta(),             // 07/10 empresa 1
            ventaNoviembre,           // 05/11 empresa 1
            CrearVenta(empresaId: 2)); // 07/10 empresa 2
        await context.SaveChangesAsync();

        var service = new VentaService(context, new CorrelativoService(context));

        // Verificación por etapas del filtro
        var todas = (await service.ObtenerFiltradasAsync()).ToList();
        Assert.Equal(3, todas.Count);

        var porEmpresa = (await service.ObtenerFiltradasAsync(empresaId: 1)).ToList();
        Assert.Equal(2, porEmpresa.Count);

        var porFechas = (await service.ObtenerFiltradasAsync(
            new DateTime(2026, 10, 1), new DateTime(2026, 10, 31))).ToList();
        Assert.Equal(2, porFechas.Count);

        var filtradas = (await service.ObtenerFiltradasAsync(
            new DateTime(2026, 10, 1), new DateTime(2026, 10, 31), empresaId: 1)).ToList();

        var unica = Assert.Single(filtradas);
        Assert.Equal(1, unica.EmpresaId);
        Assert.Equal(new DateTime(2026, 10, 7), unica.FechaVenta);
    }

    [Fact]
    public async Task VentaNotaCredito_MontoNegativo_SeContabilizaConLadosInvertidos()
    {
        await using var context = CrearContexto();
        await SembrarPeriodoYPlanAsync(context);

        // Nota de crédito/anulación: −100 base − 16 IVA = −116
        context.Ventas.Add(CrearVenta(subtotal: -100m, iva: -16m));
        await context.SaveChangesAsync();
        var venta = await context.Ventas.SingleAsync();

        var r = await CrearMotor(context).GenerarAsientoVentaAsync(venta);

        Assert.True(r.Generada);
        Assert.Equal(116m, r.TotalDebe);
        Assert.Equal(116m, r.TotalHaber);

        var asiento = await context.AsientosContables.Include(a => a.Detalles).SingleAsync(a => a.Id == r.AsientoId);
        Assert.Equal(asiento.Detalles.Sum(d => d.Debe), asiento.Detalles.Sum(d => d.Haber));
        Assert.Contains("NOTA DE CRÉDITO", asiento.Concepto);

        // Lados invertidos: Debe Ingresos + IVA Débito | Haber Caja (total)
        var caja = await context.CuentasContables.SingleAsync(c => c.CodigoCuenta == "1.1.1.1.01");
        var ventas = await context.CuentasContables.SingleAsync(c => c.CodigoCuenta == "4.1.1");
        var ivaDebito = await context.CuentasContables.SingleAsync(c => c.CodigoCuenta == "1.1.5.01");
        Assert.Equal(116m, Assert.Single(asiento.Detalles, d => d.CuentaContableId == caja.Id).Haber);
        Assert.Equal(100m, Assert.Single(asiento.Detalles, d => d.CuentaContableId == ventas.Id).Debe);
        Assert.Equal(16m, Assert.Single(asiento.Detalles, d => d.CuentaContableId == ivaDebito.Id).Debe);
    }

    [Fact]
    public async Task CompraNotaCredito_MontoNegativo_SeContabilizaConLadosInvertidos()
    {
        await using var context = CrearContexto();
        await SembrarPeriodoYPlanAsync(context);

        // Nota de crédito de compra: −200 base − 32 IVA = −232
        context.Compras.Add(CrearCompra(subtotal: -200m, iva: -32m));
        await context.SaveChangesAsync();
        var compra = await context.Compras.SingleAsync();

        var r = await CrearMotor(context).GenerarAsientoCompraAsync(compra);

        Assert.True(r.Generada);
        Assert.Equal(232m, r.TotalDebe);
        Assert.Equal(232m, r.TotalHaber);

        var asiento = await context.AsientosContables.Include(a => a.Detalles).SingleAsync(a => a.Id == r.AsientoId);
        Assert.Equal(asiento.Detalles.Sum(d => d.Debe), asiento.Detalles.Sum(d => d.Haber));
        Assert.Contains("NOTA DE CRÉDITO", asiento.Concepto);

        // Lados invertidos: Haber Compras + IVA Crédito | Debe Proveedores (total)
        var compras = await context.CuentasContables.SingleAsync(c => c.CodigoCuenta == "5.1.1");
        var ivaCredito = await context.CuentasContables.SingleAsync(c => c.CodigoCuenta == "1.1.5.02");
        var proveedores = await context.CuentasContables.SingleAsync(c => c.CodigoCuenta == "2.1.1.01");
        Assert.Equal(200m, Assert.Single(asiento.Detalles, d => d.CuentaContableId == compras.Id).Haber);
        Assert.Equal(32m, Assert.Single(asiento.Detalles, d => d.CuentaContableId == ivaCredito.Id).Haber);
        Assert.Equal(232m, Assert.Single(asiento.Detalles, d => d.CuentaContableId == proveedores.Id).Debe);
    }
}