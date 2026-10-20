using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using System.Security.Claims;
using Tyted.API.Controllers;
using Tyted.API.Data;
using Tyted.API.Services;

namespace Tyted.Tests.Usuarios;

/// <summary>
/// Tests del registro de usuarios con EMPRESA MODELO por defecto y de la
/// semilla idempotente de la base de datos (empresa modelo «Inversiones Tyted,
/// C.A.», ajuste EmpresaModeloId, ajuste ModoImpresionFactura, ejercicio
/// fiscal abierto del año actual y admin inicial vía ADMIN_SEED_PASSWORD).
/// </summary>
public class RegistroUsuarioDefaultsTests
{
    private static TytedContext CrearContexto()
    {
        var options = new DbContextOptionsBuilder<TytedContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;
        return new TytedContext(options);
    }

    private static UsuariosController CrearController(TytedContext context)
    {
        var config = new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?>())
            .Build();
        return new UsuariosController(context, config, new EmpresaAccessService(context))
        {
            ControllerContext = new ControllerContext
            {
                // HttpContext sin autenticación (como el registro bootstrap sin usuarios)
                HttpContext = new DefaultHttpContext { User = new ClaimsPrincipal(new ClaimsIdentity()) }
            }
        };
    }

    [Fact]
    public async Task Registrar_SinEmpresas_AsignaLaEmpresaModeloPorDefecto()
    {
        await using var context = CrearContexto();
        // Semilla: crea la empresa Tyted, el ajuste EmpresaModeloId, etc.
        DbInitializer.SembrarDatosIniciales(context);

        var controller = CrearController(context);
        var result = await controller.Registrar(new RegistroUsuarioDto
        {
            Username = "vendedor1",
            Password = "ClaveSegura123",
            NombreCompleto = "Vendedor de Prueba",
            Rol = "Cajero",
            Activo = true
            // Sin empresasPermitidas ni predeterminada: debe caer a la modelo
        });

        Assert.IsType<OkObjectResult>(result);

        var modeloId = await context.EmpresaConfigs
            .Where(c => c.Clave == "EmpresaModeloId")
            .Select(c => int.Parse(c.Valor))
            .SingleAsync();

        var usuario = await context.Usuarios.SingleAsync(u => u.Username == "vendedor1");
        Assert.Equal(modeloId, usuario.EmpresaPredeterminadaId);

        var asignada = await context.UsuariosEmpresas.SingleAsync(ue => ue.UsuarioId == usuario.Id);
        Assert.Equal(modeloId, asignada.EmpresaId);
    }

    [Fact]
    public async Task Registrar_ConPredeterminadaFueraDePermitidas_SeRechaza()
    {
        await using var context = CrearContexto();
        DbInitializer.SembrarDatosIniciales(context);
        var empresaId = await context.Empresa.Select(e => e.Id).FirstAsync();

        var controller = CrearController(context);
        var result = await controller.Registrar(new RegistroUsuarioDto
        {
            Username = "otro",
            Password = "ClaveSegura123",
            NombreCompleto = "Otro Usuario",
            Rol = "Cajero",
            Activo = true,
            EmpresasPermitidas = new List<int> { empresaId },
            EmpresaPredeterminadaId = 999 // fuera de las permitidas
        });

        Assert.IsType<BadRequestObjectResult>(result);
        Assert.False(await context.Usuarios.AnyAsync(u => u.Username == "otro"));
    }

    [Fact]
    public async Task Registrar_ConEmpresasExplicitas_YSinPredeterminada_UsaLaPrimera()
    {
        await using var context = CrearContexto();
        DbInitializer.SembrarDatosIniciales(context);
        var empresaId = await context.Empresa.Select(e => e.Id).FirstAsync();

        var controller = CrearController(context);
        var result = await controller.Registrar(new RegistroUsuarioDto
        {
            Username = "analista1",
            Password = "ClaveSegura123",
            NombreCompleto = "Analista de Prueba",
            Rol = "Analista",
            Activo = true,
            EmpresasPermitidas = new List<int> { empresaId }
            // Sin predeterminada: se usa la primera asignada
        });

        Assert.IsType<OkObjectResult>(result);
        var usuario = await context.Usuarios.SingleAsync(u => u.Username == "analista1");
        Assert.Equal(empresaId, usuario.EmpresaPredeterminadaId);
    }

    [Fact]
    public async Task SembrarDatosIniciales_EmpresaModelo_Ajustes_Periodo_EIdempotente()
    {
        await using var context = CrearContexto();

        // Doble corrida: la semilla debe ser idempotente (reinicio del servicio)
        DbInitializer.SembrarDatosIniciales(context);
        DbInitializer.SembrarDatosIniciales(context);

        var empresa = await context.Empresa.SingleAsync();
        Assert.Equal("Inversiones Tyted, C.A.", empresa.RazonSocial);
        Assert.Equal("J-12345678-9", empresa.RIF);

        var ajustes = await context.EmpresaConfigs.ToListAsync();
        Assert.Equal(empresa.Id.ToString(), ajustes.Single(a => a.Clave == "EmpresaModeloId").Valor);
        Assert.Equal("AMBAS", ajustes.Single(a => a.Clave == "ModoImpresionFactura").Valor);
        Assert.Equal(2, ajustes.Count); // sin duplicados tras la doble corrida

        // Ejercicio fiscal abierto del año actual para la empresa modelo
        var periodo = await context.PeriodosContables.SingleAsync();
        Assert.Equal(empresa.Id, periodo.EmpresaId);
        Assert.Equal(DateTime.Now.Year, periodo.Anio);
        Assert.Equal("Anual", periodo.TipoPeriodo);
        Assert.False(periodo.Cerrado);
        Assert.Equal("Abierto", periodo.Estado);

        // Plan base de cuentas creado
        Assert.True(await context.CuentasContables.AnyAsync(c => c.EmpresaId == empresa.Id));
    }

    [Fact]
    public async Task SembrarDatosIniciales_ProductionConEnvVar_CreaAdminInicial()
    {
        await using var context = CrearContexto();
        var anterior = Environment.GetEnvironmentVariable("ADMIN_SEED_PASSWORD");
        try
        {
            Environment.SetEnvironmentVariable("ADMIN_SEED_PASSWORD", "SuperSecreta_2026!");
            // seedDevelopmentDefaults=false simula PRODUCCIÓN: la env var basta
            DbInitializer.SembrarDatosIniciales(context, seedDevelopmentDefaults: false);

            var admin = await context.Usuarios.SingleAsync(u => u.Username == "admin");
            Assert.Equal("AdministradorSistema", admin.Rol);
            Assert.True(admin.Activo);
            Assert.False(string.IsNullOrWhiteSpace(admin.PasswordHash));
        }
        finally
        {
            Environment.SetEnvironmentVariable("ADMIN_SEED_PASSWORD", anterior);
        }
    }

    [Fact]
    public async Task SembrarDatosIniciales_SinEnvVarNiFlag_NoCreaUsuarios()
    {
        await using var context = CrearContexto();
        var anterior = Environment.GetEnvironmentVariable("ADMIN_SEED_PASSWORD");
        try
        {
            Environment.SetEnvironmentVariable("ADMIN_SEED_PASSWORD", null);
            DbInitializer.SembrarDatosIniciales(context, seedDevelopmentDefaults: false);

            Assert.False(await context.Usuarios.AnyAsync());
        }
        finally
        {
            Environment.SetEnvironmentVariable("ADMIN_SEED_PASSWORD", anterior);
        }
    }
}
