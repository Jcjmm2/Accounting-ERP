using Microsoft.EntityFrameworkCore;
using Tyted.API.Data;
using Tyted.API.Models;

namespace Tyted.API.Services;

public class PlanCuentasService
{
    private readonly TytedContext _context;

    public PlanCuentasService(TytedContext context)
    {
        _context = context;
    }

    public async Task<List<CuentaContable>> GetCuentasAsync()
    {
        return await _context.CuentasContables
            .OrderBy(c => c.CodigoCuenta)
            .ToListAsync();
    }

    public async Task<CuentaContable> CrearCuentaAsync(CuentaContable cuenta)
    {
        if (string.IsNullOrWhiteSpace(cuenta.CodigoCuenta))
            throw new InvalidOperationException("El código de la cuenta es obligatorio.");

        if (string.IsNullOrWhiteSpace(cuenta.NombreCuenta))
            throw new InvalidOperationException("El nombre de la cuenta es obligatorio.");

        if (cuenta.PadreCuentaId.HasValue)
        {
            var padreExiste = await _context.CuentasContables.AnyAsync(c => c.Id == cuenta.PadreCuentaId.Value);
            if (!padreExiste)
                throw new InvalidOperationException("La cuenta padre indicada no existe.");
        }

        _context.CuentasContables.Add(cuenta);
        await _context.SaveChangesAsync();
        return cuenta;
    }
}
