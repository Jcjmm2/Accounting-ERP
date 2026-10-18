using Microsoft.EntityFrameworkCore;
using Tyted.API.Data;
using Tyted.API.Models;

namespace Tyted.API.Services;

/// <summary>
/// Validación COMPARTIDA de periodo contable para los documentos fiscales
/// (venta, resumen Z, compra, gasto). Regla «fecha ∈ periodo»: el periodo al
/// que afecta un registro lo define su FECHA y sólo puede nacer dentro de un
/// periodo ABIERTO de la empresa (integridad contable para la posterior
/// contabilización y coherencia con los Libros/Reportes, que se filtran por el
/// rango de fechas del periodo).
/// El desempate a igual fecha prefiere el subperiodo MENSUAL sobre el ANUAL
/// (mismo criterio que PeriodoContableService.CerrarPeriodoAsync) de forma
/// determinista (luego por Id), para que el asiento caiga siempre en el
/// periodo que espera el usuario.
/// </summary>
public static class ValidacionPeriodoFiscal
{
    /// <summary>
    /// Periodo ABIERTO de la empresa que contiene la fecha; null si no existe.
    /// A igual fecha se prefiere el subperiodo mensual (desempate determinista).
    /// </summary>
    public static async Task<PeriodoContable?> BuscarPeriodoAbiertoAsync(
        this TytedContext contexto, int empresaId, DateTime fecha)
    {
        var dia = fecha.Date;
        return await contexto.PeriodosContables
            .AsNoTracking()
            .Where(p => p.EmpresaId == empresaId
                && p.FechaInicio.Date <= dia
                && p.FechaFin.Date >= dia
                && !p.Cerrado
                && p.Estado != "Cerrado")
            .OrderBy(p => p.TipoPeriodo == "Mensual" ? 0 : 1)
            .ThenBy(p => p.Id)
            .FirstOrDefaultAsync();
    }

    /// <summary>
    /// Valida que la fecha del documento caiga en un periodo ABIERTO de la
    /// empresa. Lanza InvalidOperationException (→ HTTP 400) con mensaje claro
    /// si no existe tal periodo: sin periodo no se contabilizaría el documento.
    /// </summary>
    public static async Task<PeriodoContable> ValidarPeriodoAbiertoParaDocumentoAsync(
        this TytedContext contexto, int empresaId, DateTime fecha, string documento)
    {
        var periodo = await contexto.BuscarPeriodoAbiertoAsync(empresaId, fecha);
        return periodo ?? throw new InvalidOperationException(
            $"No hay un periodo contable ABIERTO de la empresa {empresaId} que contenga la fecha {fecha:dd/MM/yyyy} del {documento}. " +
            "Cree o abra el periodo contable que va a afectar este registro antes de guardarlo.");
    }
}
