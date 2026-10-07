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
    public async Task<ActionResult<List<BalanceComprobacionDto>>> GetBalanceComprobacion([FromQuery] int periodoId)
    {
        try
        {
            var data = await _service.GetBalanceComprobacionAsync(periodoId);
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
        [FromQuery] DateTime? fechaFin = null)
    {
        var data = await _service.GetLibroMayorAsync(cuentaId, fechaInicio, fechaFin);
        return Ok(data);
    }
}
