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
        Assert.Equal("Acreedora", guardada.Naturaleza);
        Assert.False(guardada.Activa);
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
}

