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
            var hoy = DateTime.Today; // Esto es 2025-12-24 00:00:00

            // 1. Valor del Inventario (Stock * Costo Base en USD)
            var valorInventario = await _context.Productos
                .Where(p => p.StockActual > 0)
                .SumAsync(p => p.StockActual * p.CostoUnitarioBase);

            // 2. Ventas del día (Incluimos Producto para sacar el costo y la descripción)
            var ventasHoy = await _context.Ventas
                .Include(v => v.Detalles)
                    .ThenInclude(d => d.Producto) 
                .Where(v => v.FechaVenta >= hoy && !v.IsAnulada)
                .ToListAsync();

            // 3. Cambios de Tasa del día
            var tasasDia = await _context.TasaDeCambio
                .Where(t => t.FechaVigencia.Date == hoy)
                .OrderBy(t => t.FechaVigencia)
                .Select(t => new HistoricoTasaDTO 
                { 
                    Hora = t.FechaVigencia, 
                    Valor = t.Tasa 
                })
                .ToListAsync();

            // 4. Utilidad Bruta Real
            decimal utilidadBruta = 0;
            foreach (var v in ventasHoy)
            {
                foreach (var d in v.Detalles)
                {
                    decimal costoUSD = d.Producto?.CostoUnitarioBase ?? 0;
                    utilidadBruta += (d.PrecioUnitarioMonedaBase - costoUSD) * d.Cantidad;
                }
            }

            // 5. Cálculo de los 5 más vendidos (por cantidad)
            var topProductos = ventasHoy
                .SelectMany(v => v.Detalles)
                .GroupBy(d => d.CodigoProd)
                .Select(g => new TopProductoDTO
                {
                    Codigo = g.Key,
                    Descripcion = g.First().Producto?.Descripcion ?? "N/A",
                    CantidadTotal = g.Sum(d => d.Cantidad),
                    TotalVendidoUSD = g.Sum(d => d.TotalLineaMonedaBase)
                })
                .OrderByDescending(x => x.CantidadTotal)
                .Take(5)
                .ToList();

            return new DashboardGerencialDTO
            {
                ValorInventarioCostoUSD = valorInventario,
                UtilidadBrutaDiaUSD = utilidadBruta,
                VentasPorMetodo = ventasHoy
                    .GroupBy(v => v.MetodoPago ?? "OTROS")
                    .Select(g => new VentasMetodoPagoDTO {
                        Metodo = g.Key,
                        MontoUSD = g.Sum(v => v.TotalMonedaBase),
                        MontoVES = g.Sum(v => v.TotalMonedaExt)
                    }).ToList(),
                CambiosDeTasaDelDia = tasasDia.Count,
                DetalleTasasDia = tasasDia,
                TopMasVendidos = topProductos // <-- Integrado
            };
        }
    }

    // --- OBJETOS DE TRANSFERENCIA DE DATOS (DTOs) ---

    public class DashboardGerencialDTO
    {
        public decimal ValorInventarioCostoUSD { get; set; }
        public decimal UtilidadBrutaDiaUSD { get; set; }
        public List<VentasMetodoPagoDTO> VentasPorMetodo { get; set; } = new();
        public int CambiosDeTasaDelDia { get; set; }
        public List<HistoricoTasaDTO> DetalleTasasDia { get; set; } = new();
        public List<TopProductoDTO> TopMasVendidos { get; set; } = new();
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