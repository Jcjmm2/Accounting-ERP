using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Tyted.API.Controllers;
using Tyted.API.Data;
using Tyted.API.Models;
using Tyted.API.Services;

namespace Tyted.Tests.Integracion.Postgres;

/// <summary>
/// Suite de INTEGRACIÓN de los flujos críticos contra PostgreSQL real
/// (Testcontainers, Fase 3 de la planificación de migración SQL Server → PG):
/// login → asiento manual → motor automático → cierre de resultados →
/// cerrar y trasladar → recalcular (reabrir y re-cerrar) → reportes.
/// Cada test crea su propia EMPRESA aislada (RIF único) sobre el contenedor
/// compartido, por lo que el orden de ejecución no importa y no hay datos
/// cruzados. Los unitarios de lógica pura siguen en InMemory.
/// </summary>
[Collection(PostgresCollection.Nombre)]
public class FlujosCriticosPostgresTests
{
    private readonly PostgresFixture _fixture;

    public FlujosCriticosPostgresTests(PostgresFixture fixture) => _fixture = fixture;

    /// <summary>Clave JWT de prueba (≥ 32 caracteres) para el login en memoria.</summary>
    private const string JwtKeyPruebas = "Tyted-IntegrationTest-JwtKey-0123456789-abcdefghijklmnop";

    // -------------------------------------------------------------------------
    // ESCENARIO AISLADO POR TEST (empresa única sobre el contenedor compartido)
    // -------------------------------------------------------------------------
    private sealed class Escenario
    {
        public Empresa Empresa { get; init; } = null!;
        public Usuario Usuario { get; init; } = null!;
        public Cliente Cliente { get; init; } = null!;
        public PeriodoContable Octubre { get; init; } = null!;
        public PeriodoContable Noviembre { get; init; } = null!;
        public CuentaContable Caja { get; init; } = null!;
        public CuentaContable CxC { get; init; } = null!;
        public CuentaContable IvaDebito { get; init; } = null!;
        public CuentaContable Capital { get; init; } = null!;
        public CuentaContable Ventas { get; init; } = null!;
        public CuentaContable Gastos { get; init; } = null!;
    }

