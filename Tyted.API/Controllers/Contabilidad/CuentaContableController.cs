using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Tyted.API.Models;
using Tyted.API.Services;

namespace Tyted.API.Controllers.Contabilidad;

[Route("api/contabilidad")]
[ApiController]
[Authorize(Roles = "AdministradorSistema,Administrador,Analista")]
public class CuentaContableController : ControllerBase
{
    private readonly PlanCuentasService _service;

    public CuentaContableController(PlanCuentasService service)
    {
        _service = service;
    }

    [HttpGet("cuentas")]
        public async Task<ActionResult<List<CuentaContable>>> GetCuentas([FromQuery] int? empresaId)
        {
            // Se pasa empresaId al servicio para filtrar las cuentas de la empresa activa
            var cuentas = await _service.GetCuentasAsync(empresaId);
            return Ok(cuentas);
        }

    [HttpPost("cuentas")]
    public async Task<ActionResult<CuentaContable>> CrearCuenta([FromBody] CuentaContable cuenta)
    {
        try
        {
            var creada = await _service.CrearCuentaAsync(cuenta);
            return Ok(creada);
        }
        catch (Exception ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }
}
