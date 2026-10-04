using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Tyted.API.Models;

public class PeriodoContable
{
    [Key]
    public int Id { get; set; }

    [Required]
    public int Anio { get; set; }

    [Required]
    public int Mes { get; set; }

    [Required, StringLength(100)]
    public string Estado { get; set; } = "Abierto";

    public DateTime FechaInicio { get; set; }

    public DateTime FechaFin { get; set; }

    public bool Cerrado { get; set; }

    public int EmpresaId { get; set; } = 1;

    public ICollection<AsientoContable> Asientos { get; set; } = new List<AsientoContable>();
}
