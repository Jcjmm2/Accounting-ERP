using Microsoft.EntityFrameworkCore;
using Tyted.API.Data;
using Tyted.API.Models;

namespace Tyted.API.Services;

public class AsientoContableService
{
    private readonly TytedContext _context;

    public AsientoContableService(TytedContext context)
    {
        _context = context;
    }

    public async Task<List<AsientoContable>> GetAsientosAsync()
    {
        return await _context.AsientosContables
            .Include(a => a.Detalles)
            .ThenInclude(d => d.CuentaContable)
            .OrderByDescending(a => a.FechaComprobante)
            .ToListAsync();
    }

    public async Task<AsientoContable> CrearAsientoAsync(AsientoContable asiento)
    {
        if (asiento.Detalles == null || !asiento.Detalles.Any())
            throw new InvalidOperationException("El asiento debe incluir al menos un detalle.");

        var periodo = await _context.PeriodosContables.FirstOrDefaultAsync(p => p.Id == asiento.PeriodoContableId)
            ?? throw new InvalidOperationException("El periodo contable no existe.");

        if (periodo.Cerrado || string.Equals(periodo.Estado, "Cerrado", StringComparison.OrdinalIgnoreCase))
            throw new InvalidOperationException("No se puede registrar un asiento en un periodo cerrado.");

        if (asiento.FechaComprobante.Date < periodo.FechaInicio.Date || asiento.FechaComprobante.Date > periodo.FechaFin.Date)
            throw new InvalidOperationException("La fecha del asiento debe estar dentro del periodo contable.");

        var totalDebe = asiento.Detalles.Sum(d => d.Debe);
        var totalHaber = asiento.Detalles.Sum(d => d.Haber);

        if (Math.Abs((decimal)(totalDebe - totalHaber)) > 0.01m)
            throw new InvalidOperationException("La suma del debe y el haber no coincide.");

        foreach (var detalle in asiento.Detalles)
        {
            var cuenta = await _context.CuentasContables.FirstOrDefaultAsync(c => c.Id == detalle.CuentaContableId);
            if (cuenta == null)
                throw new InvalidOperationException($"La cuenta {detalle.CuentaContableId} no existe.");

            if (!cuenta.Activa)
                throw new InvalidOperationException($"La cuenta {cuenta.CodigoCuenta} está inactiva.");
        }

        asiento.TotalDebe = totalDebe;
        asiento.TotalHaber = totalHaber;

        _context.AsientosContables.Add(asiento);
        await _context.SaveChangesAsync();

        var usuario = await _context.Usuarios.FindAsync(asiento.UsuarioId);
        _context.AuditoriasContables.Add(new AuditoriaContable
        {
            Fecha = DateTime.Now,
            Usuario = usuario?.Username ?? "Sistema",
            Accion = "Creación de asiento",
            Detalle = $"Se registró el asiento {asiento.NumeroComprobante} con total debe {totalDebe} y haber {totalHaber}",
            AsientoContableId = asiento.Id
        });

        await _context.SaveChangesAsync();
        return asiento;
    }
}
