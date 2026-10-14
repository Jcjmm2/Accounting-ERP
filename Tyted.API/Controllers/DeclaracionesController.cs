using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Tyted.API.Data;
using Tyted.API.Models;
using Tyted.API.Services;

namespace Tyted.API.Controllers;

/// <summary>
/// API de DECLARACIONES SENIAT (Fase 5): genera los archivos que se cargan en
/// el Portal Fiscal. El formato vive en el backend (DeclaracionesSeniatService)
/// para usar decimal exacto, culture explícita y validación de cada campo.
/// </summary>
[Route("api/declaraciones")]
[ApiController]
[Authorize(Roles = "AdministradorSistema,Administrador,Analista,Comprador")]
public class DeclaracionesController : ControllerBase
{
    private readonly TytedContext _context;
    private readonly EmpresaAccessService _access;

    public DeclaracionesController(TytedContext context, EmpresaAccessService access)
    {
        _context = context;
        _access = access;
    }

    /// <summary>
    /// TXT de Retenciones de IVA de una quincena (Forma 99035): 16 columnas
    /// A-P separadas por TABULADOR. Se declara incluso sin retenciones (pago
    /// cero, art. 15 Providencia SNAT/2025/000054): el archivo sale sin
    /// líneas de detalle.
    /// </summary>
    [HttpGet("iva-txt")]
    public async Task<IActionResult> GetTxtIva(
        [FromQuery] int empresaId,
        [FromQuery] int anio,
        [FromQuery] int mes,
        [FromQuery] int quincena)
    {
        var error = ValidarPeriodo(empresaId, anio, mes);
        if (error != null) return BadRequest(new { message = error });
        if (quincena is not (1 or 2))
            return BadRequest(new { message = "La quincena debe ser 1 (días 1-15) o 2 (días 16-fin de mes)." });

        // AISLAMIENTO POR EMPRESA
        await _access.ValidarAccesoAsync(User, empresaId);
        var empresa = await _context.Empresa.FindAsync(empresaId);
        if (empresa == null) return NotFound();

        var (fechaInicio, fechaFin) = DeclaracionesSeniatService.RangoQuincena(anio, mes, quincena);
        var retenciones = await _context.RetencionesIvaEmitidas
            .AsNoTracking()
            .Include(r => r.Compra)
            .Where(r => r.EmpresaId == empresaId
                && r.Estado == "Emitida"
                && r.FechaRetencion >= fechaInicio
                && r.FechaRetencion <= fechaFin)
            .OrderBy(r => r.NumeroComprobante)
            .ToListAsync();

        try
        {
            var (contenido, nombre) = DeclaracionesSeniatService.GenerarTxtIva(empresa, retenciones, anio, mes, quincena);
            return File(contenido, "text/plain", nombre);
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    /// <summary>
    /// XML de Retenciones de ISLR del mes (Manual Técnico SENIAT v2.3,
    /// esquema 4.1). La base imponible va ENTERA: el sustraendo del Decreto
    /// 1.808 lo aplica automáticamente el Portal Fiscal.
    /// </summary>
    [HttpGet("islr-xml")]
    public async Task<IActionResult> GetXmlIslr(
        [FromQuery] int empresaId,
        [FromQuery] int anio,
        [FromQuery] int mes)
    {
        var error = ValidarPeriodo(empresaId, anio, mes);
        if (error != null) return BadRequest(new { message = error });

        await _access.ValidarAccesoAsync(User, empresaId);
        var empresa = await _context.Empresa.FindAsync(empresaId);
        if (empresa == null) return NotFound();

        var fechaInicio = new DateTime(anio, mes, 1);
        var fechaFin = new DateTime(anio, mes, DateTime.DaysInMonth(anio, mes), 23, 59, 59);

        var retenciones = await _context.RetencionesIslrEmitidas
            .AsNoTracking()
            .Where(r => r.EmpresaId == empresaId
                && r.Estado == "Emitida"
                && r.FechaRetencion >= fechaInicio
                && r.FechaRetencion <= fechaFin)
            .OrderBy(r => r.NumeroComprobante)
            .ToListAsync();

        try
        {
            var (contenido, nombre) = DeclaracionesSeniatService.GenerarXmlIslr(empresa, retenciones, anio, mes);
            return File(contenido, "application/xml", nombre);
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    /// <summary>Valida los parámetros comunes de periodo de una declaración.</summary>
    private static string ValidarPeriodo(int empresaId, int anio, int mes)
    {
        if (empresaId <= 0) return "Indique la empresa (empresaId).";
        if (anio < 2000 || anio > 2100) return "Indique un año válido (2000-2100).";
        if (mes is < 1 or > 12) return "Indique un mes válido (1-12).";
        return null;
    }
}
