using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Diagnostics;
using Tyted.API.Data;
using Tyted.API.Models;
using Tyted.API.Services;

namespace Tyted.Tests.Integracion;

/// <summary>
/// Pruebas de la regla «fecha ∈ periodo» para los DOCUMENTOS FISCALES: un
/// registro (venta, compra, gasto o resumen Z) sólo puede nacer dentro de un
/// periodo ABIERTO de su empresa, y el periodo al que afecta el asiento lo
/// define la FECHA del documento. El desempate a igual fecha (ejercicio anual
/// + subperiodos mensuales) prefiere el MENSUAL — mismo criterio que el cierre
/// de periodo — para que el asiento caiga siempre donde espera el usuario.
/// </summary>
public class PeriodoDocumentoFiscalTests
{
    private static TytedContext CrearContexto()
    {
        var options = new DbContextOptionsBuilder<TytedContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            // Los servicios de venta/compra usan transacciones SQL; el proveedor
            // InMemory las ignora y emite un warning que se suprime aquí.
            .ConfigureWarnings(w => w.Ignore(InMemoryEventId.TransactionIgnoredWarning))
            .Options;

        return new TytedContext(options);
    }

    /// <summary>Ejercicio anual OCT-DIC + subperiodo mensual OCTUBRE (ambos abiertos) + plan mínimo.</summary>
    private static async Task SembrarEjercicioAnualConMensualAsync(TytedContext context, int empresaId = 1)
    {
        context.PeriodosContables.Add(new PeriodoContable
        {
            EmpresaId = empresaId,
            Anio = 2026,
            TipoPeriodo = "Anual",
            Nombre = "Ejercicio 2026 (oct-dic)",
            FechaInicio = new DateTime(2026, 10, 1),
            FechaFin = new DateTime(2026, 12, 31, 23, 59, 59),
            Estado = "Abierto",
            Cerrado = false
        });
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

        var cuentas = new[]
        {
            ("1.1.1.1.01", "Caja General", "Activo", "D"),
            ("1.1.5.01", "IVA Débito Fiscal", "Activo", "D"),
            ("4.1.1", "Ingresos por Ventas", "Ingreso", "C")
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

    // --- VALIDACIÓN COMPARTIDA (ValidacionPeriodoFiscal) ---------------------

    [Fact]
    public async Task BuscarPeriodoAbierto_AmbiguedadAnualMensual_PrefiereElMensual()
    {
        await using var context = CrearContexto();
        await SembrarEjercicioAnualConMensualAsync(context);

        var periodo = await context.BuscarPeriodoAbiertoAsync(1, new DateTime(2026, 10, 7));

        Assert.NotNull(periodo);
        Assert.Equal("Mensual", periodo!.TipoPeriodo);
        Assert.Equal(10, periodo.Mes);
    }

    [Fact]
    public async Task BuscarPeriodoAbierto_FueraDeTodoPeriodo_DevuelveNull()
    {
        await using var context = CrearContexto();
        await SembrarEjercicioAnualConMensualAsync(context);

        var periodo = await context.BuscarPeriodoAbiertoAsync(1, new DateTime(2026, 9, 15));

        Assert.Null(periodo);
    }

    [Fact]
    public async Task ValidarPeriodo_TodosCerrados_SeRechaza()
    {
        await using var context = CrearContexto();
        await SembrarEjercicioAnualConMensualAsync(context);

        foreach (var p in await context.PeriodosContables.ToListAsync())
        {
            p.Cerrado = true;
            p.Estado = "Cerrado";
        }
        await context.SaveChangesAsync();

        var ex = await Assert.ThrowsAsync<InvalidOperationException>(() =>
            context.ValidarPeriodoAbiertoParaDocumentoAsync(1, new DateTime(2026, 10, 7), "la venta fiscal"));

        Assert.Contains("periodo contable ABIERTO", ex.Message);
    }

    [Fact]
    public async Task ValidarPeriodo_MensualCerrado_UsaElAnualAbierto()
    {
        await using var context = CrearContexto();
        await SembrarEjercicioAnualConMensualAsync(context);

        var mensual = await context.PeriodosContables.SingleAsync(p => p.TipoPeriodo == "Mensual");
        mensual.Cerrado = true;
        mensual.Estado = "Cerrado";
        await context.SaveChangesAsync();

        var periodo = await context.ValidarPeriodoAbiertoParaDocumentoAsync(1, new DateTime(2026, 10, 7), "la venta fiscal");

        Assert.Equal("Anual", periodo.TipoPeriodo);
    }

    // --- ALTA DE DOCUMENTOS FISCALES (fuente de verdad backend) --------------

    [Fact]
    public async Task VentaFiscal_FueraDeTodoPeriodo_SeRechazaEnElAlta()
    {
        await using var context = CrearContexto();
        await SembrarEjercicioAnualConMensualAsync(context);

        var service = new VentaService(context, new CorrelativoService(context));
        var ex = await Assert.ThrowsAsync<InvalidOperationException>(() =>
            service.CrearVentaFiscalAsync(new Venta
            {
                EmpresaId = 1,
                ClienteId = 1,
                FechaVenta = new DateTime(2026, 9, 15), // septiembre: fuera del ejercicio oct-dic
                Detalles = new List<VentaDetalle>
                {
                    new() { CodigoProd = "X", IdProductoUnidad = 1, Cantidad = 1m, PrecioUnitarioMonedaBase = 10m, TasaIVA = 16m }
                }
            }));

        Assert.Contains("periodo contable ABIERTO", ex.Message);
        Assert.Equal(0, await context.Ventas.CountAsync());
    }

    [Fact]
    public async Task CompraFiscal_FueraDeTodoPeriodo_SeRechazaEnElAlta()
    {
        await using var context = CrearContexto();
        await SembrarEjercicioAnualConMensualAsync(context);

        var service = new CompraService(context);
        var ex = await Assert.ThrowsAsync<InvalidOperationException>(() =>
            service.CrearCompraFiscalAsync(new Compra
            {
                EmpresaId = 1,
                CodigoProv = 1,
                FechaCompra = new DateTime(2026, 9, 15), // fuera del ejercicio oct-dic
                NumeroFactura = "F-001",
                NumeroControl = "00-00000001",
                TipoTransaccion = "01",
                TipoMoneda = "USD",
                TasaDeCambio = 1m,
                Detalles = new List<CompraDetalle>
                {
                    new() { CodigoProd = "X", IdProductoUnidad = 1, UnidadCompra = "UND", Cantidad = 1m, CostoUnitarioMonedaBase = 10m, TasaIVA = 0m }
                }
            }));

        Assert.Contains("periodo contable ABIERTO", ex.Message);
        Assert.Equal(0, await context.Compras.CountAsync());
    }

    // --- EL ASIENTO AFECTA AL PERIODO DEL DOCUMENTO --------------------------

    [Fact]
    public async Task Venta_Contabilizada_AfectaAlSubperiodoMensual_YNoAlAnual()
    {
        await using var context = CrearContexto();
        await SembrarEjercicioAnualConMensualAsync(context);

        var mensual = await context.PeriodosContables.SingleAsync(p => p.TipoPeriodo == "Mensual");
        var anual = await context.PeriodosContables.SingleAsync(p => p.TipoPeriodo == "Anual");

        context.Ventas.Add(new Venta
        {
            EmpresaId = 1,
            FechaVenta = new DateTime(2026, 10, 7),
            NumeroFactura = "000-000777",
            TipoMoneda = "USD",
            TasaDeCambio = 1m,
            SubtotalMonedaBase = 100m,
            IvaMonedaBase = 16m,
            TotalMonedaBase = 116m,
            SubtotalMonedaExt = 100m,
            IvaMonedaExt = 16m,
            TotalMonedaExt = 116m,
            ClienteId = 1,
            EsCredito = false
        });
        await context.SaveChangesAsync();
        var venta = await context.Ventas.SingleAsync();

        var motor = new MotorAsientosAutomaticos(context, new AsientoContableService(context), new MappingContable());
        var r = await motor.GenerarAsientoVentaAsync(venta);

        Assert.True(r.Generada);
        var asiento = await context.AsientosContables.SingleAsync(a => a.Id == r.AsientoId);
        // Desempate mensual > anual: el asiento del documento va al subperiodo.
        Assert.Equal(mensual.Id, asiento.PeriodoContableId);
        Assert.NotEqual(anual.Id, asiento.PeriodoContableId);
    }
}
