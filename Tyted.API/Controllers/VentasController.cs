using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Tyted.API.Data;
using Tyted.API.Models;
using Microsoft.AspNetCore.Authorization;
using Tyted.API.Services;

namespace Tyted.API.Controllers
{
    [Route("api/[controller]")]
    [Authorize(Roles = "AdministradorSistema,Administrador,Cajero")] 
    [ApiController]
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
        [Authorize(Roles = "AdministradorSistema,Administrador,Comprador,Cajero")]
        [HttpPost]
        public async Task<IActionResult> RegistrarVenta([FromBody] Venta venta)
        {
            var caja = await _context.CajaSesiones
                .FirstOrDefaultAsync(c => c.IsAbierta && c.Usuario == "CAJERO_PRINCIPAL");

            if (caja == null)
                return BadRequest("OPERACIÓN DENEGADA: La caja está cerrada. Debe realizar una apertura para facturar.");

            try
            {
                // El VentaService debe estar preparado para recibir 'venta.Pagos'
                var nuevaVenta = await _ventaService.RegistrarVentaAsync(venta);
                return Ok(nuevaVenta);
            }
            catch (Exception ex)
            {
                return BadRequest(new { message = ex.Message });
            }
        }

        [Authorize(Roles = "AdministradorSistema,Administrador,Comprador,Cajero")]
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

        // --- ARQUEO Y CIERRE DE CAJA ---
    
        [Authorize(Roles = "AdministradorSistema,Administrador,Comprador,Cajero")]
        public async Task<IActionResult> GetReporteDiario()
        {
            var reporte = await _ventaService.GetReporteDiarioAsync(null);
                return Ok(reporte);
        }

        [Authorize(Roles = "AdministradorSistema,Administrador,Comprador,Cajero")]
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

        [Authorize(Roles = "AdministradorSistema,Administrador,Comprador,Cajero")]
        [HttpPost("abrir-caja")]
        public async Task<IActionResult> AbrirCaja([FromBody] decimal montoInicial)
        {
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

        [Authorize(Roles = "AdministradorSistema,Administrador,Comprador,Cajero")]
        [HttpPost("cerrar-caja")]
        public async Task<IActionResult> CerrarCaja([FromBody] ArqueoCajaDTO arqueo)
        {
            var caja = await _context.CajaSesiones
                .FirstOrDefaultAsync(c => c.IsAbierta && c.Usuario == "CAJERO_PRINCIPAL");

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
        [AllowAnonymous]
        public async Task<IActionResult> GetEstadoCaja()
        {
            var abierta = await _context.CajaSesiones
                .AnyAsync(c => c.IsAbierta && c.Usuario == "CAJERO_PRINCIPAL");
            return Ok(abierta);
        }

        // --- REPORTES ---

        [Authorize(Roles = "AdministradorSistema,Administrador,Comprador,Cajero")]
        [HttpGet("reporte-productos")]
        public async Task<IActionResult> GetVentasPorProducto()
        {
            var cajaActiva = await _context.CajaSesiones
                .FirstOrDefaultAsync(c => c.IsAbierta && c.Usuario == "CAJERO_PRINCIPAL");

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