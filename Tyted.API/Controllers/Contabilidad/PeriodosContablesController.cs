using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Tyted.API.Models;
using Tyted.API.Services;

namespace Tyted.API.Controllers.Contabilidad;

[Route("api/contabilidad")]
[ApiController]
[AllowAnonymous]
public class PeriodosContablesController : ControllerBase
{
    private readonly PeriodoContableService _service;

    public PeriodosContablesController(PeriodoContableService service)
    {
        _service = service;
    }

    [HttpGet("periodos")]
    public async Task<ActionResult<List<PeriodoContable>>> GetPeriodos()
    {
        var periodos = await _service.GetPeriodosAsync();
        return Ok(periodos);
    }

    [HttpPost("periodos")]
    public async Task<ActionResult<PeriodoContable>> CrearPeriodo([FromBody] PeriodoContable periodo)
    {
        try
        {
            var creado = await _service.CrearPeriodoAsync(periodo);
            return Ok(creado);
        }
        catch (Exception ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }
}
