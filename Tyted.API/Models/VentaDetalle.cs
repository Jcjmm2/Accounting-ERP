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

        // --- LÍNEA POR PRODUCTO (POS y venta fiscal con inventario) ---
        // Opcional: las líneas de venta fiscal por CONCEPTO de ingreso (módulo
        // fiscal, sin inventario) no traen producto ni unidad; el nombre
        // responde a DescripcionFiscal.
        [StringLength(100)]
        public string? CodigoProd { get; set; }

        public int? IdProductoUnidad { get; set; }

        // En SQL es nvarchar(MAX) según tu reporte (-1), permitimos nulos
        public string? NombreUnidad { get; set; }

        // --- LÍNEA POR CONCEPTO DE INGRESO (módulo fiscal, sin inventario) ---
        /// <summary>Concepto operacional (tipo VENTA) de la línea; su CuentaContable genera el Haber.</summary>
        public int? ConceptoOperacionalId { get; set; }

        [ForeignKey(nameof(ConceptoOperacionalId))]
        public ConceptoOperacional? ConceptoOperacional { get; set; }

        /// <summary>Descripción libre del renglón para el Libro de Ventas (ej: "Facturación mensual Internet").</summary>
        [StringLength(300)]
        public string? DescripcionFiscal { get; set; }

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