using Microsoft.EntityFrameworkCore;
using Tyted.API.Data;
using Tyted.API.Models;
using Tyted.API.Services;

namespace Tyted.Tests.Contabilidad;

/// <summary>
/// Pruebas del balance de comprobación que alimenta la pantalla de reportes financieros:
/// - debe reflejar los movimientos del periodo (campos MovimientoDebe/MovimientoHaber/SaldoFinal),
/// - debe incorporar el saldo inicial de periodos anteriores,
/// - debe excluir movimientos de otras empresas,
/// - un periodo inexistente debe responder con un error controlado.
/// </summary>
public class ReportesContablesTests
{
    private static TytedContext CrearContexto()
    {
        var options = new DbContextOptionsBuilder<TytedContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;

        return new TytedContext(options);
    }

    private static async Task<(PeriodoContable periodo, CuentaContable caja, CuentaContable capital)> SembrarPeriodoAsync(
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

        var caja = new CuentaContable
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

        var capital = new CuentaContable
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
        context.CuentasContables.AddRange(caja, capital);
        await context.SaveChangesAsync();

        return (periodo, caja, capital);
    }

    private static async Task SembrarAsientoAsync(
        TytedContext context,
        int empresaId,
        PeriodoContable periodo,
        CuentaContable caja,
        CuentaContable capital,
        DateTime fecha,
        decimal monto)
    {
        context.AsientosContables.Add(new AsientoContable
        {
            EmpresaId = empresaId,
            PeriodoContableId = periodo.Id,
            NumeroComprobante = $"TEST-{fecha:yyMM}{context.AsientosContables.Count():D4}",
            FechaComprobante = fecha,
            Concepto = $"Asiento {fecha:yyyy-MM-dd}",
            TipoComprobante = "Diario",
            Estado = "Aprobado",
            UsuarioId = 1,
            Detalles = new List<AsientoDetalle>
            {
                new() { CuentaContableId = caja.Id, Debe = monto, Haber = 0m },
                new() { CuentaContableId = capital.Id, Debe = 0m, Haber = monto }
            }
        });
        await context.SaveChangesAsync();
    }

    [Fact]
    public async Task GetBalanceComprobacion_ReflejaLosMovimientosDelPeriodo()
    {
        await using var context = CrearContexto();
        var (periodo, caja, capital) = await SembrarPeriodoAsync(context, new DateTime(2026, 10, 1), new DateTime(2026, 10, 31));
        await SembrarAsientoAsync(context, 1, periodo, caja, capital, new DateTime(2026, 10, 5), 250m);

        var service = new ReportesContablesService(context);
        var balance = await service.GetBalanceComprobacionAsync(periodo.Id);

        var filaCaja = Assert.Single(balance, b => b.CuentaId == caja.Id);
        Assert.Equal(0m, filaCaja.SaldoInicial);
        Assert.Equal(250m, filaCaja.MovimientoDebe);
        Assert.Equal(0m, filaCaja.MovimientoHaber);
        Assert.Equal(250m, filaCaja.SaldoFinal);
        Assert.Equal("Activo", filaCaja.TipoCuenta);
        // Compatibilidad: TotalDebe/TotalHaber siguen exponiendo el movimiento del periodo
        Assert.Equal(250m, filaCaja.TotalDebe);

        var filaCapital = Assert.Single(balance, b => b.CuentaId == capital.Id);
        Assert.Equal(250m, filaCapital.MovimientoHaber);
        Assert.Equal(250m, filaCapital.SaldoFinal);
    }

    [Fact]
    public async Task GetBalanceComprobacion_IncluyeSaldoInicialDePeriodosAnteriores()
    {
        await using var context = CrearContexto();
        var (septiembre, caja, capital) = await SembrarPeriodoAsync(context, new DateTime(2026, 9, 1), new DateTime(2026, 9, 30));
        var (octubre, _, _) = await SembrarPeriodoAsync(context, new DateTime(2026, 10, 1), new DateTime(2026, 10, 31));

        await SembrarAsientoAsync(context, 1, septiembre, caja, capital, new DateTime(2026, 9, 5), 50m);
        await SembrarAsientoAsync(context, 1, octubre, caja, capital, new DateTime(2026, 10, 10), 100m);

        var service = new ReportesContablesService(context);
        var balance = await service.GetBalanceComprobacionAsync(octubre.Id);

        var filaCaja = Assert.Single(balance, b => b.CuentaId == caja.Id);
        Assert.Equal(50m, filaCaja.SaldoInicial);
        Assert.Equal(100m, filaCaja.MovimientoDebe);
        Assert.Equal(150m, filaCaja.SaldoFinal);
    }

