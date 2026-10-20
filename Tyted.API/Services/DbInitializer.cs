using System.Data;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Storage;
using Tyted.API.Models;
using Tyted.API.Data;
using BCrypt.Net;

namespace Tyted.API.Services
{
    public static class DbInitializer
    {
        // -----------------------------------------------------------------------
        // PLAN A — APLICACIÓN DE MIGRACIONES (reemplaza a EnsureCreated)
        //
        // EnsureCreated() NO hace nada cuando la BD ya existe, por lo que las
        // migraciones pendientes (p. ej. AddOrigenYGastosFiscales que agrega las
        // columnas Origen a Ventas/Compras y la tabla Gastos) nunca se aplicaban
        // y EF fallaba con "Invalid column name 'Origen'".
        //
        // Además, las BDs legacy fueron creadas por EnsureCreated SIN la tabla
        // __EFMigrationsHistory; si Migrate() se llamara sin más, intentaría
        // ejecutar todas las migraciones desde cero y colisionaría con las
        // tablas existentes. Por eso se hace un BOOTSTRAP del historial: se
        // marcan como aplicadas las migraciones cuyo esquema ya existe en la BD
        // legacy y Migrate() aplica solo las realmente pendientes (y las futuras).
        // -----------------------------------------------------------------------

        /// <summary>
        /// Última migración reflejada en el esquema de la BD legacy (verificado
        /// en esta BD: existe RetencionesIvaEmitidas y faltaba la columna Origen).
        /// </summary>
        private const string UltimaMigracionLegacy = "20261010153407_AddRetencionesIva";

        /// <summary>Migración inmediatamente posterior al esquema legacy (Origen + Gastos).</summary>
        private const string MigracionOrigenYGastos = "20261010163913_AddOrigenYGastosFiscales";

        public static void Initialize(TytedContext context, bool seedDevelopmentDefaults = false)
        {
            AplicarMigraciones(context);
            SembrarDatosIniciales(context, seedDevelopmentDefaults);
        }

        /// <summary>
        /// SEMILLA IDEMPOTENTE DE LA BASE DE DATOS (ejecutada tras aplicar las
        /// migraciones). Crea el catálogo base, la EMPRESA MODELO «Inversiones
        /// Tyted, C.A.» con su plan de cuentas, su ejercicio fiscal abierto del
        /// año actual, los ajustes globales y (opcional) el admin inicial.
        /// Todos los pasos son idempotentes: reiniciar el servicio no duplica
        /// datos. Es lo que hace que una BD NUEVA en el servidor arranque lista
        /// para operar (v1 en Hetzner/Coolify). Expuesto como método público
        /// para poder probarlo sin ejecutar migraciones (tests con InMemory).
        /// </summary>
        public static void SembrarDatosIniciales(TytedContext context, bool seedDevelopmentDefaults = false)
        {

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

            // 4b. AJUSTES GLOBALES (idempotente). La clave EmpresaModeloId marca la
            //     empresa plantilla del sistema («Inversiones Tyted, C.A.», RIF de
            //     fábrica): se usa para asignarla por defecto a los usuarios nuevos
            //     (registro por API o UI) y viaja al servidor con la BD nueva.
            //     ModoImpresionFactura es el ajuste base de impresión de facturas
            //     (la UI de ajustes sólo permite ACTUALIZAR filas existentes, hay
            //     que sembrarlas).
            var empresaModelo = context.Empresa.FirstOrDefault(e => e.RIF == "J-12345678-9")
                ?? context.Empresa.OrderBy(e => e.Id).FirstOrDefault();
            if (empresaModelo != null && !context.EmpresaConfigs.Any(c => c.Clave == "EmpresaModeloId"))
            {
                context.EmpresaConfigs.Add(new EmpresaConfig
                {
                    Clave = "EmpresaModeloId",
                    Valor = empresaModelo.Id.ToString(),
                    Descripcion = "Empresa modelo/plantilla: se asigna por defecto a los usuarios nuevos."
                });
            }
            if (!context.EmpresaConfigs.Any(c => c.Clave == "ModoImpresionFactura"))
            {
                context.EmpresaConfigs.Add(new EmpresaConfig
                {
                    Clave = "ModoImpresionFactura",
                    Valor = "AMBAS",
                    Descripcion = "Modo de impresión de factura: AMBAS, SOLO_BASE (USD) o SOLO_EXT (Bs.)."
                });
            }
            context.SaveChanges();

            // 5. PERIODO FISCAL DE LA EMPRESA MODELO: ejercicio ABIERTO del año
            //    actual (la v1 arranca en 2026; el usuario creará los históricos
            //    que necesite desde la UI). Si la empresa modelo ya tiene periodos
            //    (p. ej. BD de desarrollo) no se toca nada.
            if (empresaModelo != null && !context.PeriodosContables.Any(p => p.EmpresaId == empresaModelo.Id))
            {
                var anioModelo = DateTime.Now.Year;
                context.PeriodosContables.Add(new PeriodoContable
                {
                    EmpresaId = empresaModelo.Id,
                    Anio = anioModelo,
                    TipoPeriodo = "Anual",
                    Nombre = $"Ejercicio Fiscal {anioModelo}",
                    FechaInicio = new DateTime(anioModelo, 1, 1),
                    FechaFin = new DateTime(anioModelo, 12, 31, 23, 59, 59),
                    Estado = "Abierto",
                    Cerrado = false
                });
                context.SaveChanges();
            }

            // 6. Usuario Admin inicial. En DESARROLLO: exige además el flag de
            // To avoid committing secrets, the admin seed password must be provided
            // via the environment variable `ADMIN_SEED_PASSWORD` when `seedDevelopmentDefaults` is true.
            var adminSeedPermitido = seedDevelopmentDefaults
                || !string.IsNullOrWhiteSpace(Environment.GetEnvironmentVariable("ADMIN_SEED_PASSWORD"));
            if (adminSeedPermitido && !context.Usuarios.Any())
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

            // 6. CONCEPTOS DE OPERACIÓN por empresa (puente UI ↔ plan de cuentas):
            //    gastos, ingresos y compras fiscales se contabilizan contra la
            //    cuenta asociada al concepto seleccionado (semilla idempotente).
            SembrarConceptosOperacionales(context);
            // Cuentas base de retenciones (ISLR/IVA) y pagos: sin ellas el
            // motor respondería «plan de cuentas incompleto».
            AsegurarCuentasRetenciones(context);

            context.SaveChanges();
        }