    /// <summary>
    /// Empresa nueva con usuario (login), cliente (FK real de Venta — InMemory no
    /// la validaba, PostgreSQL sí), plan de cuentas mínimo que cubre el mapping
    /// global del motor (Caja/CxC/IVA Débito/Ingresos/Gastos) y los periodos
    /// Octubre + Noviembre 2026 (el cierre traslada a noviembre).
    /// </summary>
    private static async Task<Escenario> CrearEscenarioAsync(TytedContext context)
    {
        var sufijo = Guid.NewGuid().ToString("N")[..8].ToUpperInvariant();

        var empresa = new Empresa
        {
            RazonSocial = $"Empresa Prueba {sufijo}",
            RIF = $"J-{sufijo}-9",
            Direccion = "Ciudad Bolívar, Estado Bolívar",
            TipoContribuyente = "Ordinario"
        };
        var usuario = new Usuario
        {
            Username = $"admin.{sufijo.ToLowerInvariant()}",
            PasswordHash = BCrypt.Net.BCrypt.HashPassword("ClaveSegura123"),
            NombreCompleto = "Administrador de Prueba",
            Rol = "AdministradorSistema",
            Activo = true
        };
        var cliente = new Cliente
        {
            Rif = $"V{sufijo}01",
            Nombre = $"Cliente Prueba {sufijo}",
            PermitirCredito = true,
            LimiteCreditoUSD = 10000m
        };

        context.Empresa.Add(empresa);
        context.Usuarios.Add(usuario);
        context.Clientes.Add(cliente);
        await context.SaveChangesAsync();

        var octubre = new PeriodoContable
        {
            EmpresaId = empresa.Id,
            Anio = 2026,
            Mes = 10,
            TipoPeriodo = "Mensual",
            Nombre = "Octubre 2026",
            FechaInicio = new DateTime(2026, 10, 1),
            FechaFin = new DateTime(2026, 10, 31, 23, 59, 59),
            Estado = "Abierto",
            Cerrado = false
        };
        var noviembre = new PeriodoContable
        {
            EmpresaId = empresa.Id,
            Anio = 2026,
            Mes = 11,
            TipoPeriodo = "Mensual",
            Nombre = "Noviembre 2026",
            FechaInicio = new DateTime(2026, 11, 1),
            FechaFin = new DateTime(2026, 11, 30, 23, 59, 59),
            Estado = "Abierto",
            Cerrado = false
        };
        context.PeriodosContables.AddRange(octubre, noviembre);

        CuentaContable Nueva(string codigo, string nombre, string tipo, string naturaleza, int nivel) => new()
        {
            EmpresaId = empresa.Id,
            CodigoCuenta = codigo,
            NombreCuenta = nombre,
            TipoCuenta = tipo,
            Naturaleza = naturaleza,
            EsMovimiento = true,
            Nivel = nivel,
            Activa = true
        };

        var caja = Nueva("1.1.1.1.01", "Caja General", "Activo", "D", 5);
        var cxc = Nueva("1.1.3.01", "Cuentas por Cobrar", "Activo", "D", 5);
        var ivaDebito = Nueva("1.1.5.01", "IVA Débito Fiscal", "Activo", "D", 5);
        var capital = Nueva("3.1.1", "Capital social", "Patrimonio", "C", 3);
        var ventas = Nueva("4.1.1", "Ingresos por Ventas", "Ingreso", "C", 3);
        var gastos = Nueva("5.1.2", "Gastos", "Gasto", "D", 3);
        context.CuentasContables.AddRange(caja, cxc, ivaDebito, capital, ventas, gastos);
        await context.SaveChangesAsync();

        return new Escenario
        {
            Empresa = empresa,
            Usuario = usuario,
            Cliente = cliente,
            Octubre = octubre,
            Noviembre = noviembre,
            Caja = caja,
            CxC = cxc,
            IvaDebito = ivaDebito,
            Capital = capital,
            Ventas = ventas,
            Gastos = gastos
        };
    }

    private static AsientoContable NuevoAsiento(
        Escenario esc,
        DateTime fecha,
        string concepto,
        params (CuentaContable Cuenta, decimal Debe, decimal Haber)[] lineas) => new()
    {
        EmpresaId = esc.Empresa.Id,
        PeriodoContableId = esc.Octubre.Id,
        NumeroComprobante = string.Empty, // el servicio autogenera el consecutivo YYMM0000001
        FechaComprobante = fecha,
        Concepto = concepto,
        TipoComprobante = "Diario",
        Estado = "Aprobado",
        UsuarioId = esc.Usuario.Id,
        Detalles = lineas
            .Select(l => new AsientoDetalle { CuentaContableId = l.Cuenta.Id, Debe = l.Debe, Haber = l.Haber })
            .ToList()
    };

    private static IConfiguration CrearConfiguracion() => new ConfigurationBuilder()
        .AddInMemoryCollection(new Dictionary<string, string?> { ["Jwt:Key"] = JwtKeyPruebas })
        .Build();

    private static T? ObtenerPropiedad<T>(object? objeto, string nombre)
    {
        var prop = objeto?.GetType().GetProperty(nombre);
        var valor = prop?.GetValue(objeto);
        return valor is T t ? t : default;
    }

