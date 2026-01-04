using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using System.Text.Json.Serialization;

namespace Tyted.API.Models
{
    public class VentaPago
    {
        [Key]
        public int Id { get; set; }

        [Required]
        public int VentaId { get; set; }

        // Propiedad de navegación hacia la Venta
        // JsonIgnore evita ciclos infinitos al serializar a JSON
        [ForeignKey("VentaId")]
        [JsonIgnore]
        public virtual Venta? Venta { get; set; }

        [Required]
        [StringLength(50)]
        public string MetodoPago { get; set; } = string.Empty; // Ej: EFECTIVO_USD, PAGO_MOVIL, PUNTO_BDV

        [Required]
        [Column(TypeName = "decimal(18,4)")]
        public decimal MontoMonedaBase { get; set; } // Siempre el equivalente en USD

        [Required]
        [Column(TypeName = "decimal(18,4)")]
        public decimal MontoMonedaExt { get; set; } // Monto en la moneda original (ej. Bs)

        [Required]
        [Column(TypeName = "decimal(18,4)")]
        public decimal TasaDeCambio { get; set; } // Tasa usada en este pago específico
    }
}