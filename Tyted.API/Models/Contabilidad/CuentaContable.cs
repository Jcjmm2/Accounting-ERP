using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Tyted.API.Models;

public class CuentaContable
{
    [Key]
    public int Id { get; set; }

    [Required]
    public int EmpresaId { get; set; } = 1;

    [Required, StringLength(30)]
    public string CodigoCuenta { get; set; } = string.Empty;

    [Required, StringLength(150)]
    public string NombreCuenta { get; set; } = string.Empty;

    [Required, StringLength(20)]
    public string TipoCuenta { get; set; } = "Activo";

    [Required, StringLength(10)]
    public string Naturaleza { get; set; } = "D";

    public bool EsMovimiento { get; set; } = true;

    public int Nivel { get; set; }

    public int? PadreCuentaId { get; set; }

    [ForeignKey(nameof(PadreCuentaId))]
    public CuentaContable? Padre { get; set; }

    public ICollection<CuentaContable> Hijos { get; set; } = new List<CuentaContable>();

    public bool AceptaTerceros { get; set; }

    public bool AceptaCentroCosto { get; set; }

    public bool Activa { get; set; } = true;
}
