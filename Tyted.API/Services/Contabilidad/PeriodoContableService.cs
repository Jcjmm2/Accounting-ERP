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

        var existe = await _context.PeriodosContables.AnyAsync(p => p.EmpresaId == periodo.EmpresaId && p.Anio == periodo.Anio && p.Mes == periodo.Mes);
        if (existe)
            throw new InvalidOperationException("Ya existe un periodo contable para ese año y mes.");

        periodo.FechaInicio = new DateTime(periodo.Anio, periodo.Mes, 1);
        periodo.FechaFin = new DateTime(periodo.Anio, periodo.Mes, DateTime.DaysInMonth(periodo.Anio, periodo.Mes));
        periodo.Estado = periodo.Cerrado ? "Cerrado" : "Abierto";

        _context.PeriodosContables.Add(periodo);
        await _context.SaveChangesAsync();

        await RegistrarAuditoriaAsync("Creación de periodo", $"Se creó el período {periodo.Mes}/{periodo.Anio}", null, "Sistema");
        return periodo;
    }

    public async Task<PeriodoContable> CerrarPeriodoAsync(int periodoId, string usuario = "Sistema")
    {
        var periodo = await _context.PeriodosContables.FirstOrDefaultAsync(p => p.Id == periodoId)
            ?? throw new InvalidOperationException("El periodo contable no existe.");

        periodo.Cerrado = true;
        periodo.Estado = "Cerrado";
        periodo.FechaCierre = DateTime.Now;
        periodo.UsuarioCierre = usuario;

        await _context.SaveChangesAsync();
        await RegistrarAuditoriaAsync("Cierre de periodo", $"Se cerró el período {periodo.Mes}/{periodo.Anio}", periodo.Id, usuario);
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
        await RegistrarAuditoriaAsync("Apertura de periodo", $"Se reabrió el período {periodo.Mes}/{periodo.Anio}", periodo.Id, usuario);
        return periodo;
    }

    private async Task RegistrarAuditoriaAsync(string accion, string detalle, int? asientoId, string usuario)
    {
        _context.AuditoriasContables.Add(new AuditoriaContable
        {
            Fecha = DateTime.Now,
            Usuario = usuario,
            Accion = accion,
            Detalle = detalle,
            AsientoContableId = asientoId
        });

        await _context.SaveChangesAsync();
    }
}
