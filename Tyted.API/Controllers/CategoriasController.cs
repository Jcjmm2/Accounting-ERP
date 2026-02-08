using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.AspNetCore.Authorization;
using Tyted.API.Data;
using Tyted.API.Models;

namespace Tyted.API.Controllers
{
    [Route("api/[controller]")]
    [Authorize(Roles = "AdministradorSistema,Administrador,Comprador,Cajero")] 
    [ApiController]
    public class CategoriasController : ControllerBase
    {
        private readonly TytedContext _context;

        public CategoriasController(TytedContext context)
        {
            _context = context;
        }

        // GET: api/Categorias
        [HttpGet]
        public async Task<ActionResult<IEnumerable<Categoria>>> GetCategorias()
        {
            return await _context.Categorias.ToListAsync();
        }

        // GET: api/Categorias/5
        [HttpGet("{id}")]
        public async Task<ActionResult<Categoria>> GetCategoria(int id)
        {
            var categoria = await _context.Categorias.FindAsync(id);

            if (categoria == null)
            {
                return NotFound();
            }

            return categoria;
        }

        // POST: api/Categorias
        [HttpPost]
        public async Task<ActionResult<Categoria>> PostCategoria(Categoria categoria)
        {
            if (categoria == null) return BadRequest("Datos inválidos");

            // Validar que no exista el nombre duplicado
            bool existe = await _context.Categorias
                .AnyAsync(c => c.Nombre == categoria.Nombre);
            
            if (existe)
            {
                return BadRequest(new { message = "Ya existe una categoría con ese nombre." });
            }

            _context.Categorias.Add(categoria);
            await _context.SaveChangesAsync();

            return CreatedAtAction("GetCategoria", new { id = categoria.IdCategoria }, categoria);
        }

        // PUT: api/Categorias/5
        [HttpPut("{id}")]
        public async Task<IActionResult> PutCategoria(int id, Categoria categoria)
        {
            if (id != categoria.IdCategoria)
            {
                return BadRequest("El ID de la URL no coincide con el cuerpo de la petición.");
            }

            _context.Entry(categoria).State = EntityState.Modified;

            try
            {
                await _context.SaveChangesAsync();
            }
            catch (DbUpdateConcurrencyException)
            {
                if (!CategoriaExists(id))
                {
                    return NotFound();
                }
                else
                {
                    throw;
                }
            }

            // Retornamos OK con mensaje para que el frontend pueda mostrar la alerta de éxito
            return Ok(new { message = "Categoría actualizada correctamente." });
        }

        // DELETE: api/Categorias/5
        [HttpDelete("{id}")]
        public async Task<IActionResult> DeleteCategoria(int id)
        {
            var categoria = await _context.Categorias.FindAsync(id);
            if (categoria == null)
            {
                return NotFound();
            }

            // VALIDACIÓN: No borrar si hay productos usando esta categoría
            // Asume que tu tabla de productos se llama _context.Productos y tiene el campo IdCategoria
            bool enUso = await _context.Productos.AnyAsync(p => p.IdCategoria == id);
            
            if (enUso)
            {
                // Retornamos BadRequest con JSON para que el frontend lo capture
                return BadRequest(new { message = "No se puede eliminar: Hay productos asignados a esta categoría." });
            }

            _context.Categorias.Remove(categoria);
            await _context.SaveChangesAsync();

            return Ok(new { message = "Categoría eliminada." });
        }

        private bool CategoriaExists(int id)
        {
            return _context.Categorias.Any(e => e.IdCategoria == id);
        }
    }
}
