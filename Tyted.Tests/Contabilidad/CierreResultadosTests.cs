using Microsoft.EntityFrameworkCore;
using Tyted.API.Data;
using Tyted.API.Models;
using Tyted.API.Services;

namespace Tyted.Tests.Contabilidad;

/// <summary>
/// Pruebas del asiento de cierre de resultados: traslada la utilidad (Haber)
/// o la pérdida (Debe) a una cuenta de patrimonio "Resultados del ejercicio",
/// zera las cuentas de ingresos/egresos y respeta la partida doble.
/// </summary>
public class CierreResultadosTests
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
    }

    private static async Task<Escenario> SembrarBaseAsync(TytedContext context, int empresaId = 1)
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
        var capital = new CuentaContable
        {
            EmpresaId = empresaId, CodigoCuenta = "3.1.1", NombreCuenta = "Capital social",
            TipoCuenta = "Patrimonio", Naturaleza = "C", EsMovimiento = true, Nivel = 3, Activa = true
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
        context.CuentasContables.AddRange(caja, capital, ventas, gastos);
        await context.SaveChangesAsync();

        return new Escenario { EmpresaId = empresaId, Periodo = periodo, Caja = caja, Ventas = ventas, Gastos = gastos };
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
    public async Task Cierre_TransladaUtilidadAPatrimonio_YZeraCuentasDeResultado()
    {
        await using var context = CrearContexto();
        var e = await SembrarBaseAsync(context);
        // Venta 1.000 y gasto 300 => utilidad 700
        await RegistrarAsientoAsync(context, e, e.Caja, 1000m, e.Ventas, 1000m);
        await RegistrarAsientoAsync(context, e, e.Gastos, 300m, e.Caja, 300m);

        var service = new AsientoContableService(context);
        var r = await service.GenerarAsientoCierreResultadosAsync(e.Periodo.Id, e.EmpresaId, 1, "tester");

        Assert.True(r.AsientoId > 0);
        Assert.True(r.EsUtilidad);
        Assert.Equal(700m, r.Resultado);
        Assert.Equal(1000m, r.TotalIngresos);
        Assert.Equal(300m, r.TotalEgresos);
        Assert.True(r.CuentaResultadosCreada); // La cuenta se creó automáticamente
        Assert.Contains("RESULTADO", r.CuentaResultadosNombre.ToUpperInvariant());
        Assert.Equal(3, r.CantidadDetalles);   // Ventas + Gastos + Resultados

        // Partida doble y tipo "Cierre" con concepto del sistema
        var asiento = await context.AsientosContables
            .Include(a => a.Detalles)
            .FirstAsync(a => a.Id == r.AsientoId);
        Assert.Equal("Cierre", asiento.TipoComprobante);
        Assert.StartsWith(AsientoContableService.PrefijoCierreResultados, asiento.Concepto);
        Assert.Equal(asiento.TotalDebe, asiento.TotalHaber);
        Assert.Equal(1000m, asiento.TotalDebe); // 1.000 ventas = 300 gastos + 700 resultados

        // Tras el cierre: ingresos/egresos en cero y el resultado en patrimonio
        var balance = await new ReportesContablesService(context).GetBalanceComprobacionAsync(e.Periodo.Id);
        Assert.Equal(0m, balance.First(b => b.CuentaId == e.Ventas.Id).SaldoFinal);
        Assert.Equal(0m, balance.First(b => b.CuentaId == e.Gastos.Id).SaldoFinal);
        Assert.Equal(700m, balance.First(b => b.CuentaId == r.CuentaResultadosId).SaldoFinal);
        Assert.Equal(700m, balance.First(b => b.CuentaId == e.Caja.Id).SaldoFinal);
    }

    [Fact]
    public async Task Cierre_TransladaPerdida_PorDebitoAPatrimonio()
    {
        await using var context = CrearContexto();
        var e = await SembrarBaseAsync(context);
        // Venta 200 y gasto 500 => pérdida 300
        await RegistrarAsientoAsync(context, e, e.Caja, 200m, e.Ventas, 200m);
        await RegistrarAsientoAsync(context, e, e.Gastos, 500m, e.Caja, 500m);

        var service = new AsientoContableService(context);
        var r = await service.GenerarAsientoCierreResultadosAsync(e.Periodo.Id, e.EmpresaId, 1);

        Assert.False(r.EsUtilidad);
        Assert.Equal(-300m, r.Resultado);

        var detalleResultados = await context.AsientosDetalles
            .FirstAsync(d => d.AsientoContableId == r.AsientoId && d.CuentaContableId == r.CuentaResultadosId);
        Assert.Equal(300m, detalleResultados.Debe); // La pérdida se debita a patrimonio
        Assert.Equal(0m, detalleResultados.Haber);
    }

    [Fact]
    public async Task Cierre_RechazaPeriodoCerrado_YPeriodoDeOtraEmpresa()
    {
        await using var context = CrearContexto();
        var e = await SembrarBaseAsync(context);
        await RegistrarAsientoAsync(context, e, e.Caja, 1000m, e.Ventas, 1000m);

        var service = new AsientoContableService(context);

        // Periodo cerrado
        e.Periodo.Cerrado = true;
        e.Periodo.Estado = "Cerrado";
        await context.SaveChangesAsync();
        var exPeriodo = await Assert.ThrowsAsync<InvalidOperationException>(() =>
            service.GenerarAsientoCierreResultadosAsync(e.Periodo.Id, e.EmpresaId, 1));
        Assert.Contains("periodo cerrado", exPeriodo.Message);

        // Periodo que no pertenece a la empresa activa
        e.Periodo.Cerrado = false;
        e.Periodo.Estado = "Abierto";
        await context.SaveChangesAsync();
        var exEmpresa = await Assert.ThrowsAsync<InvalidOperationException>(() =>
            service.GenerarAsientoCierreResultadosAsync(e.Periodo.Id, 99, 1));
        Assert.Contains("no pertenece a la empresa", exEmpresa.Message);
    }

    [Fact]
    public async Task Cierre_SinSaldoEnResultados_LanzaError()
    {
        await using var context = CrearContexto();
        var e = await SembrarBaseAsync(context);
        // Sólo movimientos de activo/patrimonio: no hay resultado que cerrar
        var capital = await context.CuentasContables.FirstAsync(c => c.CodigoCuenta == "3.1.1");
        await RegistrarAsientoAsync(context, e, e.Caja, 500m, capital, 500m);

        var service = new AsientoContableService(context);
        var ex = await Assert.ThrowsAsync<InvalidOperationException>(() =>
            service.GenerarAsientoCierreResultadosAsync(e.Periodo.Id, e.EmpresaId, 1));
        Assert.Contains("saldo", ex.Message);
    }

    [Fact]
    public async Task Cierre_SegundaVez_Rechaza_SinRegenerar_YReemplaza_ConRegenerar()
    {
        await using var context = CrearContexto();
        var e = await SembrarBaseAsync(context);
        await RegistrarAsientoAsync(context, e, e.Caja, 1000m, e.Ventas, 1000m);
        await RegistrarAsientoAsync(context, e, e.Gastos, 300m, e.Caja, 300m);

        var service = new AsientoContableService(context);
        var primero = await service.GenerarAsientoCierreResultadosAsync(e.Periodo.Id, e.EmpresaId, 1);

        // Sin regenerar: lo rechaza
        var ex = await Assert.ThrowsAsync<InvalidOperationException>(() =>
            service.GenerarAsientoCierreResultadosAsync(e.Periodo.Id, e.EmpresaId, 1));
        Assert.Contains("Regenerar", ex.Message);

        // Con regenerar: reemplaza el cierre previo (nunca duplica)
        var segundo = await service.GenerarAsientoCierreResultadosAsync(e.Periodo.Id, e.EmpresaId, 1, regenerar: true);
        Assert.NotEqual(primero.AsientoId, segundo.AsientoId);

        var cierres = await context.AsientosContables
            .CountAsync(a => a.PeriodoContableId == e.Periodo.Id && a.TipoComprobante == "Cierre");
        Assert.Equal(1, cierres);
        Assert.Equal(700m, segundo.Resultado);
    }

    [Fact]
    public async Task Cierre_ReutilizaCuentaDeResultadosExistente()
    {
        await using var context = CrearContexto();
        var e = await SembrarBaseAsync(context);
        await RegistrarAsientoAsync(context, e, e.Caja, 1000m, e.Ventas, 1000m);
        await RegistrarAsientoAsync(context, e, e.Gastos, 300m, e.Caja, 300m);

        // La empresa ya tiene una cuenta de patrimonio de resultados
        var resultadosPrevios = new CuentaContable
        {
            EmpresaId = e.EmpresaId, CodigoCuenta = "3.1.9", NombreCuenta = "Resultados acumulados",
            TipoCuenta = "Patrimonio", Naturaleza = "C", EsMovimiento = true, Nivel = 3, Activa = true
        };
        context.CuentasContables.Add(resultadosPrevios);
        await context.SaveChangesAsync();

        var service = new AsientoContableService(context);
        var r = await service.GenerarAsientoCierreResultadosAsync(e.Periodo.Id, e.EmpresaId, 1);

        Assert.False(r.CuentaResultadosCreada);
        Assert.Equal(resultadosPrevios.Id, r.CuentaResultadosId);
    }
}

