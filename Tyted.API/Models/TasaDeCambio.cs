using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Tyted.API.Models
{
    // Esta tabla almacenará el historial de la tasa de cambio (Bs por USD)
    public class TasaDeCambio
    {
        [Key]
        public int IdTasa { get; set; }

        [Required]
        [Column(TypeName = "decimal(18, 6)")] // Usamos 6 decimales para alta precisión
        public decimal Tasa { get; set; } // Valor: Moneda Base (VES) por 1 Moneda Extranjera (USD)
                                          // Ejemplo: 36.50

        [Required]
        public DateTime FechaVigencia { get; set; } // Fecha y hora en que esta tasa entra en vigor

        [Required]
        [MaxLength(3)]
        public string MonedaOrigen { get; set; } = "USD"; // Código de Moneda de Origen (Extranjera)

        [Required]
        [MaxLength(3)]
        public string MonedaDestino { get; set; } = "VES"; // Código de Moneda Destino (Base)

        [MaxLength(100)]
        public string? UsuarioRegistro { get; set; } // Quién registró la tasa
    }
}