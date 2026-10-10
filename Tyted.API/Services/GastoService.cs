using Microsoft.EntityFrameworkCore;
using Tyted.API.Data;
using Tyted.API.Helpers;
using Tyted.API.Models;

namespace Tyted.API.Services;

/// <summary>
/// Servicio de GASTOS del módulo fiscal: documentos declarativos con
/// Origen='Fiscal' que NO tocan inventario ni el módulo de compras. Validan
/// empresa, concepto, monto y que la fecha caiga dentro de un periodo
/// contable ABIERTO (integridad contable para su posterior contabilización).
/// </summary>
public class GastoService
{
    private readonly TytedContext _context;

    public GastoService(TytedContext context)
    {
        _context = context;
    }

    /// <summary>Listado filtrado por empresa y rango del periodo contable activo.</summary>
    public async Task<List<Gasto>> GetListAsync(int? empresaId = null, DateTime? fechaInicio = null, DateTime? fechaFin = null)
    {
        var query = _context.Gastos
            .AsNoTracking()
            .Include(g => g.Proveedor)
            .AsQueryable();

        if (empresaId.HasValue)
            query = query.Where(g => g.EmpresaId == empresaId.Value);

        if (fechaInicio.HasValue)
            query = query.Where(g => g.Fecha >= fechaInicio.Value);

        // fechaFin inclusiva por día (mismo criterio que los libros de IVA)
        if (fechaFin.HasValue)
            query = query.Where(g => g.Fecha < fechaFin.Value.Date.AddDays(1));

        return await query.OrderByDescending(g => g.Fecha).ThenByDescending(g => g.Id).ToListAsync();
    }

    /// <summary>Alta de un gasto fiscal (sin inventario ni POS).</summary>
    public async Task<Gasto> CrearGastoAsync(Gasto gasto, string? usuario = null)
    {
        if (string.IsNullOrWhiteSpace(gasto.Concepto))
            throw new InvalidOperationException("El concepto del gasto es obligatorio.");
        if (gasto.Monto <= 0)
            throw new InvalidOperationException("El monto del gasto debe ser mayor a cero.");
        if (gasto.EmpresaId <= 0)
            throw new InvalidOperationException("Indique la empresa a la que pertenece el gasto.");

        if (gasto.Fecha == default)
            gasto.Fecha = DateHelper.GetVenezuelaTime();

        // Integridad contable: la fecha debe caer en un periodo ABIERTO de la empresa
        var dia = gasto.Fecha.Date;
        var hayPeriodoAbierto = await _context.PeriodosContables.AnyAsync(p =>
            p.EmpresaId == gasto.EmpresaId
            && p.FechaInicio.Date <= dia
            && p.FechaFin.Date >= dia
            && !p.Cerrado
            && p.Estado != "Cerrado");

        if (!hayPeriodoAbierto)
            throw new InvalidOperationException(
                $"No hay un periodo contable ABIERTO de la empresa {gasto.EmpresaId} que contenga la fecha {dia:dd/MM/yyyy}.");

        gasto.Origen = "Fiscal";
        gasto.IsAnulada = false;
        gasto.AsientoContableId = null;
        gasto.Usuario = string.IsNullOrWhiteSpace(usuario) ? "FISCAL" : usuario;

        _context.Gastos.Add(gasto);
        await _context.SaveChangesAsync();
        return gasto;
    }
}