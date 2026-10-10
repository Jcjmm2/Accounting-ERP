using Microsoft.EntityFrameworkCore;
using Tyted.API.Data;
using Tyted.API.Models;
using Tyted.API.Services;

namespace Tyted.Tests.Integracion;

/// <summary>
/// Pruebas del servicio de Retenciones de IVA emitidas (plan BE-TAX-201):
/// cálculo 75%/100% sobre el IVA de la factura, número de comprobante oficial
/// SENIAT (AAAAMM + 8 dígitos correlativos por empresa), una sola retención
/// vigente por factura y validaciones de la emisión.
/// </summary>
public class RetencionIvaServiceTests
{
    private static TytedContext CrearContexto()
    {
        var options = new DbContextOptionsBuilder<TytedContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;

        return new TytedContext(options);
    }

    /// <summary>Semilla: proveedor (id 1) + compra de prueba. Idempotente.</summary>
    private static async Task<Compra> SembrarCompraAsync(TytedContext context, int empresaId = 1, decimal iva = 32m, string numeroFactura = "F-000456")
    {
        if (!await context.Proveedores.AnyAsync(p => p.CodigoProv == 1))
        {
            context.Proveedores.Add(new Proveedor
            {
                CodigoProv = 1,
                Razonsocial = "PROVEEDOR DE PRUEBA C.A.",
                RIF = "J-123456789"
            });
        }

        var compra = new Compra
        {
            EmpresaId = empresaId,
            CodigoProv = 1,
            FechaCompra = new DateTime(2026, 10, 9),
            NumeroFactura = numeroFactura,
            NumeroControl = "00-000456",
            TipoMoneda = "USD",
            TasaDeCambio = 1m,
            SubtotalMonedaBase = 200m,
            IvaMonedaBase = iva,
            TotalMonedaBase = 200m + iva
        };
        context.Compras.Add(compra);
        await context.SaveChangesAsync();
        return compra;
    }

    [Fact]
    public async Task Emitir_Calcula75PorCiento_GeneraComprobanteSeniat()
    {
        await using var context = CrearContexto();
        var compra = await SembrarCompraAsync(context);

        var service = new RetencionIvaService(context);
        var r = await service.EmitirAsync(compra.Id, empresaId: 1, porcentaje: 75);

        // IVA 32 → 75% retenido = 24
        Assert.Equal(32m, r.IvaCalculado);
        Assert.Equal(75, r.PorcentajeRetencion);
        Assert.Equal(24m, r.MontoRetenido);
        Assert.Equal("Emitida", r.Estado);

        // Número oficial SENIAT: AAAAMM + 8 dígitos, secuencia 1
        var prefijo = DateTime.Now.ToString("yyyyMM");
        Assert.StartsWith(prefijo, r.NumeroComprobante);
        Assert.Equal(14, r.NumeroComprobante.Length);
        Assert.EndsWith("00000001", r.NumeroComprobante);

        // Datos del proveedor para el TXT (SNAT/2015/0049)
        Assert.Equal("J-123456789", r.ProveedorRif);
        Assert.Equal("F-000456", r.NumeroFactura);
        Assert.Equal(compra.Id, r.CompraId);
    }

    [Fact]
    public async Task Emitir_DosCompras_SecuenciaCorrelativaPorMes()
    {
        await using var context = CrearContexto();
        var compra1 = await SembrarCompraAsync(context, numeroFactura: "F-001");
        var compra2 = await SembrarCompraAsync(context, numeroFactura: "F-002");

        var service = new RetencionIvaService(context);
        var r1 = await service.EmitirAsync(compra1.Id, 1, 100);
        var r2 = await service.EmitirAsync(compra2.Id, 1, 75);

        Assert.EndsWith("00000001", r1.NumeroComprobante);
        Assert.EndsWith("00000002", r2.NumeroComprobante);
        Assert.Equal(32m, r1.MontoRetenido); // 100% del IVA 32
        Assert.Equal(24m, r2.MontoRetenido); // 75% del IVA 32
    }

    [Fact]
    public async Task Emitir_YaRetenida_SeRechaza()
    {
        await using var context = CrearContexto();
        var compra = await SembrarCompraAsync(context);

        var service = new RetencionIvaService(context);
        await service.EmitirAsync(compra.Id, 1, 75);

        var ex = await Assert.ThrowsAsync<InvalidOperationException>(
            () => service.EmitirAsync(compra.Id, 1, 100));
        Assert.Contains("ya tiene", ex.Message);
        Assert.Equal(1, await context.RetencionesIvaEmitidas.CountAsync());
    }

    [Fact]
    public async Task Emitir_PorcentajeInvalido_SeRechaza()
    {
        await using var context = CrearContexto();
        var compra = await SembrarCompraAsync(context);

        var service = new RetencionIvaService(context);
        var ex = await Assert.ThrowsAsync<InvalidOperationException>(
            () => service.EmitirAsync(compra.Id, 1, 85));
        Assert.Contains("75 o 100", ex.Message);
        Assert.Equal(0, await context.RetencionesIvaEmitidas.CountAsync());
    }

    [Fact]
    public async Task Emitir_FacturaSinIva_SeRechaza()
    {
        await using var context = CrearContexto();
        var compra = await SembrarCompraAsync(context, iva: 0m);

        var service = new RetencionIvaService(context);
        var ex = await Assert.ThrowsAsync<InvalidOperationException>(
            () => service.EmitirAsync(compra.Id, 1, 75));
        Assert.Contains("no tiene IVA", ex.Message);
    }

    [Fact]
    public async Task Emitir_CompraDeOtraEmpresa_SeRechaza()
    {
        await using var context = CrearContexto();
        var compra = await SembrarCompraAsync(context);

        var service = new RetencionIvaService(context);
        var ex = await Assert.ThrowsAsync<InvalidOperationException>(
            () => service.EmitirAsync(compra.Id, empresaId: 2, porcentaje: 75));
        Assert.Contains("empresa activa", ex.Message);
    }

    [Fact]
    public async Task GetList_FiltraPorEmpresaYRangoDelPeriodo()
    {
        await using var context = CrearContexto();
        var compra1 = await SembrarCompraAsync(context, numeroFactura: "F-100");
        var compra2 = await SembrarCompraAsync(context, numeroFactura: "F-200");

        var service = new RetencionIvaService(context);
        var r1 = await service.EmitirAsync(compra1.Id, 1, 75);
        var r2 = await service.EmitirAsync(compra2.Id, 1, 75);

        // Se fijan fechas explícitas para no depender del reloj del sistema
        var entidadR1 = await context.RetencionesIvaEmitidas.SingleAsync(x => x.Id == r1.Id);
        entidadR1.FechaRetencion = new DateTime(2026, 10, 15);
        var entidadR2 = await context.RetencionesIvaEmitidas.SingleAsync(x => x.Id == r2.Id);
        entidadR2.FechaRetencion = new DateTime(2026, 11, 5);
        await context.SaveChangesAsync();

        var delPeriodo = await service.GetListAsync(empresaId: 1,
            fechaInicio: new DateTime(2026, 10, 1), fechaFin: new DateTime(2026, 10, 31));
        var unica = Assert.Single(delPeriodo);
        Assert.Equal(r1.Id, unica.Id);

        // Aislamiento por empresa
        var deOtraEmpresa = await service.GetListAsync(empresaId: 2);
        Assert.Empty(deOtraEmpresa);
    }
}