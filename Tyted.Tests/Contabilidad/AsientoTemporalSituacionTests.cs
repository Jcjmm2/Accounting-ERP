using Microsoft.EntityFrameworkCore;
using Tyted.API.Data;
using Tyted.API.Models;
using Tyted.API.Services;

namespace Tyted.Tests.Contabilidad;

/// <summary>
/// Pruebas del asiento temporal (en memoria) que genera el Estado de Situación
/// Financiera al ser consultado: traslada el resultado del periodo a la cuenta
/// 3.1.3.1.02 de la empresa, respeta la partida doble, NO se persiste en el
/// libro mayor y controla la ausencia de la cuenta y el aislamiento por empresa.
/// </summary>
public class AsientoTemporalSituacionTests
{
    private static TytedContext CrearContexto()
    {
        var options = new DbContextOptionsBuilder<TytedContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;

        return new TytedContext(options);
    }

    private sealed class Escenario
    {
        public int EmpresaId { get; init; } = 1;
        public PeriodoContable Periodo { get; set; } = null!;
        public CuentaContable Caja { get; set; } = null!;
        public CuentaContable Ventas { get; set; } = null!;
        public CuentaContable Gastos { get; set; } = null!;
        public CuentaContable Resultados { get; set; } = null!;
    }

    private static async Task<Escenario> SembrarBaseAsync(TytedContext context, int empresaId = 1, bool incluirCuentaResultados = true)
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

        var caja = new CuentaContable
        {
            EmpresaId = empresaId, CodigoCuenta = "1.1.1.1.01", NombreCuenta = "Caja General",
            TipoCuenta = "Activo", Naturaleza = "D", EsMovimiento = true, Nivel = 5, Activa = true
        };
        var ventas = new CuentaContable
        {
            EmpresaId = empresaId, CodigoCuenta = "4.1.1", NombreCuenta = "Ventas",
            TipoCuenta = "Ingreso", Naturaleza = "C", EsMovimiento = true, Nivel = 3, Activa = true
        };
        var gastos = new CuentaContable
        {
            EmpresaId = empresaId, CodigoCuenta = "5.1.1", NombreCuenta = "Gastos de administración",
            TipoCuenta = "Gasto", Naturaleza = "D", EsMovimiento = true, Nivel = 3, Activa = true
        };

        context.PeriodosContables.Add(periodo);
        context.CuentasContables.AddRange(caja, ventas, gastos);

        CuentaContable? resultados = null;
        if (incluirCuentaResultados)
        {
            resultados = new CuentaContable
            {
                EmpresaId = empresaId, CodigoCuenta = ReportesContablesService.CodigoCuentaResultadosSituacion,
                NombreCuenta = "RESULTADOS DEL EJERCICIO",
                TipoCuenta = "Patrimonio", Naturaleza = "C", EsMovimiento = true, Nivel = 5, Activa = true
            };
            context.CuentasContables.Add(resultados);
        }

        await context.SaveChangesAsync();