        // -------------------------------------------------------------------------
        // PLAN A: APLICACIÓN DE MIGRACIONES + BOOTSTRAP DEL HISTORIAL LEGACY
        // -------------------------------------------------------------------------
        private static void AplicarMigraciones(TytedContext context)
        {
            // Si la BD aún no existe, Migrate() la crea con el esquema completo y
            // su historial; no hay nada que sembrar.
            if (!context.Database.CanConnect())
            {
                context.Database.Migrate();
                return;
            }

            var migraciones = context.Database.GetMigrations().ToList();

            if (!ExisteTabla(context, "__EFMigrationsHistory"))
            {
                // BD legacy creada con EnsureCreated(): tiene tablas pero ningún
                // historial. Marcamos como aplicadas las migraciones reflejadas en
                // el esquema actual; Migrate() aplicará solo las pendientes reales.
                var hayTablas = Convert.ToInt32(EjecutarEscalar(context,
                    "SELECT COUNT(*) FROM sys.tables WHERE is_ms_shipped = 0")) > 0;

                if (hayTablas)
                {
                    var indice = migraciones.IndexOf(UltimaMigracionLegacy);
                    if (indice < 0)
                        throw new InvalidOperationException(
                            $"No se encontró la migración base del bootstrap '{UltimaMigracionLegacy}'.");

                    var aplicadas = migraciones.Take(indice + 1).ToList();

                    // Si la BD legacy YA tiene el esquema de la migración siguiente
                    // (aplicada manualmente), marcamos también esa.
                    if (migraciones.Contains(MigracionOrigenYGastos)
                        && ColumnaExiste(context, "Ventas", "Origen")
                        && ColumnaExiste(context, "Compras", "Origen")
                        && ExisteTabla(context, "Gastos"))
                    {
                        aplicadas.Add(MigracionOrigenYGastos);
                    }

                    CrearTablaHistorial(context);
                    InsertarMigracionesAplicadas(context, aplicadas);
                }
            }

            context.Database.Migrate();
        }

        /// <summary>Ejecuta un SELECT escalar (devuelve null si no hay resultado).</summary>
        private static object? EjecutarEscalar(TytedContext context, string sql)
        {
            var conexion = context.Database.GetDbConnection();
            var abiertaAqui = conexion.State != ConnectionState.Open;
            if (abiertaAqui) conexion.Open();
            try
            {
                using var comando = conexion.CreateCommand();
                var transaccion = context.Database.CurrentTransaction?.GetDbTransaction();
                if (transaccion != null) comando.Transaction = transaccion;
                comando.CommandText = sql;
                return comando.ExecuteScalar();
            }
            finally
            {
                if (abiertaAqui) conexion.Close();
            }
        }

