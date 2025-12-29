using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Tyted.API.Models
{
    public class VentaDetalle
    {
        [Key]
        [Column("Id")] // Match con la columna 'Id' (Identity) en SQL
        public int IdDetalle { get; set; }

        [Required]
        public int VentaId { get; set; }

        [Required]
        [StringLength(100)] // Aumentado a 100 para coincidir exactamente con tu SQL
        public string CodigoProd { get; set; } = string.Empty;

        [Required]
        public int IdProductoUnidad { get; set; }

        // En SQL es nvarchar(MAX) según tu reporte (-1), permitimos nulos
        public string? NombreUnidad { get; set; }

        [Column(TypeName = "decimal(18, 4)")]
        public decimal Cantidad { get; set; }

        [Column(TypeName = "decimal(18, 4)")] // Cambiado a 4 para coincidir con el Prec 18 Scale 4 de tu SQL
        public decimal TasaIVA { get; set; }

        [Column(TypeName = "decimal(18, 4)")]
        public decimal PrecioUnitarioMonedaBase { get; set; }

        [Column(TypeName = "decimal(18, 4)")]
        public decimal SubtotalLineaMonedaBase { get; set; }

        [Column(TypeName = "decimal(18, 4)")]
        public decimal TotalLineaMonedaBase { get; set; }

        [Column(TypeName = "decimal(18, 4)")]
        public decimal PrecioUnitarioMonedaExt { get; set; }

        [Column(TypeName = "decimal(18, 4)")]
        public decimal SubtotalLineaMonedaExt { get; set; }

        [Column(TypeName = "decimal(18, 4)")]
        public decimal IvaLineaMonedaExt { get; set; }

        [Column(TypeName = "decimal(18, 4)")]
        public decimal TotalLineaMonedaExt { get; set; }

        // RELACIONES
        [ForeignKey("VentaId")]
        public virtual Venta? Venta { get; set; }

        [ForeignKey("CodigoProd")]
        public virtual Producto? Producto { get; set; }

        // En VentaDetalle.cs, añade esto:
        [ForeignKey("IdProductoUnidad")]
        public virtual ProductosUnidad? ProductoUnidad { get; set; }
    }
}