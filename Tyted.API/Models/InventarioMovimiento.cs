using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Tyted.API.Models
{
    public class InventarioMovimiento
    {
        [Key]
        public int IdMovimiento { get; set; }

        [Required]
        [StringLength(50)]
        public string CodigoProd { get; set; } = string.Empty;

        [Required]
        [StringLength(20)]
        public string Tipo { get; set; } // "ENTRADA" o "SALIDA"

        [Required]
        [StringLength(100)]
        public string Concepto { get; set; } // Ej: "Compra Factura #123", "Venta Ticket #50", "Ajuste"

        [Required]
        [Column(TypeName = "decimal(18,4)")]
        public decimal Cantidad { get; set; }

        [Required]
        [Column(TypeName = "decimal(18,4)")]
        public decimal CostoUnitarioUSD { get; set; } // Costo al momento del movimiento

        public DateTime Fecha { get; set; } = DateTime.Now;

        [ForeignKey("CodigoProd")]
        public Producto? Producto { get; set; }

        // Nueva propiedad para vincular el movimiento a una compra específica
        public int? CompraId { get; set; }

        [ForeignKey("CompraId")]
        public virtual Compra? Compra { get; set; }
    }
}