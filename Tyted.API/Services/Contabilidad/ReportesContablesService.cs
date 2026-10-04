using Microsoft.EntityFrameworkCore;
using Tyted.API.Data;

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
}
