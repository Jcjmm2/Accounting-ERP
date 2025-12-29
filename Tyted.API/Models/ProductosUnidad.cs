using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using System.Text.Json.Serialization;
using Microsoft.AspNetCore.Mvc.ModelBinding.Validation;

namespace Tyted.API.Models
{
    public class ProductosUnidad
    {
        [Key]
        [DatabaseGenerated(DatabaseGeneratedOption.Identity)]
        public int IdProductoUnidad { get; set; }

        [Required]
        [StringLength(100)] // Sincronizado con el nvarchar(100) de tu SQL
        public string CodigoProd { get; set; } = string.Empty;
        
        [Required]
        public int IdUnidad { get; set; } 

        [ForeignKey("IdUnidad")]
        [ValidateNever]
        public virtual UnidadMedida? UnidadMedida { get; set; }
        
        [Required]
        [StringLength(200)] // Sincronizado con el nvarchar(200) de tu SQL
        public string NombreUnidad { get; set; } = string.Empty; 

        [Required]
        [Column(TypeName = "decimal(18, 4)")] // ¡IMPORTANTE! Tu SQL tiene escala 4 (Prec 18, Scale 4)
        public decimal CantidadEquivalente { get; set; } 

        [Column(TypeName = "decimal(18, 4)")]
        public decimal? CostoUnitarioMonedaBase { get; set; } 

        [Column(TypeName = "decimal(18, 4)")]
        public decimal? PrecioMonedaBase { get; set; } 

        [Column(TypeName = "decimal(18, 4)")]
        public decimal? CostoUnitarioMonedaExt { get; set; } 

        [Column(TypeName = "decimal(18, 4)")]
        public decimal? PrecioMonedaExt { get; set; } 

        [StringLength(100)] // Sincronizado con el nvarchar(100) de tu SQL
        public string? CodigoBarras { get; set; } 

        // Márgenes en SQL son decimal(5, 2)
        [Column(TypeName = "decimal(5, 2)")]
        public decimal? Margen1 { get; set; }
        [Column(TypeName = "decimal(5, 2)")]
        public decimal? Margen2 { get; set; }
        [Column(TypeName = "decimal(5, 2)")]
        public decimal? Margen3 { get; set; }

        [Column(TypeName = "decimal(18, 4)")]
        public decimal? Precio2MonedaBase { get; set; }
        
        [Column(TypeName = "decimal(18, 4)")]
        public decimal? Precio3MonedaBase { get; set; }

        [Column(TypeName = "decimal(18, 4)")]
        public decimal? Precio2MonedaExt { get; set; }

        [Column(TypeName = "decimal(18, 4)")]
        public decimal? Precio3MonedaExt { get; set; }

        [ForeignKey("CodigoProd")]
        [JsonIgnore]
        [ValidateNever] 
        public virtual Producto? Producto { get; set; }
    }
}