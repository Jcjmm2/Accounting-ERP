using Tyted.API.Data;
using Tyted.API.Models;
using Microsoft.EntityFrameworkCore;
using Tyted.API.Helpers;

namespace Tyted.API.Services
{
    public class VentaService
    {
        private readonly TytedContext _context;
        private readonly CorrelativoService _correlativoService; // Agregado

        // Inyectamos ambos servicios en el constructor
        public VentaService(TytedContext context, CorrelativoService correlativoService)
        {
            _context = context;
            _correlativoService = correlativoService;
        }

        public async Task<Venta> RegistrarVentaAsync(Venta venta)
        {
            venta.NumeroFactura = await _correlativoService.GenerarSiguienteNumeroVenta();
            venta.FechaVenta = DateHelper.GetVenezuelaTime();
            venta.TipoMoneda = "USD"; 

            using var transaction = await _context.Database.BeginTransactionAsync();
            try
            {
                if (venta.ClienteId == 0 || venta.ClienteId == null) 
                {
                venta.ClienteId = 1; // ID del cliente "CLIENTE EVENTUAL";
                }
                if (venta.Detalles == null || !venta.Detalles.Any())
                    throw new Exception("No hay artículos en la venta.");

                foreach (var detalle in venta.Detalles)
                {
                    // 1. Limpieza y búsqueda del producto
                    string codigoABuscar = detalle.CodigoProd?.ToString() ?? string.Empty;
                    var producto = await _context.Productos
                        .FirstOrDefaultAsync(p => p.CodigoProd == codigoABuscar);

                    if (producto == null)
                        throw new Exception($"Producto {codigoABuscar} no existe.");

                    // 2. Búsqueda de la unidad y obtención del factor de equivalencia
                    int idUnidadBuscada = Convert.ToInt32(detalle.IdProductoUnidad);
                    var unidad = await _context.ProductosUnidad
                        .FirstOrDefaultAsync(u => u.IdProductoUnidad == idUnidadBuscada);

                    if (unidad == null)
                        throw new Exception($"Unidad de medida no encontrada para el producto {codigoABuscar}.");

                    // Asignamos el nombre de la unidad al detalle para la factura
                    detalle.NombreUnidad = unidad.NombreUnidad;

                    // 3. Cálculo de cantidad real basada en la equivalencia
                    // Ejemplo: Si vende 1 Bulto y la equivalencia es 20, cantidadReal = 20
                    decimal factor = unidad.CantidadEquivalente;
                    decimal cantidadRealARestar = detalle.Cantidad * factor;

                    // 4. Validación de Stock contra la cantidad real
                    if (producto.StockActual < cantidadRealARestar)
                        throw new Exception($"Stock insuficiente para {producto.Descripcion}. Disponible: {producto.StockActual} (Requerido: {cantidadRealARestar})");

                    // 5. DESCUENTO DE INVENTARIO (Siempre en la unidad mínima/base)
                    producto.StockActual -= cantidadRealARestar;

                    // 6. REGISTRO EN KARDEX (InventarioMovimientos)
                    var movimiento = new InventarioMovimiento
                    {
                        CodigoProd = codigoABuscar,
                        Tipo = "SALIDA",
                        Concepto = $"Venta POS - Factura {venta.NumeroFactura}",
                        Cantidad = cantidadRealARestar, // Guardamos la salida real en unidades base
                        CostoUnitarioUSD = producto.CostoUnitarioBase,
                        Fecha = DateHelper.GetVenezuelaTime()
                    };
                    _context.InventarioMovimientos.Add(movimiento);

                    // 7. CÁLCULOS FINANCIEROS DE LA LÍNEA (Basados en la cantidad facturada, no la real)
                    // Nota: El precio ya viene por la unidad seleccionada (Bulto, Gramo, etc.)
                    detalle.PrecioUnitarioMonedaExt = Math.Round(detalle.PrecioUnitarioMonedaBase * venta.TasaDeCambio, 4);
                    detalle.PrecioUnitarioMonedaExt = Math.Round(detalle.PrecioUnitarioMonedaBase * venta.TasaDeCambio, 4, MidpointRounding.AwayFromZero);
                    detalle.SubtotalLineaMonedaBase = detalle.Cantidad * detalle.PrecioUnitarioMonedaBase;
                    detalle.SubtotalLineaMonedaExt = Math.Round(detalle.Cantidad * detalle.PrecioUnitarioMonedaExt, 2);
                    detalle.SubtotalLineaMonedaExt = Math.Round(detalle.Cantidad * detalle.PrecioUnitarioMonedaExt, 2, MidpointRounding.AwayFromZero);

                    decimal factorIva = (detalle.TasaIVA) / 100;
                    detalle.IvaLineaMonedaExt = Math.Round(detalle.SubtotalLineaMonedaExt * factorIva, 2);
                    detalle.IvaLineaMonedaExt = Math.Round(detalle.SubtotalLineaMonedaExt * factorIva, 2, MidpointRounding.AwayFromZero);
                    detalle.TotalLineaMonedaExt = detalle.SubtotalLineaMonedaExt + detalle.IvaLineaMonedaExt;
                    detalle.TotalLineaMonedaBase = Math.Round(detalle.SubtotalLineaMonedaBase * (1 + factorIva), 4);
                    detalle.TotalLineaMonedaBase = Math.Round(detalle.SubtotalLineaMonedaBase * (1 + factorIva), 4, MidpointRounding.AwayFromZero);
                }

                // --- TOTALES DE CABECERA ---
                venta.SubtotalMonedaBase = venta.Detalles.Sum(d => d.SubtotalLineaMonedaBase);
                venta.TotalMonedaBase = venta.Detalles.Sum(d => d.TotalLineaMonedaBase);
                venta.IvaMonedaBase = venta.TotalMonedaBase - venta.SubtotalMonedaBase;

                venta.SubtotalMonedaExt = venta.Detalles.Sum(d => d.SubtotalLineaMonedaExt);
                venta.TotalMonedaExt = venta.Detalles.Sum(d => d.TotalLineaMonedaExt);
                venta.IvaMonedaExt = venta.TotalMonedaExt - venta.SubtotalMonedaExt;
                venta.TotalUSD = venta.TotalMonedaBase; // Evita el NULL en SQL
                venta.TotalVES = venta.TotalMonedaExt;
                venta.TasaDia = venta.TasaDeCambio;
                
                _context.Ventas.Add(venta);
                await _context.SaveChangesAsync();
                // ============================================================
                // NUEVA MEJORA: VINCULACIÓN Y CIERRE DE PEDIDO
                // ============================================================
                if (venta.PedidoId.HasValue && venta.PedidoId > 0)
                {
                    var pedido = await _context.Pedidos.FindAsync(venta.PedidoId.Value);
                    if (pedido != null)
                    {
                        pedido.Estado = "Facturado"; // Cambiamos el estado para que desaparezca del POS
                        _context.Pedidos.Update(pedido);
                        // No hace falta llamar a SaveChanges aquí, se hará con el CXC o al final
                        await _context.SaveChangesAsync(); 
                        Console.WriteLine($"---> Pedido #{pedido.Id} actualizado a Facturado con éxito.");
                    }
                } 

                // 5. LÓGICA DE CUENTAS POR COBRAR (CXC)
                if (venta.EsCredito)
                        {
                            if (venta.ClienteId == 1)
                            {
                                throw new Exception("No se permiten ventas a crédito para el CLIENTE EVENTUAL. Seleccione un cliente registrado.");
                            }

                            var cxc = new CuentaPorCobrar
                            {
                                VentaId = venta.VentaId,
                                MontoTotalUSD = venta.TotalMonedaBase,
                                SaldoPendienteUSD = venta.TotalMonedaBase - (venta.Pagos?.Sum(p => p.MontoMonedaBase) ?? 0),
                                FechaVencimiento = venta.FechaVencimiento ?? DateHelper.GetVenezuelaTime().AddDays(15),
                                Estado = "Pendiente"
                            };
                            _context.CuentasPorCobrar.Add(cxc);
                            await _context.SaveChangesAsync();
                        }

                        await transaction.CommitAsync();
                        return venta;
                    }
                    catch (Exception ex)
                    {
                        await transaction.RollbackAsync();
                        throw new Exception(ex.Message);
            }
        }

