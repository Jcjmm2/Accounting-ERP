using System.ComponentModel.DataAnnotations;

namespace Tyted.API.Models
{
    public class Empresa
    {
        [Key]
        public int Id { get; set; }

        [Required, StringLength(200)]
        public string RazonSocial { get; set; } = string.Empty;

        [Required, StringLength(20)]
        public string RIF { get; set; } = string.Empty;

        [StringLength(500)]
        public string Direccion { get; set; } = string.Empty;

        [StringLength(100)]
        public string Telefono { get; set; } = string.Empty;

        [EmailAddress, StringLength(100)]
        public string Email { get; set; } = string.Empty;

        // Tipo de Contribuyente: "Ordinario", "Especial", "Formal"
        [Required, StringLength(50)]
        public string TipoContribuyente { get; set; } = "Ordinario";

        // Opcional: Para el pie de página de facturas
        public string? LeyendaFactura { get; set; }
    }
}