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

                foreach (var detalle in compra.Detalles)
                {
                    var producto = await _context.Productos
                        .FirstOrDefaultAsync(p => p.CodigoProd == detalle.CodigoProd);

                    if (producto == null) 
                        throw new Exception($"Producto con código {detalle.CodigoProd} no existe.");

                    // 1. BUSCAR LA PRESENTACIÓN Y EQUIVALENCIA
                    // Usamos IdProductoUnidad que confirmamos existe en tu CompraDetalle.cs
                    var unidadProducto = await _context.ProductosUnidad
                        .FirstOrDefaultAsync(u => u.IdProductoUnidad == detalle.IdProductoUnidad);

                    if (unidadProducto == null)
                        throw new Exception($"No se encontró la configuración de unidad para el producto {detalle.CodigoProd}.");

                    decimal factor = unidadProducto.CantidadEquivalente;

                    // 2. NORMALIZACIÓN DE COSTO (Dólar como base ante la inflación)
                    if (compra.TipoMoneda == "VES")
                    {
                        detalle.CostoUnitarioMonedaExt = Math.Round(detalle.CostoUnitarioMonedaBase / compra.TasaDeCambio, 4);
                    }
                    else // Si ya viene en USD
                    {
                        detalle.CostoUnitarioMonedaBase = Math.Round(detalle.CostoUnitarioMonedaExt * compra.TasaDeCambio, 4);
                    }

                    // 3. ESTRATEGIA ÚLTIMO COSTO
                    // Actualizamos el costo en el maestro de productos
                    producto.CostoUnitarioBase = detalle.CostoUnitarioMonedaExt; 
                    // También actualizamos el costo en la presentación específica
                    unidadProducto.CostoUnitarioMonedaBase = detalle.CostoUnitarioMonedaExt;

                    // 4. AUMENTO DE STOCK REAL (Cantidad * Equivalencia)
                    // Si compras 1 Bulto de 20kg, suben 20 unidades al inventario
                    decimal cantidadRealEntrada = detalle.Cantidad * factor;
                    producto.StockActual += cantidadRealEntrada;

                    // 5. REGISTRO EN KARDEX
                    var movimiento = new InventarioMovimiento
                    {
                        CodigoProd = producto.CodigoProd,
                        Tipo = "ENTRADA",
                        Concepto = $"Compra #{compra.NumeroFactura} - {unidadProducto.NombreUnidad}",
                        Cantidad = cantidadRealEntrada,
                        CostoUnitarioUSD = detalle.CostoUnitarioMonedaExt,
                        Fecha = DateHelper.GetVenezuelaTime(),
                    };
                    _context.InventarioMovimientos.Add(movimiento);
                }

                _context.Compras.Add(compra);
                await _context.SaveChangesAsync();
                await transaction.CommitAsync();

                return compra;
            }
            catch (Exception ex)
            {
                await transaction.RollbackAsync();
                throw new Exception($"Error al registrar compra: {ex.Message}");
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
                        // --- CORRECCIÓN AQUÍ: Buscar el factor para revertir la cantidad real ---
                        var unidadProducto = await _context.ProductosUnidad
                            .FirstOrDefaultAsync(u => u.IdProductoUnidad == detalle.IdProductoUnidad);

                        decimal factor = unidadProducto?.CantidadEquivalente ?? 1;
                        decimal cantidadRealARestar = detalle.Cantidad * factor;

                        // --- VALIDACIÓN DE STOCK CON CANTIDAD REAL ---
                        if (producto.StockActual < cantidadRealARestar)
                        {
                            throw new Exception($"Imposible anular: El producto {producto.Descripcion} " +
                                $"tiene stock insuficiente ({producto.StockActual}) para revertir la entrada de {cantidadRealARestar} unidades.");
                        }

                        // 1. DESCUENTO DE INVENTARIO (NORMALIZADO)
                        producto.StockActual -= cantidadRealARestar;

                        // 2. KARDEX (REGISTRO DE SALIDA POR ANULACIÓN)
                        var movimiento = new InventarioMovimiento
                        {
                            CodigoProd = detalle.CodigoProd ?? "0",
                            Tipo = "SALIDA",
                            Concepto = $"Anulación Compra #{compra.Id} - Fact {compra.NumeroFactura}",
                            Cantidad = cantidadRealARestar, // Registrar la cantidad real que sale
                            CostoUnitarioUSD = producto.CostoUnitarioBase,
                            Fecha = DateHelper.GetVenezuelaTime()
                        };
                        _context.InventarioMovimientos.Add(movimiento);
                    }
                }

                // 3. ANULAR CUENTA POR PAGAR (CxP)
                // Evitamos que el sistema crea que aún le debemos al proveedor
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
                // Propagamos el mensaje específico para que el usuario sepa por qué falló (ej. stock insuficiente)
                throw new Exception(ex.Message);
            }
        }
    }
}