        public async Task<bool> AnularVentaAsync(int IdVenta)
        {
            using var transaction = await _context.Database.BeginTransactionAsync();
            try
            {
                // 1. Buscamos la venta con sus detalles y unidades de medida
                var venta = await _context.Ventas
                    .Include(v => v.Detalles)
                    .FirstOrDefaultAsync(v => v.VentaId == IdVenta);

                if (venta == null) throw new Exception("La venta no existe.");
                if (venta.IsAnulada) throw new Exception("Esta venta ya fue anulada previamente.");

                foreach (var detalle in venta.Detalles)
                {
                    // Buscamos el producto maestro
                    var producto = await _context.Productos
                        .FirstOrDefaultAsync(p => p.CodigoProd == detalle.CodigoProd);

                    if (producto != null)
                    {
                        // 2. RECUPERAR EQUIVALENCIA
                        // Buscamos la unidad específica que se usó en esa línea de venta
                        var unidad = await _context.ProductosUnidad
                            .FirstOrDefaultAsync(u => u.IdProductoUnidad == detalle.IdProductoUnidad);

                        // Si no se encuentra la unidad por alguna razón, asumimos factor 1 (seguridad)
                        decimal equivalencia = unidad?.CantidadEquivalente ?? 1;
                        decimal cantidadADevolver = detalle.Cantidad * equivalencia;

                        // 3. REVERSIÓN DE STOCK
                        producto.StockActual += cantidadADevolver;

                        // 4. REGISTRO EN KARDEX (Entrada por devolución)
                        var movimientoAnulacion = new InventarioMovimiento
                        {
                            CodigoProd = detalle.CodigoProd,
                            Tipo = "ENTRADA",
                            Concepto = $"Anulación Venta Fact #{venta.NumeroFactura}",
                            Cantidad = cantidadADevolver,
                            CostoUnitarioUSD = producto.CostoUnitarioBase,
                            Fecha = DateHelper.GetVenezuelaTime()
                        };
                        _context.InventarioMovimientos.Add(movimientoAnulacion);
                    }
                }

                // 5. BLINDAJE DE CUENTAS POR COBRAR (CxC)
                // Si la venta fue a crédito, el cliente ya no debe ese dinero
                var cxc = await _context.CuentasPorCobrar.FirstOrDefaultAsync(c => c.VentaId == IdVenta);
                if (cxc != null)
                {
                    cxc.Estado = "Anulada";
                    cxc.SaldoPendienteUSD = 0;
                    // Opcional: podrías registrar un comentario en la CxC sobre la anulación
                }

                // 6. CAMBIO DE ESTADO Y PERSISTENCIA
                venta.IsAnulada = true;
        
                await _context.SaveChangesAsync();
                await transaction.CommitAsync();
        
                return true;
            }
            catch (Exception ex)
            {
                // Si algo falla (ej. error de base de datos), no se devuelve stock ni se anula nada
                await transaction.RollbackAsync();
                throw new Exception($"Error crítico al anular: {ex.Message}");
            }
        }

