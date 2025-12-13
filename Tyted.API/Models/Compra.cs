// Tyted.API.Models/Compra.cs
using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using Tyted.API.Models;

public class Compra
{
    // Clave Primaria
    [Key]
    public int IdCompra { get; set; }

    // Datos del Documento
    [Required]
    public DateTime FechaDocumento { get; set; }
    
    [MaxLength(50)]
    public string? NumDocumento { get; set; } // Número de factura del proveedor
    
    [Required]
    [Column(TypeName = "decimal(18, 4)")] // Precisión para tasas de cambio
    public decimal TasaCambio { get; set; } // Tasa de cambio usada ese día (VES/USD)
    
    [MaxLength(50)]
    public string? TipoDoc { get; set; } // Ejemplo: Factura, Nota de Entrega, etc.

    // Relación con Proveedor (Foreign Key)
    [Required]
    public int CodigoProv { get; set; }
    public Proveedor? Proveedor { get; set; } // Propiedad de navegación

    // Totales (Usamos Moneda Base, suponiendo que es VES o la moneda local)
    [Column(TypeName = "decimal(18, 2)")]
    public decimal SubTotalMonedaBase { get; set; } // Sin impuestos
    
    [Column(TypeName = "decimal(18, 2)")]
    public decimal TotalImpuestoMonedaBase { get; set; } // Total IVA
    
    [Column(TypeName = "decimal(18, 2)")]
    public decimal TotalCompraMonedaBase { get; set; } // Incluye impuestos

    // Colección de Detalles (Relación uno-a-muchos)
    public ICollection<CompraDetalle> Detalles { get; set; } = new List<CompraDetalle>();
}