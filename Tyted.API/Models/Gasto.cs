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

        /// <summary>Proveedor opcional (si se paga/compra a un terceo registrado).</summary>
        public int? CodigoProv { get; set; }

        [ForeignKey(nameof(CodigoProv))]
        public Proveedor? Proveedor { get; set; }

        /// <summary>Monto en moneda base (USD).</summary>
        public decimal Monto { get; set; }

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