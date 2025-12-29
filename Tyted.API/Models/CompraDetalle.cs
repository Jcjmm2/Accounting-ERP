// Tyted.API.Models/CompraDetalle.cs
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using Tyted.API.Models;


namespace Tyted.API.Models
{
    public class CompraDetalle
    {
        [Key]
        public int Id { get; set; }

        [Required]
        public int CompraId { get; set; } // FK a la cabecera Compra

        [Required]
        public string? UnidadCompra { get; set; } // <--- AGREGAR ESTA LÍNEA

        [Required]
        [StringLength(50)]
        public string CodigoProd { get; set; } = string.Empty;

        [ForeignKey("CodigoProd")] // Evita que se cree "ProductoCodigoProd"
        public virtual Producto? Producto { get; set; }

        [Required]
        public int IdProductoUnidad { get; set; } // FK a la unidad específica comprada

        [Column(TypeName = "decimal(18, 4)")]
        public decimal Cantidad { get; set; }
        
        // ==========================================================
        // COSTOS Y TOTALES EN MONEDA BASE (VES)
        // ==========================================================
        [Column(TypeName = "decimal(18, 4)")]
        public decimal CostoUnitarioMonedaBase { get; set; }
        
        [Column(TypeName = "decimal(18, 4)")]
        public decimal SubtotalLineaMonedaBase { get; set; } // Campo que faltaba en el código anterior, pero esencial.
                                                            // Lo añadimos por consistencia.
        [Column(TypeName = "decimal(18, 4)")]
        public decimal TotalLineaMonedaBase { get; set; }

        // ==========================================================
        // >>> PROPIEDADES NUEVAS EN MONEDA EXTRANJERA (USD) <<<
        // ==========================================================
        [Column(TypeName = "decimal(18, 4)")]
        public decimal CostoUnitarioMonedaExt { get; set; } // Costo unitario en USD
        
        [Column(TypeName = "decimal(18, 4)")]
        public decimal SubtotalLineaMonedaExt { get; set; } // Subtotal sin IVA en USD
        
        [Column(TypeName = "decimal(18, 4)")]
        public decimal IvaLineaMonedaExt { get; set; }      // IVA de la línea en USD
        
        [Column(TypeName = "decimal(18, 4)")]
        public decimal TotalLineaMonedaExt { get; set; }    // Total de la línea en USD
        // ==========================================================
        
        // Tasa de IVA (se mantiene)
        [Column(TypeName = "decimal(18, 2)")] // Permite números como 16.00, 100.00, etc.
        public decimal TasaIVA { get; set; }
         


        // --- PROPIEDADES DE NAVEGACIÓN ---
        
        [ForeignKey("CompraId")] // <--- AGREGAR ESTO
        public virtual Compra? Compra { get; set; }

        [NotMapped]
        public decimal PrecioSugeridoBase { get; set; }

        [NotMapped]
        public decimal CostoAnteriorBase { get; set; }

        
    }
    
}