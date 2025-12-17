using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using System.Collections.Generic; // Necesario para ICollection

namespace Tyted.API.Models
{
    public class Categoria
    {
        [Key]
        public int IdCategoria { get; set; }

        [Required]
        [StringLength(100)]
        public string Nombre { get; set; } = string.Empty; // Ej: Víveres Básicos

        [Required]
        [Column(TypeName = "decimal(5, 2)")]
        // CLAVE: Porcentaje de ganancia (margen) a aplicar sobre el costo
        public decimal PorcentajeMargen { get; set; } 

        // Propiedad de navegación inversa (opcional, pero buena práctica)
        public ICollection<Producto>? Productos { get; set; }
    }
}