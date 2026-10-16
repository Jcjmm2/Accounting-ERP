using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Tyted.API.Models
{
    /// <summary>
    /// Gasto del módulo FISCAL: documento declarativo SIN inventario ni POS
    /// (Origen='Fiscal'). Ej: servicios, personal, alquiler. Se contabiliza con
    /// el motor de asientos (Debe Gastos 5.1.2 | Haber Caja o Proveedores).
    /// </summary>
    public class Gasto
    {
        [Key]
        public int Id { get; set; }

        public int EmpresaId { get; set; } = 1;

        public DateTime Fecha { get; set; }

        [Required, StringLength(300)]
        public string Concepto { get; set; } = string.Empty;

        /// <summary>Categoría libre (SERVICIO, PERSONAL, ALQUILER, OTROS...).</summary>
        [StringLength(100)]
        public string? Categoria { get; set; }

        /// <summary>
        /// Concepto operacional seleccionado en el formulario (puente con el
        /// plan de cuentas). Su CuentaContable define la cuenta del Debe al
        /// contabilizar. Opcional por compatibilidad con gastos antiguos.
        /// </summary>
        public int? ConceptoOperacionalId { get; set; }

        [ForeignKey(nameof(ConceptoOperacionalId))]
        public ConceptoOperacional? ConceptoOperacional { get; set; }

        /// <summary>Proveedor opcional (si se paga/compra a un terceo registrado).</summary>
        public int? CodigoProv { get; set; }

        [ForeignKey(nameof(CodigoProv))]
        public Proveedor? Proveedor { get; set; }

        /// <summary>Monto en moneda base (USD). Es el monto "congelado" de la factura.</summary>
        public decimal Monto { get; set; }

        // ------------------------------------------------------------------
        // DUALIDAD FISCAL (Inmutabilidad Fiscal): todo documento que genere
        // impuestos o retenciones guarda su equivalente exacto en Bolívares
        // (Bs.) al momento de su creación. El SENIAT audita el histórico, por
        // lo que estos montos NUNCA se recalculan con la tasa del día.
        // ------------------------------------------------------------------

        /// <summary>Tasa Bs./USD congelada al momento de crear el gasto.</summary>
        [Column(TypeName = "decimal(18,4)")]
        public decimal TasaDeCambio { get; set; } = 1m;

        /// <summary>Monto total en Bolívares (Bs.) congelado = Monto × TasaDeCambio.</summary>
        [Column(TypeName = "decimal(18,4)")]
        public decimal MontoMonedaExt { get; set; } // Bs.

        /// <summary>IVA del gasto en Bolívares (Bs.) si aplica. 0 cuando no hay IVA.</summary>
        [Column(TypeName = "decimal(18,4)")]
        public decimal IvaMonedaExt { get; set; } // Bs. (Si aplica)

        // ------------------------------------------------------------------
        // DATOS FISCALES DEL DOCUMENTO SOPORTE (Libro de Compras SENIAT):
        // N° de factura/boleta y N° de control. Obligatorios al registrar un
        // gasto nuevo; nullable SÓLO por compatibilidad con gastos antiguos.
        // ------------------------------------------------------------------

        /// <summary>N° de factura/boleta/recibo del gasto (columna «N° Factura» del Libro de Compras).</summary>
        [StringLength(50)]
        public string? NumeroFactura { get; set; }

        /// <summary>N° de control del documento (columna «N° Control» del Libro de Compras). «S/N» si no existe.</summary>
        [StringLength(50)]
        public string? NumeroControl { get; set; }

        /// <summary>Tipo de transacción SENIAT: 01-Registro, 02-Complemento, 03-Anulación.</summary>
        [StringLength(2)]
        public string TipoTransaccion { get; set; } = "01";

        [StringLength(20)]
        public string Origen { get; set; } = "Fiscal";

        /// <summary>Comprobante contable generado por el motor de asientos.</summary>
        public int? AsientoContableId { get; set; }

        public bool IsAnulada { get; set; } = false;

        [StringLength(100)]
        public string? Usuario { get; set; }
    }
}