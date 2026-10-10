using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Tyted.API.Data;
using Microsoft.AspNetCore.Authorization;
using Tyted.API.Models;
using Tyted.API.Services;

namespace Tyted.API.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    [Authorize(Roles = "AdministradorSistema,Administrador,Comprador")]
    public class ComprasController : ControllerBase
    {
        private readonly TytedContext _context;
        private readonly CompraService _compraService;
        // Motor de asientos automáticos: genera el comprobante contable de la
        // compra (integración administrativo-contable, plan BE-F4).
        private readonly MotorAsientosAutomaticos _motor;

        public ComprasController(TytedContext context, CompraService compraService, MotorAsientosAutomaticos motor)
        {
            _context = context;
            _compraService = compraService;
            _motor = motor;
        }

        // GET: api/Compras
        [HttpGet]
        public async Task<ActionResult<IEnumerable<Compra>>> GetCompras(
            [FromQuery] DateTime? fechaInicio,
            [FromQuery] DateTime? fechaFin,
            [FromQuery] int? empresaId)
        {
            // Filtros opcionales del Libro de Compras fiscal: rango del periodo
            // contable activo y aislamiento multiempresa. Sin parámetros se
            // conserva el comportamiento histórico (todas las compras).
            var query = _context.Compras
                .Include(c => c.Proveedor)
                .Include(c => c.Detalles)
                .AsQueryable();

            if (empresaId.HasValue)
                query = query.Where(c => c.EmpresaId == empresaId.Value);

            if (fechaInicio.HasValue)
                query = query.Where(c => c.FechaCompra >= fechaInicio.Value);

            // fechaFin inclusiva por día: cubre documentos con hora del último día
            if (fechaFin.HasValue)
                query = query.Where(c => c.FechaCompra < fechaFin.Value.Date.AddDays(1));

            return await query
                .OrderByDescending(c => c.FechaCompra)
                .ToListAsync();
        }

        // GET: api/Compras/5
        [HttpGet("{id}")]
        public async Task<ActionResult<Compra>> GetCompra(int id)
        {
            var compra = await _context.Compras
                .Include(c => c.Proveedor)
                .Include(c => c.Detalles)
                .FirstOrDefaultAsync(c => c.Id == id);

            if (compra == null) return NotFound();

            return compra;
        }

        // POST: api/Compras
        [HttpPost]
        public async Task<ActionResult<Compra>> PostCompra(Compra compra)
        {
            if (!ModelState.IsValid)
            {
                return BadRequest(ModelState); 
            }
            try
            {
                var nuevaCompra = await _compraService.RegistrarCompraAsync(compra);
                return CreatedAtAction(nameof(GetCompra), new { id = nuevaCompra.Id }, nuevaCompra);
            }
            catch (Exception ex)
            {
                return BadRequest(new { message = ex.Message });
            }            
        }

        [HttpPost("anular/{id}")]
        public async Task<IActionResult> AnularCompra(int id)
        {
            try
            {
                await _compraService.AnularCompraAsync(id);
                return Ok(new { message = "Compra anulada exitosamente. El stock y costos han sido revertidos." });
            }
            catch (Exception ex)
            {
                return BadRequest(new { message = ex.Message });
            }
        }

        // ==========================================================
        // LIBRO DE COMPRAS FISCAL (SENIAT) E INTEGRACIÓN CONTABLE
        // ==========================================================

        /// <summary>
        /// Actualiza los campos fiscales de la compra: tipo de transacción SENIAT
        /// (01-Registro, 02-Complemento, 03-Anulación) y N° Control del proveedor.
        /// </summary>
        [HttpPut("{id}/fiscal")]
        public async Task<ActionResult<Compra>> ActualizarFiscalCompra(int id, [FromBody] ActualizarDocumentoFiscalDto dto)
        {
            var compra = await _context.Compras.FirstOrDefaultAsync(c => c.Id == id);
            if (compra == null) return NotFound(new { message = "La compra no existe." });

            var tiposValidos = new[] { "01", "02", "03" };
            if (dto is null || string.IsNullOrWhiteSpace(dto.TipoTransaccion) || !tiposValidos.Contains(dto.TipoTransaccion))
                return BadRequest(new { message = "Tipo de transacción inválido. Use 01 (Registro), 02 (Complemento) o 03 (Anulación)." });

            compra.TipoTransaccion = dto.TipoTransaccion;
            compra.NumeroControl = dto.NumeroControl;
            await _context.SaveChangesAsync();
            return Ok(compra);
        }

        /// <summary>
        /// Genera el comprobante contable de la compra (partida doble) mediante el
        /// motor de asientos automáticos y vincula el asiento a la compra.
        /// </summary>
        [HttpPost("{id}/contabilizar")]
        public async Task<ActionResult<MotorAsientosResponse>> ContabilizarCompra(int id)
        {
            var compra = await _context.Compras
                .Include(c => c.Detalles)
                .Include(c => c.Proveedor)
                .FirstOrDefaultAsync(c => c.Id == id);
            if (compra == null) return NotFound(new { message = "La compra no existe." });

            try
            {
                var usuarioId = await ObtenerUsuarioIdAsync();
                var respuesta = await _motor.GenerarAsientoCompraAsync(compra, usuarioId);
                return Ok(respuesta);
            }
            catch (InvalidOperationException ex)
            {
                return BadRequest(new { message = ex.Message });
            }
        }

        /// <summary>Id real del usuario autenticado (auditoría y comprobantes).</summary>
        private async Task<int> ObtenerUsuarioIdAsync()
        {
            var nombre = User.Identity?.Name;
            if (string.IsNullOrEmpty(nombre)) return 1;
            var usuario = await _context.Usuarios.AsNoTracking().FirstOrDefaultAsync(u => u.Username == nombre);
            return usuario?.Id ?? 1;
        }

        // ==========================================================
        // ACTUALIZADO: AHORA GUARDA PRECIO 1, 2 Y 3
        // ==========================================================
        [HttpPost("confirmar-precios")]
        public async Task<IActionResult> ConfirmarPrecios([FromBody] List<ConfirmarPrecioDto> propuestas)
        {
            if (propuestas == null || !propuestas.Any()) 
                return BadRequest("No hay propuestas para procesar.");

            try
            {
                var tasaActual = await _context.TasaDeCambio
                    .Where(t => t.MonedaOrigen == "USD" && t.MonedaDestino == "VES")
                    .OrderByDescending(t => t.FechaVigencia)
                    .Select(t => t.Tasa)
                    .FirstOrDefaultAsync();

                foreach (var item in propuestas)
                {
                    var unidad = await _context.ProductosUnidad.FirstOrDefaultAsync(u => u.IdProductoUnidad == item.IdProductoUnidad);
                    if (unidad != null)
                    {
                        // Actualizar Valores Base (USD)
                        unidad.CostoUnitarioMonedaBase = item.NuevoCostoBase;
                        unidad.PrecioMonedaBase = item.NuevoPrecioBase;
                        unidad.Precio2MonedaBase = item.NuevoPrecio2Base;
                        unidad.Precio3MonedaBase = item.NuevoPrecio3Base;

                        // ACTUALIZACIÓN DE TASAS: Sincronizar con la moneda extranjera (VES)
                        if (tasaActual > 0)
                        {
                            unidad.CostoUnitarioMonedaExt = item.NuevoCostoBase * tasaActual;
                            unidad.PrecioMonedaExt = item.NuevoPrecioBase * tasaActual;
                            unidad.Precio2MonedaExt = (item.NuevoPrecio2Base) * tasaActual;
                            unidad.Precio3MonedaExt = (item.NuevoPrecio3Base) * tasaActual;
                        }

                        _context.Entry(unidad).State = EntityState.Modified;
                    }
                }

                await _context.SaveChangesAsync();
                return Ok(new { message = "Precios y costos actualizados con éxito." });
            }
            catch (Exception ex)
            {
                return BadRequest(new { message = $"Error al actualizar precios: {ex.Message}" });
            }
        }
    }

    // ==========================================================
    // DTO ACTUALIZADO: INCLUYE LOS 3 PRECIOS
    // ==========================================================
    public class ConfirmarPrecioDto
    {
        public int IdProductoUnidad { get; set; }
        public decimal NuevoCostoBase { get; set; }
        public decimal NuevoPrecioBase { get; set; }  // Mapea al Precio 1
        public decimal NuevoPrecio2Base { get; set; } // Mapea al Precio 2
        public decimal NuevoPrecio3Base { get; set; } // Mapea al Precio 3
    }
}