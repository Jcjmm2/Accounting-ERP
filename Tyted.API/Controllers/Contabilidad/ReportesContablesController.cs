using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Tyted.API.Services;

namespace Tyted.API.Controllers.Contabilidad;

[Route("api/contabilidad")]
[ApiController]
[AllowAnonymous]
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
        var data = await _service.GetBalanceComprobacionAsync(periodoId);
        return Ok(data);
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
