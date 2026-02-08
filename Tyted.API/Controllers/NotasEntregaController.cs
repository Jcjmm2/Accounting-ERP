using Microsoft.AspNetCore.Mvc;
using Tyted.API.Models;
using Microsoft.AspNetCore.Authorization;
using Tyted.API.Services;

namespace Tyted.API.Controllers
{
    [Route("api/[controller]")]
    [Authorize(Roles = "AdministradorSistema,Administrador,Comprador")]
    [ApiController]
    public class NotasEntregaController : ControllerBase
    {
        private readonly NotaEntregaService _notaEntregaService;

        public NotasEntregaController(NotaEntregaService notaEntregaService)
        {
            _notaEntregaService = notaEntregaService;
        }

        [HttpPost]
        public async Task<ActionResult<NotaEntregaCompra>> CrearNota(NotaEntregaCompra nota)
        {
            try 
            {
                var resultado = await _notaEntregaService.RegistrarEntradaAsync(nota);
                return Ok(new { mensaje = "Nota de Entrega procesada y Stock actualizado", data = resultado });
            }
            catch (Exception ex)
            {
                return BadRequest(ex.Message);
            }
        }
        [HttpDelete("{id}")]
        public async Task<IActionResult> AnularNotaEntrega(int id)
        {
            try
            {
                await _notaEntregaService.AnularNotaEntregaAsync(id); //
                return Ok(new { mensaje = "Nota de entrega anulada. El stock ha sido revertido." });
            }
            catch (Exception ex)
            {
                return BadRequest(ex.Message);
            }
        }
    }
}