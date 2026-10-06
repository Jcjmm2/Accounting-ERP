using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using System.Text.Json.Serialization;

namespace Tyted.API.Models;

public class PeriodoContable
{
    [Key]
    public int Id { get; set; }

    [Required]
    public int EmpresaId { get; set; } = 1;

    [Required]
    public int Anio { get; set; }

    // Null si es TipoPeriodo == "Anual", 1..12 si es "Mensual"
    public int? Mes { get; set; }

    [StringLength(100)]
    public string? Nombre { get; set; }

    [Required, StringLength(20)]
    public string TipoPeriodo { get; set; } = "Mensual"; // "Anual" o "Mensual"

    public int? PeriodoPadreId { get; set; }

    [ForeignKey(nameof(PeriodoPadreId))]
    [JsonIgnore]
    public PeriodoContable? PeriodoPadre { get; set; }

    [Required]
    public DateTime FechaInicio { get; set; }

    [Required]
    public DateTime FechaFin { get; set; }

    [Required, StringLength(20)]
    public string Estado { get; set; } = "Abierto";

    public bool Cerrado { get; set; }

    public DateTime? FechaCierre { get; set; }

    [StringLength(100)]
    public string? UsuarioCierre { get; set; }

    // Subperiodos hijos (Si es un periodo Anual)
    public ICollection<PeriodoContable> SubPeriodos { get; set; } = new List<PeriodoContable>();

    [JsonIgnore]
    public ICollection<AsientoContable> Asientos { get; set; } = new List<AsientoContable>();
}
