using Microsoft.EntityFrameworkCore;
using Tyted.API.Data;
using Tyted.API.Models;

namespace Tyted.API.Services;

/// <summary>
/// Servicio de Retenciones de IVA emitidas al proveedor (plan BE-TAX-201):
/// - Cálculo del porcentaje de retención (75% o 100%) sobre el IVA de la factura.
/// - Generación del número de comprobante oficial SENIAT AAAAMM + 8 dígitos
///   correlativos por empresa (contribuyente), con reintento ante condiciones
///   de carrera para evitar duplicidad de números.
/// - Control: una sola retención vigente por factura (compra).
/// </summary>
public class RetencionIvaService
{
    private readonly TytedContext _context;

    public RetencionIvaService(TytedContext context)
    {
        _context = context;
    }

    /// <summary>Listado filtrado por empresa y rango del periodo contable activo.</summary>
    public async Task<List<RetencionIvaEmitida>> GetListAsync(int? empresaId = null, DateTime? fechaInicio = null, DateTime? fechaFin = null)
    {
        var query = _context.RetencionesIvaEmitidas.AsNoTracking().AsQueryable();

        if (empresaId.HasValue)
            query = query.Where(r => r.EmpresaId == empresaId.Value);

        if (fechaInicio.HasValue)
            query = query.Where(r => r.FechaRetencion >= fechaInicio.Value);

        // fechaFin inclusiva por día (mismo criterio que los libros de IVA)
        if (fechaFin.HasValue)
            query = query.Where(r => r.FechaRetencion < fechaFin.Value.Date.AddDays(1));

        return await query
            .OrderByDescending(r => r.FechaRetencion)
            .ThenByDescending(r => r.Id)
            .ToListAsync();
    }

    /// <summary>
    /// Emite el comprobante de retención del IVA de una factura de compra.
    /// Valida: empresa activa, compra no anulada, porcentaje 75/100, IVA &gt; 0
    /// y que la factura no tenga ya una retención vigente.
    /// </summary>
    public async Task<RetencionIvaEmitida> EmitirAsync(int compraId, int empresaId, int porcentaje)
    {
        if (porcentaje != 75 && porcentaje != 100)
            throw new InvalidOperationException("El porcentaje de retención de IVA debe ser 75 o 100.");

        var compra = await _context.Compras
            .AsNoTracking()
            .Include(c => c.Proveedor)
            .FirstOrDefaultAsync(c => c.Id == compraId)
            ?? throw new InvalidOperationException("La compra no existe.");

        if (compra.EmpresaId != empresaId)
            throw new InvalidOperationException("La compra no pertenece a la empresa activa.");

        if (compra.IsAnulada)
            throw new InvalidOperationException("No se emiten comprobantes de retención sobre compras anuladas.");

        var yaExiste = await _context.RetencionesIvaEmitidas
            .AnyAsync(r => r.CompraId == compraId && r.Estado == "Emitida");
        if (yaExiste)
            throw new InvalidOperationException("La compra ya tiene un comprobante de retención de IVA emitido (una sola retención vigente por factura).");

        var iva = compra.IvaMonedaBase;
        if (iva <= 0m)
            throw new InvalidOperationException("La factura no tiene IVA: no hay retención que emitir.");

        var fecha = DateTime.Now;
        var retencion = new RetencionIvaEmitida
        {
            EmpresaId = empresaId,
            CompraId = compra.Id,
            FechaRetencion = fecha,
            NumeroComprobante = await GenerarNumeroComprobanteAsync(empresaId, fecha),
            ProveedorRif = compra.Proveedor?.RIF ?? string.Empty,
            ProveedorNombre = compra.Proveedor?.Razonsocial ?? string.Empty,
            NumeroFactura = compra.NumeroFactura ?? string.Empty,
            NumeroControl = compra.NumeroControl,
            MontoFactura = compra.TotalMonedaBase,
            BaseImponible = compra.SubtotalMonedaBase,
            IvaCalculado = iva,
            PorcentajeRetencion = porcentaje,
            MontoRetenido = Math.Round(iva * porcentaje / 100m, 2),
            Estado = "Emitida"
        };

        _context.RetencionesIvaEmitidas.Add(retencion);
        await _context.SaveChangesAsync();
        return retencion;
    }

    /// <summary>
    /// Número de comprobante oficial SENIAT: AAAAMM + 8 dígitos correlativos
    /// (ej: 20261000000804), con secuencia por empresa. Reintenta ante la
    /// condición de carrera de dos emisiones concurrentes en el mismo mes.
    /// </summary>
    private async Task<string> GenerarNumeroComprobanteAsync(int empresaId, DateTime fecha)
    {
        var prefijo = fecha.ToString("yyyyMM");

        var existentes = await _context.RetencionesIvaEmitidas
            .AsNoTracking()
            .Where(r => r.EmpresaId == empresaId && r.NumeroComprobante.StartsWith(prefijo))
            .Select(r => r.NumeroComprobante)
            .ToListAsync();

        var siguiente = 1;
        foreach (var numero in existentes)
        {
            if (numero.Length <= prefijo.Length) continue;
            if (int.TryParse(numero.AsSpan(prefijo.Length), out var secuencia) && secuencia >= siguiente)
                siguiente = secuencia + 1;
        }

        for (var intento = 0; intento < 50; intento++)
        {
            var candidato = string.Format("{0}{1:D8}", prefijo, siguiente++);
            var ocupado = await _context.RetencionesIvaEmitidas
                .AnyAsync(r => r.NumeroComprobante == candidato);
            if (!ocupado) return candidato;
        }

        return string.Format("{0}{1:D8}", prefijo, siguiente);
    }
}