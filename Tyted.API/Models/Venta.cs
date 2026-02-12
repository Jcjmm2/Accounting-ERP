using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using Tyted.API.Helpers;

namespace Tyted.API.Models
{
    public class Venta
    {
        [Key]
        [Column("Id")] // <--- Esto resuelve el error "Invalid column name IdVenta"
        public int VentaId { get; set; }

        public DateTime FechaVenta { get; set; } = DateHelper.GetVenezuelaTime();

        [Required]
        public string TipoMoneda { get; set; } = "USD"; // Campo obligatorio en tu SQL

        [Column(TypeName = "decimal(18,4)")]
        public decimal TasaDeCambio { get; set; }

        [Column(TypeName = "decimal(18,4)")]
        public decimal SubtotalMonedaBase { get; set; }

        [Column(TypeName = "decimal(18,4)")]
        public decimal IvaMonedaBase { get; set; }

        [Column(TypeName = "decimal(18,4)")]
        public decimal TotalMonedaBase { get; set; }

        [Column(TypeName = "decimal(18,4)")]
        public decimal SubtotalMonedaExt { get; set; }

        [Column(TypeName = "decimal(18,4)")]
        public decimal IvaMonedaExt { get; set; }

        [Column(TypeName = "decimal(18,4)")]
        public decimal TotalMonedaExt { get; set; }

        public bool IsAnulada { get; set; } = false;

        [StringLength(20)]
        public string NumeroFactura { get; set; } = string.Empty;

        public int ClienteId { get; set; }
        // Campos adicionales que agregamos
        [ForeignKey("ClienteId")]
        public Cliente? Cliente { get; set; }
        public string? MetodoPago { get; set; }
        
        [StringLength(100)]
        public string? Usuario { get; set; }

        public virtual ICollection<VentaPago> Pagos { get; set; } = new List<VentaPago>();

        // Estos campos existen en SQL pero no los usamos en la lógica del service, 
        // los dejamos por compatibilidad
        public decimal? TasaDia { get; set; }
        public decimal? TotalUSD { get; set; }
        public decimal? TotalVES { get; set; }

        public ICollection<VentaDetalle> Detalles { get; set; } = new List<VentaDetalle>();

        // Dentro de Venta.cs
        public bool EsCredito { get; set; } = false;
        public DateTime? FechaVencimiento { get; set; } // Solo si es crédito
        public int? PedidoId { get; set; } // Para vincular la venta con un pedido previo
    }

}