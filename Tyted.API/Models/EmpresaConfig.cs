using System.ComponentModel.DataAnnotations;

namespace Tyted.API.Models
{
    public class EmpresaConfig
    {
        [Key]
        public int Id { get; set; }

        [Required]
        [StringLength(50)]
        public string Clave { get; set; } = string.Empty; // Ejemplo: 'PermitirStockNegativo'

        [Required]
        [StringLength(50)]
        public string Valor { get; set; } = string.Empty; // Ejemplo: 'true'

        [StringLength(255)]
        public string? Descripcion { get; set; }
    }
}