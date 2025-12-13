using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Tyted.API.Models
{
    public class Producto
    {
        [Key]
        public int CodigoProd { get; set; }

        [Required]
        [StringLength(255)]
        public string Descripcion { get; set; } = string.Empty;

        [Required]
        [StringLength(50)]
        public string TipoArt { get; set; } = "Bien"; // Por defecto 'Bien' o 'Servicio'

        [Required]
        [Column(TypeName = "decimal(18, 2)")]
        public decimal StockActual { get; set; }

        // =========================================================
        // NUEVOS CAMPOS REQUERIDOS:
        // =========================================================

        [StringLength(50)]
        public string? CodigoBarras { get; set; } // Código de barras (opcional)

        // Nota: La fecha de vencimiento es generalmente por lote, no por el artículo maestro. 
        // Para simplificar, la pondremos aquí. En un sistema avanzado iría en la tabla Lote.
        public DateTime? FechaVencimiento { get; set; } 

        [Required]
        public DateTime FechaAdquisicion { get; set; } = DateTime.UtcNow; // Fecha de creación del registro del producto

        // =========================================================
        // RELACIONES:
        // =========================================================
        
        // Clave Foránea a Proveedor
        [Required]
        public int CodigoProv { get; set; }

        // Propiedad de navegación
        public Proveedor? Proveedor { get; set; }

        // Relación Uno a Muchos con Unidades de Venta
        public ICollection<ProductosUnidad> UnidadesDeVenta { get; set; } = new List<ProductosUnidad>();
    }
}