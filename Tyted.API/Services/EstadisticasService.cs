using Microsoft.EntityFrameworkCore;
using Tyted.API.Data;
using Tyted.API.Models;

namespace Tyted.API.Services
{
    public class EstadisticasService
    {
        private readonly TytedContext _context;

        public EstadisticasService(TytedContext context)
        {
            _context = context;
        }

        public async Task<DashboardGerencialDTO> GetDashboardAsync()
        {
            // 1. Configuración de tiempo (Inicio del día actual)
            var hoy = DateTime.Today;

            // 2. Valor del Inventario
            // Filtramos costos negativos o absurdamente altos (corrupción de datos)
            var valorInventario = await _context.Productos
                .Where(p => p.StockActual > 0 && p.CostoUnitarioBase > 0 && p.CostoUnitarioBase < 100000)
                .SumAsync(p => (decimal)p.StockActual * p.CostoUnitarioBase);

            // 3. Ventas del día (Carga optimizada)
            var ventasHoy = await _context.Ventas
                .Include(v => v.Detalles)
                    .ThenInclude(d => d.Producto)
                .Where(v => v.FechaVenta >= hoy && !v.IsAnulada)
                .AsNoTracking()
                .ToListAsync();

            // 4. Histórico de tasas del día
            var tasasDetalle = await _context.TasaDeCambio
                .Where(t => t.FechaVigencia >= hoy)
                .OrderBy(t => t.FechaVigencia)
                .Select(t => new HistoricoTasaDTO
                {
                    Hora = t.FechaVigencia,
                    Valor = t.Tasa
                })
                .ToListAsync();

            // 5. Cálculo de Utilidad Bruta (Lógica de negocio en memoria)
            decimal utilidadBruta = 0;
            foreach (var v in ventasHoy)
            {
                foreach (var d in v.Detalles)
                {
                    decimal costoUSD = d.Producto?.CostoUnitarioBase ?? 0;
                    // Validación de seguridad para el costo
                    if (costoUSD < 100000)
                    {
                        utilidadBruta += (d.PrecioUnitarioMonedaBase - costoUSD) * d.Cantidad;
                    }
                }
            }

            // 6. Top 5 Productos más vendidos
            var topProductos = ventasHoy
                .SelectMany(v => v.Detalles)
                .GroupBy(d => d.CodigoProd)
                .Select(g => new TopProductoDTO
                {
                    Codigo = g.Key,
                    Descripcion = g.FirstOrDefault()?.Producto?.Descripcion ?? "Desconocido",
                    CantidadTotal = g.Sum(d => d.Cantidad),
                    TotalVendidoUSD = Math.Round(g.Sum(d => d.TotalLineaMonedaBase), 2)
                })
                .OrderByDescending(x => x.CantidadTotal)
                .Take(5)
                .ToList();

            // 7. Alertas de Stock Crítico
            var inventarioBajo = await _context.Productos
                .Where(p => p.StockActual <= p.StockMinimo && p.StockMinimo > 0)
                .OrderBy(p => p.StockActual)
                .Take(10)
                .Select(p => new ProductoBajoStockDTO
                {
                    Descripcion = p.Descripcion,
                    StockActual = p.StockActual,
                    StockMinimo = p.StockMinimo
                })
                .ToListAsync();

            // 8. Construcción del Resultado Final
            return new DashboardGerencialDTO
            {
                ValorInventarioCostoUSD = Math.Round(valorInventario, 2),
                UtilidadBrutaDiaUSD = Math.Round(utilidadBruta, 2),
                VentasPorMetodo = ventasHoy
                    .GroupBy(v => v.MetodoPago ?? "OTROS")
                    .Select(g => new VentasMetodoPagoDTO
                    {
                        Metodo = g.Key,
                        MontoUSD = Math.Round(g.Sum(v => v.TotalMonedaBase), 2),
                        MontoVES = Math.Round(g.Sum(v => v.TotalMonedaExt), 2)
                    }).ToList(),
                CambiosDeTasaDelDia = tasasDetalle.Count,
                DetalleTasasDia = tasasDetalle,
                InventarioBajo = inventarioBajo,
                TopMasVendidos = topProductos
            };
        }
    }

    // --- DTOs (Data Transfer Objects) ---

    public class DashboardGerencialDTO
    {
        public decimal ValorInventarioCostoUSD { get; set; }
        public decimal UtilidadBrutaDiaUSD { get; set; }
        public List<VentasMetodoPagoDTO> VentasPorMetodo { get; set; } = new();
        public int CambiosDeTasaDelDia { get; set; }
        public List<HistoricoTasaDTO> DetalleTasasDia { get; set; } = new();
        public List<TopProductoDTO> TopMasVendidos { get; set; } = new();
        public List<ProductoBajoStockDTO> InventarioBajo { get; set; } = new();
    }

    public class ProductoBajoStockDTO
    {
        public string Descripcion { get; set; } = string.Empty;
        public decimal StockActual { get; set; }
        public decimal StockMinimo { get; set; }
    }

    public class TopProductoDTO
    {
        public string Codigo { get; set; } = string.Empty;
        public string Descripcion { get; set; } = string.Empty;
        public decimal CantidadTotal { get; set; }
        public decimal TotalVendidoUSD { get; set; }
    }

    public class VentasMetodoPagoDTO
    {
        public string Metodo { get; set; } = string.Empty;
        public decimal MontoUSD { get; set; }
        public decimal MontoVES { get; set; }
    }

    public class HistoricoTasaDTO
    {
        public DateTime Hora { get; set; }
        public decimal Valor { get; set; }
    }
}