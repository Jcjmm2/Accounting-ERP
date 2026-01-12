using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Tyted.API.Models
{
    public class TasaDeCambio
    {
        [Key]
        public int IdTasa { get; set; }

        [Required]
        [Column(TypeName = "decimal(18, 6)")]
        public decimal Tasa { get; set; } 

        [Required]
        public DateTime FechaVigencia { get; set; }

        [MaxLength(50)]
        public string NombreTasa { get; set; } // "BCV", "Paralelo", "Euro", etc.

        public string MonedaOrigen { get; set; } // "USD"
        public string MonedaDestino { get; set; } // "VES"

        [Column(TypeName = "decimal(18, 6)")]
        public decimal? FactorSugerido { get; set; }

        [MaxLength(100)]
        public string? UsuarioRegistro { get; set; }

    }
}