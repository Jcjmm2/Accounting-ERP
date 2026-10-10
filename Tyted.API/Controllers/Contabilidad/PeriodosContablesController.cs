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
    public async Task<ActionResult<CierrePeriodoResponse>> CerrarPeriodo(int periodoId, [FromBody] PeriodoCierreRequest? request)
    {
        try
        {
            var usuario = request?.Usuario ?? "Sistema";
            var usuarioId = request?.UsuarioId ?? 1;
            // Por defecto el cierre TRASLADA los saldos de activo, pasivo y
            // patrimonio al periodo siguiente (asiento de apertura de balance).
            var trasladar = request?.TrasladarSaldos ?? true;
            var respuesta = await _service.CerrarPeriodoAsync(periodoId, usuario, trasladar, usuarioId);
            return Ok(respuesta);
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

    /// <summary>
    /// Elimina un periodo SIN asientos (ni él ni sus subperiodos; los ejercicios
    /// anuales vacíos se eliminan en cascada con sus meses). Permite corregir
    /// en la aplicación periodos antiguos erróneos (p. ej. un mal periodo de
    /// apertura) sin intervención manual en la base de datos. Los periodos con
    /// asientos se rechazan con un mensaje claro.
    /// </summary>
    [HttpDelete("periodos/{periodoId}")]
    public async Task<ActionResult<EliminacionPeriodoResponse>> EliminarPeriodo(
        int periodoId,
        [FromQuery] string? usuario = null)
    {
        try
        {
            var resultado = await _service.EliminarPeriodoAsync(periodoId, usuario ?? "Sistema");
            return Ok(resultado);
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
        catch (Exception ex)
        {
            return BadRequest(new { message = $"No se pudo eliminar el periodo: {ex.Message}" });
        }
    }
}

public class PeriodoCierreRequest
{
    public string Usuario { get; set; } = "Sistema";
    /// <summary>Id del usuario que ejecuta el cierre (auditoría y comprobantes).</summary>
    public int UsuarioId { get; set; } = 1;
    /// <summary>
    /// Genera el asiento de apertura de balance con los saldos de activo,
    /// pasivo y patrimonio en el periodo siguiente (por defecto TRUE).
    /// </summary>
    public bool TrasladarSaldos { get; set; } = true;
}