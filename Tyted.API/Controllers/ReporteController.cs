using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.AspNetCore.Authorization;
using Tyted.API.Data;
using Tyted.API.Models;
using Tyted.API.Services;
using Tyted.API.Helpers;

namespace Tyted.API.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    [Authorize(Roles = "AdministradorSistema,Administrador,Analista")]
    public class ReportesController : ControllerBase
    {
        private readonly TytedContext _context;
        private readonly IReportService _reportService;

        public ReportesController(TytedContext context, IReportService reportService)
        {
            _context = context;
            _reportService = reportService;
        }

        [HttpGet("cierre-caja-hoy")]
        public async Task<IActionResult> GetCierreCaja()
        {
            var ahoraVzla = DateHelper.GetVenezuelaTime();
            var hoyInicio = ahoraVzla.Date;
            var hoyFin = hoyInicio.AddDays(1).AddTicks(-1);
            var empresa = await _context.Empresa.FirstOrDefaultAsync();

            // IMPORTANTE: Incluimos Detalles y Producto para poder armar el Top Productos
            var ventasHoy = await _context.Ventas
                .Include(v => v.Detalles)
                    .ThenInclude(d => d.Producto)
                .Where(v => v.FechaVenta >= hoyInicio && v.FechaVenta <= hoyFin && !v.IsAnulada)
                .ToListAsync();

            if (ventasHoy == null || !ventasHoy.Any())
            {
                return Ok(new { message = "No hay ventas registradas el día de hoy." });
            }

            var reporte = new
            {
                Empresa = empresa,
                FechaReporte = hoyInicio.ToString("dd/MM/yyyy"),
                CantidadOperaciones = ventasHoy.Count,
        
                // Totales USD
                TotalUSD = Math.Round(ventasHoy.Sum(v => v.TotalMonedaBase), 2),
                SubtotalUSD = Math.Round(ventasHoy.Sum(v => v.SubtotalMonedaBase), 2),
                IvaUSD = Math.Round(ventasHoy.Sum(v => v.IvaMonedaBase), 2),

                // Totales VES
                TotalVES = Math.Round(ventasHoy.Sum(v => v.TotalMonedaExt), 2),
                SubtotalVES = Math.Round(ventasHoy.Sum(v => v.SubtotalMonedaExt), 2),
                IvaVES = Math.Round(ventasHoy.Sum(v => v.IvaMonedaExt), 2),

                // 1. DESGLOSE POR MÉTODO DE PAGO
                DesglosePagos = ventasHoy
                    .GroupBy(v => v.MetodoPago ?? "No Especificado")
                    .Select(g => new {
                        Metodo = g.Key,
                        MontoUSD = Math.Round(g.Sum(v => v.TotalMonedaBase), 2),
                        MontoVES = Math.Round(g.Sum(v => v.TotalMonedaExt), 2)
                    }).ToList(),

                // 2. TOP PRODUCTOS MÁS VENDIDOS
                ProductosMasVendidos = ventasHoy
                    .SelectMany(v => v.Detalles)
                    .GroupBy(d => d.CodigoProd)
                    .Select(g => new {
                        Producto = g.FirstOrDefault()?.Producto?.Descripcion ?? g.Key,
                        Cantidad = g.Sum(d => d.Cantidad),
                        TotalUSD = Math.Round(g.Sum(d => d.TotalLineaMonedaBase), 2)
                    })
                    .OrderByDescending(x => x.Cantidad)
                    .Take(5)
                    .ToList()
            };

            return Ok(reporte);
        }

        [HttpGet("utilidad-hoy")]
        public async Task<IActionResult> GetUtilidadHoy()
        {
            var ahoraVzla = DateHelper.GetVenezuelaTime();
            var hoyInicio = ahoraVzla.Date;
            var hoyFin = hoyInicio.AddDays(1).AddTicks(-1);

            var detallesVentas = await _context.VentasDetalle
                .Include(d => d.Venta)
                .Include(d => d.Producto) 
                .Include(d => d.ProductoUnidad) 
                .Where(d => d.Venta.FechaVenta >= hoyInicio && d.Venta.FechaVenta <= hoyFin && !d.Venta.IsAnulada)
                .ToListAsync();

            if (!detallesVentas.Any())
                return Ok(new { message = "No hay ventas para calcular utilidad hoy." });

            // 1. Calculamos los totales recorriendo la lista una sola vez
            decimal ingresoNetoUSD = detallesVentas.Sum(d => d.SubtotalLineaMonedaBase);
            decimal costoTotalUSD = detallesVentas.Sum(d => 
                d.Cantidad * (d.ProductoUnidad?.CostoUnitarioMonedaBase ?? d.Producto?.CostoUnitarioBase ?? 0));

            var utilidadBruta = ingresoNetoUSD - costoTotalUSD;
            var margen = ingresoNetoUSD > 0 ? (utilidadBruta / ingresoNetoUSD) * 100 : 0;

            // 2. Actualizamos el Select de detalle por producto
            var detallePorProducto = detallesVentas
                .GroupBy(d => d.Producto?.Descripcion ?? "Desconocido")
                .Select(g => {
                    var ventaProducto = g.Sum(d => d.SubtotalLineaMonedaBase);
                    var costoProducto = g.Sum(d => d.Cantidad * (d.ProductoUnidad?.CostoUnitarioMonedaBase ?? d.Producto?.CostoUnitarioBase ?? 0));
            
                    return new {
                        Producto = g.Key,
                        VentaUSD = Math.Round(ventaProducto, 2),
                        CostoUSD = Math.Round(costoProducto, 2),
                        GananciaUSD = Math.Round(ventaProducto - costoProducto, 2),
                        MargenPorcentual = ventaProducto > 0 
                            ? Math.Round(((ventaProducto - costoProducto) / ventaProducto) * 100, 2).ToString() + "%" 
                            : "0%"
                    };
                }).ToList();

            return Ok(new
            {
                Fecha = hoyInicio.ToString("dd/MM/yyyy"),
                IngresosNetosUSD = Math.Round(ingresoNetoUSD, 2),
                CostosVentaUSD = Math.Round(costoTotalUSD, 2),
                UtilidadBrutaUSD = Math.Round(utilidadBruta, 2),
                PorcentajeMargen = Math.Round(margen, 2).ToString() + "%",
                DetallePorProducto = detallePorProducto
            });
        }

        [HttpGet("productos-costos-precios")]
        public async Task<IActionResult> GetReporteProductos()
        {
            // Consulta: Productos por categoría con sus costos y precios de venta
            var productos = await _context.Productos
                .Include(p => p.Categoria)
                .Include(p => p.UnidadesDeVenta)
                .Select(p => new {
                    Categoria = p.Categoria.Nombre,
                    Codigo = p.CodigoProd,
                    Descripcion = p.Descripcion,
                    CostoBase = p.CostoUnitarioBase,
                    Unidades = p.UnidadesDeVenta.Select(u => new {
                        u.NombreUnidad,
                        u.PrecioMonedaBase,
                        u.PrecioMonedaExt // Precio en Bolívares
                    })
                }).ToListAsync();
        
            return Ok(productos);
        }

        [HttpGet("estadisticas-ventas")]
        public async Task<IActionResult> GetEstadisticasVentas([FromQuery] DateTime inicio, [FromQuery] DateTime fin)
        {
            // Agrupa ventas por fecha para estadísticas
            var stats = await _context.Ventas
                .Where(v => v.FechaVenta >= inicio && v.FechaVenta <= fin && !v.IsAnulada)
                .GroupBy(v => v.FechaVenta.Date)
                .Select(g => new {
                    Fecha = g.Key,
                    TotalUSD = g.Sum(v => v.TotalMonedaBase),
                    Cantidad = g.Count()
                }).ToListAsync();

            return Ok(stats);
        }

        [HttpGet("descargar-margenes-excel")]
        public async Task<IActionResult> DescargarMargenes()
        {
            var archivo = await _reportService.GenerarExcelMargenesAsync();
            return File(archivo, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "MargenesGanancia.xlsx");
        }
        [Authorize(Roles = "AdministradorSistema,Administrador,Comprador,Cajero")]
        [HttpGet("descargar-cierre-pdf")]
        public async Task<IActionResult> DescargarCierrePdf([FromQuery] DateTime? fecha)
        {
            // Si no envían fecha, usamos la de hoy
            DateTime fechaReporte = fecha ?? DateHelper.GetVenezuelaTime().Date;
    
            var pdf = await _reportService.GenerarPdfCierreCajaAsync(fechaReporte);
    
            string nombreArchivo = $"Cierre_{fechaReporte:yyyyMMdd}.pdf";
            return File(pdf, "application/pdf", nombreArchivo);
        }

        [HttpGet("stock-critico")]
        public async Task<IActionResult> GetStockCritico()
        {
            // Buscamos productos donde el stock actual sea menor o igual al mínimo
            var productosCriticos = await _context.Productos
                .Include(p => p.Categoria)
                .Where(p => p.StockActual <= p.StockMinimo)
                .OrderBy(p => p.StockActual)
                .Select(p => new {
                    Codigo = p.CodigoProd,
                    Descripcion = p.Descripcion,
                    Categoria = p.Categoria != null ? p.Categoria.Nombre : "Sin Categoría",
                    StockActual = p.StockActual,
                    MinimoRequerido = p.StockMinimo,
                    // Diferencia para llegar al mínimo
                    NecesidadReposicion = p.StockMinimo - p.StockActual,
                    Estado = p.StockActual <= 0 ? "AGOTADO" : "CRÍTICO"
                })
                .ToListAsync();

            if (!productosCriticos.Any())
            {
                return Ok(new { message = "Todos los productos tienen stock suficiente." });
            }

            return Ok(new {
                FechaConsulta = DateHelper.GetVenezuelaTime().Date.ToString("dd/MM/yyyy HH:mm"),
                TotalAlertas = productosCriticos.Count,
                Items = productosCriticos
            });
        }

        [HttpGet("descargar-inventario-valorado")]
        public async Task<IActionResult> DescargarInventarioValorado()
        {
            try 
            {
                var archivo = await _reportService.GenerarExcelInventarioValoradoAsync();
                string nombreArchivo = $"Inventario_Valorizado_{DateHelper.GetVenezuelaTime():yyyyMMdd}.xlsx";
        
                return File(archivo, 
                    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", 
                    nombreArchivo);
            }
            catch (Exception ex)
            {
                return BadRequest(new { message = "Error al generar el reporte: " + ex.Message });
            }
        }
    }
}