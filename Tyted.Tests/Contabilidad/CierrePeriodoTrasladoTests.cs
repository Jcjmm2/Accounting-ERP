using Microsoft.EntityFrameworkCore;
using Tyted.API.Data;
using Tyted.API.Models;
using Tyted.API.Services;

namespace Tyted.Tests.Contabilidad;

/// <summary>
/// Pruebas de seguridad financiera de los periodos contables:
/// - Periodo de apertura de la empresa: no se permiten periodos anteriores ni
///   solapamientos parciales (se permite el anidamiento anual↔mensual).
/// - Periodos cerrados no editables.
/// - Cierre con TRASLADO de saldos: asiento «APERTURA DE BALANCE» en el
///   periodo siguiente con activo, pasivo y patrimonio, de partida doble, sin
///   duplicar saldos (modelo de exclusión simple) y con orden cronológico.
/// - Reabrir queda bloqueado cuando ya existen traspasos posteriores.
/// </summary>
public class CierrePeriodoTrasladoTests
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
        public PeriodoContable Octubre { get; set; } = null!;
        public PeriodoContable Noviembre { get; set; } = null!;
        public CuentaContable Caja { get; set; } = null!;
        public CuentaContable Capital { get; set; } = null!;
        public CuentaContable Resultados { get; set; } = null!;
        public CuentaContable Ventas { get; set; } = null!;
        public CuentaContable Gastos { get; set; } = null!;
    }

    private static PeriodoContable CrearMes(int anio, int mes, string nombre, bool cerrado = false) => new()
    {
        EmpresaId = 1,
        Anio = anio,
        Mes = mes,
        TipoPeriodo = "Mensual",
        Nombre = nombre,
        FechaInicio = new DateTime(anio, mes, 1),
        FechaFin = new DateTime(anio, mes, DateTime.DaysInMonth(anio, mes), 23, 59, 59),
        Estado = cerrado ? "Cerrado" : "Abierto",
        Cerrado = cerrado
    };

    /// <summary>
    /// Octubre 2026 (primer periodo = apertura de la empresa) y, opcionalmente,
    /// Noviembre 2026 como periodo siguiente que recibe el traslado. Plan con
    /// cuentas reales (caja, capital, resultados 3.1.3.1.02) y de resultado
    /// (ventas, gastos).
    /// </summary>
    private static async Task<Escenario> SembrarBaseAsync(TytedContext context, bool incluirNoviembre = true)
    {
        var octubre = CrearMes(2026, 10, "Octubre 2026");
        context.PeriodosContables.Add(octubre);

        PeriodoContable? noviembre = null;
        if (incluirNoviembre)
        {
            noviembre = CrearMes(2026, 11, "Noviembre 2026");
            context.PeriodosContables.Add(noviembre);
        }

        var caja = new CuentaContable
        {
            EmpresaId = 1, CodigoCuenta = "1.1.1.1.01", NombreCuenta = "Caja General",
            TipoCuenta = "Activo", Naturaleza = "D", EsMovimiento = true, Nivel = 5, Activa = true
        };
        var capital = new CuentaContable
        {
            EmpresaId = 1, CodigoCuenta = "3.1.1.1.01", NombreCuenta = "Capital Social en Acciones",
            TipoCuenta = "Patrimonio", Naturaleza = "C", EsMovimiento = true, Nivel = 5, Activa = true
        };
        var resultados = new CuentaContable
        {
            EmpresaId = 1, CodigoCuenta = "3.1.3.1.02", NombreCuenta = "RESULTADOS DEL EJERCICIO",
            TipoCuenta = "Patrimonio", Naturaleza = "C", EsMovimiento = true, Nivel = 5, Activa = true
        };
        var ventas = new CuentaContable
        {
            EmpresaId = 1, CodigoCuenta = "4.1.1", NombreCuenta = "Ventas",
            TipoCuenta = "Ingreso", Naturaleza = "C", EsMovimiento = true, Nivel = 3, Activa = true
        };
        var gastos = new CuentaContable
        {
            EmpresaId = 1, CodigoCuenta = "5.1.1", NombreCuenta = "Gastos de administración",
            TipoCuenta = "Gasto", Naturaleza = "D", EsMovimiento = true, Nivel = 3, Activa = true
        };

        context.CuentasContables.AddRange(caja, capital, resultados, ventas, gastos);
        await context.SaveChangesAsync();

        return new Escenario
        {
            EmpresaId = 1,
            Octubre = octubre,
            Noviembre = noviembre!,
            Caja = caja,
            Capital = capital,
            Resultados = resultados,
            Ventas = ventas,
            Gastos = gastos
        };
    }

    private static async Task RegistrarAsync(TytedContext context, Escenario e, DateTime fecha, CuentaContable cuentaDebe, decimal debe, CuentaContable cuentaHaber, decimal haber)
    {
        context.AsientosContables.Add(new AsientoContable
        {
            EmpresaId = e.EmpresaId,
            PeriodoContableId = e.Octubre.Id,
            NumeroComprobante = string.Empty,
            FechaComprobante = fecha,
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

    // ---------------------------------------------------------------------------
    // PERIODO DE APERTURA Y SOLAPAMIENTOS
    // ---------------------------------------------------------------------------

    [Fact]
    public async Task CrearPeriodo_AnteriorAlaApertura_SeRechaza()
    {
        await using var context = CrearContexto();
        await SembrarBaseAsync(context); // Octubre 2026 es la apertura de la empresa

        var service = new PeriodoContableService(context, new AsientoContableService(context));
        var ex = await Assert.ThrowsAsync<InvalidOperationException>(() =>
            service.CrearPeriodoAsync(new PeriodoContable
            {
                EmpresaId = 1,
                Anio = 2025,
                Mes = 12,
                TipoPeriodo = "Mensual",
                Nombre = "Diciembre 2025",
                FechaInicio = new DateTime(2025, 12, 1),
                FechaFin = new DateTime(2025, 12, 31, 23, 59, 59),
                Estado = "Abierto"
            }));

        Assert.Contains("periodo de apertura", ex.Message);
    }

    [Fact]
    public async Task CrearPeriodo_SolapamientoParcial_SeRechaza_YAnidamientoAnualMensualSePermite()
    {
        await using var context = CrearContexto();

        // El ejercicio anual 2026 es el primer periodo (apertura)
        var anual = new PeriodoContable
        {
            EmpresaId = 1,
            Anio = 2026,
            Mes = null,
            TipoPeriodo = "Anual",
            Nombre = "Ejercicio Fiscal 2026",
            FechaInicio = new DateTime(2026, 1, 1),
            FechaFin = new DateTime(2026, 12, 31, 23, 59, 59),
            Estado = "Abierto",
            Cerrado = false
        };
        context.PeriodosContables.Add(anual);
        await context.SaveChangesAsync();

        var service = new PeriodoContableService(context, new AsientoContableService(context));

        // Mensual contenido en el anual (jerarquía): permitido
        var marzo = await service.CrearPeriodoAsync(new PeriodoContable
        {
            EmpresaId = 1,
            Anio = 2026,
            Mes = 3,
            TipoPeriodo = "Mensual",
            Nombre = "Marzo 2026",
            FechaInicio = new DateTime(2026, 3, 1),
            FechaFin = new DateTime(2026, 3, 31, 23, 59, 59),
            Estado = "Abierto"
        });
        Assert.True(marzo.Id > 0);

        // Solapamiento PARCIAL con marzo (15/03 – 30/04): rechazado
        var ex = await Assert.ThrowsAsync<InvalidOperationException>(() =>
            service.CrearPeriodoAsync(new PeriodoContable
            {
                EmpresaId = 1,
                Anio = 2026,
                Mes = 4,
                TipoPeriodo = "Mensual",
                Nombre = "Abril extendido",
                FechaInicio = new DateTime(2026, 3, 15),
                FechaFin = new DateTime(2026, 4, 30, 23, 59, 59),
                Estado = "Abierto"
            }));
        Assert.Contains("solapan", ex.Message);
    }

    [Fact]
    public async Task ModificarPeriodo_Cerrado_O_AnteriorAApertura_SeRechaza()
    {
        await using var context = CrearContexto();
        var e = await SembrarBaseAsync(context, incluirNoviembre: false);

        var service = new PeriodoContableService(context, new AsientoContableService(context));
        var dto = new PeriodoContable
        {
            EmpresaId = 1,
            Anio = 2026,
            Mes = 10,
            TipoPeriodo = "Mensual",
            Nombre = "Octubre 2026 (editado)",
            FechaInicio = new DateTime(2026, 10, 1),
            FechaFin = new DateTime(2026, 10, 31, 23, 59, 59)
        };

        // 1) Periodo cerrado (aunque no tenga asientos) no es editable
        e.Octubre.Cerrado = true;
        e.Octubre.Estado = "Cerrado";
        await context.SaveChangesAsync();

        var exCerrado = await Assert.ThrowsAsync<InvalidOperationException>(
            () => service.ModificarPeriodoAsync(e.Octubre.Id, dto));
        Assert.Contains("CERRADO", exCerrado.Message);

        // 2) Ni siquiera el periodo de apertura puede retrocederse
        e.Octubre.Cerrado = false;
        e.Octubre.Estado = "Abierto";
        await context.SaveChangesAsync();

        dto.FechaInicio = new DateTime(2025, 10, 1);
        dto.FechaFin = new DateTime(2025, 10, 31, 23, 59, 59);
        var exApertura = await Assert.ThrowsAsync<InvalidOperationException>(
            () => service.ModificarPeriodoAsync(e.Octubre.Id, dto));
        Assert.Contains("periodo de apertura", exApertura.Message);
    }

    // ---------------------------------------------------------------------------
    // CIERRE CON TRASLADO DE SALDOS
    // ---------------------------------------------------------------------------

    [Fact]
    public async Task CerrarPeriodo_GeneraAperturaBalanceada_YNoDuplicaSaldos()
    {
        await using var context = CrearContexto();
        var e = await SembrarBaseAsync(context);

        // Capital inicial + operación del periodo (caja: 500 + 1000 − 300 = 1200)
        await RegistrarAsync(context, e, new DateTime(2026, 10, 2), e.Caja, 500m, e.Capital, 500m);
        await RegistrarAsync(context, e, new DateTime(2026, 10, 7), e.Caja, 1000m, e.Ventas, 1000m);
        await RegistrarAsync(context, e, new DateTime(2026, 10, 15), e.Gastos, 300m, e.Caja, 300m);

        // El flujo exige el Cierre de Resultados previo (utilidad 700)
        var cierreService = new AsientoContableService(context);
        await cierreService.GenerarAsientoCierreResultadosAsync(e.Octubre.Id, e.EmpresaId, 1);

        var service = new PeriodoContableService(context, new AsientoContableService(context));
        var r = await service.CerrarPeriodoAsync(e.Octubre.Id, "tester", trasladarSaldos: true, usuarioId: 1);

        Assert.True(r.Cerrado);
        Assert.True(r.TrasladoGenerado);
        Assert.Equal(1200m, r.TotalDebe);   // caja 1200 = capital 500 + resultados 700
        Assert.Equal(1200m, r.TotalHaber);
        Assert.Equal(3, r.CuentasTrasladadas);
        Assert.Equal("Noviembre 2026", r.PeriodoDestinoNombre);

        // El asiento de apertura vive en noviembre con fecha de inicio de noviembre
        var apertura = await context.AsientosContables
            .Include(a => a.Detalles)
            .SingleAsync(a => a.PeriodoContableId == e.Noviembre.Id && a.TipoComprobante == "Apertura");
        Assert.StartsWith(AsientoContableService.PrefijoAperturaBalance, apertura.Concepto);
        Assert.Equal(new DateTime(2026, 11, 1), apertura.FechaComprobante.Date);
        Assert.Equal(3, apertura.Detalles.Count);
        Assert.Equal(apertura.Detalles.Sum(d => d.Debe), apertura.Detalles.Sum(d => d.Haber));

        // ANTI-DOBLE-CONTEO: el traspaso se excluye de los cálculos de saldo:
        // el balance de noviembre es idéntico al de antes de cerrar octubre.
        var reportes = new ReportesContablesService(context);
        var balance = await reportes.GetBalanceComprobacionAsync(e.Noviembre.Id, e.EmpresaId);
        var filaCaja = Assert.Single(balance, b => b.CuentaId == e.Caja.Id);
        Assert.Equal(1200m, filaCaja.SaldoInicial);
        Assert.Equal(0m, filaCaja.MovimientoDebe);
        Assert.Equal(0m, filaCaja.MovimientoHaber);
        Assert.Equal(1200m, filaCaja.SaldoFinal);
    }

    [Fact]
    public async Task CerrarPeriodo_SinCierreDeResultados_SeRechaza()
    {
        await using var context = CrearContexto();
        var e = await SembrarBaseAsync(context);
        await RegistrarAsync(context, e, new DateTime(2026, 10, 7), e.Caja, 1000m, e.Ventas, 1000m);

        var service = new PeriodoContableService(context, new AsientoContableService(context));
        var ex = await Assert.ThrowsAsync<InvalidOperationException>(
            () => service.CerrarPeriodoAsync(e.Octubre.Id));

        Assert.Contains("Cierre de Resultados", ex.Message);
    }

    [Fact]
    public async Task CerrarPeriodo_SinPeriodoSiguiente_SeRechaza()
    {
        await using var context = CrearContexto();
        var e = await SembrarBaseAsync(context, incluirNoviembre: false);

        var service = new PeriodoContableService(context, new AsientoContableService(context));
        var ex = await Assert.ThrowsAsync<InvalidOperationException>(
            () => service.CerrarPeriodoAsync(e.Octubre.Id));

        Assert.Contains("periodo siguiente", ex.Message);
    }

    [Fact]
    public async Task CerrarPeriodo_PeriodoAnteriorAbierto_SeRechaza()
    {
        await using var context = CrearContexto();
        var e = await SembrarBaseAsync(context);

        // Septiembre (apertura real) queda abierto: cerrar octubre rompería el orden
        var septiembre = CrearMes(2026, 9, "Septiembre 2026");
        context.PeriodosContables.Add(septiembre);
        await context.SaveChangesAsync();

        var service = new PeriodoContableService(context, new AsientoContableService(context));
        var ex = await Assert.ThrowsAsync<InvalidOperationException>(
            () => service.CerrarPeriodoAsync(e.Octubre.Id));

        Assert.Contains("anteriores", ex.Message);
    }

    [Fact]
    public async Task AbrirPeriodo_ConTraspasoPosterior_SeRechaza()
    {
        await using var context = CrearContexto();
        var e = await SembrarBaseAsync(context);
        await RegistrarAsync(context, e, new DateTime(2026, 10, 2), e.Caja, 500m, e.Capital, 500m);

        // Sin movimientos de ingresos/egresos no hace falta cierre de resultados
        var service = new PeriodoContableService(context, new AsientoContableService(context));
        await service.CerrarPeriodoAsync(e.Octubre.Id);

        var ex = await Assert.ThrowsAsync<InvalidOperationException>(
            () => service.AbrirPeriodoAsync(e.Octubre.Id));
        Assert.Contains("apertura de balance", ex.Message);
    }

    [Fact]
    public async Task CerrarPeriodo_ReemplazaAperturaPreviaDelDestino_NuncaDuplica()
    {
        await using var context = CrearContexto();
        var e = await SembrarBaseAsync(context);
        await RegistrarAsync(context, e, new DateTime(2026, 10, 2), e.Caja, 500m, e.Capital, 500m);

        // Traspaso previo del sistema en noviembre (de otra corrida/anterior)
        context.AsientosContables.Add(new AsientoContable
        {
            EmpresaId = e.EmpresaId,
            PeriodoContableId = e.Noviembre.Id,
            NumeroComprobante = "TEST-PREVIA",
            FechaComprobante = new DateTime(2026, 11, 1),
            Concepto = $"{AsientoContableService.PrefijoAperturaBalance} de una corrida anterior",
            TipoComprobante = "Apertura",
            Estado = "Aprobado",
            UsuarioId = 1,
            Detalles = new List<AsientoDetalle>
            {
                new() { CuentaContableId = e.Caja.Id, Debe = 999m, Haber = 0m },
                new() { CuentaContableId = e.Capital.Id, Debe = 0m, Haber = 999m }
            }
        });
        await context.SaveChangesAsync();

        var service = new PeriodoContableService(context, new AsientoContableService(context));
        var r = await service.CerrarPeriodoAsync(e.Octubre.Id);

        Assert.True(r.TrasladoGenerado);

        // Queda UN SOLO traspaso del sistema en noviembre, con los saldos nuevos
        var aperturas = await context.AsientosContables
            .Include(a => a.Detalles)
            .Where(a => a.PeriodoContableId == e.Noviembre.Id
                && a.TipoComprobante == "Apertura"
                && a.Concepto.StartsWith(AsientoContableService.PrefijoAperturaBalance))
            .ToListAsync();
        var unica = Assert.Single(aperturas);
        Assert.Equal(2, unica.Detalles.Count);
        Assert.Equal(500m, unica.Detalles.Single(d => d.CuentaContableId == e.Caja.Id).Debe);
    }

    // ---------------------------------------------------------------------------
    // ELIMINACIÓN DE PERIODOS (corrección de periodos antiguos erróneos)
    // ---------------------------------------------------------------------------

    [Fact]
    public async Task EliminarPeriodo_Vacio_SeElimina_YReAnclaElPeriodoDeApertura()
    {
        await using var context = CrearContexto();
        var e = await SembrarBaseAsync(context); // Octubre y Noviembre 2026 vacíos

        var service = new PeriodoContableService(context, new AsientoContableService(context));

        // Eliminar noviembre: octubre queda como nuevo periodo de apertura
        var r1 = await service.EliminarPeriodoAsync(e.Noviembre.Id, "tester");
        Assert.Equal(0, r1.SubperiodosEliminados);
        Assert.Equal("Octubre 2026", r1.NuevoPeriodoAperturaNombre);
        Assert.False(await context.PeriodosContables.AnyAsync(p => p.Id == e.Noviembre.Id));

        // Eliminar octubre (antiguo periodo erróneo): la empresa queda sin
        // periodos y el siguiente en crearse será la nueva apertura
        var r2 = await service.EliminarPeriodoAsync(e.Octubre.Id, "tester");
        Assert.Equal(string.Empty, r2.NuevoPeriodoAperturaNombre);
        Assert.Equal(0, await context.PeriodosContables.CountAsync(p => p.EmpresaId == 1));

        // Auditoría registrada
        Assert.Equal(2, await context.AuditoriasContables.CountAsync(a => a.Accion == "Eliminación de periodo"));
    }

    [Fact]
    public async Task EliminarPeriodo_ConAsientos_SeRechaza()
    {
        await using var context = CrearContexto();
        var e = await SembrarBaseAsync(context);
        await RegistrarAsync(context, e, new DateTime(2026, 10, 7), e.Caja, 100m, e.Capital, 100m);

        var service = new PeriodoContableService(context, new AsientoContableService(context));
        var ex = await Assert.ThrowsAsync<InvalidOperationException>(
            () => service.EliminarPeriodoAsync(e.Octubre.Id));

        Assert.Contains("asientos", ex.Message);
        Assert.True(await context.PeriodosContables.AnyAsync(p => p.Id == e.Octubre.Id));
    }

    [Fact]
    public async Task EliminarEjercicioAnual_ConAsientoEnHijo_SeRechaza_YVacioSeEliminaEnCascada()
    {
        await using var context = CrearContexto();
        var e = await SembrarBaseAsync(context); // apertura: Octubre 2026

        var service = new PeriodoContableService(context, new AsientoContableService(context));
        var anual2027 = await service.CrearEjercicioFiscalCompletoAsync(1, 2027);
        Assert.Equal(12, await context.PeriodosContables.CountAsync(p => p.Anio == 2027 && p.Mes != null));

        // Un asiento en Enero 2027 bloquea la eliminación del ejercicio completo
        var enero = await context.PeriodosContables.FirstAsync(p => p.Anio == 2027 && p.Mes == 1);
        context.AsientosContables.Add(new AsientoContable
        {
            EmpresaId = 1,
            PeriodoContableId = enero.Id,
            NumeroComprobante = "TEST-2701",
            FechaComprobante = new DateTime(2027, 1, 5),
            Concepto = "Movimiento de prueba en enero",
            TipoComprobante = "Diario",
            Estado = "Aprobado",
            UsuarioId = 1,
            Detalles = new List<AsientoDetalle>
            {
                new() { CuentaContableId = e.Caja.Id, Debe = 50m, Haber = 0m },
                new() { CuentaContableId = e.Capital.Id, Debe = 0m, Haber = 50m }
            }
        });
        await context.SaveChangesAsync();

        var ex = await Assert.ThrowsAsync<InvalidOperationException>(
            () => service.EliminarPeriodoAsync(anual2027.Id));
        Assert.Contains("asientos", ex.Message);

        // Sin el asiento: se elimina el ejercicio y sus 12 meses en cascada
        var asiento = await context.AsientosContables.SingleAsync(a => a.NumeroComprobante == "TEST-2701");
        context.AsientosContables.Remove(asiento);
        await context.SaveChangesAsync();

        var r = await service.EliminarPeriodoAsync(anual2027.Id, "tester");
        Assert.Equal(12, r.SubperiodosEliminados);
        Assert.Equal(0, await context.PeriodosContables.CountAsync(p => p.Anio == 2027));
        Assert.Equal("Octubre 2026", r.NuevoPeriodoAperturaNombre);
    }
}