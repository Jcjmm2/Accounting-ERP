using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

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

        // --- CLASIFICACIÓN FISCAL SENIAT ---
        // Porcentaje de retención de IVA que la empresa aplica como Agente de
        // Retención en sus compras. 0 = Contribuyente Ordinario (no retiene);
        // 75 = regla general (Providencia SNAT/2025/000054); 100 = Sujeto
        // Pasivo Especial con omisión de deberes formales del proveedor.
        [Column(TypeName = "decimal(18,4)")]
        public decimal TasaRetencionIvaDefecto { get; set; } = 0m;

        // Opcional: Para el pie de página de facturas
        public string? LeyendaFactura { get; set; }
    }
}