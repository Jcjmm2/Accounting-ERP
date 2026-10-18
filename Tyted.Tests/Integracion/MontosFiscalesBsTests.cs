using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Diagnostics;
using Tyted.API.Data;
using Tyted.API.Models;
using Tyted.API.Services;

namespace Tyted.Tests.Integracion;

/// <summary>
/// Pruebas de la conversión del MÓDULO FISCAL a BOLÍVARES (Bs.):
///  - Compra fiscal en modo VES: los costos se capturan en Bs. (verdad fiscal
///    exacta en *MonedaExt) y el libro contable USD se deriva con la tasa.
///  - Gasto fiscal: el formulario envía base e IVA en Bs. (MontoMonedaExt /
///    IvaMonedaExt) que NO se recalculan; el asiento separa IVA Crédito.
///  - Regresión retrocompatible: gastos antiguos sin Bs. siguen derivándose.
/// </summary>
public class MontosFiscalesBsTests
{
    private static TytedContext CrearContexto()
    {
        var options = new DbContextOptionsBuilder<TytedContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .ConfigureWarnings(w => w.Ignore(InMemoryEventId.TransactionIgnoredWarning))
            .Options;

        return new TytedContext(options);
    }

    /// <summary>Semilla mínima: periodo octubre 2026 abierto + producto/unidad.</summary>
    private static async Task<int> SembrarBaseAsync(TytedContext context, bool incluirPlanCuentas = false)
    {
        context.PeriodosContables.Add(new PeriodoContable
        {
            EmpresaId = 1,
            Anio = 2026,
            Mes = 10,
            TipoPeriodo = "Mensual",
            Nombre = "Octubre 2026",
            FechaInicio = new DateTime(2026, 10, 1),
            FechaFin = new DateTime(2026, 10, 31, 23, 59, 59),
            Estado = "Abierto",
            Cerrado = false
        });

        if (incluirPlanCuentas)
        {
            context.CuentasContables.AddRange(
                new CuentaContable
                {
                    EmpresaId = 1, CodigoCuenta = "5.1.2", NombreCuenta = "Gastos",
                    TipoCuenta = "Gasto", Naturaleza = "D", EsMovimiento = true, Nivel = 5, Activa = true
                },
                new CuentaContable
                {
                    EmpresaId = 1, CodigoCuenta = "1.1.1.1.01", NombreCuenta = "Caja General",
                    TipoCuenta = "Activo", Naturaleza = "D", EsMovimiento = true, Nivel = 5, Activa = true
                },
                new CuentaContable
                {
                    EmpresaId = 1, CodigoCuenta = "1.1.5.02", NombreCuenta = "IVA Crédito Fiscal",
                    TipoCuenta = "Activo", Naturaleza = "D", EsMovimiento = true, Nivel = 5, Activa = true
                });
        }

        context.Productos.Add(new Producto
        {
            CodigoProd = "PROD-1",
            IdCategoria = 1,
            IdTasaIVA = 1,
            CodigoProv = 1,
            Descripcion = "PRODUCTO DE PRUEBA",
            TipoArt = "Bien",
            CostoUnitarioBase = 5m,
            StockActual = 100m,
            StockMinimo = 1m
        });

        context.ProductosUnidad.Add(new ProductosUnidad
        {
            CodigoProd = "PROD-1",
            IdUnidad = 1,
            NombreUnidad = "UND",
            CantidadEquivalente = 1m,
            CostoUnitarioMonedaBase = 5m,
            PrecioMonedaBase = 10m
        });

        await context.SaveChangesAsync();
        return await context.ProductosUnidad
            .Where(u => u.CodigoProd == "PROD-1")
            .Select(u => u.IdProductoUnidad)
            .FirstAsync();
    }

    [Fact]
    public async Task CompraFiscal_EnBolivares_BsExactosYUsdDerivado()
    {
        await using var context = CrearContexto();
        var uid = await SembrarBaseAsync(context);

        var service = new CompraService(context);
        var compra = await service.CrearCompraFiscalAsync(new Compra
        {
            EmpresaId = 1,
            CodigoProv = 1,
            FechaCompra = new DateTime(2026, 10, 10),
            NumeroFactura = "F-100",
            NumeroControl = "00-00099988",
            TipoTransaccion = "01",
            TipoMoneda = "VES",
            TasaDeCambio = 40m,
            Detalles = new List<CompraDetalle>
            {
                new()
                {
                    CodigoProd = "PROD-1",
                    IdProductoUnidad = uid,
                    UnidadCompra = "UND",
                    Cantidad = 2m,
                    CostoUnitarioMonedaExt = 1111.11m, // Bs. digitados por el usuario
                    TasaIVA = 16m
                }
            }
        });

        // Verdad fiscal: los Bs. digitados quedan EXACTOS en *MonedaExt.
        Assert.Equal(2222.22m, compra.SubtotalMonedaExt);
        Assert.Equal(355.56m, compra.IvaMonedaExt);
        Assert.Equal(2577.78m, compra.TotalMonedaExt);

        // Libro contable (USD) derivado con la tasa.
        Assert.Equal(55.56m, compra.SubtotalMonedaBase);
        Assert.Equal(8.89m, compra.IvaMonedaBase);

        var detalle = compra.Detalles.First();
        Assert.Equal(1111.11m, detalle.CostoUnitarioMonedaExt);
        Assert.Equal(2222.22m, detalle.SubtotalLineaMonedaExt);
        Assert.Equal(355.56m, detalle.IvaLineaMonedaExt);
        Assert.Equal(2577.78m, detalle.TotalLineaMonedaExt);
    }

