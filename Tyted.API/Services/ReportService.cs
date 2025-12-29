using ClosedXML.Excel;
using Microsoft.EntityFrameworkCore;
using Tyted.API.Data;
using QuestPDF.Fluent;
using QuestPDF.Helpers;
using QuestPDF.Infrastructure;
using Tyted.API.Models;
using Tyted.API.Helpers;

namespace Tyted.API.Services
{
    public class ReportService : IReportService
    {
        private readonly TytedContext _context;

        public ReportService(TytedContext context)
        {
            _context = context;
        }

        
        
        // REPORTE: Márgenes de Ganancia en Excel
        public async Task<byte[]> GenerarExcelMargenesAsync()
        {
            var empresa = await _context.Empresa.FirstOrDefaultAsync();
            using var workbook = new XLWorkbook();
            var worksheet = workbook.Worksheets.Add("Márgenes de Ganancia");

            // 1. ENCABEZADO DE EMPRESA
            worksheet.Cell(1, 1).Value = empresa?.RazonSocial ?? "INVERSIONES TYTED";
            worksheet.Cell(2, 1).Value = "RIF: " + empresa?.RIF;
            worksheet.Cell(3, 1).Value = "REPORTE DE MÁRGENES Y VALORIZACIÓN";
            worksheet.Cell(4, 1).Value = "Fecha: " + DateHelper.GetVenezuelaTime().ToString("g");

            // 2. CABECERAS (Movidas a la fila 6 para no chocar con el encabezado)
            string[] headers = { "Código", "Producto", "Categoría", "Stock", "Costo Unit.", "Costo Total", "P. Venta Ref.", "Venta Total", "Margen %" };
            for (int i = 0; i < headers.Length; i++)
            {
                var cell = worksheet.Cell(6, i + 1);
                cell.Value = headers[i];
                cell.Style.Font.Bold = true;
                cell.Style.Fill.BackgroundColor = XLColor.FromHtml("#1e3799");
                cell.Style.Font.FontColor = XLColor.White;
            }

            var productos = await _context.Productos
                .Include(p => p.Categoria)
                .Include(p => p.UnidadesDeVenta)
                .ToListAsync();

            int row = 7;
            foreach (var p in productos)
            {
                var u = p.UnidadesDeVenta?.FirstOrDefault();
                if (u == null) continue; 

                decimal stock = p.StockActual;
                decimal costoUnitBase = p.CostoUnitarioBase; 
                decimal precioVentaRef = u.PrecioMonedaBase ?? 0;
                decimal equivalencia = u.CantidadEquivalente > 0 ? u.CantidadEquivalente : 1;
        
                decimal valorCostoTotal = stock * costoUnitBase;
                decimal valorVentaTotalCalculada = stock * (precioVentaRef / equivalencia);

                decimal utilidadTotal = valorVentaTotalCalculada - valorCostoTotal;
                decimal margenPorcentaje = valorVentaTotalCalculada > 0 ? (utilidadTotal / valorVentaTotalCalculada) : 0;

                // Llenado de datos
                worksheet.Cell(row, 1).Value = p.CodigoProd ?? "S/C";
                worksheet.Cell(row, 2).Value = p.Descripcion;
                worksheet.Cell(row, 3).Value = p.Categoria?.Nombre ?? "S/C";
                worksheet.Cell(row, 4).Value = stock;
                worksheet.Cell(row, 5).Value = costoUnitBase;
                worksheet.Cell(row, 6).Value = valorCostoTotal;
                worksheet.Cell(row, 7).Value = precioVentaRef;
                worksheet.Cell(row, 8).Value = valorVentaTotalCalculada;
                worksheet.Cell(row, 9).Value = margenPorcentaje;

                // Formatos
                worksheet.Cell(row, 9).Style.NumberFormat.Format = "0.00%";
                worksheet.Range(row, 5, row, 8).Style.NumberFormat.Format = "#,##0.00";

                row++;
            }

            // 3. TOTALES GENERALES
            if (row > 7)
            {
                int lastDataRow = row - 1;
                int totalRow = row + 1;
                worksheet.Cell(totalRow, 3).Value = "TOTALES GENERALES:";
                worksheet.Cell(totalRow, 6).FormulaA1 = $"SUM(F7:F{lastDataRow})";
                worksheet.Cell(totalRow, 8).FormulaA1 = $"SUM(H7:H{lastDataRow})";
        
                worksheet.Range(totalRow, 3, totalRow, 8).Style.Font.Bold = true;
                worksheet.Range(totalRow, 6, totalRow, 8).Style.NumberFormat.Format = "#,##0.00";
            }

            worksheet.Columns().AdjustToContents();

            // --- EL BLOQUE DE RETORNO QUE TE FALTABA ---
            using (var stream = new MemoryStream())
            {
                workbook.SaveAs(stream);
                return stream.ToArray(); // Esto devuelve el archivo al controlador
            }
        }
        // REPORTE: Cierre de Caja en PDF (Estructura básica con QuestPDF)
        public async Task<byte[]> GenerarPdfCierreCajaAsync(DateTime fecha)
        {
            // 1. OBTENER DATOS DE LA EMPRESA PRIMERO
            var datosEmpresa = await _context.Empresa.FirstOrDefaultAsync() 
                ?? new Empresa { RazonSocial = "Empresa No Configurada" };
            
            var ventas = await _context.Ventas
                .Where(v => v.FechaVenta.Date == fecha.Date && !v.IsAnulada)
                .ToListAsync();

            var documento = Document.Create(container =>
            {
                container.Page(page =>
                {
                    page.Margin(1, Unit.Centimetre);
                    page.Header().Text($"Cierre de Caja - {fecha:dd/MM/yyyy}").FontSize(20).SemiBold().FontColor(Colors.Blue.Medium);
                    
                    page.Content().Table(table =>
                    {
                        table.ColumnsDefinition(columns =>
                        {
                            columns.RelativeColumn();
                            columns.RelativeColumn();
                            columns.RelativeColumn();
                        });

                        table.Header(header =>
                        {
                            header.Cell().Text("Factura");
                            header.Cell().Text("Total USD");
                            header.Cell().Text("Total VES");
                        });

                        foreach (var v in ventas)
                        {
                            table.Cell().Text(v.NumeroFactura);
                            table.Cell().Text($"${v.TotalMonedaBase:N2}");
                            table.Cell().Text($"{v.TotalMonedaExt:N2} Bs.");
                        }
                    });

                    page.Footer().AlignCenter().Text(x =>
                    {
                        x.Span("Página ");
                        x.CurrentPageNumber();
                    });
                });
            });

            return documento.GeneratePdf();
        }

