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
/// Pruebas de la Unidad Tributaria VIGENTE (configuración global cambiada por
/// Gaceta Oficial): el sustraendo se deriva de la UT parametrizada (no de una
/// constante) y al actualizarla se recalculan los sustraendos cacheados de los
/// conceptos ISLR. Las retenciones ya emitidas no se tocan (su sustraendo
/// vive congelado en la propia retención).
/// </summary>
public class UnidadTributariaVigenteTests
{
    private static TytedContext CrearContexto()
    {
        var options = new DbContextOptionsBuilder<TytedContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .ConfigureWarnings(w => w.Ignore(InMemoryEventId.TransactionIgnoredWarning))
            .Options;

        return new TytedContext(options);
    }

    /// <summary>Controlador de prueba con usuario autenticado AdministradorSistema.</summary>
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
    public void CalcularSustraendo_UsaLaUtParametrizada_NoLaConstante()
    {
        var conDefault = CatalogoIslr.CalcularSustraendo(3m, CatalogoIslr.UnidadTributariaDefault);
        var conUtNueva = CatalogoIslr.CalcularSustraendo(3m, 60m);

        // 83,3334 × 43 × 3% = 107,50  |  83,3334 × 60 × 3% = 150,00
        Assert.Equal(107.50m, conDefault);
        Assert.Equal(150.00m, conUtNueva);
        Assert.NotEqual(conDefault, conUtNueva);
    }

    [Fact]
    public async Task GetUnidadTributariaVigente_SinFila_DevuelveElDefault()
    {
        using var context = CrearContexto();
        var configService = new ConfigService(context);

        var (valor, _) = await configService.GetUnidadTributariaVigenteAsync();

        Assert.Equal(CatalogoIslr.UnidadTributariaDefault, valor);
    }

    [Fact]
    public async Task SetUtVigente_ActualizaYRecalculaSustraendosDeLosConceptosIslr()
    {
        using var context = CrearContexto();
        var controller = CrearController(context);

        // Concepto PNR con sustraendo cacheado con la UT default (43).
        context.ConceptosOperacionales.Add(new ConceptoOperacional
        {
            EmpresaId = 1,
            NombreConcepto = "Honorarios profesionales (PNR)",
            TipoOperacion = "ISLR",
            CuentaContable = "2.1.1.02",
            CodigoSeniat = "002",
            TipoPersona = "PNR",
            PorcentajeRetencion = 3m,
            AplicaSustraendo = true,
            MontoSustraendoBs = CatalogoIslr.CalcularSustraendo(3m, CatalogoIslr.UnidadTributariaDefault)
        });
        // Concepto PJD: sin sustraendo; no debe tocarse.
        context.ConceptosOperacionales.Add(new ConceptoOperacional
        {
            EmpresaId = 1,
            NombreConcepto = "Honorarios profesionales (PJD)",
            TipoOperacion = "ISLR",
            CuentaContable = "2.1.1.02",
            CodigoSeniat = "004",
            TipoPersona = "PJD",
            PorcentajeRetencion = 5m,
            AplicaSustraendo = false,
            MontoSustraendoBs = null
        });
        await context.SaveChangesAsync();

        var resultado = await controller.SetUtVigente(new ActualizarUtVigenteRequest
        {
            Valor = 60m,
            Gaceta = "G.O. N° 6.999 de 01/01/2027"
        });
        Assert.IsType<OkObjectResult>(resultado);

        var pnr = await context.ConceptosOperacionales.AsNoTracking().SingleAsync(c => c.CodigoSeniat == "002");
        Assert.Equal(CatalogoIslr.CalcularSustraendo(3m, 60m), pnr.MontoSustraendoBs!.Value); // 150,00

        var pjd = await context.ConceptosOperacionales.AsNoTracking().SingleAsync(c => c.CodigoSeniat == "004");
        Assert.Null(pjd.MontoSustraendoBs);

        var (valor, gaceta) = await new ConfigService(context).GetUnidadTributariaVigenteAsync();
        Assert.Equal(60m, valor);
        Assert.Equal("G.O. N° 6.999 de 01/01/2027", gaceta);
    }

    [Fact]
    public async Task SetUtVigente_ValorNoPositivo_NoActualiza()
    {
        using var context = CrearContexto();
        var controller = CrearController(context);

        var resultado = await controller.SetUtVigente(new ActualizarUtVigenteRequest { Valor = 0m });

        Assert.IsType<BadRequestObjectResult>(resultado);
        var (valor, _) = await new ConfigService(context).GetUnidadTributariaVigenteAsync();
        Assert.Equal(CatalogoIslr.UnidadTributariaDefault, valor);
    }
}