    [Fact]
    public async Task CrearGasto_EnviaVerdadFiscalEnBs_NoSeRecalcula()
    {
        await using var context = CrearContexto();
        await SembrarBaseAsync(context);

        var gastoService = new GastoService(context);
        var gasto = await gastoService.CrearGastoAsync(new Gasto
        {
            EmpresaId = 1,
            Fecha = new DateTime(2026, 10, 12),
            Concepto = "Alquiler del local (Bs.)",
            NumeroFactura = "REC-001",
            NumeroControl = "S/N",
            Monto = 30.86m,            // USD derivado (1234.56 / 40) p/ el asiento
            TasaDeCambio = 40m,
            MontoMonedaExt = 1234.56m, // Bs. digitados: VERDAD FISCAL
            IvaMonedaExt = 197.53m
        });

        // Los Bs. enviados por el formulario se respetan tal cual (no se
        // recalcula Monto × tasa, que habría dado 1234.40).
        Assert.Equal(1234.56m, gasto.MontoMonedaExt);
        Assert.Equal(197.53m, gasto.IvaMonedaExt);
        Assert.Equal(30.86m, gasto.Monto);
        Assert.Equal(40m, gasto.TasaDeCambio);
        Assert.Equal("Fiscal", gasto.Origen);
    }

    [Fact]
    public async Task CrearGasto_SinBsNiTasa_DerivaRetrocompatible()
    {
        await using var context = CrearContexto();
        await SembrarBaseAsync(context);

        var gastoService = new GastoService(context);
        // Datos antiguos: sin tasa ni monto en Bs. → tasa 1 y Bs = monto.
        var gasto = await gastoService.CrearGastoAsync(new Gasto
        {
            EmpresaId = 1,
            Fecha = new DateTime(2026, 10, 12),
            Concepto = "Gasto histórico",
            NumeroFactura = "DOC-HIST",
            NumeroControl = "S/N",
            Monto = 100m
        });

        Assert.Equal(1m, gasto.TasaDeCambio);
        Assert.Equal(100m, gasto.MontoMonedaExt);
    }

    [Fact]
    public async Task GenerarAsientoGasto_ConIva_DebitaIvaCreditoFiscal()
    {
        await using var context = CrearContexto();
        await SembrarBaseAsync(context, incluirPlanCuentas: true);

        var gastoService = new GastoService(context);
        var gasto = await gastoService.CrearGastoAsync(new Gasto
        {
            EmpresaId = 1,
            Fecha = new DateTime(2026, 10, 12),
            Concepto = "Servicio profesional con IVA 16%",
            NumeroFactura = "F-SP-1",
            NumeroControl = "00-00055544",
            Monto = 100m,           // base USD (4000 Bs. / 40)
            TasaDeCambio = 40m,
            MontoMonedaExt = 4000m, // base Bs.
            IvaMonedaExt = 640m     // IVA Bs. (16%)
        });

        var motor = new MotorAsientosAutomaticos(context, new AsientoContableService(context), new MappingContable());
        var r = await motor.GenerarAsientoGastoAsync(gasto);

        Assert.True(r.Generada);
        // MONEDA DEL COMPROBANTE: BOLÍVARES (moneda legal del libro contable).
        // Debe Gastos 4000 Bs. + Debe IVA Crédito 640 Bs. | Haber Caja 4640 Bs.
        Assert.Equal(4640m, r.TotalDebe);
        Assert.Equal(4640m, r.TotalHaber);

        var asiento = await context.AsientosContables
            .Include(a => a.Detalles)
            .ThenInclude(d => d.CuentaContable)
            .SingleAsync(a => a.Id == r.AsientoId);

        Assert.Equal(3, asiento.Detalles.Count);
        Assert.Equal(asiento.Detalles.Sum(d => d.Debe), asiento.Detalles.Sum(d => d.Haber));
        Assert.Contains(asiento.Detalles,
            d => d.CuentaContable.CodigoCuenta == "1.1.5.02" && d.Debe == 640m);
        Assert.Contains(asiento.Detalles, d => d.Haber == 4640m);
    }
}
