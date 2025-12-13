namespace Tyted.API.Models
{
    public class Proveedor
    {
        // La anotación [Key] indica a EF Core que este es el campo Primary Key
        [System.ComponentModel.DataAnnotations.Key]
        public int CodigoProv { get; set; } 
        
        // Mapeo directo a las columnas de tu tabla Proveedores
        public string? Razonsocial { get; set; }
        public string? Contacto { get; set; } // El '?' permite valores NULL
        public string? RIF { get; set; }
        public string? PersonaISLR { get; set; }
        public string? Telefono { get; set; }
        public string? Direccion { get; set; }
        public string? Email { get; set; } // El '?' permite valores NULL
        public string? Cuentaasociadaconta { get; set; }
    }
}