        /// <summary>Ejecuta un lote de sentencias DDL/DML sin leer resultados.</summary>
        private static void EjecutarSentencia(TytedContext context, string sql)
        {
            var conexion = context.Database.GetDbConnection();
            var abiertaAqui = conexion.State != ConnectionState.Open;
            if (abiertaAqui) conexion.Open();
            try
            {
                using var comando = conexion.CreateCommand();
                var transaccion = context.Database.CurrentTransaction?.GetDbTransaction();
                if (transaccion != null) comando.Transaction = transaccion;
                comando.CommandText = sql;
                comando.ExecuteNonQuery();
            }
            finally
            {
                if (abiertaAqui) conexion.Close();
            }
        }

        private static bool ExisteTabla(TytedContext context, string nombre)
            => Convert.ToInt32(EjecutarEscalar(context,
                $"SELECT CASE WHEN OBJECT_ID(N'[dbo].[{nombre}]', N'U') IS NULL THEN 0 ELSE 1 END")) == 1;

        private static bool ColumnaExiste(TytedContext context, string tabla, string columna)
            => Convert.ToInt32(EjecutarEscalar(context,
                $"SELECT CASE WHEN COL_LENGTH(N'[dbo].[{tabla}]', N'{columna}') IS NULL THEN 0 ELSE 1 END")) == 1;

