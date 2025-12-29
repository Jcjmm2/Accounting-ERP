using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Tyted.API.Models
{
    public class Categoria
    {
        [Key]
        public int IdCategoria { get; set; }

        [Required]
        [StringLength(100)]
        public string Nombre { get; set; } = string.Empty;

        // Porcentaje sugerido para esta categoría (ej: 30.00)
        [Column(TypeName = "decimal(5, 2)")]
        public decimal PorcentajeMargen { get; set; }

        // --- NAVEGACIÓN ---
        // Permite acceder a los productos de esta categoría desde C#
        //public virtual ICollection<Producto>? Productos { get; set; }
    }
}