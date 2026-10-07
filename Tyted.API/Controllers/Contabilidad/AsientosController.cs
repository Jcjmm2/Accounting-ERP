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

    // MEJORA 1: Se añade el parámetro opcional para filtrar por el periodo activo
    [HttpGet("asientos")]
    public async Task<ActionResult<List<AsientoContable>>> GetAsientos([FromQuery] int? periodoContableId, [FromQuery] int? empresaId)
    {
        // Filtros opcionales: el frontend puede traer los asientos de un periodo y/o de la empresa activa
        var asientos = await _service.GetAsientosAsync(periodoContableId, empresaId);
        return Ok(asientos);
    }

    [HttpPost("asientos")]
    public async Task<ActionResult<AsientoContable>> CrearAsiento([FromBody] AsientoContable asiento)
    {
        // Si el JSON venía con "id": null la deserialización falla y el parámetro llega en null.
        // Devolvemos un mensaje claro en vez de una NullReferenceException genérica.
        if (asiento is null)
        {
            return BadRequest(new { message = "El cuerpo de la petición no es un asiento válido. Verifica que 'id' no sea null y que los campos obligatorios estén presentes." });
        }

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

    // MEJORA 2: Se añade el endpoint PUT para procesar la edición del asiento y sus detalles
    [HttpPut("asientos/{id}")]
    public async Task<IActionResult> ActualizarAsiento(int id, [FromBody] AsientoContable asiento)
    {
        if (asiento is null)
        {
            return BadRequest(new { message = "El cuerpo de la petición no es un asiento válido. Verifica que 'id' no sea null." });
        }

        // Validación de seguridad básica
        if (asiento.Id != 0 && id != asiento.Id)
        {
            return BadRequest(new { message = "Inconsistencia de datos: El ID de la ruta no coincide con el cuerpo de la petición." });
        }

        try
        {
            // Nota: Debes crear este método 'ActualizarAsientoAsync' en tu AsientoContableService
            var actualizado = await _service.ActualizarAsientoAsync(id, asiento);
            
            if (actualizado == null)
            {
                return NotFound(new { message = $"No se encontró el asiento con ID {id} en la base de datos." });
            }
            
            return Ok(actualizado);
        }
        catch (Exception ex)
        {
            return BadRequest(new { message = $"Error al actualizar el asiento: {ex.Message}" });
        }
    }
}
