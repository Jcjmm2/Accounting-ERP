using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Tyted.API.Data;
using Tyted.API.Models;
using System.Collections.Generic;
using System.Threading.Tasks;

[Route("api/[controller]")]
[ApiController]
public class TasasIVAController : ControllerBase
{
    private readonly TytedContext _context;

    public TasasIVAController(TytedContext context)
    {
        _context = context;
    }

    // GET: /api/TasasIVA
    [HttpGet]
    public async Task<ActionResult<IEnumerable<TasaIVA>>> GetTasas()
    {
        var list = await _context.TasasIVA.AsNoTracking().ToListAsync();
        return Ok(list);
    }
}
