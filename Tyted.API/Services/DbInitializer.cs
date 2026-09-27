using Tyted.API.Models;
using Tyted.API.Data;
using BCrypt.Net;

namespace Tyted.API.Services
{
    public static class DbInitializer
    {
        public static void Initialize(TytedContext context, bool seedDevelopmentDefaults = false)
        {
            context.Database.EnsureCreated();

            // 1. Tasas de IVA (Configuración Venezuela)
            if (!context.TasasIVA.Any())
            {
                context.TasasIVA.AddRange(
                    new TasaIVA { Nombre = "Exento", Porcentaje = 0m },
                    new TasaIVA { Nombre = "General (16%)", Porcentaje = 16m },
                    new TasaIVA { Nombre = "Reducida (8%)", Porcentaje = 8m }
                );
            }

            // 2. Unidades de Medida
            if (!context.UnidadesMedida.Any())
            {
                context.UnidadesMedida.AddRange(
                    new UnidadMedida { NombreUnidad = "UNIDAD" },
                    new UnidadMedida { NombreUnidad = "BULTO" },
                    new UnidadMedida { NombreUnidad = "KILO" }
                );
            }

            // 3. Empresa (Datos por defecto para el encabezado de reportes)
            if (!context.Empresa.Any())
            {
                context.Empresa.Add(new Empresa
                {
                    RazonSocial = "Inversiones Tyted, C.A.",
                    RIF = "J-12345678-9",
                    Direccion = "Ciudad Bolívar, Estado Bolívar",
                    TipoContribuyente = "Contribuyente Especial"
                });
            }

            // 4. Usuario Admin predefinido (solo para desarrollo)
            // To avoid committing secrets, the admin seed password must be provided
            // via the environment variable `ADMIN_SEED_PASSWORD` when `seedDevelopmentDefaults` is true.
            if (seedDevelopmentDefaults && !context.Usuarios.Any())
            {
                var adminPassword = Environment.GetEnvironmentVariable("ADMIN_SEED_PASSWORD");
                if (!string.IsNullOrWhiteSpace(adminPassword))
                {
                    context.Usuarios.Add(new Usuario
                    {
                        Username = "admin",
                        PasswordHash = BCrypt.Net.BCrypt.HashPassword(adminPassword),
                        NombreCompleto = "Administrador del Sistema",
                        Rol = "AdministradorSistema",
                        Activo = true
                    });
                }
                // If no ADMIN_SEED_PASSWORD is provided, do not create a default admin user.
            }

            context.SaveChanges();
        }
    }
}