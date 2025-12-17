using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Tyted.API.Data;
using Tyted.API.Models;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using System; // Agregado para usar Exception

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
            // ✅ NUEVA INCLUSIÓN: Cargar la Categoría y TasaIVA
            .Include(p => p.Categoria) 
            .Include(p => p.TasaIVA)   
            // Fin de Nuevas Inclusiones
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
            // ✅ NUEVA INCLUSIÓN: Cargar la Categoría y TasaIVA
            .Include(p => p.Categoria) 
            .Include(p => p.TasaIVA)
            // Fin de Nuevas Inclusiones
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
        // NOTA IMPORTANTE: Al hacer POST, el objeto 'producto' debe contener
        // IdCategoria y IdTasaIVA con valores válidos (1, 2, 3, etc.)
        
        // Aseguramos que EF Core maneje la inserción del producto y sus unidades anidadas
        _context.Productos.Add(producto);
        await _context.SaveChangesAsync();

        // Tras guardar, se usa el GET por ID para devolver el objeto completo (con las FK resueltas)
        // Se recomienda llamar a GetProducto(id) aquí para devolver la información completa
        // incluyendo las categorías y tasas IVA, tal como se modificó arriba.
        return await GetProducto(producto.CodigoProd); // Usamos el método GetProducto modificado.
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
        
        // NOTA IMPORTANTE: Al hacer PUT, el objeto 'producto' debe contener
        // IdCategoria y IdTasaIVA con valores válidos (1, 2, 3, etc.)
        
        // 1. RASTREO Y MODIFICACIÓN DEL MAESTRO (Producto)
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
            return BadRequest($"🚫 No se puede eliminar el producto con código {id}. Tiene movimientos de inventario o registros asociados (Restricción de Integridad Referencial).");
        }
        catch (Exception ex)
        {
            // Otros errores 500
            return StatusCode(500, $"Ocurrió un error interno al eliminar el producto: {ex.Message}");
        }
    }
    
    // ====================================================================
    // 6. BUSCADOR (Busca productos por Descripción, Código o Código de Barras)
    // Llama a: GET /api/Productos/Buscar?q={consulta}
    // ====================================================================
    [HttpGet("Buscar")] 
    public async Task<ActionResult<IEnumerable<Producto>>> BuscarProductos([FromQuery] string q)
    {
        // El frontend requiere al menos 3 caracteres, pero el backend debe ser robusto.
        if (string.IsNullOrWhiteSpace(q) || q.Length < 3)
        {
            return Ok(new List<Producto>()); // Devuelve lista vacía, no error
        }

        var term = q.ToLower();

        var productos = await _context.Productos
            // Búsqueda flexible en múltiples campos
            .Where(p => 
                (p.Descripcion != null && p.Descripcion.ToLower().Contains(term)) || 
                (p.CodigoProd.ToString().Contains(term)) || // Búsqueda por Cód. Prod. numérico
                (p.CodigoBarras != null && p.CodigoBarras.ToLower().Contains(term))
            )
            // ✅ NUEVA INCLUSIÓN: Cargar la Categoría y TasaIVA
            .Include(p => p.Categoria)
            .Include(p => p.TasaIVA)
            // Fin de Nuevas Inclusiones
            // VITAL: Incluir las unidades de venta para que el frontend pueda configurarlas
            .Include(p => p.UnidadesDeVenta) 
                .ThenInclude(pu => pu.UnidadMedida)
            .Take(30) // Límite de resultados
            .ToListAsync();

        return Ok(productos);
    }
}