using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Tyted.API.Models
{
    /// <summary>
    /// Comprobante de Retención de ISLR emitido (Impuesto Sobre la Renta). Sigue
    /// el mismo principio de INMUTABILIDAD FISCAL que la retención de IVA: el
    /// monto retenido se congela en Bolívares (Bs.) al momento de emitirse, a la
    /// tasa del documento origen. Es el valor legal para el SENIAT.
    /// </summary>
    public class RetencionIslrEmitida
    {
        [Key]
        public int Id { get; set; }

        /// <summary>Empresa (contribuyente) emisora de la retención.</summary>
        public int EmpresaId { get; set; } = 1;

        /// <summary>Documento de origen (compra) si aplica.</summary>
        public int? CompraId { get; set; }

        [ForeignKey(nameof(CompraId))]
        public Compra? Compra { get; set; }

        public DateTime FechaRetencion { get; set; }

        /// <summary>Número oficial SENIAT (correlativo por empresa y año).</summary>
        [Required, StringLength(20)]
        public string NumeroComprobante { get; set; } = string.Empty;

        [StringLength(20)]
        public string ProveedorRif { get; set; } = string.Empty;

        [StringLength(200)]
        public string ProveedorNombre { get; set; } = string.Empty;

        [StringLength(50)]
        public string NumeroFactura { get; set; } = string.Empty;

        [StringLength(50)]
        public string? NumeroControl { get; set; }

        /// <summary>Base imponible sujeta a retención, en Bolívares (Bs.) — valor legal.</summary>
        [Column(TypeName = "decimal(18,4)")]
        public decimal BaseImponibleBs { get; set; }

        /// <summary>Porcentaje de retención de ISLR aplicado (ej: 2, 3, 4, 6, 34...).</summary>
        [Column(TypeName = "decimal(6,4)")]
        public decimal PorcentajeRetencion { get; set; }

        /// <summary>Monto retenido en Bolívares (Bs.): BaseImponible × porcentaje. Valor legal SENIAT.</summary>
        [Column(TypeName = "decimal(18,4)")]
        public decimal MontoRetenidoBs { get; set; }

        /// <summary>Equivalente en USD (moneda base) al momento de emitir, sólo como referencia.</summary>
        [Column(TypeName = "decimal(18,4)")]
        public decimal MontoRetenidoUsd { get; set; }

        /// <summary>Tasa Bs./USD congelada al momento de emitir la retención.</summary>
        [Column(TypeName = "decimal(18,4)")]
        public decimal TasaDeCambio { get; set; } = 1m;

        /// <summary>Emitida | Anulada.</summary>
        [Required, StringLength(20)]
        public string Estado { get; set; } = "Emitida";
    }
}