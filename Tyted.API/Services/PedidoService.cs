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

        public async Task<Pedido> CrearPedidoAsync(Pedido pedido)
        {
            pedido.Fecha = DateHelper.GetVenezuelaTime();
            pedido.Estado = "Pendiente";
            _context.Pedidos.Add(pedido);
            await _context.SaveChangesAsync();
            return pedido;
        }

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

                // Obtenemos la tasa actual para llenar los campos de moneda extranjera (VES)
                decimal tasaActual = await _tasaService.GetTasaActualAsync();

                // 2. MAPEADO EXACTO A TU MODELO VENTA.CS Y VENTADETALLE.CS
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
                        Cantidad = d.Cantidad?? 0,
                        
                        // Campos Moneda Base (USD)
                        PrecioUnitarioMonedaBase = d.PrecioUnitarioUSD?? 0,
                        SubtotalLineaMonedaBase = d.SubtotalUSD?? 0,
                        TotalLineaMonedaBase = d.SubtotalUSD?? 0,

                        // Campos Moneda Extranjera (VES)
                        PrecioUnitarioMonedaExt = Math.Round(d.PrecioUnitarioUSD??0 * tasaActual, 2),
                        SubtotalLineaMonedaExt = Math.Round(d.SubtotalUSD??0 * tasaActual, 2),
                        TotalLineaMonedaExt = Math.Round(d.SubtotalUSD??0 * tasaActual, 2),

                        // Campos técnicos requeridos por tu VentaDetalle.cs
                        TasaIVA = 16.00m, // Ajustar según tu lógica de impuestos
                        IdProductoUnidad = 1 // Reemplazar por la lógica de búsqueda de ID de unidad si es necesario
                    }).ToList()
                };

                // 3. Procesamos mediante el service para afectar stock y CxC
                var ventaProcesada = await _ventaService.RegistrarVentaAsync(nuevaVenta);

                // 4. Actualizamos el estado del pedido original
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
        public async Task AnularPedidoAsync(int id)
        {
            var pedido = await _context.Pedidos.FindAsync(id);
            if (pedido == null) throw new Exception("Pedido no encontrado");
            if (pedido.Estado != "Pendiente") throw new Exception("Solo se pueden anular pedidos pendientes");

            pedido.Estado = "Anulado";
            await _context.SaveChangesAsync();
        }
    }
}
        