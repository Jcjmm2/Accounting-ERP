using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using System.Text.Json.Serialization; // Necesario para [JsonIgnore]

namespace Tyted.API.Models
{
    public class ProductosUnidad
    {
        [Key]
        public int IdProductoUnidad { get; set; }

        // El IdUnidad se utilizará para vincular a la tabla maestra de UnidadMedida
        [Required]
        public int IdUnidad { get; set; } 
        
        // Propiedad de navegación que faltaba: Esto resuelve el error en el controlador
        public UnidadMedida? UnidadMedida { get; set; } 

        [Required]
        [StringLength(100)]
        public string NombreUnidad { get; set; } = string.Empty; 

        [Required]
        [Column(TypeName = "decimal(18, 2)")]
        public decimal CantidadEquivalente { get; set; } 

        // Costos y Precios
        [Required]
        [Column(TypeName = "decimal(18, 4)")]
        public decimal CostoUnitarioMonedaBase { get; set; } 

        [Required]
        [Column(TypeName = "decimal(18, 4)")]
        public decimal PrecioMonedaBase { get; set; } 

        [Required]
        [Column(TypeName = "decimal(18, 4)")]
        public decimal CostoUnitarioMonedaExt { get; set; } 

        [Required]
        [Column(TypeName = "decimal(18, 4)")]
        public decimal PrecioMonedaExt { get; set; } 

        // Relación con Producto (Padre)
        [Required]
        public int CodigoProd { get; set; }
        
        // Propiedad de navegación a Producto (Se usa [JsonIgnore] para evitar el ciclo de serialización)
        [JsonIgnore] 
        public Producto? Producto { get; set; }
    }
}