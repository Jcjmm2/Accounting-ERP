using System.ComponentModel.DataAnnotations;

namespace Tyted.API.Models
{
    public class Moneda
    {
        [Key]
        public int IdMoneda { get; set; }

        [Required]
        [StringLength(3)] // Ejemplo: USD, VES, EUR
        public string Siglas { get; set; }

        [Required]
        [StringLength(50)]
        public string Nombre { get; set; }

        public bool EsMonedaBase { get; set; } // Para marcar el Dólar según tus preferencias
    }
}