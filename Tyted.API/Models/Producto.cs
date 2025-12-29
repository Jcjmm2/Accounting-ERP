using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using Microsoft.AspNetCore.Mvc.ModelBinding.Validation;

namespace Tyted.API.Models
{
    public class Producto
    {
        [Key]
        [StringLength(100)] // Coincide con nvarchar(100)
        public string CodigoProd { get; set; } = string.Empty;

        [Required]
        public int IdCategoria { get; set; }

        [ForeignKey("IdCategoria")]
        [ValidateNever]
        public virtual Categoria? Categoria { get; set; }

        [Required]
        public int IdTasaIVA { get; set; }

        [ForeignKey("IdTasaIVA")]
        [ValidateNever]
        public virtual TasaIVA? TasaIVA { get; set; }

        [Required]
        public int CodigoProv { get; set; } // <--- CAMBIADO A INT (Era el error de Cast)

        [ForeignKey("CodigoProv")]
        [ValidateNever]
        public virtual Proveedor? Proveedor { get; set; }
        
        [Required]
        [StringLength(510)] // Coincide con nvarchar(510)
        public string Descripcion { get; set; } = string.Empty;

        [Required]
        [StringLength(100)] // Coincide con nvarchar(100)
        public string TipoArt { get; set; } = "Bien";
        
        [Required]
        [Column(TypeName = "decimal(18, 4)")]
        public decimal CostoUnitarioBase { get; set; }

        [Required]
        [Column(TypeName = "decimal(18, 4)")]
        public decimal StockActual { get; set; }

        [Required]
        [Column(TypeName = "decimal(18, 4)")]
        public decimal StockMinimo { get; set; }

        [StringLength(100)]
        public string? CodigoBarras { get; set; } 

        public DateTime? FechaVencimiento { get; set; } 

        [Required]
        public DateTime FechaAdquisicion { get; set; } = DateTime.Now;

        [Column(TypeName = "decimal(18, 4)")]
        public decimal? ImpuestoLicorPorcentaje { get; set; }

        public bool? ManejaImpuestoLicor { get; set; }

        [Required]
        public bool PermiteDesglose { get; set; }

        // Relación con las unidades de venta
        public virtual ICollection<ProductosUnidad> UnidadesDeVenta { get; set; } = new List<ProductosUnidad>();
    }
}