    [Fact]
    public async Task GetBalanceComprobacion_NoIncluyeMovimientosDeOtraEmpresa()
    {
        await using var context = CrearContexto();
        var (periodoEmpresa1, caja, capital) = await SembrarPeriodoAsync(context, new DateTime(2026, 10, 1), new DateTime(2026, 10, 31), empresaId: 1);
        var (periodoEmpresa2, _, _) = await SembrarPeriodoAsync(context, new DateTime(2026, 10, 1), new DateTime(2026, 10, 31), empresaId: 2);

        await SembrarAsientoAsync(context, 1, periodoEmpresa1, caja, capital, new DateTime(2026, 10, 5), 100m);

        // Asiento de otra empresa con cuentas propias: no debe contaminar el reporte
        var cajaEmpresa2 = new CuentaContable
        {
            EmpresaId = 2,
            CodigoCuenta = "1.1.1.1.01",
            NombreCuenta = "Caja General",
            TipoCuenta = "Activo",
            Naturaleza = "D",
            EsMovimiento = true,
            Nivel = 5,
            Activa = true
        };
        context.CuentasContables.Add(cajaEmpresa2);
        await context.SaveChangesAsync();

        context.AsientosContables.Add(new AsientoContable
        {
            EmpresaId = 2,
            PeriodoContableId = periodoEmpresa2.Id,
            NumeroComprobante = "TEST-EMP2",
            FechaComprobante = new DateTime(2026, 10, 6),
            Concepto = "Asiento empresa 2",
            TipoComprobante = "Diario",
            Estado = "Aprobado",
            UsuarioId = 1,
            Detalles = new List<AsientoDetalle> { new() { CuentaContableId = cajaEmpresa2.Id, Debe = 900m, Haber = 0m } }
        });
        await context.SaveChangesAsync();

        var service = new ReportesContablesService(context);
        var balance = await service.GetBalanceComprobacionAsync(periodoEmpresa1.Id);

        var filaCaja = Assert.Single(balance, b => b.CuentaId == caja.Id);
        Assert.Equal(100m, filaCaja.MovimientoDebe);
        Assert.DoesNotContain(balance, b => b.CuentaId == cajaEmpresa2.Id);
    }

    [Fact]
    public async Task GetBalanceComprobacion_PeriodoAnual_ConsolidaLosMovimientosDelAnio()
    {
        await using var context = CrearContexto();
        var (anual, caja, capital) = await SembrarPeriodoAsync(context, new DateTime(2026, 1, 1), new DateTime(2026, 12, 31));
        anual.TipoPeriodo = "Anual";
        anual.Mes = null;
        await context.SaveChangesAsync();

        // El asiento quedó registrado en octubre pero dentro del rango del periodo anual
        await SembrarAsientoAsync(context, 1, anual, caja, capital, new DateTime(2026, 10, 8), 75m);

        var service = new ReportesContablesService(context);
        var balance = await service.GetBalanceComprobacionAsync(anual.Id);

        var filaCaja = Assert.Single(balance, b => b.CuentaId == caja.Id);
        Assert.Equal(75m, filaCaja.MovimientoDebe);
        Assert.Equal(75m, filaCaja.SaldoFinal);
    }

