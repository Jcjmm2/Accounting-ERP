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

    /// <summary>
    /// Balance de comprobación de un periodo con la información que espera el frontend:
    /// saldo inicial, movimiento del debe/haber y saldo final de cada cuenta.
    /// Reglas aplicadas:
    /// - Solo la empresa a la que pertenece el periodo seleccionado.
    /// - El corte de fechas usa el rango del periodo (FechaInicio .. FechaFin), por lo que
    ///   un periodo anual (padre) también consolidan los asientos de sus subperiodos.
    /// - Saldo inicial = movimientos anteriores al inicio del periodo.
    /// - Saldo final se expresa con el signo natural de la cuenta (D:Debe-Haber, C:Haber-Debe).
    /// </summary>
    public async Task<List<BalanceComprobacionDto>> GetBalanceComprobacionAsync(int periodoId)
    {
        var periodo = await _context.PeriodosContables
            .AsNoTracking()
            .FirstOrDefaultAsync(p => p.Id == periodoId)
            ?? throw new InvalidOperationException("El periodo contable no existe.");

        var empresaId = periodo.EmpresaId;
        var fechaInicio = periodo.FechaInicio.Date;
        // Se suma un día para cubrir asientos con hora dentro del último día del periodo.
        var fechaFinExclusiva = periodo.FechaFin.Date.AddDays(1);

        var movimientosAnteriores = await _context.AsientosDetalles
            .AsNoTracking()
            .Where(d => d.AsientoContable!.EmpresaId == empresaId
                        && d.AsientoContable.FechaComprobante < fechaInicio)
            .GroupBy(d => d.CuentaContableId)
            .Select(g => new { CuentaId = g.Key, Debe = g.Sum(x => x.Debe), Haber = g.Sum(x => x.Haber) })
            .ToListAsync();

        var movimientosPeriodo = await _context.AsientosDetalles
            .AsNoTracking()
            .Where(d => d.AsientoContable!.EmpresaId == empresaId
                        && d.AsientoContable.FechaComprobante >= fechaInicio
                        && d.AsientoContable.FechaComprobante < fechaFinExclusiva)
            .GroupBy(d => d.CuentaContableId)
            .Select(g => new { CuentaId = g.Key, Debe = g.Sum(x => x.Debe), Haber = g.Sum(x => x.Haber) })
            .ToListAsync();

        var cuentas = await _context.CuentasContables
            .AsNoTracking()
            .Where(c => c.EmpresaId == empresaId)
            .ToListAsync();

        var anterioresPorCuenta = movimientosAnteriores.ToDictionary(x => x.CuentaId, x => x);
        var periodoPorCuenta = movimientosPeriodo.ToDictionary(x => x.CuentaId, x => x);

        var resultado = new List<BalanceComprobacionDto>();

        foreach (var cuenta in cuentas.OrderBy(c => c.CodigoCuenta))
        {
            anterioresPorCuenta.TryGetValue(cuenta.Id, out var anterior);
            periodoPorCuenta.TryGetValue(cuenta.Id, out var movimiento);

            var debeAnterior = anterior?.Debe ?? 0m;
            var haberAnterior = anterior?.Haber ?? 0m;
            var debePeriodo = movimiento?.Debe ?? 0m;
            var haberPeriodo = movimiento?.Haber ?? 0m;

            var esDeudora = string.Equals(cuenta.Naturaleza, "D", StringComparison.OrdinalIgnoreCase);
            var saldoInicial = esDeudora ? debeAnterior - haberAnterior : haberAnterior - debeAnterior;
            var saldoFinal = esDeudora
                ? saldoInicial + debePeriodo - haberPeriodo
                : saldoInicial + haberPeriodo - debePeriodo;

            // Solo se listan cuentas con saldo o con movimiento en el periodo.
            if (saldoInicial == 0m && debePeriodo == 0m && haberPeriodo == 0m)
                continue;

            resultado.Add(new BalanceComprobacionDto
            {
                CuentaId = cuenta.Id,
                CodigoCuenta = cuenta.CodigoCuenta,
                NombreCuenta = cuenta.NombreCuenta,
                Naturaleza = cuenta.Naturaleza,
                TipoCuenta = cuenta.TipoCuenta,
                SaldoInicial = saldoInicial,
                MovimientoDebe = debePeriodo,
                MovimientoHaber = haberPeriodo,
                // TotalDebe/TotalHaber se mantienen por compatibilidad con clientes existentes
                // (equivale al movimiento del periodo).
                TotalDebe = debePeriodo,
                TotalHaber = haberPeriodo,
                SaldoFinal = saldoFinal
            });
        }

        return resultado;
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
    /// <summary>Tipo de cuenta (Activo, Pasivo, Patrimonio, Ingreso, Gasto) usado para clasificar los reportes.</summary>
    public string TipoCuenta { get; set; } = string.Empty;
    /// <summary>Saldo al cierre del periodo anterior, expresado con el signo natural de la cuenta.</summary>
    public decimal SaldoInicial { get; set; }
    /// <summary>Suma del Debe generada dentro del periodo.</summary>
    public decimal MovimientoDebe { get; set; }
    /// <summary>Suma del Haber generada dentro del periodo.</summary>
    public decimal MovimientoHaber { get; set; }
    /// <summary>Alias del movimiento del debe, conservado por compatibilidad con consumidores existentes.</summary>
    public decimal TotalDebe { get; set; }
    /// <summary>Alias del movimiento del haber, conservado por compatibilidad con consumidores existentes.</summary>
    public decimal TotalHaber { get; set; }
    /// <summary>Saldo al cierre del periodo, expresado con el signo natural de la cuenta.</summary>
    public decimal SaldoFinal { get; set; }
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