        public async Task<ReporteCajaDTO> GetReporteDiarioAsync(DateTime? fechaParametro)
        {
            var hoyVenezuela = fechaParametro ?? DateHelper.GetVenezuelaTime();

            // CAMBIO CLAVE: Buscamos la sesión abierta más reciente sin importar el string del usuario
            // o buscamos la última sesión cerrada si no hay ninguna abierta.
            var sesionActiva = await _context.CajaSesiones
                .OrderByDescending(s => s.FechaApertura)
                .FirstOrDefaultAsync(s => s.IsAbierta);

            // Si no hay sesión abierta, el reporte debe ser 0 pero con la fecha correcta
            if (sesionActiva == null) 
                return new ReporteCajaDTO { Fecha = hoyVenezuela };

            // Buscamos las ventas. Agregamos un pequeño margen de 1 minuto atrás a la fecha de apertura 
            // por si acaso hubo retrasos en la grabación de la sesión
            var fechaInicioBusqueda = sesionActiva.FechaApertura.AddSeconds(-10);

            var ventasDelDia = await _context.Ventas
                .Include(v => v.Pagos) 
                .Where(v => v.FechaVenta >= fechaInicioBusqueda && !v.IsAnulada)
                .ToListAsync();

            var reporte = new ReporteCajaDTO
            {
                Fecha = hoyVenezuela,
                CantidadVentas = ventasDelDia.Count,
                TotalVendidoUSD = ventasDelDia.Sum(v => v.TotalMonedaBase),
                TotalVendidoVES = ventasDelDia.Sum(v => v.TotalMonedaExt),

                // ESTOS NOMBRES DEBEN COINCIDIR CON EL FRONTEND O VICEVERSA
                // Vamos a mapearlos explícitamente para el Arqueo:
                MontoEfectivoUSD = ventasDelDia.SelectMany(v => v.Pagos)
                    .Where(p => p.MetodoPago.ToUpper().Contains("EFECTIVO_USD"))
                    .Sum(p => p.MontoMonedaBase),

                MontoEfectivoVES = ventasDelDia.SelectMany(v => v.Pagos)
                    .Where(p => p.MetodoPago.ToUpper().Contains("EFECTIVO_VES"))
                    .Sum(p => p.MontoMonedaExt),

                MontoPagoMovil = ventasDelDia.SelectMany(v => v.Pagos)
                    .Where(p => p.MetodoPago.ToUpper().Contains("PAGO_MOVIL"))
                    .Sum(p => p.MontoMonedaExt),
                // AGREGA ESTOS PARA QUE REACT LOS RECONOZCA:
                MontoBDV = ventasDelDia.SelectMany(v => v.Pagos)
                        .Where(p => p.MetodoPago.ToUpper().Contains("PUNTO_BDV")).Sum(p => p.MontoMonedaExt),

                MontoBancamiga = ventasDelDia.SelectMany(v => v.Pagos)
                        .Where(p => p.MetodoPago.ToUpper().Contains("PUNTO_BANCAMIGA")).Sum(p => p.MontoMonedaExt),
                        
                MontoMetal = ventasDelDia.SelectMany(v => v.Pagos)
                    .Where(p => p.MetodoPago.ToUpper().Contains("METAL"))
                    .Sum(p => p.MontoMonedaBase)
                
            };

            return reporte;
        }
        
    }
}