    [Fact]
    public async Task GetBalanceComprobacion_PeriodoInexistente_LanzaErrorControlado()
    {
        await using var context = CrearContexto();
        var service = new ReportesContablesService(context);

        var excepcion = await Assert.ThrowsAsync<InvalidOperationException>(
            () => service.GetBalanceComprobacionAsync(999));

        Assert.Contains("periodo", excepcion.Message, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public async Task GetLibroMayor_SinEmpresaId_DevuelveLosMovimientosDeLaCuenta()
    {
        await using var context = CrearContexto();
        var (periodo, caja, capital) = await SembrarPeriodoAsync(context, new DateTime(2026, 10, 1), new DateTime(2026, 10, 31));
        await SembrarAsientoAsync(context, 1, periodo, caja, capital, new DateTime(2026, 10, 5), 100m);

        var service = new ReportesContablesService(context);
        var movimientos = await service.GetLibroMayorAsync(caja.Id);

        Assert.Single(movimientos);
        Assert.Equal(100m, movimientos[0].Debe);
    }

    [Fact]
    public async Task GetLibroMayor_CuentaDeOtraEmpresa_SinResultadosCuandoSePideLaEmpresaActiva()
    {
        await using var context = CrearContexto();
        // Empresa 1 y empresa 2, cada una con su propio plan y sus movimientos
        var (_, caja1, capital1) = await SembrarPeriodoAsync(context, new DateTime(2026, 10, 1), new DateTime(2026, 10, 31), empresaId: 1);
        var (periodo2, caja2, capital2) = await SembrarPeriodoAsync(context, new DateTime(2026, 10, 1), new DateTime(2026, 10, 31), empresaId: 2);
        await SembrarAsientoAsync(context, 2, periodo2, caja2, capital2, new DateTime(2026, 10, 6), 900m);

        var service = new ReportesContablesService(context);

        // La cuenta de la empresa 2 NO produce movimientos bajo la empresa 1
        var comoEmpresa1 = await service.GetLibroMayorAsync(caja2.Id, empresaId: 1);
        Assert.Empty(comoEmpresa1);

        // Bajo su propia empresa sí (y la cuenta de la empresa 1 no se mezcla)
        var comoEmpresa2 = await service.GetLibroMayorAsync(caja2.Id, empresaId: 2);
        var movimiento = Assert.Single(comoEmpresa2);
        Assert.Equal(900m, movimiento.Debe);

        var caja1Empresa1 = await service.GetLibroMayorAsync(caja1.Id, empresaId: 1);
        Assert.Empty(caja1Empresa1); // caja1 no tiene movimientos en esta siembra
    }

    [Fact]
    public async Task GetBalanceComprobacion_PeriodoDeOtraEmpresa_LanzaErrorControlado()
    {
        await using var context = CrearContexto();
        var (periodo1, caja, capital) = await SembrarPeriodoAsync(context, new DateTime(2026, 10, 1), new DateTime(2026, 10, 31), empresaId: 1);
        await SembrarAsientoAsync(context, 1, periodo1, caja, capital, new DateTime(2026, 10, 5), 100m);

        var service = new ReportesContablesService(context);

        // El periodo pertenece a la empresa 1: pedirlo bajo la empresa 2 se rechaza
        var excepcion = await Assert.ThrowsAsync<InvalidOperationException>(
            () => service.GetBalanceComprobacionAsync(periodo1.Id, empresaId: 2));
        Assert.Contains("empresa", excepcion.Message, StringComparison.OrdinalIgnoreCase);

        // Bajo su propia empresa el reporte se genera con normalidad
        var balance = await service.GetBalanceComprobacionAsync(periodo1.Id, empresaId: 1);
        Assert.Single(balance, b => b.CuentaId == caja.Id);
    }

    [Fact]
    public async Task GetLibroMayor_SaldoAcumulado_AcumulaConElSignoNaturalDeLaCuenta()
    {
        await using var context = CrearContexto();
        var (periodo, caja, capital) = await SembrarPeriodoAsync(context, new DateTime(2026, 10, 1), new DateTime(2026, 10, 31));

        // Un movimiento anterior al rango (compone el saldo inicial) y dos dentro del rango
        await SembrarAsientoAsync(context, 1, periodo, caja, capital, new DateTime(2026, 9, 20), 30m);
        await SembrarAsientoAsync(context, 1, periodo, caja, capital, new DateTime(2026, 10, 5), 100m);
        await SembrarAsientoAsync(context, 1, periodo, caja, capital, new DateTime(2026, 10, 10), 40m);

        var service = new ReportesContablesService(context);

        // Caja (deudora): saldo = Debe − Haber. Con saldo inicial 30: 130 y luego 170.
        var cajaMovimientos = await service.GetLibroMayorAsync(caja.Id, new DateTime(2026, 10, 1), new DateTime(2026, 10, 31));
        Assert.Equal(2, cajaMovimientos.Count);
        Assert.Equal(130m, cajaMovimientos[0].SaldoAcumulado);
        Assert.Equal(170m, cajaMovimientos[1].SaldoAcumulado);

        // Capital (acreedora): saldo = Haber − Debe. Mismos montos al revés: 30+100=130, luego 170.
        var capitalMovimientos = await service.GetLibroMayorAsync(capital.Id, new DateTime(2026, 10, 1), new DateTime(2026, 10, 31));
        Assert.Equal(2, capitalMovimientos.Count);
        Assert.Equal(130m, capitalMovimientos[0].SaldoAcumulado);
        Assert.Equal(170m, capitalMovimientos[1].SaldoAcumulado);

        // Sin rango de fechas no hay saldo inicial: la acumulación arranca en 0
        // y todos los movimientos (incluido el de septiembre) se listan.
        var cajaSinRango = await service.GetLibroMayorAsync(caja.Id);
        Assert.Equal(3, cajaSinRango.Count);
        Assert.Equal(30m, cajaSinRango[0].SaldoAcumulado);
        Assert.Equal(130m, cajaSinRango[1].SaldoAcumulado);
        Assert.Equal(170m, cajaSinRango[2].SaldoAcumulado);
    }
}