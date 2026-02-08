using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.AspNetCore.Authorization;
using Tyted.API.Data;
using Tyted.API.Models;

[Route("api/[controller]")]
[Authorize(Roles = "AdministradorSistema,Administrador,Comprador")] 
[ApiController]
public class ProveedoresController : ControllerBase
{
    private readonly TytedContext _context;

    public ProveedoresController(TytedContext context)
    {
        _context = context;
    }

    // ====================================================================
    // 1. GET (Leer y Filtrar proveedores)
    // Endpoint: GET /api/Proveedores?rif={value}&razonsocial={value}
    // ====================================================================
    [HttpGet]
    public async Task<ActionResult<IEnumerable<Proveedor>>> GetProveedores(
        [FromQuery] string? rif,     
        [FromQuery] string? razonsocial) 
    {
        // 1. Iniciar la consulta base (IQueryable permite construir la consulta sin ejecutarla)
        IQueryable<Proveedor> query = _context.Proveedores;

        // 2. Aplicar filtro Razón Social (Búsqueda parcial, insensible a mayúsculas)
        if (!string.IsNullOrEmpty(razonsocial))
        {
            // El .ToLower() asegura que la búsqueda sea insensible a mayúsculas/minúsculas.
            // (p.Razonsocial ?? "") maneja campos nulos de la DB de forma segura.
            query = query.Where(p => (p.Razonsocial ?? "").ToLower().Contains(razonsocial.ToLower()));
        }

        // 3. Aplicar filtro RIF (Búsqueda parcial, aplicada sobre el resultado del filtro anterior)
        if (!string.IsNullOrEmpty(rif))
        {
            // El filtro RIF generalmente no necesita ToLower, pero mantiene la seguridad de nulos.
            query = query.Where(p => (p.RIF ?? "").Contains(rif));
        }
        
        // 4. Ejecutar la consulta con todos los filtros aplicados
        return await query.ToListAsync();
    }
    
    // ====================================================================
    // 2. GET Buscador (NUEVO MÉTODO PARA DEBOUNCE DEL FRONT-END)
    // Endpoint: GET /api/Proveedores/Buscar?q={term}
    // ====================================================================
    [HttpGet("Buscar")] // << ESTO MAPEA LA RUTA /api/Proveedores/Buscar
    public async Task<ActionResult<IEnumerable<Proveedor>>> BuscarProveedores([FromQuery] string q)
    {
        // Validamos el mínimo de 3 caracteres, aunque React ya lo haga, es buena práctica del servidor.
        if (string.IsNullOrWhiteSpace(q) || q.Length < 3)
        {
            // Devolvemos 200 OK con una lista vacía para no generar error 400 en el navegador.
            return Ok(new List<Proveedor>()); 
        }

        string term = q.Trim().ToLower();

        // Lógica de búsqueda: Busca si el término coincide en Razonsocial O en RIF
        var proveedores = await _context.Proveedores
            .Where(p => (p.Razonsocial != null && p.Razonsocial.ToLower().Contains(term)) ||
                        (p.RIF != null && p.RIF.Contains(term)))
            .ToListAsync();

        return Ok(proveedores); // Devuelve 200 OK con los resultados (o una lista vacía si no hay coincidencias)
    }

    // ====================================================================
    // 3. GET por ID (Leer un proveedor específico)
    // ====================================================================
    [HttpGet("{id}")]
    public async Task<ActionResult<Proveedor>> GetProveedor(int id)
    {
        var proveedor = await _context.Proveedores.FindAsync(id);

        if (proveedor == null)
        {
            return NotFound(); // 404
        }

        return proveedor;
    }

    // ====================================================================
    // 4. POST (Crear un nuevo proveedor)
    // ====================================================================
    [HttpPost]
    public async Task<ActionResult<Proveedor>> PostProveedor(Proveedor proveedor)
    {
        _context.Proveedores.Add(proveedor);
        await _context.SaveChangesAsync();
        
        return CreatedAtAction(nameof(GetProveedor), new { id = proveedor.CodigoProv }, proveedor);
    }

    // ====================================================================
    // 5. PUT (Actualizar un proveedor existente)
    // ====================================================================
    [HttpPut("{id}")]
    public async Task<IActionResult> PutProveedor(int id, Proveedor proveedor)
    {
        if (id != proveedor.CodigoProv)
        {
            return BadRequest(); // 400
        }

        _context.Entry(proveedor).State = EntityState.Modified;

        try
        {
            await _context.SaveChangesAsync();
        }
        catch (DbUpdateConcurrencyException)
        {
            if (!_context.Proveedores.Any(e => e.CodigoProv == id))
            {
                return NotFound(); // 404
            }
            else
            {
                throw;
            }
        }

        return NoContent(); // 204
    }

    // ====================================================================
    // 6. DELETE (Eliminar un proveedor)
    // ====================================================================
    [HttpDelete("{id}")]
    public async Task<IActionResult> DeleteProveedor(int id)
    {
        var proveedor = await _context.Proveedores.FindAsync(id);
        
        if (proveedor == null)
        {
            return NotFound(); // 404
        }

        _context.Proveedores.Remove(proveedor);
        await _context.SaveChangesAsync();

        return NoContent(); // 204
    }
}