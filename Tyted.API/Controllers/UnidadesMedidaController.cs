using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Tyted.API.Data;
using Tyted.API.Models;

[Route("api/[controller]")]
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
}