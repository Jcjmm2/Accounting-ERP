using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;

namespace Tyted.API.Models
{
    public class Proveedor
    {
        [Key]
        public int CodigoProv { get; set; }

        [Required(ErrorMessage = "La razón social es obligatoria")]
        public string? Razonsocial { get; set; }

        public string? Contacto { get; set; }

        [Required]
        public string? RIF { get; set; }

        public string? PersonaISLR { get; set; }

        public string? Telefono { get; set; }

        public string? Direccion { get; set; }

        [EmailAddress(ErrorMessage = "Formato de email inválido")]
        public string? Email { get; set; }

        public string? Cuentaasociadaconta { get; set; }

        // --- NAVEGACIÓN ---
        // Relación con compras y productos para facilitar consultas
        public virtual ICollection<Compra>? Compras { get; set; }
        //public virtual ICollection<Producto>? Productos { get; set; }
    }
}