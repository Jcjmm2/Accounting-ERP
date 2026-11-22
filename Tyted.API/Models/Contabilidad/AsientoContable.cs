using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Tyted.API.Models;

/// <summary>
/// Identifica el proceso que originó el comprobante. El concepto queda para
/// presentación; la titularidad y las reglas de edición usan estos valores.
/// </summary>
public static class OrigenGeneracionAsiento
{
    public const string Manual = "Manual";
    public const string MotorFiscal = "MotorFiscal";
    public const string CierreResultados = "CierreResultados";
    public const string TrasladoApertura = "TrasladoApertura";
}

public class AsientoContable
{
    [Key]
    public int Id { get; set; }

    [Required]
    public int EmpresaId { get; set; } = 1;

    [Required]
    public int PeriodoContableId { get; set; }

    /// <summary>Periodo cuyo cierre generó este comprobante, si aplica.</summary>
    public int? PeriodoOrigenId { get; set; }

    [Required, StringLength(30)]
    public string OrigenGeneracion { get; set; } = OrigenGeneracionAsiento.Manual;

    [Required, StringLength(20)]
    public string NumeroComprobante { get; set; } = string.Empty;

    [Required]
    public DateTime FechaComprobante { get; set; } = DateTime.Today;

    [Required, StringLength(500)]
    public string Concepto { get; set; } = string.Empty;

    [Required, StringLength(10)]
    public string TipoComprobante { get; set; } = "Diario";

    [Required, StringLength(15)]
    public string Estado { get; set; } = "Aprobado";

    [Required]
    public int UsuarioId { get; set; }

    public DateTime FechaCreacion { get; set; } = DateTime.Now;

    [ForeignKey(nameof(PeriodoContableId))]
    public PeriodoContable? PeriodoContable { get; set; }

    [ForeignKey(nameof(PeriodoOrigenId))]
    public PeriodoContable? PeriodoOrigen { get; set; }

    public decimal TotalDebe { get; set; }

    public decimal TotalHaber { get; set; }

    /// <summary>Respaldo JSON de los detalles generados originalmente por el motor automático.</summary>
    public string? SnapshotOriginalJson { get; set; }

    /// <summary>Indica si un asiento automático fue editado manualmente por un usuario.</summary>
    public bool FueModificadoManualmente { get; set; } = false;

    public DateTime? FechaUltimaModificacion { get; set; }

    [MaxLength(100)]
    public string? UsuarioModificacion { get; set; }

    public ICollection<AsientoDetalle> Detalles { get; set; } = new List<AsientoDetalle>();
}
