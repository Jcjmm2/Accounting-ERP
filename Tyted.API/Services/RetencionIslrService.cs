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
    /// Emite el comprobante de retención de ISLR para un documento de origen
    /// (compra o gasto fiscal; mutuamente excluyentes). La base imponible debe
    /// venir ya en Bolívares (Bs.); si sólo se recibe en USD, se convierte con
    /// la tasa congelada del documento.
    /// </summary>
    public async Task<RetencionIslrEmitida> EmitirAsync(
        int empresaId,
        decimal baseImponible,
        decimal porcentaje,
        decimal tasaDeCambio,
        int? compraId = null,
        int? gastoId = null,
        int? conceptoOperacionalId = null,
        string? proveedorRif = null,
        string? proveedorNombre = null,
        string? numeroFactura = null,
        string? numeroControl = null)
    {
        if (baseImponible <= 0m)
            throw new InvalidOperationException("La base imponible para la retención de ISLR debe ser mayor a cero.");
        if (porcentaje <= 0m || porcentaje > 100m)
            throw new InvalidOperationException("El porcentaje de retención de ISLR debe estar entre 0 (exclusivo) y 100.");
        if (compraId.HasValue && gastoId.HasValue)
            throw new InvalidOperationException(
                "La retención de ISLR no puede asociarse a una compra y a un gasto al mismo tiempo: elija UN documento de origen.");

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

        // Documento de origen GASTO (módulo fiscal): exige proveedor con RIF,
        // porque el sujeto retenido del comprobante y del XML de declaraciones
        // DEBE llevar RIF con formato SENIAT (V/E/J/P/G + 9 dígitos).
        Gasto? gasto = null;
        if (gastoId.HasValue)
        {
            gasto = await _context.Gastos
                .AsNoTracking()
                .Include(g => g.Proveedor)
                .FirstOrDefaultAsync(g => g.Id == gastoId.Value);

            if (gasto is null)
                throw new InvalidOperationException("El gasto origen de la retención de ISLR no existe.");
            if (gasto.EmpresaId != empresaId)
                throw new InvalidOperationException("El gasto no pertenece a la empresa activa.");
            if (gasto.IsAnulada)
                throw new InvalidOperationException("No se emiten retenciones de ISLR sobre gastos anulados.");
            if (string.IsNullOrWhiteSpace(gasto.NumeroFactura))
                throw new InvalidOperationException(
                    "El gasto origen no tiene N° de factura/documento: dato obligatorio del comprobante de retención de ISLR.");
            if (string.IsNullOrWhiteSpace(gasto.Proveedor?.RIF))
                throw new InvalidOperationException(
                    "El gasto origen no tiene proveedor con RIF; el comprobante de retención de ISLR requiere el RIF del sujeto retenido.");
        }

        // Concepto del Decreto 1.808 (si se emitió desde el catálogo).
        ConceptoOperacional? concepto = null;
        if (conceptoOperacionalId.HasValue)
        {
            concepto = await _context.ConceptosOperacionales
                .AsNoTracking()
                .FirstOrDefaultAsync(c => c.Id == conceptoOperacionalId.Value && c.EmpresaId == empresaId);
            if (concepto is null)
                throw new InvalidOperationException("El concepto de retención de ISLR no existe o no pertenece a la empresa.");
        }

        // Decreto 1.808: Monto a retener = (Base Imponible × %) − Sustraendo.
        // El sustraendo sólo aplica a personas naturales residentes (conceptos
        // con AplicaSustraendo). Se usa el sustraendo precalculado del concepto.
        var sustraendo = (concepto?.AplicaSustraendo == true)
            ? (concepto.MontoSustraendoBs ?? 0m)
            : 0m;

        // Redondeo comercial AwayFromZero a 2 decimales; tope en 0 (no hay retención negativa).
        var bruto = baseImponible * porcentaje / 100m;
        var montoRetenidoBs = Math.Max(0m, Math.Round(bruto - sustraendo, 2, MidpointRounding.AwayFromZero));

        var fecha = DateTime.Now;
        var retencion = new RetencionIslrEmitida
        {
            EmpresaId = empresaId,
            CompraId = compraId,
            GastoId = gastoId,
            ConceptoOperacionalId = conceptoOperacionalId,
            CodigoConcepto = concepto?.CodigoSeniat,
            SustraendoBs = sustraendo,
            FechaRetencion = fecha,
            NumeroComprobante = await GenerarNumeroComprobanteAsync(empresaId, fecha),
            // SNAPSHOT del documento origen (lo que declara el XML): proveedor,
            // factura y control del COMPRADO o del GASTO retenido.
            ProveedorRif = proveedorRif ?? compra?.Proveedor?.RIF ?? gasto?.Proveedor?.RIF ?? string.Empty,
            ProveedorNombre = proveedorNombre ?? compra?.Proveedor?.Razonsocial ?? gasto?.Proveedor?.Razonsocial ?? string.Empty,
            NumeroFactura = numeroFactura ?? compra?.NumeroFactura ?? gasto?.NumeroFactura ?? string.Empty,
            NumeroControl = numeroControl ?? compra?.NumeroControl ?? gasto?.NumeroControl,
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
