using Microsoft.EntityFrameworkCore;
using Tyted.API.Data;
using Tyted.API.Models;
using Tyted.API.Services;

namespace Tyted.Tests;

// Pruebas de la actualización del plan de cuentas (PUT /cuentas/{id}).
// Regresión principal: el modo edición NO debe INSERTAR la cuenta con el Id
// explícito (error 544 de SQL Server: "Cannot insert explicit value for
// identity column" -> HTTP 400 en el navegador).
public class PlanCuentasServiceTests
{
    private static TytedContext CreateContext()
    {
        var options = new DbContextOptionsBuilder<TytedContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;

        return new TytedContext(options);
    }

    private static CuentaContable NuevaCuenta(string codigo = "1.1.01", string nombre = "Caja General") => new()
    {
        EmpresaId = 1,
        CodigoCuenta = codigo,
        NombreCuenta = nombre,
        TipoCuenta = "Activo",
        Naturaleza = "Deudora",
        EsMovimiento = true,
        Nivel = 5,
        PadreCuentaId = null,
        AceptaTerceros = false,
        AceptaCentroCosto = false,
        Activa = true
    };

    [Fact]
    public async Task ActualizarCuenta_ModificaLaCuentaSinInsertarOtra()
    {
        await using var context = CreateContext();
        var service = new PlanCuentasService(context);
        var creada = await service.CrearCuentaAsync(NuevaCuenta());

        var datos = NuevaCuenta("1.1.02", "Caja Chica");
        datos.Naturaleza = "Acreedora";
        datos.Activa = false;

        var actualizada = await service.ActualizarCuentaAsync(creada.Id, datos);

        // El Id (columna identidad) no cambia y no se creó un segundo registro
        Assert.Equal(creada.Id, actualizada.Id);
        Assert.Equal(1, await context.CuentasContables.CountAsync());

        var guardada = await context.CuentasContables.SingleAsync();
        Assert.Equal("1.1.02", guardada.CodigoCuenta);
        Assert.Equal("Caja Chica", guardada.NombreCuenta);
        // El formulario envía "Acreedora": se guarda normalizada como "C".
        Assert.Equal("C", guardada.Naturaleza);
        Assert.False(guardada.Activa);
    }

    [Theory]
    [InlineData("Deudora", "D")]
    [InlineData("deudora", "D")]
    [InlineData("D", "D")]
    [InlineData("Acreedora", "C")]
    [InlineData("acreedora", "C")]
    [InlineData("C", "C")]
    [InlineData("  Acreedora  ", "C")]
    public async Task CrearCuenta_NormalizaLaNaturalezaADoC(string entrada, string esperada)
    {
        await using var context = CreateContext();
        var service = new PlanCuentasService(context);
        var cuenta = NuevaCuenta("5.2.1.1.25", "Reparaciones");
        cuenta.Naturaleza = entrada;

        var creada = await service.CrearCuentaAsync(cuenta);

        Assert.Equal(esperada, creada.Naturaleza);
        Assert.Equal(esperada, (await context.CuentasContables.SingleAsync()).Naturaleza);
    }

    [Theory]
    [InlineData("")]
    [InlineData("   ")]
    [InlineData("Neutra")]
    public async Task CrearCuenta_NaturalezaInvalida_LanzaInvalidOperationException(string entrada)
    {
        await using var context = CreateContext();
        var service = new PlanCuentasService(context);
        var cuenta = NuevaCuenta();
        cuenta.Naturaleza = entrada;

        var excepcion = await Assert.ThrowsAsync<InvalidOperationException>(
            () => service.CrearCuentaAsync(cuenta));

        Assert.Contains("aturaleza", excepcion.Message);
        Assert.Equal(0, await context.CuentasContables.CountAsync());
    }

    [Fact]
    public async Task ActualizarCuenta_SinNaturalezaEnElPayload_ConservaYNormalizaLaActual()
    {
        await using var context = CreateContext();
        var service = new PlanCuentasService(context);
        // Cuenta con el formato histórico del formulario antiguo
        context.CuentasContables.Add(NuevaCuenta("5.2.1.1.25", "Reparaciones"));
        await context.SaveChangesAsync();
        var existente = await context.CuentasContables.SingleAsync();

        var datos = NuevaCuenta("5.2.1.1.25", "Reparaciones y mantenimiento");
        datos.Naturaleza = "";

        var actualizada = await service.ActualizarCuentaAsync(existente.Id, datos);

        Assert.Equal("D", actualizada.Naturaleza);
    }

    [Fact]
    public async Task ActualizarCuenta_AplicaElPayloadSinCambiarElId()
    {
        await using var context = CreateContext();
        var service = new PlanCuentasService(context);
        var creada = await service.CrearCuentaAsync(NuevaCuenta());

        // Payload equivalente al que envía la UI en modo edición (sin Id)
        var datos = NuevaCuenta("1.1.03", "Bancos");

        var actualizada = await service.ActualizarCuentaAsync(creada.Id, datos);

        Assert.Equal(creada.Id, actualizada.Id);
        Assert.Equal("1.1.03", actualizada.CodigoCuenta);
        Assert.Equal("Bancos", actualizada.NombreCuenta);
        Assert.Equal(1, await context.CuentasContables.CountAsync());
    }

