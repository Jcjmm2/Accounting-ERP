using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Tyted.API.Data;
using Microsoft.AspNetCore.Authorization;
using Tyted.API.Models;

namespace Tyted.API.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    [Authorize(Roles = "AdministradorSistema,Administrador,Cajero")]    
    public class FacturaController : ControllerBase
    {
        private readonly TytedContext _context;

        public FacturaController(TytedContext context)
        {
            _context = context;
        }

        [HttpGet("imprimir/{ventaId}")]
        public async Task<IActionResult> GenerarFactura(int ventaId)
        {
            // 1. Obtenemos datos de la empresa
            var empresa = await _context.Empresa.FirstOrDefaultAsync();
    
            // 2. Buscamos la configuración de moneda de impresión
            var configMoneda = await _context.EmpresaConfigs
                .FirstOrDefaultAsync(c => c.Clave == "ModoImpresionFactura");
            string modo = configMoneda?.Valor ?? "AMBAS";

            // 3. Cargamos la venta con sus detalles y la relación del cliente
            var venta = await _context.Ventas
                .Include(v => v.Cliente)
                .Include(v => v.Detalles)
                .FirstOrDefaultAsync(v => v.VentaId == ventaId);

            if (empresa == null || venta == null) return NotFound();

            // 4. Estructuramos el reporte para el frontend
            var reporte = new
            {
                Empresa = empresa,
                Factura = new
                {
                    venta.VentaId,
                    venta.NumeroFactura,
                    Fecha = venta.FechaVenta,
                    // Usamos la relación para obtener datos del cliente de forma segura
                    ClienteNombre = venta.Cliente != null ? venta.Cliente.Nombre : "Cliente General",
                    ClienteRif = venta.Cliente != null ? venta.Cliente.Rif : "V000000000",
                    venta.MetodoPago,
                    venta.TasaDeCambio,
                    
                    // Aplicamos lógica de visibilidad según el modo (USD/VES/AMBAS)
                    SubtotalBase = (modo == "AMBAS" || modo == "SOLO_BASE") ? venta.SubtotalMonedaBase : (decimal?)null,
                    TotalBase = (modo == "AMBAS" || modo == "SOLO_BASE") ? venta.TotalMonedaBase : (decimal?)null,
            
                    SubtotalExt = (modo == "AMBAS" || modo == "SOLO_EXT") ? venta.SubtotalMonedaExt : (decimal?)null,
                    TotalExt = (modo == "AMBAS" || modo == "SOLO_EXT") ? venta.TotalMonedaExt : (decimal?)null,
            
                    Items = venta.Detalles.Select(d => new {
                        d.CodigoProd,
                        d.NombreUnidad, 
                        d.Cantidad,
                        Precio = (modo == "SOLO_EXT") ? d.PrecioUnitarioMonedaExt : d.PrecioUnitarioMonedaBase,
                        TotalLinea = (modo == "SOLO_EXT") ? d.TotalLineaMonedaExt : d.TotalLineaMonedaBase
                    })
                }
            };

            return Ok(reporte);
        }

        [HttpGet("reporte-ventas")]
        public async Task<IActionResult> GetReporteVentas([FromQuery] DateTime desde, [FromQuery] DateTime hasta)
        {
            // Ajustamos las fechas para cubrir el rango completo de tiempo (00:00:00 a 23:59:59)
            var fechaInicio = desde.Date;
            var fechaFin = hasta.Date.AddDays(1).AddTicks(-1);

            var ventas = await _context.Ventas
                .Include(v => v.Cliente) 
                .Include(v => v.Detalles)
                .Where(v => v.FechaVenta >= fechaInicio && v.FechaVenta <= fechaFin)
                .OrderByDescending(v => v.FechaVenta)
                .Select(v => new {
                    v.VentaId,
                    v.NumeroFactura,
                    Fecha = v.FechaVenta,
                    // Acceso corregido mediante la relación configurada en el modelo
                    Cliente = v.Cliente != null ? v.Cliente.Nombre : "Cliente General",
                    MontoTotalUSD = v.TotalMonedaBase,
                    v.MetodoPago,
                    v.IsAnulada,
                    Articulos = v.Detalles.Count()
                })
                .ToListAsync();

            return Ok(ventas);
        }
    }
}