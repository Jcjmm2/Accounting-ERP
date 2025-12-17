// Tyted.API.Controllers/ComprasController.cs

using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Tyted.API.Data;
using Tyted.API.Models;
using Tyted.API.Services; 
using System.Linq;
using System.Threading.Tasks;
using System; 
using System.Collections.Generic;
using Tyted.API.Models.DTOs; // <--- ¡CRÍTICO! Necesario para usar ReporteCompraPorProveedorDTO

[Route("api/[controller]")]
[ApiController]
public class ComprasController : ControllerBase
{
    // Mantenemos _context para los GETs simples
    private readonly TytedContext _context; 
    
    // El servicio que contendrá la lógica de negocio
    private readonly CompraService _compraService; 

    // Constructor actualizado para inyectar ambos
    public ComprasController(TytedContext context, CompraService compraService) 
    {
        _context = context;
        _compraService = compraService; // Inicializamos el servicio
    }

    // ====================================================================
    // 1. GET (Consultar todas las compras)
    // ====================================================================
    [HttpGet]
    public async Task<ActionResult<IEnumerable<Compra>>> GetCompras()
    {
        // Se asume que el Proveedor es necesario para el listado.
        return await _context.Compras
            .Include(c => c.Proveedor)
            .Include(c => c.Detalles!) 
                .ThenInclude(cd => cd.Producto!) 
            .ToListAsync(); 
    }
    
    // ====================================================================
    // 2. GET (Consultar una compra por ID)
    // ====================================================================
    [HttpGet("{id}")]
    public async Task<ActionResult<Compra>> GetCompra(int id)
    {
        var compra = await _context.Compras
            .Include(c => c.Proveedor)
            .Include(c => c.Detalles!)
            .ThenInclude(cd => cd.Producto!) 
            .ThenInclude(p => p.UnidadesDeVenta!)
            .FirstOrDefaultAsync(c => c.Id == id); 

        if (compra == null)
        {
            return NotFound();
        }

        return compra;
    }

    // ====================================================================
    // 3. POST (Registrar una Nueva Compra y Actualizar Inventario/Costo)
    // ====================================================================
    [HttpPost]
    [ProducesResponseType(StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<ActionResult<Compra>> PostCompra(Compra compra)
    {
        // 1. Validaciones básicas antes de guardar
        if (compra.Detalles == null || !compra.Detalles.Any())
        {
            return BadRequest("La compra debe tener al menos un detalle (artículo).");
        }

        // 2. Ejecutar la Lógica de Negocio (Guardar Compra y Actualizar Stock)
        try
        {
            // El servicio maneja la inserción de la compra y la actualización de stock de forma transaccional.
            await _compraService.RegistrarCompraYActualizarStock(compra);
        }
        catch (InvalidOperationException ex)
        {
            // Captura errores específicos (como Producto o Unidad no encontrados, o Tasa de Cambio no vigente)
            return BadRequest(new { message = ex.Message });
        }
        catch (Exception ex)
        {
            // Captura errores generales (BD, conexión, etc.)
            Console.WriteLine($"Error al procesar la compra: {ex.Message}");
            return StatusCode(500, "Ocurrió un error interno al registrar la compra y actualizar el inventario.");
        }

        // 3. Devolver el objeto creado
        return CreatedAtAction(nameof(GetCompra), new { id = compra.Id }, compra);
    } 

    // =========================================================================
    // 4. PUT (Anular Compra y Revertir Stock)
    // =========================================================================
    [HttpPut("anular/{id}")]
    public async Task<IActionResult> AnularCompra(int id)
    {
        try
        {
            // Llama al método del servicio que ejecuta la lógica transaccional.
            await _compraService.AnularCompraYRevertirStock(id);

            // 200 OK con mensaje de éxito
            return Ok($"La compra ID {id} ha sido anulada y el stock revertido exitosamente.");
        }
        catch (KeyNotFoundException ex)
        {
            // 404 Not Found: La compra no existe
            return NotFound(ex.Message);
        }
        catch (InvalidOperationException ex)
        {
            // 400 Bad Request: Compra ya anulada o stock insuficiente para la reversión
            return BadRequest(ex.Message);
        }
        catch (Exception ex)
        {
            // 500 Internal Server Error: Cualquier otro fallo en el proceso
            Console.WriteLine($"Error al anular compra {id}: {ex.Message}");
            return StatusCode(500, "Ocurrió un error interno al intentar anular la compra y revertir el inventario.");
        }
    }
    
    // ====================================================================
    // ✅ NUEVO ENDPOINT 5: REPORTE DE TOTALES DE COMPRAS
    // Llama a: GET /api/Compras/reporte/totales-por-proveedor?fechaInicio=...&fechaFin=...
    // ====================================================================
    [HttpGet("reporte/totales-por-proveedor")]
    public async Task<ActionResult<IEnumerable<ReporteCompraPorProveedorDTO>>> GetReporteTotalesPorProveedor(
        [FromQuery] DateTime fechaInicio, 
        [FromQuery] DateTime fechaFin)
    {
        if (fechaInicio == default || fechaFin == default)
        {
            return BadRequest("Las fechas de inicio y fin son obligatorias para el reporte.");
        }
        
        try
        {
            // Llama al nuevo método implementado en el servicio
            var reporte = await _compraService.GetReporteTotalesPorProveedor(fechaInicio, fechaFin);
            return Ok(reporte);
        }
        catch (Exception ex)
        {
            Console.WriteLine($"Error al generar el reporte: {ex.Message}");
            return StatusCode(500, $"Error interno al generar el reporte: {ex.Message}");
        }
    }
}