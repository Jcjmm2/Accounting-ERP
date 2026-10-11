using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Tyted.API.Data;
using Tyted.API.Models;

namespace Tyted.API.Controllers
{
    /// <summary>
    /// Catálogo de CONCEPTOS DE OPERACIÓN por empresa (GASTO/VENTA/COMPRA):
    /// puente entre los formularios del módulo fiscal y el plan de cuentas.
    /// El frontend envía el Id del concepto; el motor contable usa su
    /// CuentaContable para generar la partida doble.
    /// </summary>
    [Route("api/conceptos-operacionales")]
    [ApiController]
    [Authorize(Roles = "AdministradorSistema,Administrador,Analista,Comprador,Cajero")]
    public class ConceptosOperacionalesController : ControllerBase
    {
        private readonly TytedContext _context;

        public ConceptosOperacionalesController(TytedContext context)
        {
            _context = context;
        }

        // GET: api/conceptos-operacionales?empresaId=1&tipo=GASTO
        [HttpGet]
        public async Task<ActionResult<IEnumerable<ConceptoOperacional>>> GetConceptos(
            [FromQuery] int? empresaId,
            [FromQuery] string? tipo)
        {
            var query = _context.ConceptosOperacionales
                .AsNoTracking()
                .AsQueryable();

            if (empresaId.HasValue)
                query = query.Where(c => c.EmpresaId == empresaId.Value);

            if (!string.IsNullOrWhiteSpace(tipo))
                query = query.Where(c => c.TipoOperacion == tipo.ToUpper());

            return await query.OrderBy(c => c.NombreConcepto).ToListAsync();
        }

        // GET: api/conceptos-operacionales/5
        [HttpGet("{id}")]
        public async Task<ActionResult<ConceptoOperacional>> GetConcepto(int id)
        {
            var concepto = await _context.ConceptosOperacionales
                .AsNoTracking()
                .FirstOrDefaultAsync(c => c.Id == id);

            if (concepto == null) return NotFound();
            return concepto;
        }

        // POST: api/conceptos-operacionales
        [HttpPost]
        [Authorize(Roles = "AdministradorSistema,Administrador")]
        public async Task<ActionResult<ConceptoOperacional>> PostConcepto(ConceptoOperacional concepto)
        {
            if (concepto is null || string.IsNullOrWhiteSpace(concepto.NombreConcepto))
                return BadRequest(new { message = "El nombre del concepto es obligatorio." });

            concepto.TipoOperacion = (concepto.TipoOperacion ?? "GASTO").ToUpper();
            if (!new[] { "COMPRA", "VENTA", "GASTO" }.Contains(concepto.TipoOperacion))
                return BadRequest(new { message = "El tipo de operación debe ser COMPRA, VENTA o GASTO." });

            var duplicado = await _context.ConceptosOperacionales.AnyAsync(c =>
                c.EmpresaId == concepto.EmpresaId
                && c.NombreConcepto == concepto.NombreConcepto
                && c.TipoOperacion == concepto.TipoOperacion);
            if (duplicado)
                return BadRequest(new { message = "Ya existe un concepto con ese nombre para esta empresa y tipo de operación." });

            _context.ConceptosOperacionales.Add(concepto);
            await _context.SaveChangesAsync();
            return CreatedAtAction(nameof(GetConcepto), new { id = concepto.Id }, concepto);
        }

        // PUT: api/conceptos-operacionales/5
        [HttpPut("{id}")]
        [Authorize(Roles = "AdministradorSistema,Administrador")]
        public async Task<IActionResult> PutConcepto(int id, ConceptoOperacional datos)
        {
            var concepto = await _context.ConceptosOperacionales.FindAsync(id);
            if (concepto == null) return NotFound();

            concepto.NombreConcepto = datos.NombreConcepto?.Trim() ?? concepto.NombreConcepto;
            concepto.CuentaContable = datos.CuentaContable?.Trim() ?? concepto.CuentaContable;
            if (!string.IsNullOrWhiteSpace(datos.TipoOperacion))
                concepto.TipoOperacion = datos.TipoOperacion.ToUpper();

            try
            {
                await _context.SaveChangesAsync();
            }
            catch (DbUpdateConcurrencyException)
            {
                if (!await _context.ConceptosOperacionales.AnyAsync(c => c.Id == id))
                    return NotFound();
                throw;
            }
            return NoContent();
        }

        // DELETE: api/conceptos-operacionales/5 (bloqueado si ya está en uso)
        [HttpDelete("{id}")]
        [Authorize(Roles = "AdministradorSistema,Administrador")]
        public async Task<IActionResult> DeleteConcepto(int id)
        {
            var concepto = await _context.ConceptosOperacionales.FindAsync(id);
            if (concepto == null) return NotFound();

            var enUso = await _context.Gastos.AnyAsync(g => g.ConceptoOperacionalId == id)
                || await _context.VentasDetalle.AnyAsync(d => d.ConceptoOperacionalId == id);
            if (enUso)
                return BadRequest(new { message = "El concepto está en uso por gastos o ventas; no puede eliminarse." });

            _context.ConceptosOperacionales.Remove(concepto);
            await _context.SaveChangesAsync();
            return NoContent();
        }
    }
}
