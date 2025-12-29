using System.ComponentModel.DataAnnotations;

namespace Tyted.API.Models
{
    public class AbonoCXC
    {
        [Key]
        public int Id { get; set; }

        public int CuentaPorCobrarId { get; set; }
        
        public DateTime FechaAbono { get; set; } = DateTime.Now;

        // Cuánto entregó el cliente en esta transacción ($)
        public decimal MontoAbonadoMonedaBase { get; set; }

        public string MetodoPago { get; set; } // Efectivo, Zelle, Transferencia
        public string Notas { get; set; }
    }
}