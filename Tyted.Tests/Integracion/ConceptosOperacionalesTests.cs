using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Diagnostics;
using Microsoft.Extensions.Configuration;
using System.Security.Claims;
using Tyted.API.Controllers;
using Tyted.API.Data;
using Tyted.API.Models;
using Tyted.API.Services;

namespace Tyted.Tests.Integracion;

/// <summary>
/// Pruebas del catálogo de conceptos operacionales. Cubren la corrección del
/// error 400 al editar/crear conceptos ISLR: el whitelist del controlador
/// admitía sólo COMPRA/VENTA/GASTO/SISTEMA y rechazaba "ISLR", el tipo que el
/// panel de Conceptos Operacionales envía para el catálogo del Decreto 1.808.
/// </summary>
public class ConceptosOperacionalesTests
{
    private static TytedContext CrearContexto()
    {
        var options = new DbContextOptionsBuilder<TytedContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .ConfigureWarnings(w => w.Ignore(InMemoryEventId.TransactionIgnoredWarning))
            .Options;

        return new TytedContext(options);
    }

    /// <summary>
    /// Controlador con un usuario autenticado de prueba. El aislamiento por
    /// empresa exige un claim NameIdentifier y un Usuario en BD; con rol
    /// AdministradorSistema tiene acceso a todas las empresas.
    /// </summary>
    private static ConceptosOperacionalesController CrearController(TytedContext context)
    {
        context.Usuarios.Add(new Usuario
        {
            Id = 1,
            Username = "admin.test",
            NombreCompleto = "Admin de Pruebas",
            Rol = "AdministradorSistema",
            Activo = true
        });
        context.SaveChanges();

        var identity = new ClaimsIdentity(new[]
        {
            new Claim(ClaimTypes.NameIdentifier, "1"),
            new Claim(ClaimTypes.Role, "AdministradorSistema")
        }, "Test");

        return new ConceptosOperacionalesController(
            context,
            new EmpresaAccessService(context),
            new ConfigurationBuilder().Build(),
            new ConfigService(context))
        {
            ControllerContext = new ControllerContext
            {
                HttpContext = new DefaultHttpContext { User = new ClaimsPrincipal(identity) }
            }
        };
    }

    [Fact]
    public async Task PutConcepto_ConTipoIslr_NoDevuelve400_YPersisteAtributosFiscales()
    {
        using var context = CrearContexto();
        var controller = CrearController(context);

        var original = new ConceptoOperacional
        {
            EmpresaId = 1,
            NombreConcepto = "Honorarios profesionales",
            TipoOperacion = "ISLR",
            CuentaContable = "2.1.1.02",
            CodigoSeniat = "055",
            TipoPersona = "PJD",
            PorcentajeRetencion = 5m,
            AplicaSustraendo = false
        };
        context.ConceptosOperacionales.Add(original);
        await context.SaveChangesAsync();

        // Edición típica del panel: mismo tipo ISLR pero cambiando cuenta,
        // tarifa, tipo de persona y sustraendo.
        var resultado = await controller.PutConcepto(original.Id, new ConceptoOperacional
        {
            EmpresaId = 1,
            NombreConcepto = "Honorarios profesionales",
            TipoOperacion = "ISLR",
            CuentaContable = "2.1.1.03",
            CodigoSeniat = "055",
            TipoPersona = "PNR",
            PorcentajeRetencion = 6.66m,
            AplicaSustraendo = true
        });

        Assert.IsType<NoContentResult>(resultado);

        var guardado = await context.ConceptosOperacionales
            .AsNoTracking()
            .SingleAsync(c => c.Id == original.Id);

        Assert.Equal("ISLR", guardado.TipoOperacion);
        Assert.Equal("2.1.1.03", guardado.CuentaContable);
        Assert.Equal("PNR", guardado.TipoPersona);
        Assert.Equal(6.66m, guardado.PorcentajeRetencion!.Value);
        Assert.True(guardado.AplicaSustraendo);
        // El sustraendo se recalcula en el servidor con la UT vigente.
        Assert.Equal(CatalogoIslr.CalcularSustraendo(6.66m, CatalogoIslr.UnidadTributariaDefault), guardado.MontoSustraendoBs!.Value);
        Assert.True(guardado.MontoSustraendoBs > 0);
    }

    [Fact]
    public async Task PutConcepto_CambiaTipoACompra_LimpiaAtributosIslr()
    {
        using var context = CrearContexto();
        var controller = CrearController(context);

        var original = new ConceptoOperacional
        {
            EmpresaId = 1,
            NombreConcepto = "Concepto reasignado",
            TipoOperacion = "ISLR",
            CuentaContable = "2.1.1.02",
            CodigoSeniat = "002",
            TipoPersona = "PNR",
            PorcentajeRetencion = 3m,
            AplicaSustraendo = true
        };
        context.ConceptosOperacionales.Add(original);
        await context.SaveChangesAsync();

        var resultado = await controller.PutConcepto(original.Id, new ConceptoOperacional
        {
            NombreConcepto = "Concepto reasignado",
            TipoOperacion = "COMPRA",
            CuentaContable = "1.1.1.1.01"
        });

        Assert.IsType<NoContentResult>(resultado);

        var guardado = await context.ConceptosOperacionales
            .AsNoTracking()
            .SingleAsync(c => c.Id == original.Id);

        Assert.Equal("COMPRA", guardado.TipoOperacion);
        Assert.Null(guardado.CodigoSeniat);
        Assert.Null(guardado.TipoPersona);
        Assert.Null(guardado.PorcentajeRetencion);
        Assert.False(guardado.AplicaSustraendo);
        Assert.Null(guardado.MontoSustraendoBs);
    }

    [Fact]
    public async Task PutConcepto_ConTipoInvalido_ReturnsBadRequest()
    {
        using var context = CrearContexto();
        var controller = CrearController(context);

        var original = new ConceptoOperacional
        {
            EmpresaId = 1,
            NombreConcepto = "Concepto válido",
            TipoOperacion = "GASTO",
            CuentaContable = "5.1.2"
        };
        context.ConceptosOperacionales.Add(original);
        await context.SaveChangesAsync();

        var resultado = await controller.PutConcepto(original.Id, new ConceptoOperacional
        {
            NombreConcepto = "Concepto válido",
            TipoOperacion = "FOO",
            CuentaContable = "5.1.2"
        });

        Assert.IsType<BadRequestObjectResult>(resultado);
    }

    [Fact]
    public async Task PostConcepto_ConTipoIslr_SePermiteYCalculaSustraendo()
    {
        using var context = CrearContexto();
        var controller = CrearController(context);

        var resultado = await controller.PostConcepto(new ConceptoOperacional
        {
            EmpresaId = 1,
            NombreConcepto = "Servicios personales (PNR)",
            TipoOperacion = "ISLR",
            CuentaContable = "2.1.1.02",
            CodigoSeniat = "010",
            TipoPersona = "PNR",
            PorcentajeRetencion = 4m,
            AplicaSustraendo = true
        });

        // El método devuelve ActionResult<T>: el CreatedAtActionResult va envuelto.
        var created = Assert.IsType<CreatedAtActionResult>(resultado.Result);
        Assert.NotNull(created.Value);

        var guardado = await context.ConceptosOperacionales.AsNoTracking().SingleAsync();
        Assert.Equal("ISLR", guardado.TipoOperacion);
        Assert.Equal("010", guardado.CodigoSeniat);
        Assert.Equal(CatalogoIslr.CalcularSustraendo(4m, CatalogoIslr.UnidadTributariaDefault), guardado.MontoSustraendoBs!.Value);
    }
}
