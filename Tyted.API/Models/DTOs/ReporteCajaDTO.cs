namespace Tyted.API.Models
{
    public class ReporteCajaDTO
    {
        public DateTime Fecha { get; set; }
        public decimal TotalVendidoUSD { get; set; }
        public decimal TotalVendidoVES { get; set; }
        public decimal TotalIVAUSD { get; set; }
        public int CantidadVentas { get; set; }
        
        // --- AGREGAR ESTO PARA EL ARQUEO ---
        public decimal MontoEfectivoUSD { get; set; }
        public decimal MontoEfectivoVES { get; set; }
        public decimal MontoPagoMovil { get; set; }
        public decimal MontoBDV { get; set; }
        public decimal MontoBancamiga { get; set; }
        public decimal MontoMetal { get; set; }
        // -----------------------------------

        public List<VentasPorMetodoPago> DesgloseMetodos { get; set; } = new();
        public List<TopProductoDTO> TopProductos { get; set; } = new();
    }

    public class VentasPorMetodoPago
    {
        public string Metodo { get; set; } = "";
        public decimal MontoUSD { get; set; }
        public decimal MontoVES { get; set; }
    }

    public class TopProductoDTO
    {
        public string Descripcion { get; set; } = "";
        public decimal CantidadVendida { get; set; }
        public decimal TotalRecaudadoUSD { get; set; }
    }
}       