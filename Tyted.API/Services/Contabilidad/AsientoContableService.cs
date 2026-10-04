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

        var totalDebe = asiento.Detalles.Sum(d => d.Debe);
        var totalHaber = asiento.Detalles.Sum(d => d.Haber);

        if (Math.Abs((decimal)(totalDebe - totalHaber)) > 0.01m)
            throw new InvalidOperationException("La suma del debe y el haber no coincide.");

        foreach (var detalle in asiento.Detalles)
        {
            var cuentaExiste = await _context.CuentasContables.AnyAsync(c => c.Id == detalle.CuentaContableId);
            if (!cuentaExiste)
                throw new InvalidOperationException($"La cuenta {detalle.CuentaContableId} no existe.");
        }

        asiento.TotalDebe = totalDebe;
        asiento.TotalHaber = totalHaber;

        _context.AsientosContables.Add(asiento);
        await _context.SaveChangesAsync();
        return asiento;
    }
}
