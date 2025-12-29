using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
//using Microsoft.AspNetCore.Authorization;
using Tyted.API.Data;
using Tyted.API.Models;

namespace Tyted.API.Controllers
{
    [Route("api/[controller]")]
    //[Authorize(Roles = "AdministradorSistema,Administrador")]
    [ApiController]
    public class CategoriasController : ControllerBase
    {
        private readonly TytedContext _context;

        public CategoriasController(TytedContext context)
        {
            _context = context;
        }

        [HttpGet]
        public async Task<ActionResult<IEnumerable<Categoria>>> GetCategorias()
        {
            return await _context.Categorias.ToListAsync();
        }

        [HttpPost]
        public async Task<ActionResult<Categoria>> PostCategoria(Categoria categoria)
        {
            // Esto te dirá exactamente qué campo falta o está mal formateado
            if (!ModelState.IsValid)
            {
                return BadRequest(ModelState); 
            }

            _context.Categorias.Add(categoria);
            await _context.SaveChangesAsync();
    
            return CreatedAtAction(nameof(GetCategorias), new { id = categoria.IdCategoria }, categoria);
        }

        [HttpPut("{id}")]
        public async Task<IActionResult> PutCategoria(int id, Categoria categoria)
        {
            if (id != categoria.IdCategoria) return BadRequest();
            _context.Entry(categoria).State = EntityState.Modified;
            await _context.SaveChangesAsync();
            return NoContent();
        }

        [HttpDelete("{id}")]
        public async Task<IActionResult> DeleteCategoria(int id)
        {
            var categoria = await _context.Categorias.FindAsync(id);
            if (categoria == null) return NotFound();

            // Verificamos si tiene productos antes de borrar
            var tieneProductos = await _context.Productos.AnyAsync(p => p.IdCategoria == id);
            if (tieneProductos) 
                return BadRequest("No se puede eliminar la categoría porque tiene productos asociados.");

            _context.Categorias.Remove(categoria);
            await _context.SaveChangesAsync();
            return NoContent();
        }
    }
}
