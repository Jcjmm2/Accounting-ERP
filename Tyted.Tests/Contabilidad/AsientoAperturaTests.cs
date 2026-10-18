using Microsoft.EntityFrameworkCore;
using Tyted.API.Data;
using Tyted.API.Models;
using Tyted.API.Services;

namespace Tyted.Tests.Contabilidad;

/// <summary>
/// Pruebas del asiento de APERTURA de periodo (tipo "Apertura", concepto
/// libre): fija los SALDOS INICIALES del Balance de Comprobación y NO cuenta
/// como movimiento del mes; sólo puede haber UNO por periodo; los traspasos
/// automáticos "APERTURA DE BALANCE" siguen excluidos (el saldo llega por
/// histórico) y el Libro Mayor muestra la apertura sin acumularla.
/// </summary>
public class AsientoAperturaTests
{
    private static TytedContext CrearContexto()
    {
        var options = new DbContextOptionsBuilder<TytedContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;

        return new TytedContext(options);
    }

    private static async Task<(PeriodoContable periodo, CuentaContable caja, CuentaContable capital)> SembrarPeriodoAsync(
        TytedContext context, DateTime fechaInicio, DateTime fechaFin, int empresaId = 1)
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
        var caja = await context.CuentasContables
            .FirstOrDefaultAsync(c => c.EmpresaId == empresaId && c.CodigoCuenta == "1.1.1.1.01");
        if (caja == null)
        {
            caja = new CuentaContable
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
            context.CuentasContables.Add(caja);
        }

        var capital = await context.CuentasContables
            .FirstOrDefaultAsync(c => c.EmpresaId == empresaId && c.CodigoCuenta == "3.1.1.1.01");
        if (capital == null)
        {
            capital = new CuentaContable
            {
                EmpresaId = empresaId,
                CodigoCuenta = "3.1.1.1.01",
                NombreCuenta = "Capital Social",
                TipoCuenta = "Patrimonio",
                Naturaleza = "C",
                EsMovimiento = true,
                Nivel = 5,
                Activa = true
            };
            context.CuentasContables.Add(capital);
        }

