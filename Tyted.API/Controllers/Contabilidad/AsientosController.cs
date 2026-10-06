using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Tyted.API.Models;
using Tyted.API.Services;

namespace Tyted.API.Controllers.Contabilidad;

[Route("api/contabilidad")]
[ApiController]
[Authorize(Roles = "AdministradorSistema,Administrador,Analista")]
public class AsientosController : ControllerBase
{
    private readonly AsientoContableService _service;

    public AsientosController(AsientoContableService service)
    {
        _service = service;
    }

    [HttpGet("asientos")]
    public async Task<ActionResult<List<AsientoContable>>> GetAsientos()
    {
        var asientos = await _service.GetAsientosAsync();
        return Ok(asientos);
    }

    [HttpPost("asientos")]
    public async Task<ActionResult<AsientoContable>> CrearAsiento([FromBody] AsientoContable asiento)
    {
        try
        {
            var creado = await _service.CrearAsientoAsync(asiento);
            return Ok(creado);
        }
        catch (Exception ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }
}
