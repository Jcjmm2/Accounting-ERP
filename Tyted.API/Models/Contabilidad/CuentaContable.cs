using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Tyted.API.Models;

public class CuentaContable
{
    [Key]
    public int Id { get; set; }

    [Required, StringLength(50)]
    public string Codigo { get; set; } = string.Empty;

    [Required, StringLength(200)]
    public string Nombre { get; set; } = string.Empty;

    [Required, StringLength(50)]
    public string Naturaleza { get; set; } = "Deudora";

    [Required, StringLength(50)]
    public string Tipo { get; set; } = "Activo";

    public int? PadreId { get; set; }

    [ForeignKey(nameof(PadreId))]
    public CuentaContable? Padre { get; set; }

    public ICollection<CuentaContable> Hijos { get; set; } = new List<CuentaContable>();

    public bool Activa { get; set; } = true;

    public int EmpresaId { get; set; } = 1;
}
