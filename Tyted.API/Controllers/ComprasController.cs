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
            if (!ModelState.IsValid)
            {
                return BadRequest(ModelState); 
            }
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
                return BadRequest(new { message = ex.Message });
            }
        }

        // ==========================================================
        // ACTUALIZADO: AHORA GUARDA PRECIO 1, 2 Y 3
        // ==========================================================
        [HttpPost("confirmar-precios")]
        public async Task<IActionResult> ConfirmarPrecios([FromBody] List<ConfirmarPrecioDto> propuestas)
        {
            if (propuestas == null || !propuestas.Any()) 
                return BadRequest("No hay propuestas para procesar.");

            try
            {
                var tasaActual = await _context.TasaDeCambio
                    .Where(t => t.MonedaOrigen == "USD" && t.MonedaDestino == "VES")
                    .OrderByDescending(t => t.FechaVigencia)
                    .Select(t => t.Tasa)
                    .FirstOrDefaultAsync();

                foreach (var item in propuestas)
                {
                    var unidad = await _context.ProductosUnidad.FirstOrDefaultAsync(u => u.IdProductoUnidad == item.IdProductoUnidad);
                    if (unidad != null)
                    {
                        // Actualizar Valores Base (USD)
                        unidad.CostoUnitarioMonedaBase = item.NuevoCostoBase;
                        unidad.PrecioMonedaBase = item.NuevoPrecioBase;
                        unidad.Precio2MonedaBase = item.NuevoPrecio2Base;
                        unidad.Precio3MonedaBase = item.NuevoPrecio3Base;

                        // ACTUALIZACIÓN DE TASAS: Sincronizar con la moneda extranjera (VES)
                        if (tasaActual > 0)
                        {
                            unidad.CostoUnitarioMonedaExt = item.NuevoCostoBase * tasaActual;
                            unidad.PrecioMonedaExt = item.NuevoPrecioBase * tasaActual;
                            unidad.Precio2MonedaExt = (item.NuevoPrecio2Base) * tasaActual;
                            unidad.Precio3MonedaExt = (item.NuevoPrecio3Base) * tasaActual;
                        }

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

    // ==========================================================
    // DTO ACTUALIZADO: INCLUYE LOS 3 PRECIOS
    // ==========================================================
    public class ConfirmarPrecioDto
    {
        public int IdProductoUnidad { get; set; }
        public decimal NuevoCostoBase { get; set; }
        public decimal NuevoPrecioBase { get; set; }  // Mapea al Precio 1
        public decimal NuevoPrecio2Base { get; set; } // Mapea al Precio 2
        public decimal NuevoPrecio3Base { get; set; } // Mapea al Precio 3
    }
}