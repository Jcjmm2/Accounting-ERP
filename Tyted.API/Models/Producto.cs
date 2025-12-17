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

        public decimal PorcentajeIVA => TasaIVA?.IdTasaIVA ?? 0;

        // ❌ CAMBIO 1: ELIMINAMOS LA PROPIEDAD SIMPLE DE IVA
        // public double TasaIVA { get; set; } = 0.16; // LÍNEA ELIMINADA/COMENTADA

        // =========================================================
        // ✅ CAMBIO 2: AGREGAR LAS NUEVAS RELACIONES
        // =========================================================

        // 1. Relación con Categoria (Define el margen de ganancia)
        [Required]
        public int IdCategoria { get; set; } // FK a la tabla Categoria
        // Propiedad de Navegación
        public Categoria? Categoria { get; set; } 

        // 2. Relación con TasaIVA (Define el porcentaje de impuesto)
        [Required]
        public int IdTasaIVA { get; set; } // FK a la tabla TasaIVA
        // Propiedad de Navegación
        public TasaIVA? TasaIVA { get; set; } 

        // =========================================================
        // CAMPOS EXISTENTES:
        // =========================================================

        [StringLength(50)]
        public string? CodigoBarras { get; set; } // Código de barras (opcional)

        // Nota: La fecha de vencimiento es generalmente por lote, no por el artículo maestro. 
        public DateTime? FechaVencimiento { get; set; } 

        [Required]
        public DateTime FechaAdquisicion { get; set; } = DateTime.UtcNow; // Fecha de creación del registro del producto

        // =========================================================
        // RELACIONES EXISTENTES:
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