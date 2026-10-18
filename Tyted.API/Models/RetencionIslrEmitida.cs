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

        /// <summary>Documento de origen (compra) si aplica. Exclusivo con GastoId.</summary>
        public int? CompraId { get; set; }

        [ForeignKey(nameof(CompraId))]
        public Compra? Compra { get; set; }

        /// <summary>
        /// Documento de origen (gasto fiscal) si aplica. Exclusivo con CompraId:
        /// una retención de ISLR se emite sobre UN solo documento de origen.
        /// </summary>
        public int? GastoId { get; set; }

        [ForeignKey(nameof(GastoId))]
        public Gasto? Gasto { get; set; }

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

        /// <summary>Concepto de retención del Decreto 1.808 usado (si se emitió desde un concepto).</summary>
        public int? ConceptoOperacionalId { get; set; }

        [ForeignKey(nameof(ConceptoOperacionalId))]
        public ConceptoOperacional? ConceptoOperacional { get; set; }

        /// <summary>Código de operación SENIAT congelado (ej. "002").</summary>
        [StringLength(3)]
        public string? CodigoConcepto { get; set; }

        /// <summary>
        /// Sustraendo en Bs. descontado al calcular el monto retenido (sólo PNR).
        /// Se congela aquí; el archivo XML lleva la base imponible entera y el
        /// portal del SENIAT aplica el sustraendo automáticamente.
        /// </summary>
        [Column(TypeName = "decimal(18,4)")]
        public decimal SustraendoBs { get; set; }

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

        // ------------------------------------------------------------------
        // CONTABILIZACIÓN (integración administrativo-contable): comprobante
        // de diario del retenido (Debe Proveedores | Haber ISLR retenido por
        // pagar) generado por el motor de asientos automáticos, idempotente.
        // ------------------------------------------------------------------

        /// <summary>Comprobante contable del retenido (idempotencia: no se duplica).</summary>
        public int? AsientoContableId { get; set; }

        /// <summary>Comprobante de REVERSO generado al anular la retención (auditoría contable).</summary>
        public int? AsientoReversoId { get; set; }

        // ------------------------------------------------------------------
        // ANULACIÓN (sólo con motivo y fecha: rastro auditable; nunca se
        // borran filas de retenciones emitidas).
        // ------------------------------------------------------------------

        /// <summary>Fecha/hora de anulación de la retención (null mientras esté Emitida).</summary>
        public DateTime? FechaAnulacion { get; set; }

        /// <summary>Motivo de la anulación registrado por el usuario.</summary>
        [StringLength(300)]
        public string? MotivoAnulacion { get; set; }
    }
}