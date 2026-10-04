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
}