        return new Escenario
        {
            EmpresaId = empresaId,
            Periodo = periodo,
            Caja = caja,
            Ventas = ventas,
            Gastos = gastos,
            Resultados = resultados!
        };
    }

    /// <summary>Registra un asiento diario sencillo (dos líneas) en el periodo.</summary>
    private static async Task RegistrarAsientoAsync(TytedContext context, Escenario e, CuentaContable cuentaDebe, decimal debe, CuentaContable cuentaHaber, decimal haber)
    {
        context.AsientosContables.Add(new AsientoContable
        {
            EmpresaId = e.EmpresaId,
            PeriodoContableId = e.Periodo.Id,
            NumeroComprobante = string.Empty,
            FechaComprobante = new DateTime(2026, 10, 7),
            Concepto = "Movimiento de prueba",
            TipoComprobante = "Diario",
            Estado = "Aprobado",
            UsuarioId = 1,
            Detalles = new List<AsientoDetalle>
            {
                new() { CuentaContableId = cuentaDebe.Id, Debe = debe, Haber = 0m },
                new() { CuentaContableId = cuentaHaber.Id, Debe = 0m, Haber = haber }
            }
        });
        await context.SaveChangesAsync();
    }

    [Fact]
    public async Task AsientoTemporal_TransladaUtilidadALaCuenta3103102_YRespetaPartidaDoble()
    {
        await using var context = CrearContexto();
        var e = await SembrarBaseAsync(context);
        // Utilidad: ventas 1.000 − gastos 300 = 700
        await RegistrarAsientoAsync(context, e, e.Caja, 1000m, e.Ventas, 1000m);
        await RegistrarAsientoAsync(context, e, e.Gastos, 300m, e.Caja, 300m);

        var service = new ReportesContablesService(context);
        var asiento = await service.GetAsientoTemporalSituacionFinancieraAsync(e.Periodo.Id, e.EmpresaId);

        Assert.True(asiento.CuentaResultadosEncontrada);
        Assert.Equal(ReportesContablesService.CodigoCuentaResultadosSituacion, asiento.CuentaResultadosCodigo);
        Assert.Equal(1000m, asiento.TotalIngresos);
        Assert.Equal(300m, asiento.TotalEgresos);
        Assert.Equal(700m, asiento.Resultado);
        Assert.True(asiento.EsUtilidad);
        Assert.Equal("Temporal", asiento.TipoComprobante);

        // Partida doble del asiento: la suma del debe coincide con la del haber
        Assert.Equal(asiento.Detalles.Sum(d => d.Debe), asiento.Detalles.Sum(d => d.Haber));

        // La línea final acredita el resultado en 3.1.3.1.02
        var lineaResultados = Assert.Single(asiento.Detalles, d => d.CuentaId == e.Resultados.Id);
        Assert.Equal(0m, lineaResultados.Debe);
        Assert.Equal(700m, lineaResultados.Haber);

        // NO se persiste: el libro mayor queda intacto (sólo los 2 asientos manuales)
        Assert.Equal(2, await context.AsientosContables.CountAsync());
        Assert.Equal(4, await context.AsientosDetalles.CountAsync());
    }

    [Fact]
    public async Task AsientoTemporal_PerdidaSeDebitaEnLaCuentaDeResultados()
    {
        await using var context = CrearContexto();
        var e = await SembrarBaseAsync(context);
        // Pérdida: ventas 300 − gastos 1.000 = −700
        await RegistrarAsientoAsync(context, e, e.Caja, 300m, e.Ventas, 300m);
        await RegistrarAsientoAsync(context, e, e.Gastos, 1000m, e.Caja, 1000m);

        var service = new ReportesContablesService(context);
        var asiento = await service.GetAsientoTemporalSituacionFinancieraAsync(e.Periodo.Id, e.EmpresaId);

        Assert.Equal(-700m, asiento.Resultado);
        Assert.False(asiento.EsUtilidad);

        var lineaResultados = Assert.Single(asiento.Detalles, d => d.CuentaId == e.Resultados.Id);
        Assert.Equal(700m, lineaResultados.Debe);
        Assert.Equal(0m, lineaResultados.Haber);
        Assert.Equal(asiento.Detalles.Sum(d => d.Debe), asiento.Detalles.Sum(d => d.Haber));
    }

    [Fact]
    public async Task AsientoTemporal_UsaSaldosArrastradosDePeriodosAnteriores()
    {
        await using var context = CrearContexto();
        var e = await SembrarBaseAsync(context);

        // Septiembre (periodo anterior): una venta que se arrastra a octubre
        var septiembre = new PeriodoContable
        {
            EmpresaId = 1, Anio = 2026, Mes = 9, Nombre = "Septiembre 2026",
            TipoPeriodo = "Mensual",
            FechaInicio = new DateTime(2026, 9, 1),
            FechaFin = new DateTime(2026, 9, 30, 23, 59, 59),
            Cerrado = false, Estado = "Abierto"
        };
        context.PeriodosContables.Add(septiembre);
        await context.SaveChangesAsync();

        await RegistrarAsientoAsync(context, e, e.Caja, 500m, e.Ventas, 500m);

        context.AsientosContables.Add(new AsientoContable
        {
            EmpresaId = e.EmpresaId,
            PeriodoContableId = septiembre.Id,
            NumeroComprobante = string.Empty,
            FechaComprobante = new DateTime(2026, 9, 15),
            Concepto = "Venta de septiembre",
            TipoComprobante = "Diario",
            Estado = "Aprobado",
            UsuarioId = 1,
            Detalles = new List<AsientoDetalle>
            {
                new() { CuentaContableId = e.Caja.Id, Debe = 200m, Haber = 0m },
                new() { CuentaContableId = e.Ventas.Id, Debe = 0m, Haber = 200m }
            }
        });
        await context.SaveChangesAsync();

        var service = new ReportesContablesService(context);
        var asiento = await service.GetAsientoTemporalSituacionFinancieraAsync(e.Periodo.Id, e.EmpresaId);

        // 500 de octubre + 200 arrastrados de septiembre = 700 de utilidad
        Assert.Equal(700m, asiento.TotalIngresos);
        Assert.Equal(700m, asiento.Resultado);
    }

    [Fact]
    public async Task AsientoTemporal_SinCuentaResultados_IndicaCuentaNoEncontradaPeroCalculaResultado()
    {
        await using var context = CrearContexto();
        var e = await SembrarBaseAsync(context, incluirCuentaResultados: false);
        await RegistrarAsientoAsync(context, e, e.Caja, 1000m, e.Ventas, 1000m);
        await RegistrarAsientoAsync(context, e, e.Gastos, 300m, e.Caja, 300m);

        var service = new ReportesContablesService(context);
        var asiento = await service.GetAsientoTemporalSituacionFinancieraAsync(e.Periodo.Id, e.EmpresaId);

        Assert.False(asiento.CuentaResultadosEncontrada);
        Assert.Equal(700m, asiento.Resultado);
        // Sin la cuenta destino no se aporta la línea de patrimonio (sólo el cierre de I/E)
        Assert.DoesNotContain(asiento.Detalles, d => d.CodigoCuenta == ReportesContablesService.CodigoCuentaResultadosSituacion);
    }

    [Fact]
    public async Task AsientoTemporal_TrasCierreReal_ResultadoCero_YReutilizaCuenta()
    {
        await using var context = CrearContexto();
        var e = await SembrarBaseAsync(context);
        await RegistrarAsientoAsync(context, e, e.Caja, 1000m, e.Ventas, 1000m);
        await RegistrarAsientoAsync(context, e, e.Gastos, 300m, e.Caja, 300m);

        // Cierre real del periodo: zera ingresos/egresos y acumula en 3.1.3.1.02
        var cierreService = new AsientoContableService(context);
        var cierre = await cierreService.GenerarAsientoCierreResultadosAsync(e.Periodo.Id, e.EmpresaId, 1);
        Assert.Equal(e.Resultados.Id, cierre.CuentaResultadosId);

        // El asiento temporal ya no aporta resultado (sería duplicar el cierre)
        var service = new ReportesContablesService(context);
        var asiento = await service.GetAsientoTemporalSituacionFinancieraAsync(e.Periodo.Id, e.EmpresaId);

        Assert.Equal(0m, asiento.Resultado);
        Assert.Empty(asiento.Detalles);
        Assert.True(asiento.CuentaResultadosEncontrada);
    }

    [Fact]
    public async Task AsientoTemporal_PeriodoInexistente_LanzaErrorControlado()
    {
        await using var context = CrearContexto();
        var service = new ReportesContablesService(context);

        var ex = await Assert.ThrowsAsync<InvalidOperationException>(
            () => service.GetAsientoTemporalSituacionFinancieraAsync(periodoId: 999, empresaId: 1));
        Assert.Contains("no existe", ex.Message);
    }

    [Fact]
    public async Task AsientoTemporal_PeriodoDeOtraEmpresa_LanzaErrorControlado()
    {
        await using var context = CrearContexto();
        var e = await SembrarBaseAsync(context, empresaId: 1);
        await RegistrarAsientoAsync(context, e, e.Caja, 1000m, e.Ventas, 1000m);

        var service = new ReportesContablesService(context);
        var ex = await Assert.ThrowsAsync<InvalidOperationException>(
            () => service.GetAsientoTemporalSituacionFinancieraAsync(e.Periodo.Id, empresaId: 2));
        Assert.Contains("no pertenece a la empresa", ex.Message);
    }
}