        public async Task<byte[]> GenerarExcelInventarioValoradoAsync()
        {
            // 1. Verificación del Contexto
            if (_context == null) throw new Exception("El contexto de la base de datos no está inicializado.");

            var empresa = await _context.Empresa.FirstOrDefaultAsync();
    
            // 2. Traer productos con Includes
            var listaProductos = await _context.Productos
                .Include(p => p.Categoria)
                .Include(p => p.UnidadesDeVenta) 
                .Where(p => p.StockActual > 0)
                .ToListAsync();

            var productos = listaProductos ?? new List<Producto>();

            using var workbook = new XLWorkbook();
            var worksheet = workbook.Worksheets.Add("Inventario");

            // --- ENCABEZADO ---
            worksheet.Cell(1, 1).Value = (empresa?.RazonSocial ?? "INVERSIONES TYTED").ToUpper();
            worksheet.Cell(2, 1).Value = "RIF: " + (empresa?.RIF ?? "N/A");
            worksheet.Cell(3, 1).Value = "VALORIZACIÓN DE INVENTARIO (USD)";
            worksheet.Cell(4, 1).Value = "Fecha: " + DateHelper.GetVenezuelaTime().ToString("dd/MM/yyyy HH:mm");

            // --- TÍTULOS ---
            // Agregamos columnas para ver el Costo Total y la Venta Total
            string[] headers = { 
                "Código", "Producto", "Categoría", "Stock", 
                "Costo Unit.", "Costo Total", "P. Venta Ref.", "Venta Total", "Utilidad Real" 
            };

            for (int i = 0; i < headers.Length; i++) {
                var cell = worksheet.Cell(6, i + 1);
                cell.Value = headers[i];
                cell.Style.Font.Bold = true;
                cell.Style.Fill.BackgroundColor = XLColor.FromHtml("#1e3799");
                cell.Style.Font.FontColor = XLColor.White;
            }

            int row = 7;
            foreach (var p in productos)
            {
                if (p == null) continue;

                // ACCESO SEGURO A UNIDADES Y EQUIVALENCIAS
                var unidades = p.UnidadesDeVenta ?? new List<ProductosUnidad>();
                var u = unidades.FirstOrDefault();
        
                decimal stock = p.StockActual;
                decimal costoUnitBase = p.CostoUnitarioBase; // Ej: 0.0065 (gramo)
                decimal precioVentaRef = u?.PrecioMonedaBase ?? 0m; // Ej: 8.125 (kilo)
                decimal equivalencia = (u?.CantidadEquivalente > 0) ? u.CantidadEquivalente : 1;

                // --- CÁLCULOS SEGUROS PARA EL EXCEL ---
                // Costo Total = 4750 * 0.0065 = 30.87
                decimal costoTotalFila = stock * costoUnitBase;
        
                // Venta Total = 4750 * (8.125 / 1000) = 38.59
                decimal ventaTotalFila = stock * (precioVentaRef / equivalencia);
        
                // Utilidad = 38.59 - 30.87 = 7.72
                decimal utilidadTotalFila = ventaTotalFila - costoTotalFila;

                // --- LLENADO DE CELDAS ---
                worksheet.Cell(row, 1).Value = p.CodigoProd ?? "S/C";
                worksheet.Cell(row, 2).Value = p.Descripcion ?? "SIN NOMBRE";
                worksheet.Cell(row, 3).Value = p.Categoria?.Nombre ?? "S/C";
                worksheet.Cell(row, 4).Value = stock;
                worksheet.Cell(row, 5).Value = costoUnitBase;
                worksheet.Cell(row, 6).Value = costoTotalFila;
                worksheet.Cell(row, 7).Value = precioVentaRef;
                worksheet.Cell(row, 8).Value = ventaTotalFila;
                worksheet.Cell(row, 9).Value = utilidadTotalFila;

                // Formato de moneda para las columnas de dinero (5 a 9)
                worksheet.Range(row, 5, row, 9).Style.NumberFormat.Format = "#,##0.00";

                row++;
            }

            // --- TOTALES GENERALES ---
            if (row > 7)
            {
                int totalRow = row + 1;
                worksheet.Cell(totalRow, 3).Value = "TOTALES:";
                worksheet.Cell(totalRow, 6).FormulaA1 = $"SUM(F7:F{row - 1})"; // Total Inversión
                worksheet.Cell(totalRow, 8).FormulaA1 = $"SUM(H7:H{row - 1})"; // Total Venta Esperada
                worksheet.Cell(totalRow, 9).FormulaA1 = $"SUM(I7:I{row - 1})"; // Total Utilidad
        
                worksheet.Range(totalRow, 3, totalRow, 9).Style.Font.Bold = true;
                worksheet.Range(totalRow, 6, totalRow, 9).Style.NumberFormat.Format = "#,##0.00";
            }

            worksheet.Columns().AdjustToContents();
        
            using var stream = new MemoryStream();
            workbook.SaveAs(stream);
            return stream.ToArray();
        }
        public async Task<byte[]> GenerarTicketVentaAsync(int ventaId)
        {
            var datosEmpresa = await _context.Empresa.FirstOrDefaultAsync() 
                ?? new Empresa { RazonSocial = "Empresa No Configurada" };
            
            var venta = await _context.Ventas
                .Include(v => v.Detalles)
                .FirstOrDefaultAsync(v => v.VentaId == ventaId);

            if (venta == null) return null;

            var empresa = await _context.Empresa.FirstOrDefaultAsync();

            return QuestPDF.Fluent.Document.Create(container =>
            {
                container.Page(page =>
                {
                    // Formato de ticket (ancho de 80mm típico de impresoras térmicas)
                    page.Size(80, 200, Unit.Millimetre);
                    page.Margin(5, Unit.Millimetre);
                    page.DefaultTextStyle(x => x.FontSize(9).FontFamily(Fonts.CourierNew));

                    page.Header().Column(col =>
                    {
                        col.Item().Text(empresa?.RazonSocial ?? "TYTED").Bold().FontSize(12).AlignCenter();
                        col.Item().Text($"RIF: {empresa?.RIF}").AlignCenter();
                        col.Item().Text(empresa?.Direccion ?? "").AlignCenter().FontSize(8);
                        col.Item().PaddingVertical(5).LineHorizontal(1);
                        col.Item().Text($"Factura: {venta.NumeroFactura}").Bold();
                        col.Item().Text($"Fecha: {venta.FechaVenta:dd/MM/yyyy HH:mm}");
                        col.Item().PaddingVertical(5).LineHorizontal(1);
                    });

                    page.Content().Column(col =>
                    {
                        foreach (var item in venta.Detalles)
                        {
                            col.Item().Row(row =>
                            {
                                row.RelativeItem().Text($"{item.Cantidad} x {item.CodigoProd}");
                                row.ConstantItem(50).AlignRight().Text(item.TotalLineaMonedaBase.ToString("N2"));
                            });
                        }

                        col.Item().PaddingVertical(5).LineHorizontal(0.5f);

                        // Totales en Dólares (Moneda Base)
                        col.Item().Row(row => {
                            row.RelativeItem().Text("TOTAL USD:").Bold();
                            row.ConstantItem(50).AlignRight().Text(venta.TotalMonedaBase.ToString("N2")).Bold();
                        });

                        // Equivalente en Bolívares (Moneda Ext)
                        col.Item().PaddingTop(5).Background("#F0F0F0").Padding(2).Column(c => {
                            c.Item().Text($"Tasa: {venta.TasaDeCambio:N2} VES/USD").FontSize(7).AlignCenter();
                            c.Item().Row(r => {
                                r.RelativeItem().Text("TOTAL VES:").Bold();
                                r.ConstantItem(50).AlignRight().Text(venta.TotalMonedaExt.ToString("N2")).Bold();
                            });
                        });
                    });

                    page.Footer().AlignCenter().Text("¡Gracias por su compra!").FontSize(8).Italic();
                });
            }).GeneratePdf();
        }
    }
}