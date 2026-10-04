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

            // 4. Plan base de cuentas contables (estructura VEN-NIF)
            if (!context.CuentasContables.Any())
            {
                var empresa = context.Empresa.FirstOrDefault();
                var empresaId = empresa?.Id ?? 1;

                var cuentas = new List<CuentaContable>
                {
                    new() { EmpresaId = empresaId, CodigoCuenta = "1", NombreCuenta = "ACTIVO", TipoCuenta = "Activo", Naturaleza = "D", EsMovimiento = false, Nivel = 1, AceptaTerceros = false, AceptaCentroCosto = false, Activa = true },
                    new() { EmpresaId = empresaId, CodigoCuenta = "1.1", NombreCuenta = "CORRIENTE", TipoCuenta = "Activo", Naturaleza = "D", EsMovimiento = false, Nivel = 2, AceptaTerceros = false, AceptaCentroCosto = false, Activa = true },
                    new() { EmpresaId = empresaId, CodigoCuenta = "1.1.1", NombreCuenta = "CAJA", TipoCuenta = "Activo", Naturaleza = "D", EsMovimiento = false, Nivel = 3, AceptaTerceros = false, AceptaCentroCosto = false, Activa = true },
                    new() { EmpresaId = empresaId, CodigoCuenta = "1.1.1.1", NombreCuenta = "Cajas de operación", TipoCuenta = "Activo", Naturaleza = "D", EsMovimiento = true, Nivel = 4, AceptaTerceros = false, AceptaCentroCosto = false, Activa = true },
                    new() { EmpresaId = empresaId, CodigoCuenta = "1.1.1.1.01", NombreCuenta = "Caja General", TipoCuenta = "Activo", Naturaleza = "D", EsMovimiento = true, Nivel = 5, AceptaTerceros = true, AceptaCentroCosto = true, Activa = true },

                    new() { EmpresaId = empresaId, CodigoCuenta = "2", NombreCuenta = "PASIVO", TipoCuenta = "Pasivo", Naturaleza = "C", EsMovimiento = false, Nivel = 1, AceptaTerceros = false, AceptaCentroCosto = false, Activa = true },
                    new() { EmpresaId = empresaId, CodigoCuenta = "2.1", NombreCuenta = "CORRIENTE", TipoCuenta = "Pasivo", Naturaleza = "C", EsMovimiento = false, Nivel = 2, AceptaTerceros = false, AceptaCentroCosto = false, Activa = true },
                    new() { EmpresaId = empresaId, CodigoCuenta = "2.1.1", NombreCuenta = "CUENTAS POR PAGAR", TipoCuenta = "Pasivo", Naturaleza = "C", EsMovimiento = false, Nivel = 3, AceptaTerceros = false, AceptaCentroCosto = false, Activa = true },
                    new() { EmpresaId = empresaId, CodigoCuenta = "2.1.1.1", NombreCuenta = "Proveedores", TipoCuenta = "Pasivo", Naturaleza = "C", EsMovimiento = true, Nivel = 4, AceptaTerceros = true, AceptaCentroCosto = false, Activa = true },
                    new() { EmpresaId = empresaId, CodigoCuenta = "2.1.1.1.01", NombreCuenta = "Proveedores nacionales", TipoCuenta = "Pasivo", Naturaleza = "C", EsMovimiento = true, Nivel = 5, AceptaTerceros = true, AceptaCentroCosto = false, Activa = true },

                    new() { EmpresaId = empresaId, CodigoCuenta = "3", NombreCuenta = "PATRIMONIO", TipoCuenta = "Patrimonio", Naturaleza = "C", EsMovimiento = false, Nivel = 1, AceptaTerceros = false, AceptaCentroCosto = false, Activa = true },
                    new() { EmpresaId = empresaId, CodigoCuenta = "3.1", NombreCuenta = "CAPITAL", TipoCuenta = "Patrimonio", Naturaleza = "C", EsMovimiento = false, Nivel = 2, AceptaTerceros = false, AceptaCentroCosto = false, Activa = true },
                    new() { EmpresaId = empresaId, CodigoCuenta = "3.1.1", NombreCuenta = "Capital social", TipoCuenta = "Patrimonio", Naturaleza = "C", EsMovimiento = true, Nivel = 3, AceptaTerceros = false, AceptaCentroCosto = false, Activa = true },

                    new() { EmpresaId = empresaId, CodigoCuenta = "4", NombreCuenta = "INGRESOS", TipoCuenta = "Ingreso", Naturaleza = "C", EsMovimiento = false, Nivel = 1, AceptaTerceros = false, AceptaCentroCosto = false, Activa = true },
                    new() { EmpresaId = empresaId, CodigoCuenta = "4.1", NombreCuenta = "INGRESOS OPERACIONALES", TipoCuenta = "Ingreso", Naturaleza = "C", EsMovimiento = false, Nivel = 2, AceptaTerceros = false, AceptaCentroCosto = false, Activa = true },
                    new() { EmpresaId = empresaId, CodigoCuenta = "4.1.1", NombreCuenta = "Servicios", TipoCuenta = "Ingreso", Naturaleza = "C", EsMovimiento = true, Nivel = 3, AceptaTerceros = true, AceptaCentroCosto = true, Activa = true },

                    new() { EmpresaId = empresaId, CodigoCuenta = "5", NombreCuenta = "COSTOS Y GASTOS", TipoCuenta = "Gasto", Naturaleza = "D", EsMovimiento = false, Nivel = 1, AceptaTerceros = false, AceptaCentroCosto = false, Activa = true },
                    new() { EmpresaId = empresaId, CodigoCuenta = "5.1", NombreCuenta = "GASTOS", TipoCuenta = "Gasto", Naturaleza = "D", EsMovimiento = false, Nivel = 2, AceptaTerceros = false, AceptaCentroCosto = false, Activa = true },
                    new() { EmpresaId = empresaId, CodigoCuenta = "5.1.1", NombreCuenta = "Gastos operativos", TipoCuenta = "Gasto", Naturaleza = "D", EsMovimiento = true, Nivel = 3, AceptaTerceros = true, AceptaCentroCosto = true, Activa = true }
                };

                context.CuentasContables.AddRange(cuentas);
                context.SaveChanges();

                var mapa = context.CuentasContables
                    .Where(c => c.EmpresaId == empresaId)
                    .ToDictionary(c => c.CodigoCuenta, c => c);

                foreach (var cuenta in context.CuentasContables.Where(c => c.EmpresaId == empresaId).ToList())
                {
                    var codigoPadre = cuenta.CodigoCuenta.Contains('.')
                        ? cuenta.CodigoCuenta[..cuenta.CodigoCuenta.LastIndexOf('.')]
                        : null;

                    if (!string.IsNullOrWhiteSpace(codigoPadre) && mapa.ContainsKey(codigoPadre))
                    {
                        cuenta.PadreCuentaId = mapa[codigoPadre].Id;
                    }
                }

                context.SaveChanges();
            }

            // 5. Usuario Admin predefinido (solo para desarrollo)
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