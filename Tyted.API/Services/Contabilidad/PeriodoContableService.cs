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

    public async Task<List<PeriodoContable>> GetPeriodosAsync(int? empresaId = null)
    {
        var query = _context.PeriodosContables.AsNoTracking().Include(p => p.SubPeriodos).AsQueryable();

        if (empresaId.HasValue)
        {
            query = query.Where(p => p.EmpresaId == empresaId.Value);
        }

        var periodos = await query
            .Where(p => p.TipoPeriodo == "Anual" || p.PeriodoPadreId == null || p.TipoPeriodo == null)
            .OrderByDescending(p => p.Anio)
            .ToListAsync();

        // Ordenar hijos en memoria de forma segura
        foreach (var p in periodos)
        {
            if (p.SubPeriodos != null && p.SubPeriodos.Any())
            {
                p.SubPeriodos = p.SubPeriodos.OrderBy(s => s.Mes).ToList();
            }
        }

        return periodos;
    } 

    public async Task<PeriodoContable?> GetPeriodoActivoAsync(int empresaId)
    {
        var ahora = DateTime.Now;

        var subperiodo = await _context.PeriodosContables
            .Where(p => p.EmpresaId == empresaId && p.Anio == ahora.Year && p.Mes == ahora.Month && p.TipoPeriodo == "Mensual")
            .FirstOrDefaultAsync();

        if (subperiodo is not null) return subperiodo;

        return await _context.PeriodosContables
            .Where(p => p.EmpresaId == empresaId && p.Anio == ahora.Year && p.TipoPeriodo == "Anual")
            .FirstOrDefaultAsync();
    }

    // 1. Crear un periodo individual (valida nulos en Mes de forma segura)
    public async Task<PeriodoContable> CrearPeriodoAsync(PeriodoContable periodo)
    {
        if (periodo.Anio <= 0)
            throw new InvalidOperationException("El año del periodo contable no es válido.");

        var existe = await _context.PeriodosContables.AnyAsync(p => 
            p.EmpresaId == periodo.EmpresaId && 
            p.Anio == periodo.Anio && 
            p.Mes == periodo.Mes && 
            p.TipoPeriodo == periodo.TipoPeriodo);

        if (existe)
            throw new InvalidOperationException("Ya existe un periodo contable registrado con estas especificaciones.");

        int mesValido = periodo.Mes.HasValue && periodo.Mes.Value >= 1 && periodo.Mes.Value <= 12 ? periodo.Mes.Value : 1;

        if (periodo.FechaInicio == default)
        {
            periodo.FechaInicio = periodo.Mes.HasValue 
                ? new DateTime(periodo.Anio, mesValido, 1) 
                : new DateTime(periodo.Anio, 1, 1);
        }

        if (periodo.FechaFin == default)
        {
            periodo.FechaFin = periodo.Mes.HasValue 
                ? new DateTime(periodo.Anio, mesValido, DateTime.DaysInMonth(periodo.Anio, mesValido), 23, 59, 59) 
                : new DateTime(periodo.Anio, 12, 31, 23, 59, 59);
        }

        periodo.Estado = periodo.Cerrado ? "Cerrado" : "Abierto";

        _context.PeriodosContables.Add(periodo);
        await _context.SaveChangesAsync();

        return periodo;
    }

    // 2. Generar Ejercicio Fiscal Anual (Padre) con sus 12 Subperiodos Mensuales (Hijos)
    public async Task<PeriodoContable> CrearEjercicioFiscalCompletoAsync(int empresaId, int anio)
    {
        var existeAnual = await _context.PeriodosContables
            .AnyAsync(p => p.EmpresaId == empresaId && p.Anio == anio && p.TipoPeriodo == "Anual");

        if (existeAnual)
            throw new InvalidOperationException($"El Ejercicio Fiscal {anio} ya se encuentra registrado.");

        var periodoPadre = new PeriodoContable
        {
            EmpresaId = empresaId,
            Anio = anio,
            Mes = null,
            TipoPeriodo = "Anual",
            Nombre = $"Ejercicio Fiscal {anio}",
            FechaInicio = new DateTime(anio, 1, 1),
            FechaFin = new DateTime(anio, 12, 31, 23, 59, 59),
            Estado = "Abierto",
            Cerrado = false
        };

        _context.PeriodosContables.Add(periodoPadre);
        await _context.SaveChangesAsync();

        string[] nombresMeses = { "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre" };

        for (int mes = 1; mes <= 12; mes++)
        {
            var subperiodo = new PeriodoContable
            {
                EmpresaId = empresaId,
                Anio = anio,
                Mes = mes,
                TipoPeriodo = "Mensual",
                PeriodoPadreId = periodoPadre.Id,
                Nombre = $"{nombresMeses[mes - 1]} {anio}",
                FechaInicio = new DateTime(anio, mes, 1),
                FechaFin = new DateTime(anio, mes, DateTime.DaysInMonth(anio, mes), 23, 59, 59),
                Estado = "Abierto",
                Cerrado = false
            };
            _context.PeriodosContables.Add(subperiodo);
        }

        await _context.SaveChangesAsync();
        return periodoPadre;
    }

    // 3. Comprobar si el periodo posee asientos contables vinculados
    public async Task<bool> TieneMovimientosAsync(int periodoId)
    {
        return await _context.AsientosContables
            .AnyAsync(a => a.PeriodoContableId == periodoId);
    }

    // 4. Modificar periodo existente si no tiene movimientos
    public async Task<PeriodoContable> ModificarPeriodoAsync(int periodoId, PeriodoContable periodoDTO)
    {
        var periodo = await _context.PeriodosContables
            .FirstOrDefaultAsync(p => p.Id == periodoId)
            ?? throw new InvalidOperationException("El periodo contable no existe.");

        bool tieneMovimientos = await TieneMovimientosAsync(periodoId);
        if (tieneMovimientos)
            throw new InvalidOperationException("No se puede modificar un periodo que ya posee asientos contables registrados.");

        periodo.Anio = periodoDTO.Anio;
        periodo.Mes = periodoDTO.Mes;
        periodo.Nombre = periodoDTO.Nombre;
        periodo.FechaInicio = periodoDTO.FechaInicio;
        periodo.FechaFin = periodoDTO.FechaFin;
        periodo.TipoPeriodo = periodoDTO.TipoPeriodo ?? periodo.TipoPeriodo;

        await _context.SaveChangesAsync();
        return periodo;
    }

    public async Task<PeriodoContable> CerrarPeriodoAsync(int periodoId, string usuario = "Sistema")
    {
        var periodo = await _context.PeriodosContables
            .Include(p => p.SubPeriodos)
            .FirstOrDefaultAsync(p => p.Id == periodoId)
            ?? throw new InvalidOperationException("El periodo contable no existe.");

        periodo.Cerrado = true;
        periodo.Estado = "Cerrado";
        periodo.FechaCierre = DateTime.Now;
        periodo.UsuarioCierre = usuario;

        if (periodo.TipoPeriodo == "Anual" && periodo.SubPeriodos?.Any() == true)
        {
            foreach (var sub in periodo.SubPeriodos)
            {
                sub.Cerrado = true;
                sub.Estado = "Cerrado";
                sub.FechaCierre = DateTime.Now;
                sub.UsuarioCierre = usuario;
            }
        }

        await _context.SaveChangesAsync();
        return periodo;
    }

    public async Task<PeriodoContable> AbrirPeriodoAsync(int periodoId, string usuario = "Sistema")
    {
        var periodo = await _context.PeriodosContables.FirstOrDefaultAsync(p => p.Id == periodoId)
            ?? throw new InvalidOperationException("El periodo contable no existe.");

        periodo.Cerrado = false;
        periodo.Estado = "Abierto";
        periodo.FechaCierre = null;
        periodo.UsuarioCierre = null;

        await _context.SaveChangesAsync();
        return periodo;
    }
}
