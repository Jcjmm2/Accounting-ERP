using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Tyted.API.Models;

public class PeriodoContable
{
    [Key]
    public int Id { get; set; }

    [Required]
    public int EmpresaId { get; set; } = 1;

    [Required]
    public int Anio { get; set; }

    [Required]
    public int Mes { get; set; }

    [Required]
    public DateTime FechaInicio { get; set; }

    [Required]
    public DateTime FechaFin { get; set; }

    public bool Cerrado { get; set; }

    public ICollection<AsientoContable> Asientos { get; set; } = new List<AsientoContable>();
}
