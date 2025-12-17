using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Tyted.API.Data;
using Tyted.API.Models;
using System.Collections.Generic;
using System.Threading.Tasks;

[Route("api/[controller]")]
[ApiController]
public class CategoriasController : ControllerBase
{
    private readonly TytedContext _context;

    public CategoriasController(TytedContext context)
    {
        _context = context;
    }

    // GET: /api/Categorias
    [HttpGet]
    public async Task<ActionResult<IEnumerable<Categoria>>> GetCategorias()
    {
        var list = await _context.Categorias.AsNoTracking().ToListAsync();
        return Ok(list);
    }
}