    // -------------------------------------------------------------------------
    // 1) MIGRACIÓN + SEMILLA contra el motor real
    // -------------------------------------------------------------------------
    [Fact]
    public async Task Semilla_YMigracion_CreanEsquemaYDatosBaseEnPostgres()
    {
        await using var context = _fixture.CrearContexto();

        // Sin migraciones pendientes y la inicial registrada en el historial.
        Assert.Empty(await context.Database.GetPendingMigrationsAsync());
        var aplicadas = await context.Database.GetAppliedMigrationsAsync();
        Assert.Contains(aplicadas, m => m.EndsWith("_InitialPostgres", StringComparison.Ordinal));

        // Semilla idempotente ejecutada por el fixture (empresa modelo, plan
        // base, ejercicio fiscal abierto, conceptos SISTEMA y ajustes globales).
        Assert.True(await context.Empresa.AnyAsync(e => e.RIF == "J-12345678-9"));
        Assert.True(await context.CuentasContables.CountAsync() >= 23);
        Assert.True(await context.PeriodosContables.AnyAsync(p =>
            p.TipoPeriodo == "Anual" && p.Anio == DateTime.Now.Year && !p.Cerrado));
        Assert.True(await context.ConceptosOperacionales.AnyAsync(c =>
            c.NombreConcepto == "CAJA_PRINCIPAL" && c.TipoOperacion == "SISTEMA"));
        Assert.True(await context.EmpresaConfigs.AnyAsync(c => c.Clave == "EmpresaModeloId"));
        Assert.True(await context.EmpresaConfigs.AnyAsync(c => c.Clave == "ModoImpresionFactura"));

        // Sin ADMIN_SEED_PASSWORD no se crea el admin por defecto…
        Assert.False(await context.Usuarios.AnyAsync(u => u.Username == "admin"));
    }

    // -------------------------------------------------------------------------
    // 2) LOGIN (BCrypt + JWT) contra la tabla Usuarios de PostgreSQL
    // -------------------------------------------------------------------------
    [Fact]
    public async Task Login_ContraPostgresReal_GeneraTokenJwt()
    {
        await using var context = _fixture.CrearContexto();
        var esc = await CrearEscenarioAsync(context);

        var controller = new UsuariosController(context, CrearConfiguracion(), new EmpresaAccessService(context));

        var ok = Assert.IsType<OkObjectResult>(await controller.Login(new LoginDto
        {
            Username = esc.Usuario.Username,
            Password = "ClaveSegura123"
        }));
        Assert.False(string.IsNullOrWhiteSpace(ObtenerPropiedad<string>(ok.Value, "token")));
        Assert.Equal(esc.Usuario.Username, ObtenerPropiedad<string>(ok.Value, "usuario"));
        Assert.Equal(esc.Usuario.Rol, ObtenerPropiedad<string>(ok.Value, "rol"));

        // Clave incorrecta → 401 (valida el hash BCrypt guardado en PG).
        var denegado = await controller.Login(new LoginDto
        {
            Username = esc.Usuario.Username,
            Password = "clave-mala"
        });
        Assert.IsType<UnauthorizedObjectResult>(denegado);
    }

    // -------------------------------------------------------------------------
    // 3) FECHAS NAIVE: el switch legacy + timestamp without time zone
    //    deben devolver EXACTAMENTE el mismo DateTime (sin desplazamiento UTC).
    // -------------------------------------------------------------------------
    [Fact]
    public async Task FechasNaive_SeGuardanYSeLeen_SinConversionUtcEnPostgres()
    {
        await using var context = _fixture.CrearContexto();
        var esc = await CrearEscenarioAsync(context);

        var fechaOriginal = new DateTime(2026, 10, 15, 14, 30, 45);
        var asiento = NuevoAsiento(esc, fechaOriginal, "Prueba de persistencia naive de fechas");
        // Inserto el asiento "a pelo" (sin servicio) para aislar la prueba de
        // fechas de cualquier otra validación de negocio.
        asiento.NumeroComprobante = "26100000099";
        context.AsientosContables.Add(asiento);
        await context.SaveChangesAsync();

        await using var contextoLectura = _fixture.CrearContexto();
        var leido = await contextoLectura.AsientosContables
            .AsNoTracking()
            .SingleAsync(a => a.Id == asiento.Id);

        Assert.Equal(fechaOriginal, leido.FechaComprobante);
        Assert.Equal(DateTimeKind.Unspecified, leido.FechaComprobante.Kind);
    }