    [Fact]
    public async Task ActualizarCuenta_CuentaInexistente_LanzaKeyNotFound()
    {
        await using var context = CreateContext();
        var service = new PlanCuentasService(context);

        await Assert.ThrowsAsync<KeyNotFoundException>(
            () => service.ActualizarCuentaAsync(999, NuevaCuenta()));
    }

    [Fact]
    public async Task ActualizarCuenta_SinCodigo_LanzaInvalidOperationException()
    {
        await using var context = CreateContext();
        var service = new PlanCuentasService(context);
        var creada = await service.CrearCuentaAsync(NuevaCuenta());

        var datos = NuevaCuenta("   ", "Sin código");

        var excepcion = await Assert.ThrowsAsync<InvalidOperationException>(
            () => service.ActualizarCuentaAsync(creada.Id, datos));

        Assert.Contains("código", excepcion.Message);
    }

    [Fact]
    public async Task ActualizarCuenta_SinNombre_LanzaInvalidOperationException()
    {
        await using var context = CreateContext();
        var service = new PlanCuentasService(context);
        var creada = await service.CrearCuentaAsync(NuevaCuenta());

        var datos = NuevaCuenta("1.1.01", "   ");

        var excepcion = await Assert.ThrowsAsync<InvalidOperationException>(
            () => service.ActualizarCuentaAsync(creada.Id, datos));

        Assert.Contains("nombre", excepcion.Message);
    }

    [Fact]
    public async Task ActualizarCuenta_CodigoDuplicadoEnLaEmpresa_LanzaInvalidOperationException()
    {
        await using var context = CreateContext();
        var service = new PlanCuentasService(context);
        await service.CrearCuentaAsync(NuevaCuenta("1.1.01", "Caja General"));
        var segunda = await service.CrearCuentaAsync(NuevaCuenta("1.1.02", "Bancos"));

        var datos = NuevaCuenta("1.1.01", "Caja General (renombre)");
        var excepcion = await Assert.ThrowsAsync<InvalidOperationException>(
            () => service.ActualizarCuentaAsync(segunda.Id, datos));

        Assert.Contains("Ya existe", excepcion.Message);
        // La cuenta original conserva su código
        var seguardada = await context.CuentasContables.SingleAsync(c => c.Id == segunda.Id);
        Assert.Equal("1.1.02", seguardada.CodigoCuenta);
    }

    [Fact]
    public async Task ActualizarCuenta_PadreInexistente_LanzaInvalidOperationException()
    {
        await using var context = CreateContext();
        var service = new PlanCuentasService(context);
        var creada = await service.CrearCuentaAsync(NuevaCuenta());

        var datos = NuevaCuenta();
        datos.PadreCuentaId = 999;

        await Assert.ThrowsAsync<InvalidOperationException>(
            () => service.ActualizarCuentaAsync(creada.Id, datos));
    }

    [Fact]
    public async Task EliminarAsientoCierre_AnulaElAsientoSinBorrarloFisicamente()
    {
        await using var context = CreateContext();
        var service = new AsientoContableService(context);

        var periodo = new PeriodoContable
        {
            EmpresaId = 1,
            Anio = 2026,
            Mes = 11,
            TipoPeriodo = "Mensual",
            Nombre = "Noviembre 2026",
            FechaInicio = new DateTime(2026, 11, 1),
            FechaFin = new DateTime(2026, 11, 30),
            Estado = "Abierto",
            Cerrado = false
        };
        context.PeriodosContables.Add(periodo);
        await context.SaveChangesAsync();

        var asiento = new AsientoContable
        {
            EmpresaId = 1,
            PeriodoContableId = periodo.Id,
            OrigenGeneracion = OrigenGeneracionAsiento.CierreResultados,
            NumeroComprobante = "26110000001",
            FechaComprobante = new DateTime(2026, 11, 30),
            Concepto = "CIERRE DE RESULTADOS Noviembre 2026: traslado de utilidad por 1000.00 a la cuenta 3.99 - RESULTADOS DEL EJERCICIO",
            TipoComprobante = "Cierre",
            Estado = "Aprobado",
            UsuarioId = 1,
            TotalDebe = 1_000m,
            TotalHaber = 1_000m,
            Detalles = new List<AsientoDetalle>
            {
                new AsientoDetalle { CuentaContableId = 1, Debe = 1_000m, Haber = 0m },
                new AsientoDetalle { CuentaContableId = 2, Debe = 0m, Haber = 1_000m }
            }
        };
        context.AsientosContables.Add(asiento);
        context.AuditoriasContables.Add(new AuditoriaContable
        {
            Fecha = DateTime.Now,
            Usuario = "Sistema",
            Accion = "Creación de asiento",
            Detalle = "Prueba",
            AsientoContableId = asiento.Id
        });
        await context.SaveChangesAsync();

        var eliminado = await service.EliminarAsientoAsync(asiento.Id, 1, "admin");

        Assert.True(eliminado);
        Assert.Equal(1, await context.AsientosContables.CountAsync());
        Assert.Equal("Anulado", (await context.AsientosContables.SingleAsync()).Estado);
        Assert.Equal(2, await context.AuditoriasContables.CountAsync());
    }

