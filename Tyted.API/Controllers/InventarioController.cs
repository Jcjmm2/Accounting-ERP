using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Tyted.API.Data;
using Tyted.API.Models;

namespace Tyted.API.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class InventarioController : ControllerBase
    {
        private readonly TytedContext _context;

        public InventarioController(TytedContext context)
        {
            _context = context;
        }

        // --- EL MÉTODO DEBE IR AQUÍ ADENTRO ---
        [HttpGet("movimientos/{codigoProd}")]
        public async Task<IActionResult> GetMovimientos(string codigoProd)
        {
            var movimientos = await _context.InventarioMovimientos
                .Where(m => m.CodigoProd == codigoProd)
                .OrderByDescending(m => m.Fecha)
                .ToListAsync();

            return Ok(movimientos);
        }
    } // Cierre de la Clase
} // Cierre del Namespace