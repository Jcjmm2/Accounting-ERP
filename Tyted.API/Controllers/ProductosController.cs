using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Tyted.API.Data;
using Tyted.API.Models;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;

[Route("api/[controller]")]
[ApiController]
public class ProductosController : ControllerBase
{
    private readonly TytedContext _context;

    public ProductosController(TytedContext context)
    {
        _context = context;
    }

    // ====================================================================
    // 1. GET (Consultar todos los productos con filtros opcionales)
    // Endpoint: GET /api/Productos?descripcion=ejemplo&codigo=123
    // ====================================================================
    [HttpGet]
    public async Task<ActionResult<IEnumerable<Producto>>> GetProductos(
        [FromQuery] string? descripcion, 
        [FromQuery] string? codigo)
    {
        var query = _context.Productos
            // VITAL: Cargar las relaciones anidadas
            .Include(p => p.Proveedor)
            .Include(p => p.UnidadesDeVenta)
                .ThenInclude(pu => pu.UnidadMedida)
            .AsQueryable();

        // 1. Filtro por Descripción (Busca en el campo Descripcion del producto)
        if (!string.IsNullOrEmpty(descripcion))
        {
            // APLICACIÓN DE LA CORRECCIÓN: Manejo de nulos (?? "") antes de buscar.
            query = query.Where(p => (p.Descripcion ?? "").ToLower().Contains(descripcion.ToLower()));
        }

        // 2. Filtro por Código (Busca en CodigoBarras)
        if (!string.IsNullOrEmpty(codigo))
        {
            // Mantener la lógica de código de barras
            query = query.Where(p => 
                (p.CodigoBarras != null && p.CodigoBarras.ToLower().Contains(codigo.ToLower()))
            );
        }

        // Ejecutar la consulta con todos los filtros aplicados
        return await query.ToListAsync();
    }
    
    // ====================================================================
    // 2. GET (Consultar un producto por ID)
    // Endpoint: GET /api/Productos/{id}
    // ====================================================================
    [HttpGet("{id}")]
    public async Task<ActionResult<Producto>> GetProducto(int id)
    {
        // Busca el producto e incluye todos los detalles anidados
        var producto = await _context.Productos
            .Include(p => p.Proveedor)
            .Include(p => p.UnidadesDeVenta)
                .ThenInclude(pu => pu.UnidadMedida)
            .FirstOrDefaultAsync(p => p.CodigoProd == id);

        if (producto == null)
        {
            return NotFound();
        }

        return producto;
    }

    // ====================================================================
    // 3. POST (Registrar un Nuevo Producto)
    // Endpoint: POST /api/Productos
    // ====================================================================
    [HttpPost]
    public async Task<ActionResult<Producto>> PostProducto(Producto producto)
    {
        // Validaciones o lógica de negocio antes de guardar...
        
        // Aseguramos que EF Core maneje la inserción del producto y sus unidades anidadas
        _context.Productos.Add(producto);
        await _context.SaveChangesAsync();

        // Tras guardar, se usa el GET por ID para devolver el objeto completo (con las FK resueltas)
        return CreatedAtAction(nameof(GetProducto), new { id = producto.CodigoProd }, producto);
    }
    
    // ====================================================================
    // 4. PUT (Editar/Actualizar un Producto)
    // Endpoint: PUT /api/Productos/{id}
    // ====================================================================
    [HttpPut("{id}")]
    public async Task<IActionResult> PutProducto(int id, Producto producto)
    {
        if (id != producto.CodigoProd)
        {
            return BadRequest("El ID del producto no coincide.");
        }
        
        // =========================================================================
        // 1. RASTREO Y MODIFICACIÓN DEL MAESTRO (Producto)
        // Marcamos el objeto principal como modificado.
        _context.Entry(producto).State = EntityState.Modified;
        
        // EVITAMOS QUE EF CORE INTENTE MODIFICAR LA COLECCIÓN DE UNIDADES DE VENTA 
        // automáticamente, ya que la gestionaremos manualmente.
        _context.Entry(producto).Collection(p => p.UnidadesDeVenta).IsModified = false;
        // =========================================================================


        // 2. Manejo de las unidades de venta (Variantes)
        // Busca todas las unidades (variantes) existentes para este producto.
        var unidadesExistentes = await _context.ProductosUnidad
            .Where(pu => pu.CodigoProd == id)
            .AsNoTracking()
            .ToListAsync();
        
        // Identificar unidades a eliminar: unidades que estaban en la DB pero no se recibieron del Frontend
        var unidadesAEliminar = unidadesExistentes
            .Where(ue => !producto.UnidadesDeVenta.Any(pn => pn.IdProductoUnidad == ue.IdProductoUnidad && ue.IdProductoUnidad != 0))
            .ToList();
        
        _context.ProductosUnidad.RemoveRange(unidadesAEliminar);

        // Identificar unidades a añadir o modificar
        foreach (var unidadNueva in producto.UnidadesDeVenta)
        {
            if (unidadNueva.IdProductoUnidad == 0)
            {
                // Es una unidad nueva (POST), añadir
                unidadNueva.CodigoProd = id; 
                _context.ProductosUnidad.Add(unidadNueva);
            }
            else
            {
                // Es una unidad existente (PUT), modificar
                _context.Entry(unidadNueva).State = EntityState.Modified;
            }
        }

        // 3. Guardar todos los cambios (Producto principal, unidades eliminadas, añadidas y modificadas)
        try
        {
            await _context.SaveChangesAsync(); 
        }
        catch (DbUpdateConcurrencyException)
        {
            if (!_context.Productos.Any(e => e.CodigoProd == id))
            {
                return NotFound();
            }
            else
            {
                throw;
            }
        }
        
        return NoContent(); // Código 204: Éxito en la actualización sin contenido de retorno.
        
    }

    // ====================================================================
    // 5. DELETE (Eliminar un Producto)
    // Endpoint: DELETE /api/Productos/{id}
    // ESTE ES EL MÉTODO AÑADIDO PARA CORREGIR EL ERROR 405
    // ====================================================================
    [HttpDelete("{id}")]
    public async Task<IActionResult> DeleteProducto(int id)
    {
        if (_context.Productos == null)
        {
            return NotFound("La colección de productos no está disponible.");
        }
        
        var producto = await _context.Productos.FindAsync(id);

        if (producto == null)
        {
            return NotFound($"Producto con código {id} no encontrado.");
        }

        try
        {
            // Remover el producto
            _context.Productos.Remove(producto);
            
            // Guardar los cambios
            await _context.SaveChangesAsync();

            // 204 No Content: Respuesta estándar para DELETE exitoso
            return NoContent(); 
        }
        catch (DbUpdateException)
        {
            // Este es el error capturado cuando hay restricción de clave foránea (FK)
            // Se devuelve 400 Bad Request y un mensaje específico que el front-end puede mostrar.
            return BadRequest($"🚫 No se puede eliminar el producto con código {id}. Tiene movimientos de inventario o registros asociados (Restricción de Integridad Referencial).");
        }
        catch (Exception ex)
        {
            // Otros errores 500
            return StatusCode(500, $"Ocurrió un error interno al eliminar el producto: {ex.Message}");
        }
    }
}