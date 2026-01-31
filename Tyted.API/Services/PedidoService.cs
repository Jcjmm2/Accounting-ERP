using Microsoft.EntityFrameworkCore;
using Tyted.API.Data;
using Tyted.API.Models;
using Tyted.API.Helpers;

namespace Tyted.API.Services
{
    public class PedidoService
    {
        private readonly TytedContext _context;
        private readonly VentaService _ventaService;
        private readonly TasaService _tasaService;

        public PedidoService(TytedContext context, VentaService ventaService, TasaService tasaService)
        {
            _context = context;
            _ventaService = ventaService;
            _tasaService = tasaService;
        }

        // ==========================================
        // 1. MÉTODOS DE CONSULTA (LECTURA)
        // ==========================================

        public async Task<IEnumerable<Pedido>> ObtenerPedidosPendientesAsync()
        {
            return await _context.Pedidos
                .Include(p => p.Cliente)
                .Where(p => p.Estado == "Pendiente")
                .OrderByDescending(p => p.Fecha)
                .ToListAsync();
        }

        public async Task<Pedido?> ObtenerPedidoPorIdAsync(int id)
        {
            return await _context.Pedidos
                .Include(p => p.Cliente)
                .Include(p => p.Detalles)
                    // Esto le dice a EF que traiga los datos del producto de cada detalle
                    .ThenInclude(d => d.ProductoUnidadNavigation)
                        .ThenInclude(pu => pu.Producto)
                .FirstOrDefaultAsync(p => p.Id == id);
        }
        public async Task<Pedido> GetPedido(int id)
        {
            return await _context.Pedidos
                .Include(p => p.Detalles)
                    .ThenInclude(d => d.Producto) // <--- CRUCIAL: Traer el producto asociado
                .FirstOrDefaultAsync(p => p.Id == id);
        }

        // ==========================================
        // 2. MÉTODOS DE GESTIÓN (ESCRITURA)
        // ==========================================

        public async Task<Pedido> CrearPedidoAsync(Pedido pedido)
        {
            if (pedido.Detalles == null || !pedido.Detalles.Any())
                throw new Exception("El pedido no puede estar vacío.");

            // Configuración inicial del pedido
            pedido.Fecha = DateHelper.GetVenezuelaTime();
            pedido.Estado = "Pendiente";
            
            // Seguridad: Recalcular totales en servidor para evitar manipulaciones del cliente
            pedido.MontoTotalUSD = pedido.Detalles.Sum(d => (d.PrecioUnitarioUSD ?? 0) * (d.Cantidad ?? 0));

            _context.Pedidos.Add(pedido);
            await _context.SaveChangesAsync();
            return pedido;
        }

        public async Task AnularPedidoAsync(int id)
        {
            var pedido = await _context.Pedidos.FindAsync(id);
            if (pedido == null) throw new Exception("Pedido no encontrado");
            if (pedido.Estado != "Pendiente") throw new Exception("Solo se pueden anular pedidos pendientes");

            pedido.Estado = "Anulado";
            await _context.SaveChangesAsync();
        }

        // ==========================================
        // 3. PROCESAMIENTO (CONVERSIÓN A VENTA)
        // ==========================================

        public async Task<Venta> ConvertirPedidoAVentaAsync(int pedidoId, string metodoPago, bool esCredito)
        {
            using var transaction = await _context.Database.BeginTransactionAsync();
            try
            {
                var pedido = await _context.Pedidos
                    .Include(p => p.Detalles)
                    .FirstOrDefaultAsync(p => p.Id == pedidoId);

                if (pedido == null) throw new Exception("Pedido no encontrado.");
                if (pedido.Estado != "Pendiente") throw new Exception("El pedido ya no está pendiente.");

                // Obtenemos la tasa actual para la facturación
                decimal tasaActual = await _tasaService.GetTasaActualAsync();

                // MAPEADO A MODELO VENTA (Cumpliendo con Venta.cs y VentaDetalle.cs)
                var nuevaVenta = new Venta
                {
                    ClienteId = pedido.ClienteId,
                    FechaVenta = DateHelper.GetVenezuelaTime(),
                    MetodoPago = metodoPago,
                    EsCredito = esCredito,
                    FechaVencimiento = esCredito ? DateHelper.GetVenezuelaTime().AddDays(15) : null,
                    TipoMoneda = "USD",
                    TasaDeCambio = tasaActual,
                    
                    // Totales en Moneda Base (USD)
                    TotalMonedaBase = pedido.MontoTotalUSD,
                    SubtotalMonedaBase = pedido.MontoTotalUSD,
                    
                    // Totales en Moneda Extranjera (VES)
                    TotalMonedaExt = Math.Round(pedido.MontoTotalUSD * tasaActual, 2),
                    SubtotalMonedaExt = Math.Round(pedido.MontoTotalUSD * tasaActual, 2),

                    Detalles = pedido.Detalles.Select(d => new VentaDetalle
                    {
                        CodigoProd = d.CodigoProd,
                        Cantidad = d.Cantidad ?? 0,
                        
                        // Campos Moneda Base (USD)
                        PrecioUnitarioMonedaBase = d.PrecioUnitarioUSD ?? 0,
                        SubtotalLineaMonedaBase = d.SubtotalUSD ?? 0,
                        TotalLineaMonedaBase = d.SubtotalUSD ?? 0,

                        // Campos Moneda Extranjera (VES)
                        PrecioUnitarioMonedaExt = Math.Round((d.PrecioUnitarioUSD ?? 0) * tasaActual, 2),
                        SubtotalLineaMonedaExt = Math.Round((d.SubtotalUSD ?? 0) * tasaActual, 2),
                        TotalLineaMonedaExt = Math.Round((d.SubtotalUSD ?? 0) * tasaActual, 2),

                        TasaIVA = 16.00m, 
                        IdProductoUnidad = d.IdProductoUnidad > 0 ? d.IdProductoUnidad : 1 
                    }).ToList()
                };

                // Registrar venta (Afecta Stock, Caja y CxC mediante VentaService)
                var ventaProcesada = await _ventaService.RegistrarVentaAsync(nuevaVenta);

                // Marcar pedido como finalizado
                pedido.Estado = "Facturado";
                _context.Pedidos.Update(pedido);
                
                await _context.SaveChangesAsync();
                await transaction.CommitAsync();

                return ventaProcesada;
            }
            catch (Exception ex)
            {
                await transaction.RollbackAsync();
                throw new Exception($"Error en conversión: {ex.Message}");
            }
        }
    }
}