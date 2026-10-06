using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Tyted.API.Models;
using Tyted.API.Services;

namespace Tyted.API.Controllers.Contabilidad;

[Route("api/contabilidad")]
[ApiController]
[Authorize(Roles = "AdministradorSistema,Administrador,Analista")]
public class PeriodosContablesController : ControllerBase
{
    private readonly PeriodoContableService _service;

    public PeriodosContablesController(PeriodoContableService service)
    {
        _service = service;
    }

    [HttpGet("periodos")]
    public async Task<ActionResult<List<PeriodoContable>>> GetPeriodos([FromQuery] int? empresaId)
    {
        // Ahora pasa el empresaId al servicio para aislar la data
        var periodos = await _service.GetPeriodosAsync(empresaId);
        return Ok(periodos);
    }

    [HttpPost("periodos")]
    public async Task<ActionResult<PeriodoContable>> CrearPeriodo([FromBody] PeriodoContable periodo)
    {
        try
        {
            if (periodo is null)
            {
                throw new InvalidOperationException("El cuerpo de la petición no puede estar vacío.");
            }

            PeriodoContable creado;

            if (periodo.TipoPeriodo == "Anual")
            {
                creado = await _service.CrearEjercicioFiscalCompletoAsync(periodo.EmpresaId, periodo.Anio);
            }
            else
            {
                creado = await _service.CrearPeriodoAsync(periodo);
            }

            return Ok(creado);
        }
        catch (Exception ex)
        {
            Console.WriteLine($"[CREAR_PERIODO] {ex}");
            return BadRequest(new { message = ex.Message, stack = ex.StackTrace });
        }
    }

    [HttpPost("periodos/{periodoId}/cerrar")]
    public async Task<ActionResult<PeriodoContable>> CerrarPeriodo(int periodoId, [FromBody] PeriodoCierreRequest? request)
    {
        try
        {
            var usuario = request?.Usuario ?? "Sistema";
            var periodo = await _service.CerrarPeriodoAsync(periodoId, usuario);
            return Ok(periodo);
        }
        catch (Exception ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    [HttpPost("periodos/{periodoId}/abrir")]
    public async Task<ActionResult<PeriodoContable>> AbrirPeriodo(int periodoId, [FromBody] PeriodoCierreRequest? request)
    {
        try
        {
            var usuario = request?.Usuario ?? "Sistema";
            var periodo = await _service.AbrirPeriodoAsync(periodoId, usuario);
            return Ok(periodo);
        }
        catch (Exception ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    [HttpGet("periodos/{periodoId}/tiene-movimientos")]
    public async Task<ActionResult<object>> TieneMovimientos(int periodoId)
    {
        try
        {
            var tiene = await _service.TieneMovimientosAsync(periodoId);
            return Ok(new { tieneMovimientos = tiene });
        }
        catch (Exception ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    [HttpPut("periodos/{periodoId}")]
    public async Task<ActionResult<PeriodoContable>> ModificarPeriodo(int periodoId, [FromBody] PeriodoContable periodo)
    {
        try
        {
            var modificado = await _service.ModificarPeriodoAsync(periodoId, periodo);
            return Ok(modificado);
        }
        catch (Exception ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }
}

public class PeriodoCierreRequest
{
    public string Usuario { get; set; } = "Sistema";
}