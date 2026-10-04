using Microsoft.EntityFrameworkCore;
using Tyted.API.Data;
using Tyted.API.Models;

namespace Tyted.API.Services;

public class PeriodoContableService
{
    private readonly TytedContext _context;

    public PeriodoContableService(TytedContext context)
    {
        _context = context;
    }

    public async Task<List<PeriodoContable>> GetPeriodosAsync()
    {
        return await _context.PeriodosContables
            .OrderByDescending(p => p.Anio)
            .ThenByDescending(p => p.Mes)
            .ToListAsync();
    }

    public async Task<PeriodoContable> CrearPeriodoAsync(PeriodoContable periodo)
    {
        if (periodo.Anio <= 0 || periodo.Mes <= 0 || periodo.Mes > 12)
            throw new InvalidOperationException("El periodo contable debe tener un año y mes válidos.");

        periodo.FechaInicio = new DateTime(periodo.Anio, periodo.Mes, 1);
        periodo.FechaFin = new DateTime(periodo.Anio, periodo.Mes, DateTime.DaysInMonth(periodo.Anio, periodo.Mes));

        _context.PeriodosContables.Add(periodo);
        await _context.SaveChangesAsync();
        return periodo;
    }
}