    [Fact]
    public async Task ActualizarCuenta_ConservaLosCamposEstructuralesQueEnviaElCliente()
    {
        await using var context = CreateContext();
        var service = new PlanCuentasService(context);

        var titulo = NuevaCuenta("1", "ACTIVO");
        titulo.EsMovimiento = false;
        titulo.Nivel = 1;
        var creado = await service.CrearCuentaAsync(titulo);

        // La UI envía nivel/tipo/movimiento conservados de la cuenta original
        var datos = NuevaCuenta("1", "ACTIVO GENERAL");
        datos.EsMovimiento = false;
        datos.Nivel = 1;

        var actualizada = await service.ActualizarCuentaAsync(creado.Id, datos);

        Assert.Equal("ACTIVO GENERAL", actualizada.NombreCuenta);
        Assert.Equal(1, actualizada.Nivel);
        Assert.False(actualizada.EsMovimiento);
        Assert.Equal("Activo", actualizada.TipoCuenta);
    }

    [Fact]
    public async Task GenerarAsientoCierreResultados_EligeCuentaPatrimonioDeMovimiento_NoTitulo()
    {
        await using var context = CreateContext();
        var service = new AsientoContableService(context);

        var periodo = new PeriodoContable
        {
            EmpresaId = 1,
            Anio = 2026,
            Mes = 1,
            Nombre = "Enero 2026",
            TipoPeriodo = "Mensual",
            FechaInicio = new DateTime(2026, 1, 1),
            FechaFin = new DateTime(2026, 1, 31),
            Estado = "Abierto",
            Cerrado = false
        };
        context.PeriodosContables.Add(periodo);
        await context.SaveChangesAsync();

        var tituloPatrimonio = new CuentaContable
        {
            EmpresaId = 1,
            CodigoCuenta = "3",
            NombreCuenta = "PATRIMONIO",
            TipoCuenta = "Patrimonio",
            Naturaleza = "C",
            EsMovimiento = false,
            Nivel = 1,
            AceptaTerceros = false,
            AceptaCentroCosto = false,
            Activa = true
        };
        context.CuentasContables.Add(tituloPatrimonio);
        await context.SaveChangesAsync();

        var cuentaPatrimonioMovimiento = new CuentaContable
        {
            EmpresaId = 1,
            CodigoCuenta = "3.1.1",
            NombreCuenta = "Capital social",
            TipoCuenta = "Patrimonio",
            Naturaleza = "C",
            EsMovimiento = true,
            Nivel = 3,
            PadreCuentaId = tituloPatrimonio.Id,
            AceptaTerceros = false,
            AceptaCentroCosto = false,
            Activa = true
        };

        var ingreso = new CuentaContable
        {
            EmpresaId = 1,
            CodigoCuenta = "4.1.1",
            NombreCuenta = "Ingresos por servicios",
            TipoCuenta = "Ingreso",
            Naturaleza = "C",
            EsMovimiento = true,
            Nivel = 3,
            AceptaTerceros = true,
            AceptaCentroCosto = true,
            Activa = true
        };

        var gasto = new CuentaContable
        {
            EmpresaId = 1,
            CodigoCuenta = "5.1.1",
            NombreCuenta = "Gastos operativos",
            TipoCuenta = "Gasto",
            Naturaleza = "D",
            EsMovimiento = true,
            Nivel = 3,
            AceptaTerceros = true,
            AceptaCentroCosto = true,
            Activa = true
        };

        context.CuentasContables.AddRange(cuentaPatrimonioMovimiento, ingreso, gasto);
        await context.SaveChangesAsync();

        context.AsientosContables.Add(new AsientoContable
        {
            EmpresaId = 1,
            PeriodoContableId = periodo.Id,
            OrigenGeneracion = OrigenGeneracionAsiento.Manual,
            NumeroComprobante = "DIA-001",
            FechaComprobante = new DateTime(2026, 1, 15),
            Concepto = "Ingreso enero",
            TipoComprobante = "Diario",
            Estado = "Aprobado",
            UsuarioId = 1,
            Detalles = new List<AsientoDetalle>
            {
                new() { CuentaContableId = ingreso.Id, Debe = 0m, Haber = 500m },
                new() { CuentaContableId = gasto.Id, Debe = 100m, Haber = 0m }
            }
        });
        await context.SaveChangesAsync();

        var cierre = await service.GenerarAsientoCierreResultadosAsync(periodo.Id, 1, 1, "Sistema");

        var cuentaResultado = await context.CuentasContables.SingleAsync(c => c.Id == cierre.CuentaResultadosId);
        Assert.NotEqual(tituloPatrimonio.Id, cierre.CuentaResultadosId);
        Assert.Equal("RESULTADOS DEL EJERCICIO", cuentaResultado.NombreCuenta);
        Assert.True(cuentaResultado.EsMovimiento);
        Assert.NotEqual("PATRIMONIO", cuentaResultado.TipoCuenta);
    }
}

