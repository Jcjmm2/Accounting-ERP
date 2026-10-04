using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Tyted.API.Models;

public class AsientoDetalle
{
    [Key]
    public int Id { get; set; }

    [Required]
    public int AsientoContableId { get; set; }

    [ForeignKey(nameof(AsientoContableId))]
    public AsientoContable? AsientoContable { get; set; }

    [Required]
    public int CuentaContableId { get; set; }

    [ForeignKey(nameof(CuentaContableId))]
    public CuentaContable? CuentaContable { get; set; }

    [StringLength(100)]
    public string Referencia { get; set; } = string.Empty;

    public decimal Debe { get; set; }

    public decimal Haber { get; set; }
}
