using Microsoft.EntityFrameworkCore;
using Tyted.API.Data;
using Tyted.API.Models;
using Tyted.API.Services;

namespace Tyted.Tests;

public class ReportesContablesServiceTests
{
    private static TytedContext CreateContext()
    {
        var options = new DbContextOptionsBuilder<TytedContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;

        return new TytedContext(options);
    }

    [Fact]
    public void ModelosContables_ExistenEnElProyectoActual()
    {
        Assert.Equal("PeriodoContable", typeof(PeriodoContable).Name);
        Assert.Equal("CuentaContable", typeof(CuentaContable).Name);
        Assert.Equal("AsientoContable", typeof(AsientoContable).Name);
    }

    [Fact]
    public async Task ReportesContablesService_SePuedeCrearSinDatosIniciales()
    {
        await using var context = CreateContext();

        var service = new ReportesContablesService(context);
        var resumen = await service.GetResumenAsync();

        Assert.NotNull(resumen);
    }

    [Fact]
    public async Task PeriodoContableService_CreaEjercicioFiscalCompletoCon12Meses()
    {
        await using var context = CreateContext();
        var service = new PeriodoContableService(context, new AsientoContableService(context));

        var ejercicio = await service.CrearEjercicioFiscalCompletoAsync(1, 2026);

        Assert.Equal("Anual", ejercicio.TipoPeriodo);
        Assert.Equal(2026, ejercicio.Anio);

        var registros = await context.PeriodosContables
            .Where(p => p.EmpresaId == 1 && p.Anio == 2026)
            .ToListAsync();

        Assert.Equal(13, registros.Count);
        Assert.Equal(12, registros.Count(p => p.TipoPeriodo == "Mensual"));
        Assert.Equal(1, registros.Count(p => p.TipoPeriodo == "Anual"));
        Assert.Contains(registros, p => p.Mes == 1 && p.Nombre == "Enero 2026");
        Assert.Contains(registros, p => p.Mes == 12 && p.Nombre == "Diciembre 2026");
    }

    [Fact]
    public async Task PeriodoContableService_FiltraPorEmpresaActiva()
    {
        await using var context = CreateContext();
        var service = new PeriodoContableService(context, new AsientoContableService(context));

        await service.CrearEjercicioFiscalCompletoAsync(1, 2026);
        await service.CrearEjercicioFiscalCompletoAsync(2, 2027);

        var periodosEmpresa1 = await service.GetPeriodosAsync(1);
        var periodosEmpresa2 = await service.GetPeriodosAsync(2);

        Assert.All(periodosEmpresa1, p => Assert.Equal(1, p.EmpresaId));
        Assert.All(periodosEmpresa2, p => Assert.Equal(2, p.EmpresaId));
        Assert.Contains(periodosEmpresa1, p => p.Anio == 2026);
        Assert.Contains(periodosEmpresa2, p => p.Anio == 2027);
    }
}
