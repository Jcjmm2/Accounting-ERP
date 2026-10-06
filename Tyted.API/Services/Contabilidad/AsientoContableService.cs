using Microsoft.EntityFrameworkCore;
using Tyted.API.Data;
using Tyted.API.Models;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;

namespace Tyted.API.Services;

public class AsientoContableService
{
    private readonly TytedContext _context;

    public AsientoContableService(TytedContext context)
    {
        _context = context;
    }

    public async Task<List<AsientoContable>> GetAsientosAsync(int? periodoContableId = null)
    {
        var query = _context.AsientosContables
            .Include(a => a.Detalles)
            .ThenInclude(d => d.CuentaContable)
            .AsQueryable();

        if (periodoContableId.HasValue)
        {
            query = query.Where(a => a.PeriodoContableId == periodoContableId.Value);
        }

        return await query
            .OrderByDescending(a => a.FechaComprobante)
            .ToListAsync();
    }

    public async Task<AsientoContable> CrearAsientoAsync(AsientoContable asiento)
    {
        if (asiento.Detalles == null || !asiento.Detalles.Any())
            throw new InvalidOperationException("El asiento debe incluir al menos un detalle.");

        // 1. Validar existencia y estado del periodo de forma aislada
        var periodo = await _context.PeriodosContables
            .AsNoTracking()
            .FirstOrDefaultAsync(p => p.Id == asiento.PeriodoContableId)
            ?? throw new InvalidOperationException("El periodo contable no existe.");

        if (periodo.Cerrado || string.Equals(periodo.Estado, "Cerrado", StringComparison.OrdinalIgnoreCase))
            throw new InvalidOperationException("No se puede registrar un asiento en un periodo cerrado.");

        if (asiento.FechaComprobante.Date < periodo.FechaInicio.Date || asiento.FechaComprobante.Date > periodo.FechaFin.Date)
            throw new InvalidOperationException("La fecha del asiento debe estar dentro del periodo contable.");

        // 2. Calcular y validar totales de partida doble
        var totalDebe = asiento.Detalles.Sum(d => d.Debe);
        var totalHaber = asiento.Detalles.Sum(d => d.Haber);

        if (Math.Abs((decimal)(totalDebe - totalHaber)) > 0.01m)
            throw new InvalidOperationException("La suma del debe y el haber no coincide.");

        // 3. Validar cada cuenta contable
        foreach (var detalle in asiento.Detalles)
        {
            var cuenta = await _context.CuentasContables
                .AsNoTracking()
                .FirstOrDefaultAsync(c => c.Id == detalle.CuentaContableId);

            if (cuenta == null)
                throw new InvalidOperationException($"La cuenta con ID {detalle.CuentaContableId} no existe.");

            if (!cuenta.Activa)
                throw new InvalidOperationException($"La cuenta {cuenta.CodigoCuenta} está inactiva.");
        }

        asiento.TotalDebe = totalDebe;
        asiento.TotalHaber = totalHaber;

        // 4. Guardar cabecera y detalles utilizando los IDs recibidos
        _context.AsientosContables.Add(asiento);
        await _context.SaveChangesAsync();

        // 5. Registrar auditoría de manera segura
        var usuario = await _context.Usuarios.AsNoTracking().FirstOrDefaultAsync(u => u.Id == asiento.UsuarioId);
        _context.AuditoriasContables.Add(new AuditoriaContable
        {
            Fecha = DateTime.Now,
            Usuario = usuario?.Username ?? "Sistema",
            Accion = "Creación de asiento",
            Detalle = $"Se registró el asiento {asiento.NumeroComprobante} con total debe {totalDebe} y haber {totalHaber}. Tipo: {asiento.TipoComprobante}",
            AsientoContableId = asiento.Id
        });

        await _context.SaveChangesAsync();
        return asiento;
    }

    public async Task<AsientoContable> ActualizarAsientoAsync(int id, AsientoContable asientoActualizado)
    {
        var asientoExistente = await _context.AsientosContables
            .Include(a => a.Detalles)
            .FirstOrDefaultAsync(a => a.Id == id);

        if (asientoExistente == null) return null;

        if (asientoActualizado.Detalles == null || !asientoActualizado.Detalles.Any())
            throw new InvalidOperationException("El asiento modificado debe incluir al menos un detalle.");

        var periodo = await _context.PeriodosContables
            .AsNoTracking()
            .FirstOrDefaultAsync(p => p.Id == asientoActualizado.PeriodoContableId)
            ?? throw new InvalidOperationException("El periodo contable asignado no existe.");

        if (periodo.Cerrado || string.Equals(periodo.Estado, "Cerrado", StringComparison.OrdinalIgnoreCase))
            throw new InvalidOperationException("No se puede modificar un asiento que pertenece a un periodo cerrado.");

        if (asientoActualizado.FechaComprobante.Date < periodo.FechaInicio.Date || asientoActualizado.FechaComprobante.Date > periodo.FechaFin.Date)
            throw new InvalidOperationException("La fecha modificada del asiento debe estar dentro del periodo contable.");

        var totalDebe = asientoActualizado.Detalles.Sum(d => d.Debe);
        var totalHaber = asientoActualizado.Detalles.Sum(d => d.Haber);

        if (Math.Abs((decimal)(totalDebe - totalHaber)) > 0.01m)
            throw new InvalidOperationException("La suma del debe y el haber no coincide en el asiento modificado.");

        foreach (var detalle in asientoActualizado.Detalles)
        {
            var cuenta = await _context.CuentasContables
                .AsNoTracking()
                .FirstOrDefaultAsync(c => c.Id == detalle.CuentaContableId);

            if (cuenta == null) throw new InvalidOperationException($"La cuenta {detalle.CuentaContableId} no existe.");
            if (!cuenta.Activa) throw new InvalidOperationException($"La cuenta {cuenta.CodigoCuenta} está inactiva.");
            
            detalle.CuentaContable = null;
            detalle.AsientoContable = null;
        }

        asientoExistente.Concepto = asientoActualizado.Concepto;
        asientoExistente.FechaComprobante = asientoActualizado.FechaComprobante;
        asientoExistente.TipoComprobante = asientoActualizado.TipoComprobante;
        asientoExistente.TotalDebe = totalDebe;
        asientoExistente.TotalHaber = totalHaber;

        _context.RemoveRange(asientoExistente.Detalles);
        
        foreach (var nuevoDetalle in asientoActualizado.Detalles)
        {
            nuevoDetalle.Id = 0;
            asientoExistente.Detalles.Add(nuevoDetalle);
        }

        var usuario = await _context.Usuarios.AsNoTracking().FirstOrDefaultAsync(u => u.Id == asientoActualizado.UsuarioId);
        _context.AuditoriasContables.Add(new AuditoriaContable
        {
            Fecha = DateTime.Now,
            Usuario = usuario?.Username ?? "Sistema",
            Accion = "Modificación de asiento",
            Detalle = $"Se modificó el asiento {asientoExistente.NumeroComprobante}. Nuevo debe/haber: {totalDebe}. Concepto modificado: {asientoExistente.Concepto}",
            AsientoContableId = asientoExistente.Id
        });

        await _context.SaveChangesAsync();
        return asientoExistente;
    }
}
