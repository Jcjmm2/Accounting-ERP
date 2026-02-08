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
    public class ClientesController : ControllerBase
    {
        private readonly TytedContext _context;

        public ClientesController(TytedContext context) => _context = context;

        [HttpGet("buscar/{termino}")]
        public async Task<IActionResult> Buscar(string termino)
        {
            // Busca por RIF o Nombre para agilidad en el POS
            var clientes = await _context.Clientes
                .Where(c => c.Rif.Contains(termino) || c.Nombre.Contains(termino))
                .Take(5)
                .ToListAsync();
            return Ok(clientes);
        }

        [HttpPost]
        public async Task<IActionResult> Crear([FromBody] Cliente cliente)
        {
            if (await _context.Clientes.AnyAsync(c => c.Rif == cliente.Rif))
                return BadRequest("El RIF ya está registrado");

            _context.Clientes.Add(cliente);
            await _context.SaveChangesAsync();
            return Ok(cliente);
        }
        [HttpPut("{id}")]
        public async Task<IActionResult> Actualizar(int id, [FromBody] Cliente cliente)
        {
            if (id != cliente.Id) return BadRequest("El ID del cliente no coincide");

            _context.Entry(cliente).State = EntityState.Modified;

            try {
                await _context.SaveChangesAsync();
            }
            catch (DbUpdateConcurrencyException) {
                if (!_context.Clientes.Any(e => e.Id == id)) return NotFound();
                else throw;
            }

            return NoContent();
        }
        [HttpGet]
        public async Task<IActionResult> GetAll()
        {
            // Retorna los últimos 20 clientes registrados para que la tabla no esté vacía
            var clientes = await _context.Clientes
                .OrderByDescending(c => c.Id)
                .Take(20)
                .ToListAsync();
            return Ok(clientes);
        }
    }
}