using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Authorization;
using Tyted.API.Models;
using Tyted.API.Services;

namespace Tyted.API.Controllers
{
    [Route("api/[controller]")]
    [Authorize(Roles = "AdministradorSistema,Administrador,Comprador,Cajero")] // Requiere login
    [ApiController]
    public class PedidosController : ControllerBase
    {
        private readonly PedidoService _pedidoService;

        public PedidosController(PedidoService pedidoService)
        {
            _pedidoService = pedidoService;
        }

        [HttpPost]
        public async Task<ActionResult<Pedido>> PostPedido([FromBody] Pedido pedido)
        {
            if (pedido == null || pedido.Detalles == null || !pedido.Detalles.Any())
            {
                return BadRequest("El pedido debe contener al menos un producto.");
            }

            try
            {
                // Aseguramos que el estado inicial sea siempre PENDIENTE
                pedido.Estado = "Pendiente";
                pedido.Fecha = DateTime.Now;

                var nuevoPedido = await _pedidoService.CrearPedidoAsync(pedido);
                return CreatedAtAction(nameof(GetPedidoById), new { id = nuevoPedido.Id }, nuevoPedido);
            }
            catch (Exception ex)
            {
                return BadRequest($"Error al crear el pedido: {ex.Message}");
            }
        }

        [HttpGet("{id}")]
        public async Task<ActionResult<Pedido>> GetPedidoById(int id)
        {
            var pedido = await _pedidoService.ObtenerPedidoPorIdAsync(id);
            if (pedido == null) return NotFound("Pedido no encontrado");
            return Ok(pedido);
        }
        
        [HttpGet]
        public async Task<ActionResult<IEnumerable<Pedido>>> GetPedidosPendientes()
        {
            try
            {
                // Deberías implementar este método en tu Service para filtrar por Estado == "Pendiente"
                var pedidos = await _pedidoService.ObtenerPedidosPendientesAsync();
                return Ok(pedidos);
            }
            catch (Exception ex)
            {
                return BadRequest(ex.Message);
            }
        }

        [HttpPost("{id}/facturar")]
        public async Task<IActionResult> FacturarPedido(
            int id, 
            [FromQuery] string metodoPago = "Efectivo", 
            [FromQuery] bool esCredito = false)
        {
            try
            {
                // Este método en el service debe: 
                // 1. Crear la Venta, 2. Descontar Inventario, 3. Marcar Pedido como "Facturado"
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
                await _pedidoService.AnularPedidoAsync(id);
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