    // -------------------------------------------------------------------------
    // 4) FLUJO CRÍTICO COMPLETO (la cadena entera contra PG real)
    // -------------------------------------------------------------------------
    [Fact]
    public async Task FlujoCritico_Login_Asiento_Motor_Cierre_Traslado_Recalcular_Y_Reportes_ContraPostgresReal()
    {
        await using var context = _fixture.CrearContexto();
        var esc = await CrearEscenarioAsync(context);

        // ============ 1) LOGIN ============
        var usuarios = new UsuariosController(context, CrearConfiguracion(), new EmpresaAccessService(context));
        var login = Assert.IsType<OkObjectResult>(await usuarios.Login(new LoginDto
        {
            Username = esc.Usuario.Username,
            Password = "ClaveSegura123"
        }));
        Assert.False(string.IsNullOrWhiteSpace(ObtenerPropiedad<string>(login.Value, "token")));

        // ============ 2) ASIENTOS MANUALES (partida doble + consecutivo) ============
        var asientos = new AsientoContableService(context);

        var aperturaCapital = await asientos.CrearAsientoAsync(NuevoAsiento(
            esc, new DateTime(2026, 10, 1), "Apertura de capital de trabajo",
            (esc.Caja, 5000m, 0m), (esc.Capital, 0m, 5000m)));
        Assert.Equal("26100000001", aperturaCapital.NumeroComprobante);
        Assert.Equal(5000m, aperturaCapital.TotalDebe);
        Assert.Equal(5000m, aperturaCapital.TotalHaber);

        var ventaManual = await asientos.CrearAsientoAsync(NuevoAsiento(
            esc, new DateTime(2026, 10, 7), "Venta de contado registrada manualmente",
            (esc.Caja, 1000m, 0m), (esc.Ventas, 0m, 1000m)));
        Assert.Equal("26100000002", ventaManual.NumeroComprobante);

        // ============ 3) MOTOR AUTOMÁTICO (venta a crédito → CxC + IVA) ============
        var motor = new MotorAsientosAutomaticos(context, asientos, new MappingContable());
        var venta = new Venta
        {
            EmpresaId = esc.Empresa.Id,
            FechaVenta = new DateTime(2026, 10, 7),
            NumeroFactura = "000-000123",
            TipoMoneda = "USD",
            TasaDeCambio = 1m,
            SubtotalMonedaBase = 100m,
            IvaMonedaBase = 16m,
            TotalMonedaBase = 116m,
            SubtotalMonedaExt = 100m,
            IvaMonedaExt = 16m,
            TotalMonedaExt = 116m,
            ClienteId = esc.Cliente.Id, // FK real exigida por PostgreSQL
            EsCredito = true
        };
        context.Ventas.Add(venta);
        await context.SaveChangesAsync();

        var rMotor = await motor.GenerarAsientoVentaAsync(venta, esc.Usuario.Id);
        Assert.True(rMotor.Generada);
        Assert.True(rMotor.AsientoId > 0);
        Assert.Equal(116m, rMotor.TotalDebe);
        Assert.Equal(116m, rMotor.TotalHaber);
        Assert.Equal(rMotor.AsientoId, venta.AsientoContableId); // FK de idempotencia

        // Gasto operativo manual para tener egresos en el cierre.
        await asientos.CrearAsientoAsync(NuevoAsiento(
            esc, new DateTime(2026, 10, 9), "Gasto de administración del mes",
            (esc.Gastos, 300m, 0m), (esc.Caja, 0m, 300m)));

        // ============ 4) CIERRE DE RESULTADOS ============
        var rCierre = await asientos.GenerarAsientoCierreResultadosAsync(
            esc.Octubre.Id, esc.Empresa.Id, esc.Usuario.Id, esc.Usuario.Username);
        Assert.True(rCierre.EsUtilidad);
        Assert.Equal(1100m, rCierre.TotalIngresos); // 1.000 manual + 100 del motor
        Assert.Equal(300m, rCierre.TotalEgresos);
        Assert.Equal(800m, rCierre.Resultado);
        Assert.Equal(3, rCierre.CantidadDetalles);  // Ventas + Gastos + Resultados
        Assert.True(rCierre.CuentaResultadosCreada);

        // ============ 5) CERRAR OCTUBRE CON TRASLADO A NOVIEMBRE ============
        var periodos = new PeriodoContableService(context, asientos);
        var rCierrePeriodo = await periodos.CerrarPeriodoAsync(
            esc.Octubre.Id, "tester", trasladarSaldos: true, esc.Usuario.Id);
        Assert.True(rCierrePeriodo.Cerrado);
        Assert.True(rCierrePeriodo.TrasladoGenerado);
        Assert.Equal("Noviembre 2026", rCierrePeriodo.PeriodoDestinoNombre);
        Assert.Equal(rCierrePeriodo.TotalDebe, rCierrePeriodo.TotalHaber); // traslado cuadrado
        Assert.True(rCierrePeriodo.TotalDebe > 0m);

        var octubreCerrado = await context.PeriodosContables.AsNoTracking()
            .SingleAsync(p => p.Id == esc.Octubre.Id);
        Assert.True(octubreCerrado.Cerrado);
        Assert.Equal("Cerrado", octubreCerrado.Estado);

        // ============ 6) RECALCULAR (reabrir para corrección y volver a cerrar) ============
        var rReabrir = await periodos.ReabrirParaCorreccionAsync(esc.Octubre.Id, "tester");
        Assert.True(rReabrir.TrasladoEliminado);

        var trasladosTrasReabrir = await context.AsientosContables.AsNoTracking()
            .CountAsync(a => a.PeriodoContableId == esc.Noviembre.Id && a.TipoComprobante == "Apertura");
        Assert.Equal(0, trasladosTrasReabrir);

        var octubreAbierto = await context.PeriodosContables.AsNoTracking()
            .SingleAsync(p => p.Id == esc.Octubre.Id);
        Assert.False(octubreAbierto.Cerrado);

        var rRecierre = await periodos.CerrarPeriodoAsync(
            esc.Octubre.Id, "tester", trasladarSaldos: true, esc.Usuario.Id);
        Assert.True(rRecierre.TrasladoGenerado);
        Assert.Equal(rCierrePeriodo.TotalDebe, rRecierre.TotalDebe); // recálculo reproducible

        var trasladosTrasRecierre = await context.AsientosContables.AsNoTracking()
            .CountAsync(a => a.PeriodoContableId == esc.Noviembre.Id && a.TipoComprobante == "Apertura");
        Assert.Equal(1, trasladosTrasRecierre); // sin duplicados

        // ============ 7) REPORTES ============
        var reportes = new ReportesContablesService(context);

        // Balance de noviembre: caja arranca con el saldo real al cierre de octubre.
        var balanceNoviembre = await reportes.GetBalanceComprobacionAsync(esc.Noviembre.Id, esc.Empresa.Id);
        var cajaBalance = Assert.Single(balanceNoviembre, b => b.CuentaId == esc.Caja.Id);
        Assert.Equal(5700m, cajaBalance.SaldoInicial); // 5.000 + 1.000 − 300
        Assert.Equal(5700m, cajaBalance.SaldoFinal);

        // Libro mayor de caja en octubre: 3 movimientos y saldo acumulado 5.700.
        var libroCajaOctubre = await reportes.GetLibroMayorAsync(
            esc.Caja.Id, new DateTime(2026, 10, 1), new DateTime(2026, 10, 31), esc.Empresa.Id);
        Assert.Equal(3, libroCajaOctubre.Count);
        Assert.Equal(5700m, libroCajaOctubre[^1].SaldoAcumulado);
    }
}

