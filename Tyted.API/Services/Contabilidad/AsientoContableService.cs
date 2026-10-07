using Microsoft.EntityFrameworkCore;
using Tyted.API.Data;
using Tyted.API.Models;
using System;
using System.Collections.Generic;
using System.Globalization;
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

    public async Task<List<AsientoContable>> GetAsientosAsync(int? periodoContableId = null, int? empresaId = null)
    {
        var query = _context.AsientosContables
            .Include(a => a.Detalles)
            .ThenInclude(d => d.CuentaContable)
            .AsQueryable();

        if (periodoContableId.HasValue)
        {
            query = query.Where(a => a.PeriodoContableId == periodoContableId.Value);
        }

        if (empresaId.HasValue)
        {
            query = query.Where(a => a.EmpresaId == empresaId.Value);
        }

        return await query
            .OrderByDescending(a => a.FechaComprobante)
            .ToListAsync();
    }

    public async Task<AsientoContable> CrearAsientoAsync(AsientoContable asiento)
    {
        if (asiento.Detalles == null || !asiento.Detalles.Any())
            throw new InvalidOperationException("El asiento debe incluir al menos un detalle.");

        if (asiento.EmpresaId <= 0)
            throw new InvalidOperationException("El asiento no tiene una empresa asignada. Seleccione la empresa activa e intente de nuevo.");

        if (asiento.PeriodoContableId <= 0)
            throw new InvalidOperationException("El asiento no tiene un periodo contable asignado. Seleccione el periodo activo e intente de nuevo.");

        if (string.IsNullOrWhiteSpace(asiento.Concepto))
            throw new InvalidOperationException("El concepto (glosa) del asiento es obligatorio.");

        // 1. Validar existencia y estado del periodo de forma aislada
        var periodo = await _context.PeriodosContables
            .AsNoTracking()
            .FirstOrDefaultAsync(p => p.Id == asiento.PeriodoContableId)
            ?? throw new InvalidOperationException("El periodo contable no existe.");

        if (periodo.EmpresaId != asiento.EmpresaId)
            throw new InvalidOperationException($"El periodo contable seleccionado pertenece a la empresa {periodo.EmpresaId} y no a la empresa activa ({asiento.EmpresaId}). Cambie el periodo o la empresa.");

        if (periodo.Cerrado || string.Equals(periodo.Estado, "Cerrado", StringComparison.OrdinalIgnoreCase))
            throw new InvalidOperationException("No se puede registrar un asiento en un periodo cerrado.");

        if (asiento.FechaComprobante.Date < periodo.FechaInicio.Date || asiento.FechaComprobante.Date > periodo.FechaFin.Date)
            throw new InvalidOperationException("La fecha del asiento debe estar dentro del periodo contable.");

        // 2. Calcular y validar totales de partida doble
        var totalDebe = asiento.Detalles.Sum(d => d.Debe);
        var totalHaber = asiento.Detalles.Sum(d => d.Haber);

        if (Math.Abs((decimal)(totalDebe - totalHaber)) > 0.01m)
            throw new InvalidOperationException("La suma del debe y el haber no coincide.");

        if (totalDebe <= 0)
            throw new InvalidOperationException("El asiento debe tener un monto mayor a cero.");

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

            NormalizarDetalle(detalle);
        }

        // Autogeneración del consecutivo del comprobante con formato YYMM0000001
        // (ej: 26100000001 = primer comprobante de octubre/2026). El frontend envía
        // la cadena vacía en modo creación y conserva el número al editar.
        if (string.IsNullOrWhiteSpace(asiento.NumeroComprobante))
            asiento.NumeroComprobante = await GenerarNumeroComprobanteAsync(asiento.EmpresaId, asiento.FechaComprobante);

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

        if (periodo.EmpresaId != asientoExistente.EmpresaId)
            throw new InvalidOperationException("El periodo contable indicado no pertenece a la empresa de este asiento.");

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

            NormalizarDetalle(detalle);
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

    /// <summary>
    /// Genera el consecutivo del comprobante con el formato solicitado YYMM0000001:
    /// 2 dígitos de año + 2 de mes + secuencia de 7 dígitos (ej: 26100000001).
    /// La secuencia se reinicia cada mes y es independiente por empresa, de modo que
    /// cada compañía mantiene su propia serie contable.
    /// Los comprobantes legados (ej: COMP-261007143055) no alteran la secuencia porque
    /// su sufijo no es numérico.
    /// </summary>
    private async Task<string> GenerarNumeroComprobanteAsync(int empresaId, DateTime fechaComprobante)
    {
        var prefijo = fechaComprobante.ToString("yyMM", CultureInfo.InvariantCulture);

        var existentes = await _context.AsientosContables
            .AsNoTracking()
            .Where(a => a.EmpresaId == empresaId && a.NumeroComprobante.StartsWith(prefijo))
            .Select(a => a.NumeroComprobante)
            .ToListAsync();

        var siguiente = 1;
        foreach (var numero in existentes)
        {
            if (numero.Length <= prefijo.Length) continue;

            if (int.TryParse(numero.AsSpan(prefijo.Length), out var secuencia) && secuencia >= siguiente)
                siguiente = secuencia + 1;
        }

        // Reintento básico ante una condición de carrera (dos usuarios creando en el mismo
        // mes al mismo tiempo): si el candidato ya existe se incrementa la secuencia.
        for (var intento = 0; intento < 50; intento++)
        {
            var candidato = string.Format(CultureInfo.InvariantCulture, "{0}{1:D7}", prefijo, siguiente++);
            var ocupado = await _context.AsientosContables
                .AnyAsync(a => a.EmpresaId == empresaId && a.NumeroComprobante == candidato);
            if (!ocupado) return candidato;
        }

        // Último recurso si el bucle se agota: se devuelve el siguiente número calculado.
        return string.Format(CultureInfo.InvariantCulture, "{0}{1:D7}", prefijo, siguiente);
    }

    /// <summary>
    /// AsientoDetalle.Referencia está limitado a 100 caracteres en la BD.
    /// El frontend envía el concepto completo (hasta 500), así que se recorta
    /// aquí para evitar un error 400/500 proveniente de SQL Server.
    /// </summary>
    private static void NormalizarDetalle(AsientoDetalle detalle)
    {
        detalle.Referencia ??= string.Empty;

        if (detalle.Referencia.Length > 100)
            detalle.Referencia = detalle.Referencia[..100];
    }
}
