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

        // Concepto operacional (puente con el plan de cuentas): debe ser de la
        // misma empresa y de tipo GASTO. Su CuentaContable define el Debe al
        // contabilizar (fallback a la cuenta global de gastos si no hay concepto).
        if (gasto.ConceptoOperacionalId.HasValue)
        {
            var concepto = await _context.ConceptosOperacionales.FirstOrDefaultAsync(c =>
                c.Id == gasto.ConceptoOperacionalId.Value
                && c.EmpresaId == gasto.EmpresaId
                && c.TipoOperacion == "GASTO");

            if (concepto is null)
                throw new InvalidOperationException(
                    $"El concepto operacional {gasto.ConceptoOperacionalId} no existe, no es de tipo GASTO o no pertenece a la empresa {gasto.EmpresaId}.");

            // Mantiene la columna histórica Categoria en sincronía con el nombre
            // del concepto seleccionado (la tabla de gastos la sigue mostrando).
            if (string.IsNullOrWhiteSpace(gasto.Categoria))
                gasto.Categoria = concepto.NombreConcepto;
        }

        if (gasto.Fecha == default)
            gasto.Fecha = DateHelper.GetVenezuelaTime();

        // DUALIDAD FISCAL (Inmutabilidad Fiscal): el formulario fiscal captura en
        // Bolívares (Bs.) y envía MontoMonedaExt (base) e IvaMonedaExt ya en Bs.;
        // esos valores son la VERDAD FISCAL y NO se recalculan. El Monto (moneda
        // base USD) alimenta el asiento contable; si no viene MontoMonedaExt
        // (datos antiguos), se deriva con la tasa vigente (retrocompatible: sin
        // tasa se asume 1, gasto ya expresado en Bs.).
        var tasa = gasto.TasaDeCambio > 0 ? gasto.TasaDeCambio : 1m;
        gasto.TasaDeCambio = tasa;
        if (gasto.MontoMonedaExt <= 0)
            gasto.MontoMonedaExt = Math.Round(gasto.Monto * tasa, 2, MidpointRounding.AwayFromZero);
        if (gasto.IvaMonedaExt < 0)
            gasto.IvaMonedaExt = 0m;

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