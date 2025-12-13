// Tyted.API.Controllers/ComprasController.cs

using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Tyted.API.Data;
using Tyted.API.Models;
using System.Linq;
using System.Threading.Tasks;
using System; // <--- AGREGAR ESTO para usar 'Exception' en el try/catch

[Route("api/[controller]")]
[ApiController]
public class ComprasController : ControllerBase
{
    private readonly TytedContext _context;

    public ComprasController(TytedContext context)
    {
        _context = context;
    }

    // ====================================================================
    // 1. GET (Consultar todas las compras)
    // ====================================================================
    [HttpGet]
    public async Task<ActionResult<IEnumerable<Compra>>> GetCompras()
    {
        return await _context.Compras
            .Include(c => c.Proveedor)
            .Include(c => c.Detalles!) 
                .ThenInclude(cd => cd.Producto!) // <-- ¡AÑADIR '!' AQUÍ!
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
                .ThenInclude(cd => cd.Producto!) // <-- ¡AÑADIR '!' AQUÍ!
                    .ThenInclude(p => p.UnidadesDeVenta!)
                    .FirstOrDefaultAsync(c => c.IdCompra == id);

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

        // 2. Procesa la Compra y sus Detalles
        _context.Compras.Add(compra);

        // 3. Lógica Clave: Actualizar Stock y Costo Promedio
        foreach (var detalle in compra.Detalles!) 
        {
            var producto = await _context.Productos
                .FirstOrDefaultAsync(p => p.CodigoProd == detalle.CodigoProd);
            
            var unidad = await _context.ProductosUnidad
                .FirstOrDefaultAsync(pu => pu.IdProductoUnidad == detalle.IdProductoUnidad);

            if (producto == null)
            {
                return BadRequest($"Producto con CodigoProd {detalle.CodigoProd} no encontrado.");
            }
            
            // --- CÁLCULO DEL NUEVO COSTO PROMEDIO (Método Ponderado) ---
            
            decimal stockAnterior = producto.StockActual; 
            decimal costoAnteriorBase = unidad != null ? unidad.CostoUnitarioMonedaBase : 0; 
            
            decimal cantidadNueva = detalle.CantidadComprada; 
            decimal costoNuevoBase = detalle.CostoUnitarioMonedaBase;

            decimal nuevoCostoPromedio = 0;
            
            if (stockAnterior + cantidadNueva > 0)
            {
                nuevoCostoPromedio = ((stockAnterior * costoAnteriorBase) + (cantidadNueva * costoNuevoBase)) / (stockAnterior + cantidadNueva);
            }

            // --- ACTUALIZACIÓN DE DATOS ---

            // A. Actualizar Stock
            producto.StockActual += cantidadNueva;

            // B. Actualizar Costo en la Unidad de Venta
            if (unidad != null)
            {
                unidad.CostoUnitarioMonedaBase = nuevoCostoPromedio;
                // Opcional: Si el costo en USD debe calcularse: unidad.CostoUnitarioMonedaExt = nuevoCostoPromedio / compra.TasaCambio;
                _context.Entry(unidad).State = EntityState.Modified; 
            }
            
            // Marcar el Producto como modificado
            _context.Entry(producto).State = EntityState.Modified;
        } // <-- CIERRE CORRECTO DEL FOREACH
            
        try
        {
            await _context.SaveChangesAsync();
        }
        catch (Exception ex)
        {
            // Puedes loggear la excepción aquí para depuración
            return StatusCode(500, $"Error al guardar la compra: {ex.Message}");
        }

        // Devolver el objeto creado
        return CreatedAtAction(nameof(GetCompra), new { id = compra.IdCompra }, compra);
    } // <-- CIERRE CORRECTO DEL MÉTODO POST
}

