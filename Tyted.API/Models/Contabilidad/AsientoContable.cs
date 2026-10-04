using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Tyted.API.Models;

public class AsientoContable
{
    [Key]
    public int Id { get; set; }

    [Required]
    public DateTime Fecha { get; set; } = DateTime.Today;

    [Required, StringLength(250)]
    public string Descripcion { get; set; } = string.Empty;

    [StringLength(50)]
    public string Estado { get; set; } = "Borrador";

    public int EmpresaId { get; set; } = 1;

    public int PeriodoContableId { get; set; }

    [ForeignKey(nameof(PeriodoContableId))]
    public PeriodoContable? PeriodoContable { get; set; }

    public decimal TotalDebe { get; set; }

    public decimal TotalHaber { get; set; }

    public ICollection<AsientoDetalle> Detalles { get; set; } = new List<AsientoDetalle>();
}
