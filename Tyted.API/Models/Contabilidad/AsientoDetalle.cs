using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Tyted.API.Models;

public class AsientoDetalle
{
    [Key]
    public int Id { get; set; }

    public int AsientoContableId { get; set; }

    [ForeignKey(nameof(AsientoContableId))]
    public AsientoContable? AsientoContable { get; set; }

    public int CuentaContableId { get; set; }

    [ForeignKey(nameof(CuentaContableId))]
    public CuentaContable? CuentaContable { get; set; }

    public decimal Debe { get; set; }

    public decimal Haber { get; set; }

    [StringLength(150)]
    public string Referencia { get; set; } = string.Empty;
}
