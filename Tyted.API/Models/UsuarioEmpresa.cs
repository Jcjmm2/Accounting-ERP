using System.ComponentModel.DataAnnotations;

namespace Tyted.API.Models
{
    /// <summary>
    /// Tabla intermedia Muchos-a-Muchos (Multi-Tenant): un usuario puede tener
    /// acceso a muchas empresas y una empresa puede tener muchos usuarios.
    /// El AdministradorSistema ve todas las empresas DINÁMICAMENTE por rol (no
    /// depende de estas filas); para el resto de roles, estas filas definen el
    /// aislamiento por empresa.
    /// </summary>
    public class UsuarioEmpresa
    {
        [Key]
        public int UsuarioId { get; set; }
        public Usuario? Usuario { get; set; }

        [Key]
        public int EmpresaId { get; set; }
        public Empresa? Empresa { get; set; }
    }
}