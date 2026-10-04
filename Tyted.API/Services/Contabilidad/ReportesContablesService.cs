using Microsoft.EntityFrameworkCore;
using Tyted.API.Data;
using Tyted.API.Models;

namespace Tyted.API.Services;

public class ReportesContablesService
{
    private readonly TytedContext _context;

    public ReportesContablesService(TytedContext context)
    {
        _context = context;
    }

    public async Task<object> GetResumenAsync()
    {
        var cuentas = await _context.CuentasContables.CountAsync();
        var asientos = await _context.AsientosContables.CountAsync();
        var totalDebe = await _context.AsientosDetalles.SumAsync(d => (decimal?)d.Debe) ?? 0m;
        var totalHaber = await _context.AsientosDetalles.SumAsync(d => (decimal?)d.Haber) ?? 0m;

        return new
        {
            cuentas,
            asientos,
            totalDebe,
            totalHaber,
            diferencia = totalDebe - totalHaber
        };
    }

    public async Task<List<BalanceComprobacionDto>> GetBalanceComprobacionAsync(int periodoId)
    {
        var query = await _context.AsientosDetalles
            .Include(d => d.CuentaContable)
            .Where(d => d.AsientoContable!.PeriodoContableId == periodoId)
            .GroupBy(d => new { d.CuentaContableId, d.CuentaContable!.CodigoCuenta, d.CuentaContable.NombreCuenta, d.CuentaContable.Naturaleza })
            .Select(g => new BalanceComprobacionDto
            {
                CuentaId = g.Key.CuentaContableId,
                CodigoCuenta = g.Key.CodigoCuenta,
                NombreCuenta = g.Key.NombreCuenta,
                Naturaleza = g.Key.Naturaleza,
                TotalDebe = g.Sum(x => x.Debe),
                TotalHaber = g.Sum(x => x.Haber)
            })
            .OrderBy(x => x.CodigoCuenta)
            .ToListAsync();

        return query;
    }

    public async Task<List<LibroMayorDto>> GetLibroMayorAsync(int cuentaId, DateTime? fechaInicio = null, DateTime? fechaFin = null)
    {
        var query = _context.AsientosDetalles
            .Include(d => d.AsientoContable)
            .Include(d => d.CuentaContable)
            .Where(d => d.CuentaContableId == cuentaId);

        if (fechaInicio.HasValue)
            query = query.Where(d => d.AsientoContable!.FechaComprobante >= fechaInicio.Value);

        if (fechaFin.HasValue)
            query = query.Where(d => d.AsientoContable!.FechaComprobante <= fechaFin.Value);

        return await query
            .OrderBy(d => d.AsientoContable!.FechaComprobante)
            .ThenBy(d => d.Id)
            .Select(d => new LibroMayorDto
            {
                AsientoId = d.AsientoContableId,
                NumeroComprobante = d.AsientoContable!.NumeroComprobante,
                FechaComprobante = d.AsientoContable.FechaComprobante,
                Concepto = d.AsientoContable.Concepto,
                CuentaId = d.CuentaContableId,
                CodigoCuenta = d.CuentaContable!.CodigoCuenta,
                NombreCuenta = d.CuentaContable.NombreCuenta,
                Debe = d.Debe,
                Haber = d.Haber
            })
            .ToListAsync();
    }
}

public class BalanceComprobacionDto
{
    public int CuentaId { get; set; }
    public string CodigoCuenta { get; set; } = string.Empty;
    public string NombreCuenta { get; set; } = string.Empty;
    public string Naturaleza { get; set; } = string.Empty;
    public decimal TotalDebe { get; set; }
    public decimal TotalHaber { get; set; }
}

public class LibroMayorDto
{
    public int AsientoId { get; set; }
    public string NumeroComprobante { get; set; } = string.Empty;
    public DateTime FechaComprobante { get; set; }
    public string Concepto { get; set; } = string.Empty;
    public int CuentaId { get; set; }
    public string CodigoCuenta { get; set; } = string.Empty;
    public string NombreCuenta { get; set; } = string.Empty;
    public decimal Debe { get; set; }
    public decimal Haber { get; set; }
}
