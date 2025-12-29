using Microsoft.AspNetCore.Mvc;
//using Microsoft.AspNetCore.Authorization;
using Tyted.API.Models;
using Tyted.API.Services;

namespace Tyted.API.Controllers
{
    [Route("api/[controller]")]
    //[Authorize(Roles = "AdministradorSistema,Administrador,Comprador,Cajero")] // Requiere login
    [ApiController]
    public class PedidosController : ControllerBase
    {
        private readonly PedidoService _pedidoService;

        public PedidosController(PedidoService pedidoService)
        {
            _pedidoService = pedidoService;
        }

        [HttpPost]
        public async Task<ActionResult<Pedido>> PostPedido(Pedido pedido)
        {
            var nuevoPedido = await _pedidoService.CrearPedidoAsync(pedido);
            return CreatedAtAction(nameof(GetPedidoById), new { id = nuevoPedido.Id }, nuevoPedido);
        }

        [HttpGet("{id}")]
        public async Task<ActionResult<Pedido>> GetPedidoById(int id)
        {
            // Nota: Aquí podrías agregar un método en el service para buscar por ID
            // Por ahora, asumimos la búsqueda directa para la prueba.
            return Ok(); 
        }

        [HttpPost("{id}/facturar")]
        public async Task<IActionResult> FacturarPedido(
            int id, 
            [FromQuery] string metodoPago = "Efectivo", 
            [FromQuery] bool esCredito = false) // Agregamos el parámetro aquí
        {
            try
            {
                // CAMBIO: Ahora pasamos los 3 argumentos requeridos
                var venta = await _pedidoService.ConvertirPedidoAVentaAsync(id, metodoPago, esCredito);
        
                return Ok(new { 
                    mensaje = "Pedido facturado con éxito", 
                    factura = venta.NumeroFactura,
                    ventaId = venta.VentaId 
                });
            }
            catch (Exception ex)
            {
                return BadRequest(ex.Message);
            }
        }
        [HttpPut("{id}")]
        public async Task<IActionResult> ActualizarPedido(int id, Pedido pedido)
        {
            // Lógica: Solo permitir si el pedido original está "Pendiente"
            // Debes implementar el método en PedidoService
            return Ok();
        }

        [HttpPatch("{id}/anular")]
        public async Task<IActionResult> AnularPedido(int id)
        {
            try
            {
                await _pedidoService.AnularPedidoAsync(id); //
                return Ok(new { mensaje = "Pedido anulado correctamente." });
            }
            catch (Exception ex)
            {
                return BadRequest(ex.Message);
            }
        }

        // Nota: Para "Actualizar", lo más seguro es anular y crear uno nuevo si hay cambios grandes,
        // o implementar un método Update en PedidoService que valide que el estado sea "Pendiente".}
    }
}