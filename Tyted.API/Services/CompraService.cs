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

                // Las compras de origen FISCAL nunca tocaron stock ni kardex:
                // su anulación tampoco revierte inventario (sólo cambia estado).
                if (compra.Origen != "Fiscal")
                {
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
                } // fin Origen != "Fiscal" (sin reversión de inventario)

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

        /// <summary>
        /// Alta de compra desde el módulo FISCAL: documento declarativo con
        /// Origen='Fiscal' SIN aumento de stock, SIN actualización de costos y
        /// SIN kardex (no afecta el módulo de compras ni la gestión de
        /// inventario). Totales recalculados en servidor desde las líneas.
        /// </summary>
        public async Task<Compra> CrearCompraFiscalAsync(Compra compra)
        {
            if (compra.Detalles == null || !compra.Detalles.Any())
                throw new Exception("La compra fiscal no tiene líneas detalladas.");
            if (compra.CodigoProv == null)
                throw new Exception("Indique el proveedor de la compra fiscal.");

            // DATOS FISCALES DEL LIBRO DE COMPRAS (SENIAT): N° de factura
            // obligatorio siempre; N° de control obligatorio para el tipo 01
            // (Registro) — los complementos (02) y anulaciones (03) pueden
            // prescindir de él porque refieren a un documento afectado.
            if (string.IsNullOrWhiteSpace(compra.NumeroFactura))
                throw new Exception("El N° de factura de la compra fiscal es obligatorio (dato del Libro de Compras).");
            compra.NumeroFactura = compra.NumeroFactura.Trim();

            compra.TipoTransaccion = string.IsNullOrWhiteSpace(compra.TipoTransaccion)
                ? "01"
                : compra.TipoTransaccion.Trim();
            if (compra.TipoTransaccion is not ("01" or "02" or "03"))
                throw new Exception("El tipo de transacción SENIAT de la compra fiscal debe ser 01, 02 o 03.");

            if (compra.TipoTransaccion == "01" && string.IsNullOrWhiteSpace(compra.NumeroControl))
                throw new Exception(
                    "El N° de control de la factura es obligatorio (tipo 01 Registro; dato del Libro de Compras). " +
                    "Si el documento no tiene control, escriba «S/N».");
            if (!string.IsNullOrWhiteSpace(compra.NumeroControl))
                compra.NumeroControl = compra.NumeroControl.Trim();

            using var transaction = await _context.Database.BeginTransactionAsync();
            try
            {
                compra.Origen = "Fiscal";
                if (compra.FechaCompra == default) compra.FechaCompra = DateHelper.GetVenezuelaTime();
                compra.IsAnulada = false;
                if (string.IsNullOrWhiteSpace(compra.TipoMoneda)) compra.TipoMoneda = "USD";
                var tasa = compra.TasaDeCambio > 0 ? compra.TasaDeCambio : 1m;

                // ENTRADA EN BOLÍVARES (fiscal en Bs.): el formulario fiscal
                // captura los costos en Bs. y los envía en CostoUnitarioMonedaExt
                // con TipoMoneda VES. Los Bs. son la VERDAD FISCAL exacta (se
                // congelan tal cual en los campos *MonedaExt); los campos
                // *MonedaBase (USD) se derivan con la tasa para el asiento
                // contable, que sigue la convención de moneda base del libro.
                var enBolivares = compra.TipoMoneda == "VES" || compra.TipoMoneda == "BS";
                if (enBolivares && tasa <= 1m)
                    throw new Exception("La compra fiscal en Bolívares requiere una tasa de cambio Bs./USD válida (mayor que 1).");

                decimal subtotal = 0m, ivaTotal = 0m;          // moneda base (USD)
                decimal subtotalBs = 0m, ivaTotalBs = 0m;      // Bolívares (Bs.)
                foreach (var detalle in compra.Detalles)
                {
                    var producto = await _context.Productos
                        .FirstOrDefaultAsync(p => p.CodigoProd == detalle.CodigoProd)
                        ?? throw new Exception($"Producto {detalle.CodigoProd} no existe.");
                    var unidad = await _context.ProductosUnidad
                        .FirstOrDefaultAsync(u => u.IdProductoUnidad == detalle.IdProductoUnidad)
                        ?? throw new Exception($"Unidad no encontrada para {detalle.CodigoProd}.");
                    if (detalle.Cantidad <= 0)
                        throw new Exception("Cantidad inválida en las líneas de la compra fiscal.");

                    if (string.IsNullOrWhiteSpace(detalle.UnidadCompra))
                        detalle.UnidadCompra = unidad.NombreUnidad;

                    if (enBolivares)
                    {
                        var costoBs = detalle.CostoUnitarioMonedaExt;
                        if (costoBs <= 0)
                            throw new Exception("Costo unitario (Bs.) inválido en las líneas de la compra fiscal.");

                        var lineaBs = Math.Round(costoBs * detalle.Cantidad, 2);
                        var ivaLineaBs = Math.Round(lineaBs * (detalle.TasaIVA / 100m), 2);

                        detalle.CostoUnitarioMonedaExt = costoBs;
                        detalle.SubtotalLineaMonedaExt = lineaBs;
                        detalle.IvaLineaMonedaExt = ivaLineaBs;
                        detalle.TotalLineaMonedaExt = lineaBs + ivaLineaBs;

                        // Derivación USD (libro contable) con redondeo a centavos.
                        var linea = Math.Round(lineaBs / tasa, 2);
                        var ivaLinea = Math.Round(ivaLineaBs / tasa, 2);
                        detalle.CostoUnitarioMonedaBase = Math.Round(costoBs / tasa, 4);
                        detalle.SubtotalLineaMonedaBase = linea;
                        detalle.TotalLineaMonedaBase = linea + ivaLinea;

                        subtotalBs += lineaBs;
                        ivaTotalBs += ivaLineaBs;
                        subtotal += linea;
                        ivaTotal += ivaLinea;
                    }
                    else
                    {
                        var linea = Math.Round(detalle.CostoUnitarioMonedaBase * detalle.Cantidad, 2);
                        var ivaLinea = Math.Round(linea * (detalle.TasaIVA / 100m), 2);
                        detalle.SubtotalLineaMonedaBase = linea;
                        detalle.TotalLineaMonedaBase = linea + ivaLinea;
                        detalle.CostoUnitarioMonedaExt = detalle.CostoUnitarioMonedaBase * tasa;
                        detalle.SubtotalLineaMonedaExt = linea * tasa;
                        detalle.IvaLineaMonedaExt = ivaLinea * tasa;
                        detalle.TotalLineaMonedaExt = (linea + ivaLinea) * tasa;

                        subtotal += linea;
                        ivaTotal += ivaLinea;
                    }
                }

                compra.SubtotalMonedaBase = subtotal;
                compra.IvaMonedaBase = ivaTotal;
                compra.TotalMonedaBase = subtotal + ivaTotal;
                if (enBolivares)
                {
                    // Verdad fiscal: Bs. exactos los que digitó el usuario.
                    compra.SubtotalMonedaExt = subtotalBs;
                    compra.IvaMonedaExt = ivaTotalBs;
                    compra.TotalMonedaExt = subtotalBs + ivaTotalBs;
                }
                else
                {
                    compra.SubtotalMonedaExt = subtotal * tasa;
                    compra.IvaMonedaExt = ivaTotal * tasa;
                    compra.TotalMonedaExt = (subtotal + ivaTotal) * tasa;
                }
                compra.TasaDeCambio = tasa;

                _context.Compras.Add(compra);
                await _context.SaveChangesAsync();
                await transaction.CommitAsync();
                return compra;
            }
            catch (Exception ex)
            {
                await transaction.RollbackAsync();
                throw new Exception($"Error al registrar la compra fiscal: {ex.Message}", ex);
            }
        }
    }
}