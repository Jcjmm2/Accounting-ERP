using Tyted.API.Data;
using Tyted.API.Models;
using Microsoft.EntityFrameworkCore;
using Tyted.API.Helpers;

namespace Tyted.API.Services
{
    public class CompraService
    {
        private readonly TytedContext _context;

        public CompraService(TytedContext context)
        {
            _context = context;
        }

        public async Task<Compra> RegistrarCompraAsync(Compra compra)
        {
            using var transaction = await _context.Database.BeginTransactionAsync();
            try
            {
                if (compra.Detalles == null || !compra.Detalles.Any())
                    throw new Exception("La compra no tiene productos detallados.");

                // 1. Vincular la compra al contexto
                // Esto permite que EF genere el ID de la compra antes de insertar los movimientos
                _context.Compras.Add(compra);

                foreach (var detalle in compra.Detalles)
                {
                    var producto = await _context.Productos
                        .FirstOrDefaultAsync(p => p.CodigoProd == detalle.CodigoProd);

                    if (producto == null) 
                        throw new Exception($"Producto con código {detalle.CodigoProd} no existe.");

                    var unidadProducto = await _context.ProductosUnidad
                        .FirstOrDefaultAsync(u => u.IdProductoUnidad == detalle.IdProductoUnidad);

                    if (unidadProducto == null)
                        throw new Exception($"Error de configuración de unidad para {detalle.CodigoProd}.");

                    decimal factor = unidadProducto.CantidadEquivalente;

                    // 2. Normalización a Moneda Base (Dólar)
                    // Aseguramos que siempre trabajemos con USD para el valor del inventario
                    if (compra.TipoMoneda == "VES" || compra.TipoMoneda == "BS")
                    {
                        if (detalle.CostoUnitarioMonedaBase == 0 && compra.TasaDeCambio > 0)
                        {
                            detalle.CostoUnitarioMonedaBase = Math.Round(detalle.CostoUnitarioMonedaExt / compra.TasaDeCambio, 4);
                        }
                    }
                    else 
                    {
                        detalle.CostoUnitarioMonedaExt = detalle.CostoUnitarioMonedaBase;
                    }

                    // 3. Desglose de Costo Unitario Real (Clave para las estadísticas)
                    // Si el factor es 20 (bulto) y el costo es $24, el costo unitario real es $1.20
                    decimal costoUnitarioRealUSD = detalle.CostoUnitarioMonedaBase / (factor > 0 ? factor : 1);

                    // Actualizamos maestro de productos y la presentación específica
                    producto.CostoUnitarioBase = costoUnitarioRealUSD; 
                    unidadProducto.CostoUnitarioMonedaBase = detalle.CostoUnitarioMonedaBase;

                    // 4. Aumento de Stock Real
                    // Convertimos bultos/empaques a unidades mínimas (StockActual siempre en unidades)
                    decimal cantidadRealEntrada = detalle.Cantidad * factor;
                    producto.StockActual += cantidadRealEntrada;

                    // 5. Registro en Kardex (Vinculado a la compra)
                    var movimiento = new InventarioMovimiento
                    {
                        CodigoProd = producto.CodigoProd,
                        Tipo = "ENTRADA",
                        Concepto = $"Compra #{compra.NumeroFactura} - {unidadProducto.NombreUnidad}",
                        Cantidad = cantidadRealEntrada,
                        CostoUnitarioUSD = costoUnitarioRealUSD, 
                        Fecha = DateHelper.GetVenezuelaTime(),
                
                        // Usamos la propiedad de navegación para evitar errores de Foreign Key (FK)
                        Compra = compra 
                    };
                    _context.InventarioMovimientos.Add(movimiento);
                }

                // 6. Persistencia de datos en una sola operación atómica
                await _context.SaveChangesAsync();
                await transaction.CommitAsync();

                return compra;
            }
            catch (Exception ex)
            {
                await transaction.RollbackAsync();
                var inner = ex.InnerException != null ? $" -> {ex.InnerException.Message}" : "";
                throw new Exception($"Error al registrar compra: {ex.Message}{inner}");
            }
        }

        public async Task AnularCompraAsync(int id)
        {
            using var transaction = await _context.Database.BeginTransactionAsync();
            try
            {
                var compra = await _context.Compras
                    .Include(c => c.Detalles)
                    .FirstOrDefaultAsync(c => c.Id == id);

                if (compra == null) throw new Exception("La compra no existe.");
                if (compra.IsAnulada) throw new Exception("Esta compra ya fue anulada.");

                foreach (var detalle in compra.Detalles)
                {
                    var producto = await _context.Productos
                        .FirstOrDefaultAsync(p => p.CodigoProd == detalle.CodigoProd);

                    if (producto != null)
                    {
                        var unidadProducto = await _context.ProductosUnidad
                            .FirstOrDefaultAsync(u => u.IdProductoUnidad == detalle.IdProductoUnidad);

                        decimal factor = unidadProducto?.CantidadEquivalente ?? 1;
                        decimal cantidadRealARestar = detalle.Cantidad * factor;

                        if (producto.StockActual < cantidadRealARestar)
                        {
                            throw new Exception($"Imposible anular: El producto {producto.Descripcion} " +
                                $"tiene stock insuficiente ({producto.StockActual}) para revertir la entrada de {cantidadRealARestar} unidades.");
                        }

                        // 1. DESCUENTO DE INVENTARIO
                        producto.StockActual -= cantidadRealARestar;

                        // 2. KARDEX (SALIDA POR ANULACIÓN)
                        var movimiento = new InventarioMovimiento
                        {
                            CodigoProd = detalle.CodigoProd ?? "0",
                            Tipo = "SALIDA",
                            Concepto = $"Anulación Compra #{compra.Id} - Fact {compra.NumeroFactura}",
                            Cantidad = cantidadRealARestar,
                            CostoUnitarioUSD = producto.CostoUnitarioBase,
                            Fecha = DateHelper.GetVenezuelaTime()
                        };
                        _context.InventarioMovimientos.Add(movimiento);
                    }
                }

                // 3. ANULAR CUENTA POR PAGAR
                var cxp = await _context.CuentasPorPagar.FirstOrDefaultAsync(c => c.CompraId == id);
                if (cxp != null)
                {
                    cxp.Estado = "Anulada";
                    cxp.SaldoPendienteUSD = 0;
                }

                compra.IsAnulada = true;
                await _context.SaveChangesAsync();
                await transaction.CommitAsync();
            }
            catch (Exception ex)
            {
                await transaction.RollbackAsync();
                throw new Exception(ex.Message);
            }
        }
    }
}