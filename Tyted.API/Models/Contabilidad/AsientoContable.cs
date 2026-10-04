using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Tyted.API.Models;

public class AsientoContable
{
    [Key]
    public int Id { get; set; }

    [Required]
    public int EmpresaId { get; set; } = 1;

    [Required]
    public int PeriodoContableId { get; set; }

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

    public decimal TotalDebe { get; set; }

    public decimal TotalHaber { get; set; }

    public ICollection<AsientoDetalle> Detalles { get; set; } = new List<AsientoDetalle>();
}
