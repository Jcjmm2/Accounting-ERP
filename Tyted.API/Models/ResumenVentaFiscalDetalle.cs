using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Tyted.API.Models
{
    /// <summary>
    /// Detalle por alícuota de un Resumen de ventas de la máquina fiscal
    /// (cierre Z, Libro de Ventas SENIAT): una línea por cada tasa de IVA del
    /// cierre (8%, 16% o 31%), con la base gravada en Bolívares exactos. El
    /// IVA de la línea se recalcula en servidor (base × tasa, 2 decimales) y
    /// los totales planos del resumen se derivan de estas líneas, por lo que
    /// la partida doble (Debe Caja | Haber Ingresos + IVA) siempre cuadra.
    /// </summary>
    public class ResumenVentaFiscalDetalle
    {
        [Key]
        public int Id { get; set; }

        /// <summary>Resumen Z al que pertenece la línea.</summary>
        public int ResumenVentaFiscalId { get; set; }

        [ForeignKey(nameof(ResumenVentaFiscalId))]
        public ResumenVentaFiscal? Resumen { get; set; }

        /// <summary>Alícuota del IVA de la línea: 8, 16 o 31 (porcentaje).</summary>
        [Column(TypeName = "decimal(6, 4)")]
        public decimal TasaIVA { get; set; }

        /// <summary>Base gravada de la alícuota en Bolívares (Bs.) — verdad fiscal.</summary>
        [Column(TypeName = "decimal(18, 4)")]
        public decimal BaseBs { get; set; }

        /// <summary>IVA de la línea en Bs.: BaseBs × TasaIVA redondeado a 2 decimales (calculado en servidor).</summary>
        [Column(TypeName = "decimal(18, 4)")]
        public decimal IvaBs { get; set; }
    }
}
