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

        //[Required]
        //[MaxLength(3)]
        //public int? MonedaOrigenId { get; set; } = 1;
        

        //[Required]
        //[MaxLength(3)]
        //public int? MonedaDestinoId { get; set; } =2;

        [Column(TypeName = "decimal(18, 6)")]
        public decimal? FactorSugerido { get; set; }

        [MaxLength(100)]
        public string? UsuarioRegistro { get; set; }

        public string MonedaOrigen { get; set; }
        public string MonedaDestino { get; set; }
    }
}