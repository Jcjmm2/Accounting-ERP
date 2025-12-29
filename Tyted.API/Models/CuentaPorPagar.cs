using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Tyted.API.Models
{
    public class CuentaPorPagar
    {
        [Key]
        public int Id { get; set; }
        public int CompraId { get; set; }
        [ForeignKey("CompraId")]
        public Compra Compra { get; set; }

        // Cambiamos a los nombres que buscan tus servicios:
        public decimal MontoTotalUSD { get; set; }
        public decimal SaldoPendienteUSD { get; set; }

        public DateTime FechaRegistro { get; set; } = DateTime.Now;
        public DateTime FechaVencimiento { get; set; }
        public string Estado { get; set; } = "Pendiente";
    }
}