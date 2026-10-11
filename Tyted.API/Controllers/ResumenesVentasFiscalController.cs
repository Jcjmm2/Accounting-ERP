using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Tyted.API.Data;
using Tyted.API.Models;
using Tyted.API.Services;

namespace Tyted.API.Controllers
{
    /// <summary>
    /// Resúmenes de ventas de la máquina fiscal (cierre Z) del Libro de Ventas
    /// SENIAT: documento declarativo con el N° de control de la máquina, el N° Z
    /// y el rango de facturas del resumen. Cada resumen se contabiliza con UN
    /// asiento de diario (Debe Caja | Haber Ingresos + IVA Débito Fiscal).
    /// </summary>
    [Route("api/resumenes-ventas-fiscal")]
    [ApiController]
    [Authorize(Roles = "AdministradorSistema,Administrador,Analista,Cajero")]
    public class ResumenesVentasFiscalController : ControllerBase
    {
        private readonly TytedContext _context;
        // Motor de asientos automáticos: 1 comprobante por resumen (idempotente).
        private readonly MotorAsientosAutomaticos _motor;

        public ResumenesVentasFiscalController(TytedContext context, MotorAsientosAutomaticos motor)
        {
            _context = context;
            _motor = motor;
        }

        // GET: api/resumenes-ventas-fiscal?fechaInicio=&fechaFin=&empresaId=
        [HttpGet]
        public async Task<ActionResult<IEnumerable<ResumenVentaFiscal>>> GetResumenes(
            [FromQuery] DateTime? fechaInicio,
            [FromQuery] DateTime? fechaFin,
            [FromQuery] int? empresaId)
        {
            var query = _context.ResumenesVentasFiscales
                .AsNoTracking()
                .AsQueryable();

            if (empresaId.HasValue)
                query = query.Where(r => r.EmpresaId == empresaId.Value);

            if (fechaInicio.HasValue)
                query = query.Where(r => r.Fecha >= fechaInicio.Value);

            // fechaFin inclusiva por día (mismo criterio que los libros de IVA)
            if (fechaFin.HasValue)
                query = query.Where(r => r.Fecha < fechaFin.Value.Date.AddDays(1));

            return await query.OrderByDescending(r => r.Fecha).ThenByDescending(r => r.Id).ToListAsync();
        }

        // POST: api/resumenes-ventas-fiscal
        [HttpPost]
        public async Task<ActionResult<ResumenVentaFiscal>> PostResumen(ResumenVentaFiscal resumen)
        {
            if (resumen is null)
                return BadRequest(new { message = "El cuerpo de la petición no es un resumen válido." });
            if (string.IsNullOrWhiteSpace(resumen.NumeroControlMaquina))
                return BadRequest(new { message = "El N° de control de la máquina fiscal es obligatorio." });
            if (string.IsNullOrWhiteSpace(resumen.NumeroZ))
                return BadRequest(new { message = "El N° Z es obligatorio." });
            if (string.IsNullOrWhiteSpace(resumen.FacturaDesde) || string.IsNullOrWhiteSpace(resumen.FacturaHasta))
                return BadRequest(new { message = "Indique el rango de facturas (Desde/Hasta) del resumen." });
            if (resumen.EmpresaId <= 0)
                return BadRequest(new { message = "Indique la empresa a la que pertenece el resumen." });

            // El rango debe ser coherente (comparación numérica; los números
            // vienen con relleno de ceros, p. ej. 00000940 <= 00000952).
            if (long.TryParse(resumen.FacturaDesde, out var desde) &&
                long.TryParse(resumen.FacturaHasta, out var hasta) &&
                desde > hasta)
            {
                return BadRequest(new { message = "La factura 'Desde' no puede ser mayor que la 'Hasta'." });
            }

            // Cuadre de montos: Total = Exento + Base gravada + IVA
            var totalCalculado = resumen.Exento + resumen.BaseGravada + resumen.Iva;
            if (resumen.Total <= 0m)
                resumen.Total = totalCalculado;
            else if (Math.Abs(resumen.Total - totalCalculado) > 0.005m)
                return BadRequest(new { message = "El total del resumen debe ser igual a Exento + Base gravada + IVA." });

            // Un solo resumen por N° Z y empresa (el cierre Z es único por día)
            var duplicado = await _context.ResumenesVentasFiscales.AnyAsync(r =>
                r.EmpresaId == resumen.EmpresaId
                && r.NumeroZ == resumen.NumeroZ
                && !r.IsAnulada);
            if (duplicado)
                return BadRequest(new { message = $"Ya existe un resumen con N° Z {resumen.NumeroZ} para esta empresa." });

            resumen.Origen = "Fiscal";
            resumen.IsAnulada = false;
            resumen.AsientoContableId = null;
            if (string.IsNullOrWhiteSpace(resumen.Usuario))
                resumen.Usuario = "FISCAL";
            if (resumen.Fecha == default)
                resumen.Fecha = DateTime.UtcNow;

            _context.ResumenesVentasFiscales.Add(resumen);
            await _context.SaveChangesAsync();
            return Ok(resumen);
        }

        // POST: api/resumenes-ventas-fiscal/5/contabilizar
        [HttpPost("{id}/contabilizar")]
        public async Task<IActionResult> Contabilizar(int id)
        {
            var resumen = await _context.ResumenesVentasFiscales.FindAsync(id);
            if (resumen == null)
                return NotFound(new { message = "El resumen de ventas no existe." });

            try
            {
                var resultado = await _motor.GenerarAsientoResumenVentaAsync(resumen);
                return Ok(resultado);
            }
            catch (InvalidOperationException ex)
            {
                // Sin periodo contable abierto u otras validaciones de negocio
                return BadRequest(new { message = ex.Message });
            }
            catch (Exception ex)
            {
                return BadRequest(new { message = $"No se pudo contabilizar el resumen: {ex.Message}" });
            }
        }
    }
}
