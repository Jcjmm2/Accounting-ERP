using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore; // IMPORTANTE: Para usar Include y ToListAsync
using Tyted.API.Data; // IMPORTANTE: Donde reside tu TytedContext
using Tyted.API.Models;
using Tyted.API.Services;

namespace Tyted.API.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class VentasController : ControllerBase
    {
        private readonly VentaService _ventaService;
        private readonly TytedContext _context; // Agregamos el contexto

        private readonly VentaDetalle _ventaDetalle;

        // Actualizamos el constructor para recibir AMBOS servicios
        public VentasController(VentaService ventaService, TytedContext context)
        {
            _ventaService = ventaService;
            _context = context;
            
            
        }

        [HttpPost]
        public async Task<IActionResult> RegistrarVenta([FromBody] Venta venta)
        {
            var caja = await _context.CajaSesiones
                    .FirstOrDefaultAsync(c => c.IsAbierta && c.Usuario == "CAJERO_PRINCIPAL");

                if (caja == null)
                {
                    return BadRequest("OPERACIÓN DENEGADA: La caja está cerrada. Debe realizar una apertura para facturar.");
                }

               
            try
            {
                var nuevaVenta = await _ventaService.RegistrarVentaAsync(venta);
                return Ok(nuevaVenta);
            }
            catch (Exception ex)
            {
                return BadRequest(new { message = ex.Message });
            }
        }

        [HttpPost("anular/{id}")]
        public async Task<IActionResult> AnularVenta(int id)
        {
            try
            {
                await _ventaService.AnularVentaAsync(id);
                return Ok(new { message = "Venta anulada y stock devuelto al inventario con éxito." });
            }
            catch (Exception ex)
            {
                return BadRequest(new { message = ex.Message });
            }
        }

        [HttpGet("reporte-diario")]
        public async Task<ActionResult> GetReporte(DateTime? fecha)
        {
            var fechaConsulta = fecha ?? DateTime.Now;
            var reporte = await _ventaService.GetReporteDiarioAsync(fechaConsulta);
            return Ok(reporte);
        }

        [HttpPost("consultar-cuadre-caja")]
        public async Task<IActionResult> ConsultarCuadreCaja([FromBody] ArqueoCajaDTO arqueo)
        {
            var hoy = DateTime.Today;
            var ventasHoy = await _context.Ventas
                .Where(v => v.FechaVenta.Date == hoy && !v.IsAnulada)
                .ToListAsync();

            // 1. Lo que dice el sistema que hay en cada método
            decimal sistemaUSD = ventasHoy
                .Where(v => v.MetodoPago == "EFECTIVO USD")
                .Sum(v => v.TotalMonedaBase);

            decimal sistemaPagoMovil = ventasHoy
                .Where(v => v.MetodoPago == "PAGO MOVIL")
                .Sum(v => v.TotalMonedaBase); // Se suma en base (USD) para comparar con el DTO

            // 2. Cálculo de diferencias individuales
            decimal difUSD = arqueo.EfectivoUSDDeclarado - sistemaUSD;
            decimal difPM = arqueo.PagoMovilDeclarado - sistemaPagoMovil;

            // 3. Resultado global
            // Una caja está cuadrada SOLO si TODAS las diferencias son cero
            bool estaCuadrado = (difUSD == 0 && difPM == 0);

            return Ok(new ResultadoArqueoDTO {
                DiferenciaUSD = difUSD,
                DiferenciaVES = difPM, // Usamos este campo para la diferencia de Pago Móvil
                Estado = estaCuadrado ? "Cuadrado" : "Descuadrado",
                Mensaje = estaCuadrado ? "Caja perfectamente cuadrada" : 
                          $"Diferencia USD: ${difUSD:N2} | Diferencia Pago Móvil: ${difPM:N2}"
            });
        }
        [HttpGet("reporte-productos")]
        public async Task<IActionResult> GetVentasPorProducto(DateTime? fecha = null)
        {
            var f = fecha ?? DateTime.Today;

            var reporte = await _context.VentasDetalle
                .Where(d => d.Venta.FechaVenta.Date == f.Date && !d.Venta.IsAnulada)
                .GroupBy(d => new { d.CodigoProd, d.NombreUnidad })
                .Select(g => new
                {
                    Codigo = g.Key.CodigoProd,
                    Unidad = g.Key.NombreUnidad,
                    CantidadTotal = g.Sum(d => d.Cantidad),
                    TotalUSD = g.Sum(d => d.TotalLineaMonedaBase)
                })
                .OrderByDescending(x => x.TotalUSD)
                .ToListAsync();

            return Ok(reporte);
        }
        [HttpPost("abrir-caja")]
        public async Task<IActionResult> AbrirCaja([FromBody] decimal montoInicial)
        {
            // Verificar si ya hay una abierta para no duplicar
            var existe = await _context.CajaSesiones.AnyAsync(c => c.IsAbierta);
            if (existe) return BadRequest("Ya existe una sesión de caja abierta.");

            var nuevaCaja = new CajaSesion
            {
                FechaApertura = DateTime.Now,
                MontoAperturaUSD = montoInicial,
                Usuario = "CAJERO_PRINCIPAL",
                IsAbierta = true
            };

            _context.CajaSesiones.Add(nuevaCaja);
            await _context.SaveChangesAsync();
            return Ok(new { message = "Caja abierta exitosamente" });
        }
        [HttpPost("cerrar-caja")]
        public async Task<IActionResult> CerrarCaja([FromBody] ArqueoCajaDTO arqueo)
        {
            var caja = await _context.CajaSesiones
                .FirstOrDefaultAsync(c => c.IsAbierta && c.Usuario == "CAJERO_PRINCIPAL");

            if (caja == null) return BadRequest("No hay una caja abierta para cerrar.");

            caja.FechaCierre = DateTime.Now;
            caja.MontoCierreEfectivoUSD = arqueo.EfectivoUSDDeclarado;
            caja.MontoCierrePagoMovilUSD = arqueo.PagoMovilDeclarado;
            caja.ObservacionesCierre = arqueo.Observaciones; // <--- Se guarda en la DB
            caja.IsAbierta = false; 

            await _context.SaveChangesAsync();
            return Ok(new { message = "Caja cerrada exitosamente" });
        }
        [HttpGet("estado-caja")]
        public async Task<IActionResult> GetEstadoCaja()
        {
            // Verifica si hay una caja abierta para el usuario actual
            var abierta = await _context.CajaSesiones
                .AnyAsync(c => c.IsAbierta && c.Usuario == "CAJERO_PRINCIPAL");
            
            // Retorna simplemente true o false
            return Ok(abierta);
        }
    }
    
}