        context.PeriodosContables.Add(periodo);
        await context.SaveChangesAsync();
        return (periodo, caja, capital);
    }

    /// <summary>Crea un asiento vía servicio (valida partida doble, periodo y apertura única).</summary>
    private static Task<AsientoContable> CrearAsiento(
        TytedContext context, PeriodoContable periodo, CuentaContable caja, CuentaContable capital,
        DateTime fecha, decimal monto, string tipo, string concepto)
        => new AsientoContableService(context).CrearAsientoAsync(new AsientoContable
        {
            EmpresaId = periodo.EmpresaId,
            PeriodoContableId = periodo.Id,
            FechaComprobante = fecha,
            Concepto = concepto,
            TipoComprobante = tipo,
            Estado = "Aprobado",
            UsuarioId = 1,
            Detalles = new List<AsientoDetalle>
            {
                new() { CuentaContableId = caja.Id, Debe = monto, Haber = 0m },
                new() { CuentaContableId = capital.Id, Debe = 0m, Haber = monto }
            }
        });

    [Fact]
    public async Task Balance_AperturaManual_SePresentaComoSaldoInicial_NoComoMovimiento()
    {
        await using var context = CrearContexto();
        var (periodo, caja, capital) = await SembrarPeriodoAsync(context, new DateTime(2025, 1, 1), new DateTime(2025, 1, 31));

        // El usuario registra la apertura de la empresa: Dr Caja / Cr Capital.
        await CrearAsiento(context, periodo, caja, capital,
            new DateTime(2025, 1, 1), 103.20m, "Apertura", "Apertura de la empresa ABC, C.A.");

        var balance = await new ReportesContablesService(context).GetBalanceComprobacionAsync(periodo.Id);

        var filaCaja = Assert.Single(balance, b => b.CuentaId == caja.Id);
        Assert.Equal(103.20m, filaCaja.SaldoInicial);   // la apertura fija el inicial
        Assert.Equal(0m, filaCaja.MovimientoDebe);      // NO es movimiento del mes
        Assert.Equal(0m, filaCaja.MovimientoHaber);
        Assert.Equal(103.20m, filaCaja.SaldoFinal);

        var filaCapital = Assert.Single(balance, b => b.CuentaId == capital.Id);
        Assert.Equal(103.20m, filaCapital.SaldoInicial);
        Assert.Equal(0m, filaCapital.MovimientoHaber);
        Assert.Equal(103.20m, filaCapital.SaldoFinal);
    }

    [Fact]
    public async Task Balance_PeriodoSiguiente_LaAperturaLlegaComoHistorico()
    {
        await using var context = CrearContexto();
        var (enero, caja, capital) = await SembrarPeriodoAsync(context, new DateTime(2025, 1, 1), new DateTime(2025, 1, 31));
        await CrearAsiento(context, enero, caja, capital,
            new DateTime(2025, 1, 1), 103.20m, "Apertura", "Apertura de la empresa");

        var (febrero, _, _) = await SembrarPeriodoAsync(context, new DateTime(2025, 2, 1), new DateTime(2025, 2, 28));

        var balance = await new ReportesContablesService(context).GetBalanceComprobacionAsync(febrero.Id);

        var filaCaja = Assert.Single(balance, b => b.CuentaId == caja.Id);
        Assert.Equal(103.20m, filaCaja.SaldoInicial); // histórico (fecha < 01/02)
        Assert.Equal(0m, filaCaja.MovimientoDebe);
        Assert.Equal(103.20m, filaCaja.SaldoFinal);
    }

    [Fact]
    public async Task CrearAsiento_SegundaAperturaManual_SeRechaza_ElTraspasoAutomaticoNoCuenta()
    {
        await using var context = CrearContexto();
        var (periodo, caja, capital) = await SembrarPeriodoAsync(context, new DateTime(2025, 1, 1), new DateTime(2025, 1, 31));

        await CrearAsiento(context, periodo, caja, capital,
            new DateTime(2025, 1, 1), 100m, "Apertura", "Apertura de la empresa");

        // Segunda apertura manual en el mismo periodo: rechazada (duplicaría
        // los saldos iniciales).
        var ex = await Assert.ThrowsAsync<InvalidOperationException>(() =>
            CrearAsiento(context, periodo, caja, capital,
                new DateTime(2025, 1, 2), 50m, "Apertura", "Segunda apertura indebida"));
        Assert.Contains("UNO por periodo", ex.Message);

        // El traspaso automático "APERTURA DE BALANCE" (mismo tipo "Apertura"
        // pero con prefijo de sistema) NO está sujeto a esa regla.
        var traspaso = await CrearAsiento(context, periodo, caja, capital,
            new DateTime(2025, 1, 31), 75m, "Apertura", "APERTURA DE BALANCE Enero 2025: traslado de saldos");
        Assert.True(traspaso.Id > 0);
        Assert.Equal(2, await context.AsientosContables.CountAsync());
    }

    [Fact]
    public async Task Balance_TraspasoAutomatico_SigueExcluidoDeInicialYMovimiento()
    {
        await using var context = CrearContexto();
        var (enero, caja, capital) = await SembrarPeriodoAsync(context, new DateTime(2025, 1, 1), new DateTime(2025, 1, 31));

        // Movimiento real de enero (tipo Diario): 500.
        await CrearAsiento(context, enero, caja, capital,
            new DateTime(2025, 1, 15), 500m, "Diario", "Operación de enero");

        var (febrero, _, _) = await SembrarPeriodoAsync(context, new DateTime(2025, 2, 1), new DateTime(2025, 2, 28));

        // Traspaso automático fechado el 01/02 (como lo genera CerrarPeriodo):
        // NO suma movimiento NI saldo inicial (el histórico ya aporta los 500).
        await CrearAsiento(context, febrero, caja, capital,
            new DateTime(2025, 2, 1), 500m, "Apertura", "APERTURA DE BALANCE Febrero 2025: traslado de saldos");

        var balance = await new ReportesContablesService(context).GetBalanceComprobacionAsync(febrero.Id);

        var filaCaja = Assert.Single(balance, b => b.CuentaId == caja.Id);
        Assert.Equal(500m, filaCaja.SaldoInicial); // del histórico de enero, sin duplicar
        Assert.Equal(0m, filaCaja.MovimientoDebe); // el traspaso no es movimiento
        Assert.Equal(500m, filaCaja.SaldoFinal);   // 500 + 0 (no 1000)
    }

    [Fact]
    public async Task LibroMayor_Apertura_MuestraLaLineaPeroNoAcumula()
    {
        await using var context = CrearContexto();
        var (periodo, caja, capital) = await SembrarPeriodoAsync(context, new DateTime(2025, 1, 1), new DateTime(2025, 1, 31));

        await CrearAsiento(context, periodo, caja, capital,
            new DateTime(2025, 1, 1), 103.20m, "Apertura", "Apertura de la empresa");
        // Movimiento normal posterior: 40.
        await CrearAsiento(context, periodo, caja, capital,
            new DateTime(2025, 1, 10), 40m, "Diario", "Operación del mes");

        var lineas = await new ReportesContablesService(context).GetLibroMayorAsync(
            caja.Id, new DateTime(2025, 1, 1), new DateTime(2025, 1, 31, 23, 59, 59));

        Assert.Equal(2, lineas.Count);
        // Saldo inicial EXPUESTO en cada fila (histórico + apertura del rango):
        // 103.20 — el mismo criterio del Balance de Comprobación.
        Assert.All(lineas, l => Assert.Equal(103.20m, l.SaldoInicial));
        // La apertura se MUESTRA (auditable) con el saldo inicial ya aplicado…
        var apertura = lineas.Single(l => l.Concepto.StartsWith("Apertura"));
        Assert.Equal(103.20m, apertura.SaldoAcumulado);
        // El tipo de comprobante permite a la UI excluir la apertura del
        // movimiento (Debe/Haber «—») y de los totales del libro.
        Assert.Equal("Apertura", apertura.TipoComprobante);
        // …y el movimiento posterior acumula sobre ese inicial.
        var operacion = lineas.Single(l => l.Concepto.StartsWith("Operación"));
        Assert.Equal(143.20m, operacion.SaldoAcumulado);
        Assert.Equal("Diario", operacion.TipoComprobante);
    }

    [Fact]
    public async Task LibroMayor_RangoSiguiente_SaldoInicialProvieneDelHistorico()
    {
        await using var context = CrearContexto();
        var (enero, caja, capital) = await SembrarPeriodoAsync(context, new DateTime(2025, 1, 1), new DateTime(2025, 1, 31));
        await CrearAsiento(context, enero, caja, capital,
            new DateTime(2025, 1, 1), 103.20m, "Apertura", "Apertura de la empresa");

        var (febrero, _, _) = await SembrarPeriodoAsync(context, new DateTime(2025, 2, 1), new DateTime(2025, 2, 28));
        // Movimiento normal de febrero: 40.
        await CrearAsiento(context, febrero, caja, capital,
            new DateTime(2025, 2, 10), 40m, "Diario", "Operación de febrero");

        var lineas = await new ReportesContablesService(context).GetLibroMayorAsync(
            caja.Id, new DateTime(2025, 2, 1), new DateTime(2025, 2, 28, 23, 59, 59));

        var movimiento = Assert.Single(lineas);
        // Saldo inicial de febrero = apertura de enero arrastrada por histórico.
        Assert.Equal(103.20m, movimiento.SaldoInicial);
        Assert.Equal(143.20m, movimiento.SaldoAcumulado);
    }
}
