using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Tyted.API.Data;
using Tyted.API.Models;
using Microsoft.AspNetCore.Authorization;
using Tyted.API.Services;

namespace Tyted.API.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    [Authorize(Roles = "AdministradorSistema,Administrador,Cajero")] 
    public class VentasController : ControllerBase
    {
        private readonly VentaService _ventaService;
        private readonly TytedContext _context;

        public VentasController(VentaService ventaService, TytedContext context)
        {
            _ventaService = ventaService;
            _context = context;
        }
        // --- GESTIÓN DE VENTAS ---

        [HttpGet]
        public async Task<ActionResult<IEnumerable<Venta>>> GetVentas()
        {
            var ventas = await _ventaService.ObtenerTodasAsync();
            return Ok(ventas);
        }

        [HttpPost]
        public async Task<IActionResult> RegistrarVenta([FromBody] Venta venta)
        {
            string usuarioActual = User.Identity?.Name;

            if (string.IsNullOrEmpty(usuarioActual)) 
            {
                return Unauthorized("No se pudo identificar al usuario.");
            }
            
            var caja = await _context.CajaSesiones
                .FirstOrDefaultAsync(c => c.IsAbierta && c.Usuario == usuarioActual);

            if (caja == null)
                return BadRequest($"OPERACIÓN DENEGADA: El usuario {usuarioActual} no tiene una sesión de caja abierta. Debe realizar una apertura.");

            venta.Usuario = usuarioActual;
            // Ahora delegamos el error al Middleware global
            var nuevaVenta = await _ventaService.RegistrarVentaAsync(venta);
            return Ok(nuevaVenta);
        }

        [HttpPost("anular/{id}")]
        public async Task<IActionResult> AnularVenta(int id, [FromHeader(Name = "X-Admin-Key")] string adminKey)
        {
            // En producción, esto debería venir de una configuración en la DB
            const string CLAVE_SEGURIDAD = "admin123";

            if (adminKey != CLAVE_SEGURIDAD)
            {
                return Unauthorized(new { message = "Clave de autorización de administrador inválida." });
            }

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

        // --- ARQUEO Y CIERRE DE CAJA ---
    
        [HttpGet("reporte-diario")]
        public async Task<IActionResult> GetReporteDiario()
        {
            var reporte = await _ventaService.GetReporteDiarioAsync(null);
                return Ok(reporte);
        }

        [HttpPost("consultar-cuadre-caja")]
        public async Task<IActionResult> ConsultarCuadreCaja([FromBody] ArqueoCajaDTO arqueo)
        {
            // Obtenemos lo que el sistema dice que debería haber según las facturas
            var totalesSistema = await _ventaService.GetReporteDiarioAsync(null);

            // Calculamos diferencias individuales
            decimal difUSD = (decimal)arqueo.EfectivoUSDDeclarado - totalesSistema.MontoEfectivoUSD;
            decimal difVES = (decimal)arqueo.EfectivoVESDeclarado - totalesSistema.MontoEfectivoVES;
            decimal difPM = (decimal)arqueo.PagoMovilDeclarado - totalesSistema.MontoPagoMovil;
            decimal difBDV = (decimal)arqueo.BDVDeclarado - totalesSistema.MontoBDV;
            decimal difBancamiga = (decimal)arqueo.BancamigaDeclarado - totalesSistema.MontoBancamiga;
            decimal difMetal = (decimal)arqueo.MetalDeclarado - totalesSistema.MontoMetal;

            // Se considera cuadrado si las 3 monedas coinciden (margen 0.01)
            bool estaCuadrado = Math.Abs(difUSD) < 0.01m && 
                                Math.Abs(difVES) < 0.01m && 
                                Math.Abs(difPM) < 0.01m &&
                                Math.Abs(difBDV) < 0.01m &&
                                Math.Abs(difBancamiga) < 0.01m &&
                                Math.Abs(difMetal) < 0.01m 
                                ;

            return Ok(new {
                Estado = estaCuadrado ? "Cuadrado" : "Descuadrado",
                DiferenciaUSD = difUSD,
                DiferenciaVES = difVES, 
                DiferenciaPM = difPM,
                DiferenciaBDV = difBDV,
                DiferenciaBancamiga = difBancamiga,
                DiferenciaMetal = difMetal,
                Mensaje = estaCuadrado ? "Caja Cuadrada" : "Existen diferencias en el arqueo"
            });
        }

        // --- SESIONES DE CAJA ---

        [HttpPost("abrir-caja")]
        public async Task<IActionResult> AbrirCaja([FromBody] decimal montoInicial)
        {
            string usuarioActual = User.Identity?.Name; // <--- OBTENER DEL TOKEN
            if (string.IsNullOrEmpty(usuarioActual)) return Unauthorized();

            var existeMismaCaja = await _context.CajaSesiones
                .AnyAsync(c => c.IsAbierta && c.Usuario == usuarioActual);
                
            if (existeMismaCaja) return BadRequest($"El usuario {usuarioActual} ya tiene una caja abierta.");

            // 2. Opcional: Validar si OTRO usuario tiene la caja abierta (si solo tienes 1 PC)
            // var existeOtraCaja = await _context.CajaSesiones.AnyAsync(c => c.IsAbierta);
            // if (existeOtraCaja) return BadRequest("Hay una caja abierta por otro usuario. Debe cerrarse primero.");

            var nuevaCaja = new CajaSesion
            {
                FechaApertura = DateTime.Now,
                MontoAperturaUSD = montoInicial,
                Usuario = usuarioActual,
                IsAbierta = true
            };

            _context.CajaSesiones.Add(nuevaCaja);
            await _context.SaveChangesAsync();
            return Ok(new { message = "Caja abierta exitosamente" });
        }

        [HttpPost("cerrar-caja")]
        public async Task<IActionResult> CerrarCaja([FromBody] ArqueoCajaDTO arqueo)
        {
            string usuarioActual = User.Identity?.Name;

            var caja = await _context.CajaSesiones
                .FirstOrDefaultAsync(c => c.IsAbierta && c.Usuario == usuarioActual);

            if (caja == null) return BadRequest("No hay una caja abierta para cerrar.");

            caja.FechaCierre = DateTime.Now;
            caja.MontoCierreEfectivoUSD = arqueo.EfectivoUSDDeclarado;
            caja.MontoCierrePagoMovilUSD = arqueo.PagoMovilDeclarado;
            caja.ObservacionesCierre = arqueo.Observaciones;
            caja.IsAbierta = false; 

            await _context.SaveChangesAsync();
            return Ok(new { message = "Caja cerrada exitosamente" });
        }

        [HttpGet("estado-caja")]
        public async Task<IActionResult> GetEstadoCaja()
        {
            string usuarioActual = User.Identity?.Name;
            if (string.IsNullOrEmpty(usuarioActual)) return Ok(false);
            var abierta = await _context.CajaSesiones
                .AnyAsync(c => c.IsAbierta && c.Usuario == usuarioActual);
            return Ok(abierta);
        }

        // --- REPORTES ---

        [HttpGet("reporte-productos")]
        public async Task<IActionResult> GetVentasPorProducto()
        {
            string usuarioActual = User.Identity?.Name;
            
            var cajaActiva = await _context.CajaSesiones
                .FirstOrDefaultAsync(c => c.IsAbierta && c.Usuario == usuarioActual);

            if (cajaActiva == null) return Ok(new List<object>());

            var reporte = await _context.VentasDetalle
                .Where(d => d.Venta.FechaVenta >= cajaActiva.FechaApertura && !d.Venta.IsAnulada)
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
    }
}