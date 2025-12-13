// Tyted.API.Models/CompraDetalle.cs
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using Tyted.API.Models;

public class CompraDetalle
{
    // Clave Primaria Compuesta (Recomendado para detalles si no usas un ID autoincremental)
    // Pero por simplicidad en EF, usaremos un ID simple por ahora.
    [Key]
    public int IdCompraDetalle { get; set; }

    // Relación con la Compra (Foreign Key)
    [Required]
    public int IdCompra { get; set; }
    public Compra? Compra { get; set; } // Propiedad de navegación (Maestro)

    // Relación con el Producto o la Unidad de Venta (Foreign Key)
    [Required]
    public int CodigoProd { get; set; } 
    public Producto? Producto { get; set; } // Propiedad de navegación al Producto Maestro
    
    // Opcional: Si necesitas rastrear la unidad específica comprada (Caja, Paquete, etc.)
    [Required]
    public int IdProductoUnidad { get; set; } // La unidad de venta/compra en ProductosUnidad
    public ProductosUnidad? ProductoUnidad { get; set; } 

    // Cantidades y Precios
    [Required]
    [Column(TypeName = "decimal(18, 2)")]
    public decimal CantidadComprada { get; set; } 
    
    [Required]
    [Column(TypeName = "decimal(18, 4)")]
    public decimal CostoUnitarioMonedaBase { get; set; } 
    
    [Required]
    [Column(TypeName = "decimal(18, 4)")]
    public decimal CostoUnitarioMonedaExt { get; set; } 
    
    [Required]
    [Column(TypeName = "decimal(18, 2)")]
    public decimal TotalLineaMonedaBase { get; set; } 
}