using Microsoft.EntityFrameworkCore;
using Tyted.API.Data;
using Tyted.API.Models;

namespace Tyted.API.Services;

/// <summary>
/// Servicio de Retenciones de ISLR emitidas (Impuesto Sobre la Renta):
/// - La base imponible y el monto retenido se congelan en Bolívares (Bs.) al
///   momento de emitir, aplicando el porcentaje sobre la base en Bs.
/// - INMUTABILIDAD FISCAL: el monto retenido en Bs. es el valor legal para el
///   SENIAT y NUNCA se recalcula con la tasa del día. El equivalente en USD se
///   guarda sólo como referencia histórica.
/// </summary>
public class RetencionIslrService
{
    private readonly TytedContext _context;

    public RetencionIslrService(TytedContext context)
    {
        _context = context;
    }

    /// <summary>Listado filtrado por empresa y rango del periodo contable activo.</summary>
    public async Task<List<RetencionIslrEmitida>> GetListAsync(int? empresaId = null, DateTime? fechaInicio = null, DateTime? fechaFin = null)
    {
        var query = _context.RetencionesIslrEmitidas.AsNoTracking().AsQueryable();

        if (empresaId.HasValue)
            query = query.Where(r => r.EmpresaId == empresaId.Value);

        if (fechaInicio.HasValue)
            query = query.Where(r => r.FechaRetencion >= fechaInicio.Value);

        if (fechaFin.HasValue)
            query = query.Where(r => r.FechaRetencion < fechaFin.Value.Date.AddDays(1));

        return await query
            .OrderByDescending(r => r.FechaRetencion)
            .ThenByDescending(r => r.Id)
            .ToListAsync();
    }

    /// <summary>
    /// Emite el comprobante de retención de ISLR para un documento de origen.
    /// La base imponible debe venir ya en Bolívares (Bs.); si sólo se recibe en
    /// USD, se convierte con la tasa congelada del documento.
    /// </summary>
    public async Task<RetencionIslrEmitida> EmitirAsync(
        int empresaId,
        decimal baseImponible,
        decimal porcentaje,
        decimal tasaDeCambio,
        int? compraId = null,
        string? proveedorRif = null,
        string? proveedorNombre = null,
        string? numeroFactura = null,
        string? numeroControl = null)
    {
        if (baseImponible <= 0m)
            throw new InvalidOperationException("La base imponible para la retención de ISLR debe ser mayor a cero.");
        if (porcentaje <= 0m || porcentaje > 100m)
            throw new InvalidOperationException("El porcentaje de retención de ISLR debe estar entre 0 (exclusivo) y 100.");

        var tasa = tasaDeCambio > 0 ? tasaDeCambio : 1m;

        Compra? compra = null;
        if (compraId.HasValue)
        {
            compra = await _context.Compras
                .AsNoTracking()
                .Include(c => c.Proveedor)
                .FirstOrDefaultAsync(c => c.Id == compraId.Value);

            if (compra is null)
                throw new InvalidOperationException("La compra origen de la retención de ISLR no existe.");
            if (compra.EmpresaId != empresaId)
                throw new InvalidOperationException("La compra no pertenece a la empresa activa.");
            if (compra.IsAnulada)
                throw new InvalidOperationException("No se emiten retenciones de ISLR sobre compras anuladas.");
        }

        // Monto retenido en Bs.: redondeo comercial AwayFromZero a 2 decimales.
        var montoRetenidoBs = Math.Round(baseImponible * porcentaje / 100m, 2, MidpointRounding.AwayFromZero);

        var fecha = DateTime.Now;
        var retencion = new RetencionIslrEmitida
        {
            EmpresaId = empresaId,
            CompraId = compraId,
            FechaRetencion = fecha,
            NumeroComprobante = await GenerarNumeroComprobanteAsync(empresaId, fecha),
            ProveedorRif = proveedorRif ?? compra?.Proveedor?.RIF ?? string.Empty,
            ProveedorNombre = proveedorNombre ?? compra?.Proveedor?.Razonsocial ?? string.Empty,
            NumeroFactura = numeroFactura ?? compra?.NumeroFactura ?? string.Empty,
            NumeroControl = numeroControl ?? compra?.NumeroControl,
            BaseImponibleBs = baseImponible,
            PorcentajeRetencion = porcentaje,
            MontoRetenidoBs = montoRetenidoBs,
            MontoRetenidoUsd = tasa > 0 ? Math.Round(montoRetenidoBs / tasa, 4, MidpointRounding.AwayFromZero) : montoRetenidoBs,
            TasaDeCambio = tasa,
            Estado = "Emitida"
        };

        _context.RetencionesIslrEmitidas.Add(retencion);
        await _context.SaveChangesAsync();
        return retencion;
    }
    /// <summary>
    /// Número de comprobante SENIAT de ISLR: AAAAMM + 8 dígitos correlativos,
    /// con secuencia por empresa. Reintenta ante condición de carrera.
    /// </summary>
    private async Task<string> GenerarNumeroComprobanteAsync(int empresaId, DateTime fecha)
    {
        var prefijo = fecha.ToString("yyyyMM");

        var existentes = await _context.RetencionesIslrEmitidas
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
            var ocupado = await _context.RetencionesIslrEmitidas
                .AnyAsync(r => r.NumeroComprobante == candidato);
            if (!ocupado) return candidato;
        }

        return string.Format("{0}{1:D8}", prefijo, siguiente);
    }
}
