using System.ComponentModel.DataAnnotations;

namespace Tyted.API.Models
{
    public class Cliente
    {
        [Key]
        public int Id { get; set; }
        
        [Required, StringLength(20)]
        public string Rif { get; set; } = string.Empty; // Ejemplo: V123456789
        
        [Required, StringLength(200)]
        public string Nombre { get; set; } = string.Empty;
        
        public string? Direccion { get; set; }
        public string? Telefono { get; set; }
        public string? Email { get; set; }
        
        // Configuración para el POS
        public bool PermitirCredito { get; set; } = false;
        public decimal LimiteCreditoUSD { get; set; } = 0;
    }
}