using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Tyted.API.Services;

namespace Tyted.API.Controllers.Contabilidad;

[Route("api/contabilidad")]
// Ruta alias: el frontend consume los reportes bajo /api/contabilidad/reportescontables/*
// (si no se expone, todas las llamadas devolvían 404 y la página los convertía en listas vacías).
[Route("api/contabilidad/reportescontables")]
[ApiController]
[Authorize(Roles = "AdministradorSistema,Administrador,Analista")]
public class ReportesContablesController : ControllerBase
{
    private readonly ReportesContablesService _service;

    public ReportesContablesController(ReportesContablesService service)
    {
        _service = service;
    }

    [HttpGet("resumen")]
    public async Task<ActionResult> GetResumen()
    {
        var resumen = await _service.GetResumenAsync();
        return Ok(resumen);
    }

    [HttpGet("balance-comprobacion")]
    public async Task<ActionResult<List<BalanceComprobacionDto>>> GetBalanceComprobacion(
        [FromQuery] int periodoId,
        [FromQuery] int? empresaId = null)
    {
        try
        {
            // empresaId (opcional) valida que el periodo pertenezca a la empresa activa
            var data = await _service.GetBalanceComprobacionAsync(periodoId, empresaId);
            return Ok(data);
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    [HttpGet("libro-mayor")]
    public async Task<ActionResult<List<LibroMayorDto>>> GetLibroMayor(
        [FromQuery] int cuentaId,
        [FromQuery] DateTime? fechaInicio = null,
        [FromQuery] DateTime? fechaFin = null,
        [FromQuery] int? empresaId = null)
    {
        // empresaId (opcional) acota los movimientos a la empresa activa
        var data = await _service.GetLibroMayorAsync(cuentaId, fechaInicio, fechaFin, empresaId);
        return Ok(data);
    }
}
