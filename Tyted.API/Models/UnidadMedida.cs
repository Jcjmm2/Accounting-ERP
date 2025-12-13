using System.ComponentModel.DataAnnotations;

namespace Tyted.API.Models
{
    public class UnidadMedida
    {
        [Key]
        public int IdUnidad { get; set; }

        [Required]
        [MaxLength(50)]
        public string NombreUnidad { get; set; } = string.Empty; // Ej: Unidad, Caja, Paquete, Kg, Litro
    }
}