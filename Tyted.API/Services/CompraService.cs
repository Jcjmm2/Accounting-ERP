// Tyted.API.Services/CompraService.cs
using Microsoft.EntityFrameworkCore;
using Tyted.API.Data;
using Tyted.API.Models;
using Tyted.API.Models.DTOs; // <--- NUEVO: Para el DTO del reporte
using System.Transactions;
using System; 
using System.Collections.Generic;
using System.Linq; // <--- NUEVO: Necesario para GroupBy, Sum, Select, etc.

namespace Tyted.API.Services
{
    public class CompraService
    {
        private readonly TytedContext _context;

        public CompraService(TytedContext context)
        {
            _context = context;
        }

        // ====================================================================
        // MÉTODO DE TASA DE CAMBIO (EXISTENTE)
        // ====================================================================
        private async Task<decimal> GetTasaDeCambioVigente(DateTime fecha)
        {
            var tasa = await _context.TasaDeCambio
                .Where(t => t.FechaVigencia.Date <= fecha.Date)
                .OrderByDescending(t => t.FechaVigencia)
                .FirstOrDefaultAsync();

            if (tasa == null)
            {
                throw new InvalidOperationException($"No se encontró una tasa de cambio (USD/VES) vigente para la fecha {fecha.ToShortDateString()}. Revise su tabla Tasa...");
            }
            return tasa.Tasa;
        }

        // ====================================================================
        // MÉTODO 1: REGISTRAR COMPRA Y ACTUALIZAR STOCK (EXISTENTE)
        // ====================================================================
        public async Task RegistrarCompraYActualizarStock(Compra compra)
        {
            using (var transaction = new TransactionScope(TransactionScopeAsyncFlowOption.Enabled))
            {
                try
                {
                    // 1. Inserción de la Compra y Detalles...
                    _context.Compras.Add(compra);
                    await _context.SaveChangesAsync();

                    // 2. Procesamiento de Stock
                    if (compra.Detalles != null && compra.Detalles.Any())
                    {
                        foreach (var detalle in compra.Detalles)
                        {
                            var unidadCompra = await _context.ProductosUnidad
                                .FirstOrDefaultAsync(pu => pu.IdProductoUnidad == detalle.IdProductoUnidad);

                            var producto = await _context.Productos
                                .FirstOrDefaultAsync(p => p.CodigoProd == detalle.CodigoProd);
                            
                            if (unidadCompra != null && producto != null)
                            {
                                decimal aumento = detalle.Cantidad * unidadCompra.CantidadEquivalente;
                                
                                // Logs de depuración omitidos aquí por brevedad.
                                producto.StockActual += aumento;
                            }
                        }
                        
                        // 3. Guardar los cambios de Stock
                        await _context.SaveChangesAsync();
                    }

                    // 4. Completar la transacción
                    transaction.Complete();
                }
                catch (Exception ex)
                {
                    Console.WriteLine($"Error al registrar la compra y actualizar stock: {ex.Message}");
                    throw; 
                }
            }
        }

        // ====================================================================
        // ✅ NUEVO MÉTODO 2: ANULAR COMPRA Y REVERTIR STOCK (Implementación)
        // ====================================================================
        public async Task AnularCompraYRevertirStock(int compraId)
        {
            using (var transaction = new TransactionScope(TransactionScopeAsyncFlowOption.Enabled))
            {
                try
                {
                    // 1. Obtener la compra y sus detalles (CRÍTICO: Usar Include)
                    var compra = await _context.Compras
                        .Include(c => c.Detalles) 
                        .FirstOrDefaultAsync(c => c.Id == compraId);

                    if (compra == null)
                    {
                        throw new KeyNotFoundException($"Compra con ID {compraId} no encontrada.");
                    }

                    // 2. Validación de Estado (usa la nueva propiedad IsAnulada)
                    if (compra.IsAnulada) 
                    {
                        throw new InvalidOperationException($"La Compra ID {compraId} ya ha sido anulada.");
                    }

                    // 3. Revertir Stock para CADA detalle de la compra
                    if (compra.Detalles != null)
                    {
                        foreach (var detalle in compra.Detalles)
                        {
                            var unidadCompra = await _context.ProductosUnidad
                                .FirstOrDefaultAsync(pu => pu.IdProductoUnidad == detalle.IdProductoUnidad);
                            
                            var producto = await _context.Productos
                                .FirstOrDefaultAsync(p => p.CodigoProd == detalle.CodigoProd);

                            if (unidadCompra != null && producto != null)
                            {
                                // Calcular la cantidad total de stock a restar
                                decimal reduccionStock = detalle.Cantidad * unidadCompra.CantidadEquivalente;

                                // Regla de Negocio: Verificar stock para evitar valores negativos
                                if (producto.StockActual < reduccionStock)
                                {
                                    throw new InvalidOperationException(
                                        $"No se puede anular la compra. El producto {producto.CodigoProd} ({producto.Descripcion}) " +
                                        $"requiere una reducción de {reduccionStock:N2}, pero solo tiene {producto.StockActual:N2} en stock. " +
                                        "Esto sugiere que parte de esta compra ya ha sido vendida.");
                                }
                                
                                // **RESTA CRÍTICA DEL STOCK**
                                producto.StockActual -= reduccionStock;
                            }
                        }
                    }
                    
                    // 4. Marcar la Compra como Anulada
                    compra.IsAnulada = true; 
                    
                    // 5. Guardar los cambios (Compra y Productos)
                    await _context.SaveChangesAsync();

                    // 6. Completar la transacción
                    transaction.Complete();
                }
                catch (Exception ex)
                {
                    // La transacción NO se completa (rollback automático).
                    Console.WriteLine($"Error al anular la compra y revertir stock: {ex.Message}");
                    throw;
                }
            }
        }
        public async Task<IEnumerable<ReporteCompraPorProveedorDTO>> GetReporteTotalesPorProveedor(DateTime fechaInicio, DateTime fechaFin)
        {
            var reporte = await _context.Compras
                // CRÍTICO: Filtrar por fechas y asegurar que NO esté ANULADA
                .Where(c => c.FechaCompra.Date >= fechaInicio.Date 
                         && c.FechaCompra.Date <= fechaFin.Date 
                         && !c.IsAnulada) 
                .GroupBy(c => c.CodigoProv)
                .Select(g => new ReporteCompraPorProveedorDTO
                {
                    CodigoProd = g.Key,
                    // Busca el nombre del proveedor. Esto se traduce a un LEFT JOIN eficiente en SQL
                    Razonsocial = _context.Proveedores
                        .Where(p => p.CodigoProv == g.Key)
                        .Select(p => p.Razonsocial)
                        .FirstOrDefault() ?? "Proveedor Desconocido",
                    
                    TotalCompras = g.Count(),
                    
                    // Sumas de totales en Moneda Base (VES)
                    TotalBaseVES = g.Sum(c => c.TotalMonedaBase),
                    SubtotalBaseVES = g.Sum(c => c.SubtotalMonedaBase),
                    IVABaseVES = g.Sum(c => c.IvaMonedaBase),
                    
                    // Sumas de totales en Moneda Extranjera (USD)
                    TotalExtUSD = g.Sum(c => c.TotalMonedaExt),
                    SubtotalExtUSD = g.Sum(c => c.SubtotalMonedaExt),
                    IVAExtUSD = g.Sum(c => c.IvaMonedaExt)
                })
                .OrderByDescending(r => r.TotalBaseVES) // Opcional: ordenar por el total más alto
                .ToListAsync();

            return reporte;
        }
    }
}