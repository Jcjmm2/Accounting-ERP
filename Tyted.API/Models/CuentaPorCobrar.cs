using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Tyted.API.Models
{
    public class CuentaPorCobrar
    {
        [Key]
        public int Id { get; set; }
        public int VentaId { get; set; }
        [ForeignKey("VentaId")]
        public Venta Venta { get; set; }

        // Cambiamos a los nombres que buscan tus servicios:
        public decimal MontoTotalUSD { get; set; } 
        public decimal SaldoPendienteUSD { get; set; }

        public DateTime FechaEmision { get; set; } = DateTime.Now;
        public DateTime FechaVencimiento { get; set; }
        public string Estado { get; set; } = "Pendiente";
    }
}