using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Tyted.API.Models;

public class AuditoriaContable
{
    [Key]
    public int Id { get; set; }

    public DateTime Fecha { get; set; } = DateTime.Now;

    [Required, StringLength(100)]
    public string Usuario { get; set; } = string.Empty;

    [Required, StringLength(100)]
    public string Accion { get; set; } = string.Empty;

    [StringLength(500)]
    public string Detalle { get; set; } = string.Empty;

    public int? AsientoContableId { get; set; }

    [ForeignKey(nameof(AsientoContableId))]
    public AsientoContable? AsientoContable { get; set; }
}