        /// <summary>Crea __EFMigrationsHistory con la forma exacta de EF Core (SQL Server).</summary>
        private static void CrearTablaHistorial(TytedContext context)
        {
            EjecutarSentencia(context, @"
IF OBJECT_ID(N'[dbo].[__EFMigrationsHistory]', N'U') IS NULL
BEGIN
    CREATE TABLE [dbo].[__EFMigrationsHistory] (
        [MigrationId] nvarchar(150) NOT NULL,
        [ProductVersion] nvarchar(32) NOT NULL,
        CONSTRAINT [PK___EFMigrationsHistory] PRIMARY KEY ([MigrationId])
    );
END");
        }

        private static void InsertarMigracionesAplicadas(TytedContext context, IEnumerable<string> migraciones)
        {
            foreach (var id in migraciones)
            {
                EjecutarSentencia(context, $@"
IF NOT EXISTS (SELECT 1 FROM [dbo].[__EFMigrationsHistory] WHERE [MigrationId] = N'{id}')
    INSERT INTO [dbo].[__EFMigrationsHistory] ([MigrationId], [ProductVersion]) VALUES (N'{id}', N'10.0.1');");
            }
        }

        // -------------------------------------------------------------------------
        // CUENTAS BASE DE RETENCIONES (idempotente por empresa)
        // -------------------------------------------------------------------------
        /// <summary>
        /// Crea en el plan de cada empresa, si faltan, las cuentas que usan los
        /// asientos de RETENCIONES y PAGOS: «Proveedores» (2.1.1.01, apuntada por
        /// el mapping PROVEEDORES), «ISLR retenido por pagar» (2.1.1.02),
        /// «Impuestos por pagar» (2.1.5) e «IVA Retenido por Entregar»
        /// (2.1.5.01, clave SISTEMA IVA_RETENCION). Sin ellas el motor responde
        /// «plan de cuentas incompleto» y las retenciones no se contabilizarían.
        /// </summary>
        private static void AsegurarCuentasRetenciones(TytedContext context)
        {
            var cuentasBase = new (string Codigo, string Nombre, int Nivel)[]
            {
                ("2.1.1.01", "Proveedores", 5),
                ("2.1.1.02", "ISLR retenido por pagar", 5),
                ("2.1.5", "Impuestos por pagar", 3),
                ("2.1.5.01", "IVA Retenido por Entregar (SENIAT)", 5)
            };

            foreach (var empresaId in context.Empresa.Select(e => e.Id).ToList())
            {
                var creadas = new List<CuentaContable>();
                foreach (var (codigo, nombre, nivel) in cuentasBase)
                {
                    var existe = context.CuentasContables.Any(c =>
                        c.EmpresaId == empresaId && c.CodigoCuenta == codigo);
                    if (existe) continue;

                    creadas.Add(new CuentaContable
                    {
                        EmpresaId = empresaId,
                        CodigoCuenta = codigo,
                        NombreCuenta = nombre,
                        TipoCuenta = "Pasivo",
                        Naturaleza = "C",
                        EsMovimiento = nivel >= 5,
                        Nivel = nivel,
                        Activa = true
                    });
                }

                if (creadas.Count == 0) continue;
                context.CuentasContables.AddRange(creadas);
                context.SaveChanges();

                // Vincula el padre directo (2.1.1 / 2.1.5) cuando exista en el
                // plan de la empresa (incluida la recién creada en este lote).
                var plan = context.CuentasContables
                    .Where(c => c.EmpresaId == empresaId)
                    .ToDictionary(c => c.CodigoCuenta, c => c);
                foreach (var cuenta in creadas)
                {
                    var codigoPadre = cuenta.CodigoCuenta[..cuenta.CodigoCuenta.LastIndexOf('.')];
                    if (plan.TryGetValue(codigoPadre, out var padre) && padre.Id != cuenta.Id)
                        cuenta.PadreCuentaId = padre.Id;
                }
                context.SaveChanges();
            }
        }

        // -------------------------------------------------------------------------
        // CONCEPTOS DE OPERACIÓN (semilla por empresa, idempotente)
        // -------------------------------------------------------------------------
        /// <summary>
        /// Catálogo base de conceptos por empresa (GASTO/VENTA/COMPRA) atado al
        /// plan VEN-NIF. Solo si la empresa aún no tiene conceptos. Si una cuenta
        /// no existe en el plan de la empresa, el motor contable responde con una
        /// advertencia (no bloquea el registro).
        /// </summary>
        private static void SembrarConceptosOperacionales(TytedContext context)
        {
            var semilla = new (string Nombre, string Tipo, string Cuenta)[]
            {
                // GASTOS (plan 5.1)
                ("Uniformes", "GASTO", "5.1.1.1.14"),
                ("Hospedaje", "GASTO", "5.1.1.1.19"),
                ("Servicios de terceros", "GASTO", "5.1.1.1.17"),
                ("Gas, luz, agua y aseo", "GASTO", "5.1.2.1.01"),
                ("Servicio de telefonía", "GASTO", "5.1.2.1.02"),
                ("Alquileres", "GASTO", "5.1.2.1.11"),
                // INGRESOS / VENTAS (plan 4.1.1.1)
                ("Servicios de Internet Satelital", "VENTA", "4.1.1.1.01"),
                ("Servicios de Internet Residencial", "VENTA", "4.1.1.1.02"),
                ("Venta de Equipos", "VENTA", "4.1.1.1.03"),
                // COMPRAS (catálogo listo para uso futuro)
                ("Compra de equipos Internet Satelital", "COMPRA", "5.1.1.1.16"),
                // ----------------------------------------------------------------
                // CUENTAS BASE (SISTEMA): contrapartidas fijas que el motor de
                // asientos usa en los 4 flujos (venta, resumen Z, compra, gasto).
                // Cada empresa puede reasignarlas desde 🧮 Conceptos → ⚙️ SISTEMA;
                // si no existen, el motor cae al mapping global (appsettings).
                ("CAJA_PRINCIPAL", "SISTEMA", "1.1.1.1.01"),
                ("CXC_CLIENTES", "SISTEMA", "1.1.3.01"),
                ("IVA_DEBITO", "SISTEMA", "1.1.5.01"),
                ("IVA_CREDITO", "SISTEMA", "1.1.5.02"),
                ("INGRESOS_VENTAS", "SISTEMA", "4.1.1"),
                ("COMPRAS", "SISTEMA", "5.1.1"),
                ("GASTOS", "SISTEMA", "5.1.2"),
                ("PROVEEDORES", "SISTEMA", "2.1.1.01"),
                // Retenciones (ISLR e IVA): pasivos que el motor usa en los
                // asientos de retención (ISLR al emitir) y de pago de facturas
                // (IVA retenido «al momento del pago»).
                ("IVA_RETENCION", "SISTEMA", "2.1.5.01")
            };

            var empresas = context.Empresa.Select(e => e.Id).ToList();
            foreach (var empresaId in empresas)
            {
                if (context.ConceptosOperacionales.Any(c => c.EmpresaId == empresaId))
                {
                    // Empresa ya configurada: sólo se completan las CUENTAS BASE
                    // (SISTEMA) que falten, para que el motor de asientos tenga
                    // sus contrapartidas mapeadas desde el panel de conceptos.
                    foreach (var (nombre, tipo, cuenta) in semilla.Where(s => s.Tipo == "SISTEMA"))
                    {
                        if (context.ConceptosOperacionales.Any(c =>
                            c.EmpresaId == empresaId
                            && c.TipoOperacion == tipo
                            && c.NombreConcepto == nombre))
                            continue;

                        context.ConceptosOperacionales.Add(new ConceptoOperacional
                        {
                            EmpresaId = empresaId,
                            NombreConcepto = nombre,
                            TipoOperacion = tipo,
                            CuentaContable = cuenta
                        });
                    }
                    continue;
                }

                foreach (var (nombre, tipo, cuenta) in semilla)
                {
                    context.ConceptosOperacionales.Add(new ConceptoOperacional
                    {
                        EmpresaId = empresaId,
                        NombreConcepto = nombre,
                        TipoOperacion = tipo,
                        CuentaContable = cuenta
                    });
                }
            }

            context.SaveChanges();
        }
    }
}