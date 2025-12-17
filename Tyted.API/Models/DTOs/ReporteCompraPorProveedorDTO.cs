// Archivo: Tyted.API.Models/DTOs/ReporteCompraPorProveedorDTO.cs

namespace Tyted.API.Models.DTOs
{
    public class ReporteCompraPorProveedorDTO
    {
        public int CodigoProd { get; set; }
        public string? Razonsocial { get; set; }
        
        // Suma de todas las compras no anuladas
        public int TotalCompras { get; set; } // Contador de facturas
        
        // Totales en Moneda Base (VES)
        public decimal TotalBaseVES { get; set; }
        public decimal SubtotalBaseVES { get; set; }
        public decimal IVABaseVES { get; set; }
        
        // Totales en Moneda Extranjera (USD)
        public decimal TotalExtUSD { get; set; }
        public decimal SubtotalExtUSD { get; set; }
        public decimal IVAExtUSD { get; set; }
    }
}