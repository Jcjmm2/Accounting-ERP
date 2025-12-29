using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
//using Microsoft.AspNetCore.Authorization;
using Tyted.API.Data;
using Tyted.API.Models;

[Route("api/[controller]")]
//[Authorize(Roles = "AdministradorSistema,Administrador,Comprador,Analista")]
[ApiController]
public class UnidadesMedidaController : ControllerBase
{
    private readonly TytedContext _context;

    public UnidadesMedidaController(TytedContext context)
    {
        _context = context;
    }

    // GET: api/UnidadesMedida
    // Endpoint simple para obtener la lista completa del catálogo
    [HttpGet]
    public async Task<ActionResult<IEnumerable<UnidadMedida>>> GetUnidadesMedida()
    {
        // Se puede añadir lógica de autenticación o paginación si es necesario, pero por ahora se mantiene simple.
        return await _context.UnidadesMedida.ToListAsync();
    }

            // POST: api/UnidadesMedida (Para crear GRAMO, KILO, etc.)
        [HttpPost]
        public async Task<ActionResult<UnidadMedida>> PostUnidad(UnidadMedida unidad)
        {
            _context.UnidadesMedida.Add(unidad);
            await _context.SaveChangesAsync();
            return CreatedAtAction(nameof(GetUnidadesMedida), new { id = unidad.IdUnidad }, unidad);
        }

        // PUT: api/UnidadesMedida/5 (Modificar)
        [HttpPut("{id}")]
        public async Task<IActionResult> PutUnidad(int id, UnidadMedida unidad)
        {
            if (id != unidad.IdUnidad) return BadRequest();

            // REGLA: Verificar si la unidad ya está en uso en ProductosUnidad
            bool tieneMovimientos = await _context.ProductosUnidad.AnyAsync(u => u.IdUnidad == id);
            
            if (tieneMovimientos)
            {
                return BadRequest("No se puede modificar la unidad porque ya está asociada a productos con precios y costos.");
            }

            _context.Entry(unidad).State = EntityState.Modified;
            await _context.SaveChangesAsync();

            return NoContent();
        }

        // DELETE: api/UnidadesMedida/5 (Anular/Eliminar)
        [HttpDelete("{id}")]
        public async Task<IActionResult> DeleteUnidad(int id)
        {
            var unidad = await _context.UnidadesMedida.FindAsync(id);
            if (unidad == null) return NotFound();

            // REGLA: Verificar si tiene movimientos
            bool tieneMovimientos = await _context.ProductosUnidad.AnyAsync(u => u.IdUnidad == id);

            if (tieneMovimientos)
            {
                return BadRequest("No se puede eliminar la unidad. Está en uso en el inventario.");
            }

            _context.UnidadesMedida.Remove(unidad);
            await _context.SaveChangesAsync();

            return NoContent();
        }
}

