using Microsoft.EntityFrameworkCore;
using Tyted.API.Data;
using Tyted.API.Models;
using Tyted.API.Services;

namespace Tyted.Tests.Contabilidad;

/// <summary>
/// Pruebas del consecutivo del comprobante con formato YYMM0000001:
/// - 2 dígitos de año + 2 de mes + secuencia de 7 dígitos (ej: 26100000001).
/// - La secuencia avanza dentro del mes y se reinicia en el mes siguiente.
/// - Cada empresa mantiene su propia serie y los números manuales se conservan.
/// </summary>
public class ConsecutivoComprobanteTests
{
    private static TytedContext CrearContexto()
    {
        var options = new DbContextOptionsBuilder<TytedContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;

        return new TytedContext(options);
    }

    private static async Task<(PeriodoContable periodo, CuentaContable debe, CuentaContable haber)> SembrarPeriodoAsync(
        TytedContext context,
        DateTime fechaInicio,
        DateTime fechaFin,
        int empresaId = 1)
    {
        var periodo = new PeriodoContable
        {
            EmpresaId = empresaId,
            Anio = fechaInicio.Year,
            Mes = fechaInicio.Month,
            Nombre = $"{fechaInicio:MMMM} {fechaInicio.Year}",
            TipoPeriodo = "Mensual",
            FechaInicio = fechaInicio,
            FechaFin = fechaFin,
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

    private static AsientoContable NuevoAsiento(
        int empresaId,
        PeriodoContable periodo,
        CuentaContable debe,
        CuentaContable haber,
        DateTime fecha,
        string numeroComprobante = "")
        => new()
        {
            EmpresaId = empresaId,
            PeriodoContableId = periodo.Id,
            NumeroComprobante = numeroComprobante, // Vacío => el backend autogenera
            FechaComprobante = fecha,
            Concepto = $"Asiento {fecha:yyyy-MM-dd}",
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
    public async Task CrearAsientos_MismoMes_GeneraSecuenciaEnFormatoYYMM0000001()
    {
        await using var context = CrearContexto();
        var (periodo, debe, haber) = await SembrarPeriodoAsync(context, new DateTime(2026, 10, 1), new DateTime(2026, 10, 31));

        var service = new AsientoContableService(context);

        var primero = await service.CrearAsientoAsync(NuevoAsiento(1, periodo, debe, haber, new DateTime(2026, 10, 5)));
        var segundo = await service.CrearAsientoAsync(NuevoAsiento(1, periodo, debe, haber, new DateTime(2026, 10, 12)));

        Assert.Equal("26100000001", primero.NumeroComprobante);
        Assert.Equal("26100000002", segundo.NumeroComprobante);
        Assert.Matches(@"^\d{11}$", primero.NumeroComprobante);
    }

    [Fact]
    public async Task CrearAsientos_MesSiguiente_ReiniciaLaSecuencia()
    {
        await using var context = CrearContexto();
        var (octubre, debe, haber) = await SembrarPeriodoAsync(context, new DateTime(2026, 10, 1), new DateTime(2026, 10, 31));
        var (noviembre, _, _) = await SembrarPeriodoAsync(context, new DateTime(2026, 11, 1), new DateTime(2026, 11, 30));

        var service = new AsientoContableService(context);

        await service.CrearAsientoAsync(NuevoAsiento(1, octubre, debe, haber, new DateTime(2026, 10, 20)));
        await service.CrearAsientoAsync(NuevoAsiento(1, octubre, debe, haber, new DateTime(2026, 10, 25)));
        var deNoviembre = await service.CrearAsientoAsync(NuevoAsiento(1, noviembre, debe, haber, new DateTime(2026, 11, 3)));

        Assert.Equal("26110000001", deNoviembre.NumeroComprobante);
    }

    [Fact]
    public async Task CrearAsientos_EmpresasDiferentes_TienenSeriesIndependientes()
    {
        await using var context = CrearContexto();
        var (periodoEmpresa1, debe, haber) = await SembrarPeriodoAsync(context, new DateTime(2026, 10, 1), new DateTime(2026, 10, 31), empresaId: 1);
        var (periodoEmpresa2, _, _) = await SembrarPeriodoAsync(context, new DateTime(2026, 10, 1), new DateTime(2026, 10, 31), empresaId: 2);

        var service = new AsientoContableService(context);

        var asientoEmpresa1 = await service.CrearAsientoAsync(NuevoAsiento(1, periodoEmpresa1, debe, haber, new DateTime(2026, 10, 5)));
        var asientoEmpresa2 = await service.CrearAsientoAsync(NuevoAsiento(2, periodoEmpresa2, debe, haber, new DateTime(2026, 10, 5)));

        Assert.Equal("26100000001", asientoEmpresa1.NumeroComprobante);
        Assert.Equal("26100000001", asientoEmpresa2.NumeroComprobante);
    }

    [Fact]
    public async Task CrearAsiento_ConNumeroManual_SeConservaElNumeroIngresado()
    {
        await using var context = CrearContexto();
        var (periodo, debe, haber) = await SembrarPeriodoAsync(context, new DateTime(2026, 10, 1), new DateTime(2026, 10, 31));

        var service = new AsientoContableService(context);
        var asiento = await service.CrearAsientoAsync(
            NuevoAsiento(1, periodo, debe, haber, new DateTime(2026, 10, 5), numeroComprobante: "26100000099"));

        Assert.Equal("26100000099", asiento.NumeroComprobante);
    }

    [Fact]
    public async Task CrearAsiento_ConFormatoLegadoAnterior_NoAlteraLaSecuenciaNueva()
    {
        await using var context = CrearContexto();
        var (periodo, debe, haber) = await SembrarPeriodoAsync(context, new DateTime(2026, 10, 1), new DateTime(2026, 10, 31));

        // Comprobante del formato legado COMP-yyMMddHHmmss: no debe romper la nueva numeración
        context.AsientosContables.Add(new AsientoContable
        {
            EmpresaId = 1,
            PeriodoContableId = periodo.Id,
            NumeroComprobante = "COMP-261007143055",
            FechaComprobante = new DateTime(2026, 10, 7),
            Concepto = "Asiento legado",
            TipoComprobante = "Diario",
            Estado = "Aprobado",
            UsuarioId = 1
        });
        await context.SaveChangesAsync();

        var service = new AsientoContableService(context);
        var asiento = await service.CrearAsientoAsync(NuevoAsiento(1, periodo, debe, haber, new DateTime(2026, 10, 9)));

        Assert.Equal("26100000001", asiento.NumeroComprobante);
    }
}