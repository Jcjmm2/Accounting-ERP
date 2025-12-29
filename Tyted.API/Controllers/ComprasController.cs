using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Tyted.API.Data;
using Tyted.API.Models;
using Tyted.API.Services;

namespace Tyted.API.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class ComprasController : ControllerBase
    {
        private readonly TytedContext _context;
        private readonly CompraService _compraService;

        public ComprasController(TytedContext context, CompraService compraService)
        {
            _context = context;
            _compraService = compraService;
        }

        // GET: api/Compras
        [HttpGet]
        public async Task<ActionResult<IEnumerable<Compra>>> GetCompras()
        {
            return await _context.Compras
                .Include(c => c.Proveedor)
                .Include(c => c.Detalles)
                .OrderByDescending(c => c.FechaCompra)
                .ToListAsync();
        }

        // GET: api/Compras/5
        [HttpGet("{id}")]
        public async Task<ActionResult<Compra>> GetCompra(int id)
        {
            var compra = await _context.Compras
                .Include(c => c.Proveedor)
                .Include(c => c.Detalles)
                .FirstOrDefaultAsync(c => c.Id == id);

            if (compra == null) return NotFound();

            return compra;
        }

        // POST: api/Compras
        [HttpPost]
        public async Task<ActionResult<Compra>> PostCompra(Compra compra)
        {
            try
            {
                var nuevaCompra = await _compraService.RegistrarCompraAsync(compra);
                return CreatedAtAction(nameof(GetCompra), new { id = nuevaCompra.Id }, nuevaCompra);
            }
            catch (Exception ex)
            {
                return BadRequest(new { message = ex.Message });
            }            
        }

        // ==========================================================
        // AGREGADO: ENDPOINT DE ANULACIÓN
        // ==========================================================
        [HttpPost("anular/{id}")]
        public async Task<IActionResult> AnularCompra(int id)
        {
            try
            {
                await _compraService.AnularCompraAsync(id);
                return Ok(new { message = "Compra anulada exitosamente. El stock y costos han sido revertidos." });
            }
            catch (Exception ex)
            {
                // Aquí capturamos el error de "Stock Insuficiente" que programamos en el Service
                return BadRequest(new { message = ex.Message });
            }
        }

        // ==========================================================
        // MEJORA: CONFIRMAR PRECIOS (Ajustado para mayor seguridad)
        // ==========================================================
        [HttpPost("confirmar-precios")]
        public async Task<IActionResult> ConfirmarPrecios([FromBody] List<ConfirmarPrecioDto> propuestas)
        {
            if (propuestas == null || !propuestas.Any()) 
                return BadRequest("No hay propuestas para procesar.");

            try
            {
                foreach (var item in propuestas)
                {
                    var unidad = await _context.ProductosUnidad.FirstOrDefaultAsync(u => u.IdProductoUnidad == item.IdProductoUnidad);
                    if (unidad != null)
                    {
                        unidad.CostoUnitarioMonedaBase = item.NuevoCostoBase;
                        unidad.PrecioMonedaBase = item.NuevoPrecioBase;
                        // En Venezuela, si el precio cambia, actualizamos la fecha para saber cuándo se remarcó
                        _context.Entry(unidad).State = EntityState.Modified;
                    }
                }

                await _context.SaveChangesAsync();
                return Ok(new { message = "Precios y costos actualizados con éxito." });
            }
            catch (Exception ex)
            {
                return BadRequest(new { message = $"Error al actualizar precios: {ex.Message}" });
            }
        }
    }

    // DTO necesario para que el endpoint de confirmar-precios funcione correctamente
    public class ConfirmarPrecioDto
    {
        public int IdProductoUnidad { get; set; }
        public decimal NuevoCostoBase { get; set; }
        public decimal NuevoPrecioBase { get; set; }
    }
}