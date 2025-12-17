using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using System.Collections.Generic; // Necesario para ICollection

namespace Tyted.API.Models
{
    public class TasaIVA
    {
        [Key]
        public int IdTasaIVA { get; set; }

        [Required]
        [StringLength(50)]
        public string Nombre { get; set; } = string.Empty; // Ej: Tasa General (16%)

        [Required]
        [Column(TypeName = "decimal(5, 2)")]
        // El porcentaje en valor numérico: 16.00, 8.00, 0.00, 31.00
        public decimal Porcentaje { get; set; } 

        // Propiedad de navegación inversa (opcional, pero buena práctica)
        public ICollection<Producto>? Productos { get; set; }
    }
}