using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Tyted.API.Controllers.Contabilidad;
using Tyted.API.Data;
using Tyted.API.Models;
using Tyted.API.Services;

namespace Tyted.Tests.Contabilidad;

/// <summary>
/// Pruebas de la cadena de registro de asientos (controller + service):
/// - El cuerpo "null" (JSON con "id": null) debe responder 400 con mensaje claro.
/// - El periodo debe pertenecer a la empresa del asiento.
/// - La glosa se recorta al máximo de 100 caracteres de AsientoDetalle.Referencia.
/// - El listado se puede filtrar por empresa.
/// </summary>
public class AsientoRegistroTests
{
    private static TytedContext CrearContexto()
    {
        var options = new DbContextOptionsBuilder<TytedContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;

        return new TytedContext(options);
    }

    private static async Task<(PeriodoContable periodo, CuentaContable debe, CuentaContable haber)> SembrarBaseAsync(
        TytedContext context,
        int empresaId = 1)
    {
        var periodo = new PeriodoContable
        {
            EmpresaId = empresaId,
            Anio = 2026,
            Mes = 10,
            Nombre = "Octubre 2026",
            TipoPeriodo = "Mensual",
            FechaInicio = new DateTime(2026, 10, 1),
            FechaFin = new DateTime(2026, 10, 31, 23, 59, 59),
            Cerrado = false,
            Estado = "Abierto"
        };

        var debe = new CuentaContable
        {
            EmpresaId = empresaId,
            CodigoCuenta = "1.1.1.1.01",
            NombreCuenta = "Caja General",
            TipoCuenta = "Activo",
            Naturaleza = "D",
            EsMovimiento = true,
            Nivel = 5,
            Activa = true
        };

        var haber = new CuentaContable
        {
            EmpresaId = empresaId,
            CodigoCuenta = "3.1.1",
            NombreCuenta = "Capital social",
            TipoCuenta = "Patrimonio",
            Naturaleza = "C",
            EsMovimiento = true,
            Nivel = 3,
            Activa = true
        };

        context.PeriodosContables.Add(periodo);
        context.CuentasContables.AddRange(debe, haber);
        await context.SaveChangesAsync();

        return (periodo, debe, haber);
    }

    private static AsientoContable NuevoAsiento(int empresaId, PeriodoContable periodo, CuentaContable debe, CuentaContable haber)
        => new()
        {
            EmpresaId = empresaId,
            PeriodoContableId = periodo.Id,
            NumeroComprobante = string.Empty, // El backend debe autogenerarlo
            FechaComprobante = new DateTime(2026, 10, 7),
            Concepto = "Asiento de prueba",
            TipoComprobante = "Diario",
            Estado = "Aprobado",
            UsuarioId = 1,
            Detalles = new List<AsientoDetalle>
            {
                new() { CuentaContableId = debe.Id, Debe = 100m, Haber = 0m },
                new() { CuentaContableId = haber.Id, Debe = 0m, Haber = 100m }
            }
        };

    [Fact]
    public async Task CrearAsiento_EnPeriodoAbierto_DebeGenerarNumeroComprobante()
    {
        await using var context = CrearContexto();
        var (periodo, debe, haber) = await SembrarBaseAsync(context);

        var service = new AsientoContableService(context);
        var asiento = await service.CrearAsientoAsync(NuevoAsiento(1, periodo, debe, haber));

        Assert.True(asiento.Id > 0);
        Assert.False(string.IsNullOrWhiteSpace(asiento.NumeroComprobante));
        Assert.True(asiento.NumeroComprobante.Length <= 20);
        Assert.Equal(100m, asiento.TotalDebe);
        Assert.Equal(100m, asiento.TotalHaber);
    }

    [Fact]
    public async Task CrearAsiento_ConGlosaLarga_RecortaLaReferenciaA100Caracteres()
    {
        await using var context = CrearContexto();
        var (periodo, debe, haber) = await SembrarBaseAsync(context);

        var asiento = NuevoAsiento(1, periodo, debe, haber);
        asiento.Concepto = new string('X', 300); // Concepto admite 500, la referencia solo 100
        foreach (var detalle in asiento.Detalles)
        {
            detalle.Referencia = asiento.Concepto;
        }

        var service = new AsientoContableService(context);
        var creado = await service.CrearAsientoAsync(asiento);

        Assert.All(creado.Detalles, d => Assert.True(d.Referencia!.Length <= 100));
    }

    [Fact]
    public async Task CrearAsiento_PeriodoQueNoPerteneceALaEmpresa_DevuelveError()
    {
        await using var context = CrearContexto();
        var (periodoEmpresa1, debe, haber) = await SembrarBaseAsync(context, empresaId: 1);

        var service = new AsientoContableService(context);
        var asiento = NuevoAsiento(empresaId: 2, periodoEmpresa1, debe, haber);

        var excepcion = await Assert.ThrowsAsync<InvalidOperationException>(
            () => service.CrearAsientoAsync(asiento));

        Assert.Contains("empresa", excepcion.Message, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public async Task CrearAsiento_CuerpoNulo_DevuelveBadRequest()
    {
        await using var context = CrearContexto();
        var controller = new AsientosController(new AsientoContableService(context));

        var resultado = await controller.CrearAsiento(null!);

        var badRequest = Assert.IsType<BadRequestObjectResult>(resultado.Result);
        Assert.NotNull(badRequest.Value);
    }

    [Fact]
    public async Task GetAsientos_FiltraPorEmpresa()
    {
        await using var context = CrearContexto();

        context.AsientosContables.AddRange(
            new AsientoContable
            {
                EmpresaId = 1, PeriodoContableId = 1, NumeroComprobante = "A-1",
                FechaComprobante = new DateTime(2026, 10, 2), Concepto = "Empresa 1",
                TipoComprobante = "Diario", Estado = "Aprobado", UsuarioId = 1
            },
            new AsientoContable
            {
                EmpresaId = 2, PeriodoContableId = 2, NumeroComprobante = "A-2",
                FechaComprobante = new DateTime(2026, 10, 3), Concepto = "Empresa 2",
                TipoComprobante = "Diario", Estado = "Aprobado", UsuarioId = 1
            });
        await context.SaveChangesAsync();

        var service = new AsientoContableService(context);
        var asientosEmpresa1 = await service.GetAsientosAsync(empresaId: 1);
        var todos = await service.GetAsientosAsync();

        Assert.Single(asientosEmpresa1);
        Assert.Equal("Empresa 1", asientosEmpresa1[0].Concepto);
        Assert.Equal(2, todos.Count);
    }
}