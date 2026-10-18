// Tyted.API.Models/ResumenVentaFiscal.cs
using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Tyted.API.Models
{
    /// <summary>
    /// Resumen de ventas de la máquina fiscal (Libro de Ventas SENIAT): un
    /// documento declarativo por Z del día con el N° de control de la máquina,
    /// el N° Z y el rango de facturas del resumen (ej: 00000940-00000952).
    /// NO tiene líneas de producto: se registran los montos totales del resumen
    /// (exento, base gravada, IVA y total) en Bs., y el desglose POR ALÍCUOTA
    /// del cierre (8%, 16%, 31%) vive en Detalles (los totales se derivan de
    /// esas líneas). Cada resumen se contabiliza con UN asiento de diario
    /// (Debe Caja | Haber Ingresos + IVA Débito Fiscal).
    /// </summary>
    public class ResumenVentaFiscal
    {
        [Key]
        public int Id { get; set; }

        /// <summary>Empresa a la que pertenece el resumen (selector global empresaActiva).</summary>
        public int EmpresaId { get; set; } = 1;

        /// <summary>Día del resumen (cierre Z de la máquina fiscal).</summary>
        public DateTime Fecha { get; set; }

        /// <summary>N° de Control de la máquina fiscal/emisor (ej. Z1F0006326).</summary>
        [Required, StringLength(30)]
        public string NumeroControlMaquina { get; set; } = string.Empty;

        /// <summary>N° de cierre Z (ej. 0163).</summary>
        [Required, StringLength(10)]
        public string NumeroZ { get; set; } = string.Empty;

        /// <summary>Primera factura del rango del resumen (ej. 00000940).</summary>
        [Required, StringLength(20)]
        public string FacturaDesde { get; set; } = string.Empty;

        /// <summary>Última factura del rango del resumen (ej. 00000952).</summary>
        [Required, StringLength(20)]
        public string FacturaHasta { get; set; } = string.Empty;

        // --- Montos del resumen en BOLÍVARES (Bs.), capturados así en el
        // formulario fiscal ("Expresado en Bs.") y usados tal cual por el
        // motor de asientos (moneda legal del libro contable). ---
        [Column(TypeName = "decimal(18, 4)")]
        public decimal Exento { get; set; }

        [Column(TypeName = "decimal(18, 4)")]
        public decimal BaseGravada { get; set; }

        [Column(TypeName = "decimal(18, 4)")]
        public decimal Iva { get; set; }

        [Column(TypeName = "decimal(18, 4)")]
        public decimal Total { get; set; }

        /// <summary>Tipo de transacción SENIAT: 01-Registro, 02-Complemento, 03-Anulación.</summary>
        [StringLength(2)]
        public string TipoTransaccion { get; set; } = "01";

        [StringLength(20)]
        public string Origen { get; set; } = "Fiscal";

        /// <summary>Comprobante contable generado por el motor de asientos (1 asiento por resumen).</summary>
        public int? AsientoContableId { get; set; }

        public bool IsAnulada { get; set; } = false;

        [StringLength(100)]
        public string? Usuario { get; set; }

        /// <summary>
        /// Desglose por alícuota del cierre Z (una línea por cada tasa del
        /// resumen: 8%, 16% o 31%, con su base en Bs. exactos). Opcional: los
        /// resúmenes antiguos quedan sólo con los totales planos de arriba.
        /// </summary>
        public ICollection<ResumenVentaFiscalDetalle> Detalles { get; set; } = new List<ResumenVentaFiscalDetalle>();
    }
}
