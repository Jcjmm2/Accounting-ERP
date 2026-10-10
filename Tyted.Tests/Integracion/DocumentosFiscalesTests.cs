using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Diagnostics;
using Tyted.API.Data;
using Tyted.API.Models;
using Tyted.API.Services;

namespace Tyted.Tests.Integracion;

/// <summary>
/// Pruebas de los documentos del módulo FISCAL (Origen='Fiscal'):
/// ventas y compras declarativas SIN efectos en el POS ni en la gestión de
/// inventario (sin stock, sin kardex, sin caja), anulaciones sin reversión de
/// inventario, exclusiones del arqueo y altas de gastos contabilizados.
/// </summary>
public class DocumentosFiscalesTests
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

    /// <summary>Semilla mínima: periodo octubre, producto+unidad y cliente eventual.</summary>
    private static async Task<int> SembrarBaseAsync(TytedContext context, bool incluirPeriodo = true, bool incluirPlanCuentas = false)
    {
        if (incluirPeriodo)
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
        }

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
                });
        }

        context.Clientes.Add(new Cliente { Id = 1, Rif = "V00000000", Nombre = "CLIENTE EVENTUAL" });

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

    private static VentaDetalle LineaVenta(int idUnidad, decimal cantidad = 2m, decimal precio = 10m, decimal tasaIva = 16m) => new()
    {
        CodigoProd = "PROD-1",
        IdProductoUnidad = idUnidad,
        Cantidad = cantidad,
        PrecioUnitarioMonedaBase = precio,
        TasaIVA = tasaIva
    };

    private static CompraDetalle LineaCompra(int idUnidad, decimal cantidad = 3m, decimal costo = 5m, decimal tasaIva = 16m) => new()
    {
        CodigoProd = "PROD-1",
        IdProductoUnidad = idUnidad,
        UnidadCompra = "UND",
        Cantidad = cantidad,
        CostoUnitarioMonedaBase = costo,
        TasaIVA = tasaIva
    };

    [Fact]
    public async Task VentaFiscal_NoTocaStockNiKardex_YRecalculaTotales()
    {
        await using var context = CrearContexto();
        var uid = await SembrarBaseAsync(context);

        var service = new VentaService(context, new CorrelativoService(context));
        var venta = await service.CrearVentaFiscalAsync(new Venta
        {
            EmpresaId = 1,
            ClienteId = 1,
            FechaVenta = new DateTime(2026, 10, 10),
            TipoTransaccion = "01",
            TasaDeCambio = 1m,
            Detalles = new List<VentaDetalle> { LineaVenta(uid) } // 2 × $10 + 16% IVA
        });

        Assert.Equal("Fiscal", venta.Origen);
        Assert.False(string.IsNullOrEmpty(venta.NumeroFactura));
        // Totales recalculados en servidor: 20 base + 3.20 IVA = 23.20
        Assert.Equal(20m, venta.SubtotalMonedaBase);
        Assert.Equal(3.20m, venta.IvaMonedaBase);
        Assert.Equal(23.20m, venta.TotalMonedaBase);

        // SIN efectos de inventario: stock intacto y sin kardex
        var producto = await context.Productos.SingleAsync(p => p.CodigoProd == "PROD-1");
        Assert.Equal(100m, producto.StockActual);
        Assert.Equal(0, await context.InventarioMovimientos.CountAsync());
        Assert.Empty(venta.Pagos ?? new List<VentaPago>()); // sin pagos: no toca arqueo
    }

    [Fact]
    public async Task VentaFiscal_AnulacionSinReversionDeStock()
    {
        await using var context = CrearContexto();
        var uid = await SembrarBaseAsync(context);

        var service = new VentaService(context, new CorrelativoService(context));
        var venta = await service.CrearVentaFiscalAsync(new Venta
        {
            EmpresaId = 1,
            ClienteId = 1,
            Detalles = new List<VentaDetalle> { LineaVenta(uid) }
        });

        var anulada = await service.AnularVentaAsync(venta.VentaId);
        Assert.True(anulada);

        var reloaded = await context.Ventas.SingleAsync(v => v.VentaId == venta.VentaId);
        Assert.True(reloaded.IsAnulada);

        // La venta fiscal nunca descontó stock: la anulación no lo devuelve
        var producto = await context.Productos.SingleAsync(p => p.CodigoProd == "PROD-1");
        Assert.Equal(100m, producto.StockActual);
        Assert.Equal(0, await context.InventarioMovimientos.CountAsync());
    }

    [Fact]
    public async Task ReporteDiario_ExcluyeVentasFiscales()
    {
        await using var context = CrearContexto();
        var uid = await SembrarBaseAsync(context);

        context.CajaSesiones.Add(new CajaSesion
        {
            FechaApertura = DateTime.Now.AddHours(-2),
            MontoAperturaUSD = 50m,
            Usuario = "CAJERO1",
            IsAbierta = true
        });

        // Venta POS directa (origen por defecto)
        context.Ventas.Add(new Venta
        {
            EmpresaId = 1,
            ClienteId = 1,
            FechaVenta = DateTime.Now.AddMinutes(-30),
            NumeroFactura = "000-POS",
            Origen = "POS",
            TotalMonedaBase = 100m,
            TotalMonedaExt = 100m
        });
        await context.SaveChangesAsync();

        // Venta fiscal del módulo (no debe sumar en el arqueo)
        var service = new VentaService(context, new CorrelativoService(context));
        var fiscal = await service.CrearVentaFiscalAsync(new Venta
        {
            EmpresaId = 1,
            ClienteId = 1,
            Detalles = new List<VentaDetalle> { LineaVenta(uid) } // total 23.20
        });

        var reporte = await service.GetReporteDiarioAsync(null);
        Assert.Equal(1, reporte.CantidadVentas);
        Assert.Equal(100m, reporte.TotalVendidoUSD); // sólo la POS
        Assert.Equal("Fiscal", fiscal.Origen);
    }

    [Fact]
    public async Task CompraFiscal_NoTocaStockCostosNiKardex_YAnulacionSinReversion()
    {
        await using var context = CrearContexto();
        var uid = await SembrarBaseAsync(context);

        var service = new CompraService(context);
        var compra = await service.CrearCompraFiscalAsync(new Compra
        {
            EmpresaId = 1,
            CodigoProv = 1,
            FechaCompra = new DateTime(2026, 10, 11),
            NumeroFactura = "F-900",
            TipoMoneda = "USD",
            TasaDeCambio = 1m,
            Detalles = new List<CompraDetalle> { LineaCompra(uid) } // 3 × $5 + 16% IVA
        });

        Assert.Equal("Fiscal", compra.Origen);
        // Totales del calculados en servidor: 15 base + 2.40 IVA = 17.40
        Assert.Equal(15m, compra.SubtotalMonedaBase);
        Assert.Equal(2.40m, compra.IvaMonedaBase);
        Assert.Equal(17.40m, compra.TotalMonedaBase);

        // SIN stock, SIN costos, SIN kardex
        var producto = await context.Productos.SingleAsync(p => p.CodigoProd == "PROD-1");
        Assert.Equal(100m, producto.StockActual);
        Assert.Equal(5m, producto.CostoUnitarioBase);
        Assert.Equal(0, await context.InventarioMovimientos.CountAsync());

        // Anulación fiscal sin reversión de inventario
        await service.AnularCompraAsync(compra.Id);
        var reloaded = await context.Compras.SingleAsync(c => c.Id == compra.Id);
        Assert.True(reloaded.IsAnulada);
        Assert.Equal(100m, producto.StockActual);
        Assert.Equal(0, await context.InventarioMovimientos.CountAsync());
    }

    [Fact]
    public async Task Gasto_CreaYContabilizaBalanceado_EIdempotente()
    {
        await using var context = CrearContexto();
        await SembrarBaseAsync(context, incluirPeriodo: true, incluirPlanCuentas: true);

        var gastoService = new GastoService(context);
        var gasto = await gastoService.CrearGastoAsync(new Gasto
        {
            EmpresaId = 1,
            Fecha = new DateTime(2026, 10, 12),
            Concepto = "Pago de servicios públicos",
            Categoria = "SERVICIO",
            Monto = 100m
        }, usuario: "TESTER");

        Assert.Equal("Fiscal", gasto.Origen);
        Assert.False(gasto.IsAnulada);

        var motor = new MotorAsientosAutomaticos(context, new AsientoContableService(context), new MappingContable());
        var r = await motor.GenerarAsientoGastoAsync(gasto);

        Assert.True(r.Generada);
        Assert.Equal(100m, r.TotalDebe);
        Assert.Equal(100m, r.TotalHaber);

        var asiento = await context.AsientosContables.Include(a => a.Detalles).SingleAsync(a => a.Id == r.AsientoId);
        Assert.Equal(asiento.Detalles.Sum(d => d.Debe), asiento.Detalles.Sum(d => d.Haber));
        // Debe Gastos 5.1.2 | Haber Caja 1.1.1.1.01
        Assert.Equal(2, asiento.Detalles.Count);
        Assert.Equal(gasto.AsientoContableId, r.AsientoId);

        // Idempotencia: segunda contabilización no duplica
        var segundo = await motor.GenerarAsientoGastoAsync(gasto);
        Assert.False(segundo.Generada);
        Assert.Equal(1, await context.AsientosContables.CountAsync());
    }

    [Fact]
    public async Task Gasto_FueraDePeriodoAbierto_SeRechaza()
    {
        await using var context = CrearContexto();
        await SembrarBaseAsync(context); // sólo octubre abierto

        var gastoService = new GastoService(context);
        var ex = await Assert.ThrowsAsync<InvalidOperationException>(() =>
            gastoService.CrearGastoAsync(new Gasto
            {
                EmpresaId = 1,
                Fecha = new DateTime(2026, 11, 5),
                Concepto = "Gasto fuera de periodo",
                Monto = 10m
            }));

        Assert.Contains("periodo contable ABIERTO", ex.Message);
    }

    [Fact]
    public async Task ObtenerFiltradas_FiltroOrigenSeparaPosDeFiscal()
    {
        await using var context = CrearContexto();
        var uid = await SembrarBaseAsync(context);

        context.Ventas.Add(new Venta
        {
            EmpresaId = 1,
            ClienteId = 1,
            FechaVenta = new DateTime(2026, 10, 10),
            NumeroFactura = "000-POS",
            Origen = "POS",
            TotalMonedaBase = 50m
        });
        await context.SaveChangesAsync();

        var service = new VentaService(context, new CorrelativoService(context));
        var fiscal = await service.CrearVentaFiscalAsync(new Venta
        {
            EmpresaId = 1,
            ClienteId = 1,
            Detalles = new List<VentaDetalle> { LineaVenta(uid) }
        });

        var soloPos = (await service.ObtenerFiltradasAsync(empresaId: 1, origen: "POS")).ToList();
        var soloFiscal = (await service.ObtenerFiltradasAsync(empresaId: 1, origen: "Fiscal")).ToList();

        var unicaPos = Assert.Single(soloPos);
        Assert.Equal("POS", unicaPos.Origen);
        var unicaFiscal = Assert.Single(soloFiscal);
        Assert.Equal(fiscal.VentaId, unicaFiscal.VentaId);
    }
}