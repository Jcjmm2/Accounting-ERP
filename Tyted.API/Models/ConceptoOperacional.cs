// Tyted.API.Models/ConceptoOperacional.cs
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Tyted.API.Models
{
    /// <summary>
    /// Concepto de operación: puente entre la UI (selector del formulario fiscal)
    /// y el plan de cuentas de la empresa. Cuando el operador registra un gasto
    /// o una venta fiscal selecciona un concepto; el motor de asientos usa su
    /// CuentaContable para generar la partida doble sin que el usuario deba
    /// memorizar códigos contables. Catálogo POR EMPRESA (cada empresa tiene su
    /// propio plan de cuentas).
    /// </summary>
    public class ConceptoOperacional
    {
        [Key]
        public int Id { get; set; }

        /// <summary>Empresa a la que pertenece el concepto (aislamiento multiempresa).</summary>
        public int EmpresaId { get; set; } = 1;

        public Empresa? Empresa { get; set; }

        [Required, StringLength(150)]
        public string NombreConcepto { get; set; } = string.Empty; // Ej: "Uniformes"

        /// <summary>OPERACIÓN a la que aplica: COMPRA | VENTA | GASTO | ISLR | SISTEMA.</summary>
        [Required, StringLength(10)]
        public string TipoOperacion { get; set; } = "GASTO";

        /// <summary>Código de la cuenta del plan (ej. "5.1.1.1.14"); se valida contra el plan al contabilizar.</summary>
        [Required, StringLength(30)]
        public string CuentaContable { get; set; } = string.Empty;

        // ------------------------------------------------------------------
        // ATRIBUTOS FISCALES (ISLR — Decreto 1.808). Sólo se usan cuando
        // TipoOperacion == "ISLR"; en los demás tipos permanecen en NULL/false.
        // La CuentaContable del concepto ISLR es el PASIVO "ISLR retenido por
        // pagar" que el motor de asientos usa en el Haber.
        // ------------------------------------------------------------------

        /// <summary>Código de operación SENIAT de 3 dígitos (ej. "002", "055").</summary>
        [StringLength(3)]
        public string? CodigoSeniat { get; set; }

        /// <summary>Tipo de entidad del proveedor: PNR | PJND | PJD.</summary>
        [StringLength(4)]
        public string? TipoPersona { get; set; }

        /// <summary>Tarifa de retención del Decreto 1.808 en porcentaje (ej. 3 = 3%).</summary>
        [Column(TypeName = "decimal(18,4)")]
        public decimal? PorcentajeRetencion { get; set; }

        /// <summary>True si el concepto permite descontar el sustraendo (sólo PNR).</summary>
        public bool AplicaSustraendo { get; set; }

        /// <summary>
        /// Sustraendo en Bolívares (Bs.) precalculado con la Unidad Tributaria
        /// vigente. Se almacena congelado (auditable) y sólo se resta al IMPRIMIR
        /// el comprobante; el archivo XML de declaración lleva la base imponible
        /// entera y el portal aplica el sustraendo.
        /// </summary>
        [Column(TypeName = "decimal(18,4)")]
        public decimal? MontoSustraendoBs { get; set; }

        // ------------------------------------------------------------------
        // SUJECIÓN A ISLR EN GASTOS (modo híbrido). Sólo aplican cuando
        // TipoOperacion == "GASTO"; en los demás tipos se limpian. Marcan que
        // los gastos de este concepto suelen estar sujetos a retención de ISLR
        // y apuntan al concepto del catálogo ISLR que se SUGIERE preseleccionar
        // al emitir. La emisión SIEMPRE es explícita por documento (nunca
        // automática): la tarifa depende del tipo de persona del proveedor.
        // ------------------------------------------------------------------

        /// <summary>True si los gastos de este concepto suelen estar sujetos a retención de ISLR.</summary>
        public bool AplicaRetencionIslr { get; set; }

        /// <summary>Concepto ISLR del catálogo Decreto 1.808 sugerido (preselección al emitir).</summary>
        public int? ConceptoIslrSugeridoId { get; set; }

        [ForeignKey(nameof(ConceptoIslrSugeridoId))]
        public ConceptoOperacional? ConceptoSugeridoIslr { get; set; }
    }
}
