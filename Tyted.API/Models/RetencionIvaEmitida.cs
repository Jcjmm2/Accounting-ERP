using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Tyted.API.Models
{
    /// <summary>
    /// Comprobante de Retención de IVA emitido al proveedor (Retenciones IVA
    /// Emitidas / Libro de Compras, plan BE-TAX-201). El número de comprobante
    /// sigue la especificación SENIAT AAAAMM + 8 dígitos correlativos
    /// (ej: 20261000000804), con secuencia por empresa (contribuyente).
    /// </summary>
    public class RetencionIvaEmitida
    {
        [Key]
        public int Id { get; set; }

        /// <summary>Empresa (contribuyente) emisora de la retención.</summary>
        public int EmpresaId { get; set; } = 1;

        /// <summary>Factura de compra a la que se aplica la retención.</summary>
        public int? CompraId { get; set; }

        [ForeignKey(nameof(CompraId))]
        public Compra? Compra { get; set; }

        public DateTime FechaRetencion { get; set; }

        /// <summary>Número oficial SENIAT: AAAAMM + 8 dígitos (20261000000804).</summary>
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

        /// <summary>Total de la factura (moneda base).</summary>
        public decimal MontoFactura { get; set; }

        /// <summary>Base imponible gravada de la factura (moneda base).</summary>
        public decimal BaseImponible { get; set; }

        /// <summary>IVA de la factura (moneda base) sobre el que se retiene.</summary>
        public decimal IvaCalculado { get; set; }

        /// <summary>Porcentaje de retención aplicado: 75 o 100.</summary>
        public int PorcentajeRetencion { get; set; } = 75;

        /// <summary>Monto retenido al proveedor = IVA × porcentaje.</summary>
        public decimal MontoRetenido { get; set; }

        // --- INTEGRACIÓN CONTABLE (retención de IVA) ---
        /// <summary>
        /// Comprobante contable asociado a la retención: en compras de CONTADO
        /// se genera al EMITIR (Debe Caja | Haber IVA Retenido por Entregar) y
        /// en compras a CRÉDITO al registrar el PAGO (parte Haber del asiento
        /// de pago). Null = retención aún sin asiento.
        /// </summary>
        public int? AsientoContableId { get; set; }

        // ------------------------------------------------------------------
        // DUALIDAD FISCAL (Inmutabilidad Fiscal): equivalente exacto en
        // Bolívares (Bs.) congelado al momento de emitir la retención, a la
        // tasa de la factura original (Compras.TasaDeCambio). Es el valor
        // legal para el SENIAT y NO se recalcula con la tasa del día.
        // ------------------------------------------------------------------

        /// <summary>Total de la factura en Bolívares (Bs.), congelado de Compra.TotalMonedaExt.</summary>
        [Column(TypeName = "decimal(18,4)")]
        public decimal MontoFacturaBs { get; set; }

        /// <summary>Base imponible gravada en Bolívares (Bs.), congelado de Compra.SubtotalMonedaExt.</summary>
        [Column(TypeName = "decimal(18,4)")]
        public decimal BaseImponibleBs { get; set; }

        /// <summary>IVA de la factura en Bolívares (Bs.), congelado de Compra.IvaMonedaExt.</summary>
        [Column(TypeName = "decimal(18,4)")]
        public decimal IvaCalculadoBs { get; set; }

        /// <summary>Monto retenido en Bolívares (Bs.): el valor legal para el SENIAT.</summary>
        [Column(TypeName = "decimal(18,4)")]
        public decimal MontoRetenidoBs { get; set; }

        /// <summary>Emitida | Anulada.</summary>
        [Required, StringLength(20)]
        public string Estado { get; set; } = "Emitida";
    }
}