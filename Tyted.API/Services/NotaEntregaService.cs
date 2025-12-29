using Microsoft.EntityFrameworkCore;
using Tyted.API.Data;
using Tyted.API.Models;

namespace Tyted.API.Services
{
    public class NotaEntregaService
    {
        private readonly TytedContext _context;

        public NotaEntregaService(TytedContext context)
        {
            _context = context;
        }

        public async Task<NotaEntregaCompra> RegistrarEntradaAsync(NotaEntregaCompra nota)
        {
            using var transaction = await _context.Database.BeginTransactionAsync();
            try
            {
                _context.NotasEntregaCompra.Add(nota);

                foreach (var item in nota.Detalles)
                {
                    // 1. Buscamos el producto principal
                    var producto = await _context.Productos
                        .FirstOrDefaultAsync(p => p.CodigoProd == item.CodigoProd);

                    if (producto != null)
                    {
                        // NOTA: Como NotaEntregaCompraDetalle no tiene IdProductoUnidad,
                        // asumimos que la cantidad recibida ya viene en la unidad base 
                        // o buscamos la unidad por defecto del producto.
                        
                        decimal cantidadEnUnidadesBase = item.CantidadRecibida;

                        // 2. Actualizamos el Producto Principal
                        producto.StockActual += cantidadEnUnidadesBase;
                        
                        // Actualizamos el costo en dólares (Tu moneda base)
                        producto.CostoUnitarioBase = item.CostoUnitarioUSD;

                        // 3. REGISTRO EN KARDEX
                        var movimiento = new InventarioMovimiento
                        {
                            CodigoProd = item.CodigoProd,
                            Tipo = "ENTRADA",
                            Concepto = $"Nota de Entrega Compra #{nota.NumeroNota ?? "S/N"}",
                            Cantidad = cantidadEnUnidadesBase,
                            CostoUnitarioUSD = item.CostoUnitarioUSD,
                            Fecha = DateTime.Now
                        };
                        _context.InventarioMovimientos.Add(movimiento);
                    }
                }

                await _context.SaveChangesAsync();
                await transaction.CommitAsync();
                return nota;
            }
            catch (Exception ex)
            {
                await transaction.RollbackAsync();
                throw new Exception($"Error al procesar nota de entrega: {ex.Message}");
            }
        }
        public async Task AnularNotaEntregaAsync(int id)
        {
            using var transaction = await _context.Database.BeginTransactionAsync();
            try 
            {
                // 1. Buscamos la nota con sus detalles para saber qué revertir
                var nota = await _context.NotasEntregaCompra
                    .Include(n => n.Detalles)
                    .FirstOrDefaultAsync(n => n.Id == id);

                if (nota == null) throw new Exception("Nota de entrega no encontrada.");
                if (nota.ProcesadoAFactura) throw new Exception("No se puede anular una nota ya procesada a factura.");

                foreach (var item in nota.Detalles) 
                {
                    var producto = await _context.Productos
                        .FirstOrDefaultAsync(p => p.CodigoProd == item.CodigoProd);

                    if (producto != null) 
                    {
                        // 2. REVERSIÓN DE STOCK
                        // Restamos la cantidad que entró originalmente para que el inventario sea real
                        producto.StockActual -= item.CantidadRecibida;

                        // 3. RESTAURACIÓN DE COSTO
                        // Buscamos el último costo de una entrada válida que NO sea la que estamos anulando
                        var ultimoMovimientoValido = await _context.InventarioMovimientos
                            .Where(m => m.CodigoProd == item.CodigoProd && 
                                        m.Tipo == "ENTRADA" && 
                                        m.Concepto != $"Nota de Entrega Compra #{nota.NumeroNota}")
                            .OrderByDescending(m => m.Fecha)
                            .FirstOrDefaultAsync();

                        if (ultimoMovimientoValido != null)
                        {
                            // Devolvemos el costo histórico al producto
                            producto.CostoUnitarioBase = ultimoMovimientoValido.CostoUnitarioUSD;
                        }

                        // 4. REGISTRO EN KARDEX (CON CORRECCIÓN DESCRIPTIVA)
                        // Ahora guardamos el costo que se está anulando para que la auditoría sea clara
                        _context.InventarioMovimientos.Add(new InventarioMovimiento 
                        {
                            CodigoProd = item.CodigoProd,
                            Tipo = "SALIDA",
                            Concepto = $"ANULACIÓN Nota de Entrega #{nota.NumeroNota}",
                            Cantidad = item.CantidadRecibida,
                            CostoUnitarioUSD = item.CostoUnitarioUSD, // Refleja el costo que "sale" del sistema
                            Fecha = DateTime.Now
                        });
                    }
                }

                // 5. ELIMINACIÓN FÍSICA O LÓGICA
                _context.NotasEntregaCompra.Remove(nota);
                
                await _context.SaveChangesAsync();
                await transaction.CommitAsync();
            } 
            catch (Exception ex)
            {
                await transaction.RollbackAsync();
                throw new Exception($"Error al anular nota de entrega: {ex.Message}");
            }
        }
    }
}