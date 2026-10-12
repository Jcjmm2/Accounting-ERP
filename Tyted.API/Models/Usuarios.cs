using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using System.Text.Json.Serialization; // Evita exponer el hash en las respuestas HTTP
using System.Collections.Generic; // Necesario para ICollection

namespace Tyted.API.Models
    {

    public class Usuario
    {
        [Key]
        public int Id { get; set; }
        [Required]
        public string Username { get; set; } = string.Empty;
        [JsonIgnore]
        public string PasswordHash { get; set; } = string.Empty;
        public string NombreCompleto { get; set; } = string.Empty;
        public string Rol { get; set; } = "AdministradorSistema";
        
        public bool Activo { get; set; } = true;

        // --- MULTI-EMPRESA (MULTI-TENANT) ---
        // Empresa que se carga por defecto al iniciar sesión (debe pertenecer
        // a EmpresasAsignadas). Nullable por compatibilidad con usuarios previos.
        public int? EmpresaPredeterminadaId { get; set; }

        // Empresas a las que el usuario tiene acceso (tabla intermedia).
        // El AdministradorSistema ignora esta lista y ve todas por rol.
        public ICollection<UsuarioEmpresa>? EmpresasAsignadas { get; set; }
    }
}