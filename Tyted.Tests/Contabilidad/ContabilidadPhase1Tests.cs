using Microsoft.EntityFrameworkCore;
using Tyted.API.Data;
using Tyted.API.Models;
using Tyted.API.Services;

namespace Tyted.Tests.Contabilidad;

public class ContabilidadPhase1Tests
{
    [Fact]
    public async Task CrearAsiento_EnPeriodoCerrado_DevuelveError()
    {
        var options = new DbContextOptionsBuilder<TytedContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;

        await using var context = new TytedContext(options);
        var periodo = new PeriodoContable
        {
            EmpresaId = 1,
            Anio = 2026,
            Mes = 10,
            FechaInicio = new DateTime(2026, 10, 1),
            FechaFin = new DateTime(2026, 10, 31),
            Cerrado = true,
            Estado = "Cerrado"
        };

        var cuentaDebe = new CuentaContable
        {
            EmpresaId = 1,
            CodigoCuenta = "1.1.1",
            NombreCuenta = "Caja",
            TipoCuenta = "Activo",
            Naturaleza = "D",
            EsMovimiento = true,
            Nivel = 3,
            Activa = true
        };

        var cuentaHaber = new CuentaContable
        {
            EmpresaId = 1,
            CodigoCuenta = "2.1.1",
            NombreCuenta = "Cuentas por pagar",
            TipoCuenta = "Pasivo",
            Naturaleza = "C",
            EsMovimiento = true,
            Nivel = 3,
            Activa = true
        };

        context.PeriodosContables.Add(periodo);
        context.CuentasContables.AddRange(cuentaDebe, cuentaHaber);
        await context.SaveChangesAsync();

        var service = new AsientoContableService(context);

        var asiento = new AsientoContable
        {
            EmpresaId = 1,
            PeriodoContableId = periodo.Id,
            NumeroComprobante = "TEST-001",
            FechaComprobante = new DateTime(2026, 10, 15),
            Concepto = "Validación de cierre",
            TipoComprobante = "Diario",
            Estado = "Aprobado",
            UsuarioId = 1,
            Detalles = new List<AsientoDetalle>
            {
                new() { CuentaContableId = cuentaDebe.Id, Debe = 100m, Haber = 0m },
                new() { CuentaContableId = cuentaHaber.Id, Debe = 0m, Haber = 100m }
            }
        };

        await Assert.ThrowsAsync<InvalidOperationException>(() => service.CrearAsientoAsync(asiento));
    }

    [Fact]
    public async Task ObtenerBalanceComprobacion_DevuelveTotalesPorCuenta()
    {
        var options = new DbContextOptionsBuilder<TytedContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;

        await using var context = new TytedContext(options);

        var periodo = new PeriodoContable
        {
            EmpresaId = 1,
            Anio = 2026,
            Mes = 10,
            FechaInicio = new DateTime(2026, 10, 1),
            FechaFin = new DateTime(2026, 10, 31),
            Cerrado = false,
            Estado = "Abierto"
        };

        var cuentaDebe = new CuentaContable
        {
            EmpresaId = 1,
            CodigoCuenta = "1.1.1",
            NombreCuenta = "Caja",
            TipoCuenta = "Activo",
            Naturaleza = "D",
            EsMovimiento = true,
            Nivel = 3,
            Activa = true
        };

        var cuentaHaber = new CuentaContable
        {
            EmpresaId = 1,
            CodigoCuenta = "2.1.1",
            NombreCuenta = "Proveedor",
            TipoCuenta = "Pasivo",
            Naturaleza = "C",
            EsMovimiento = true,
            Nivel = 3,
            Activa = true
        };

        var asiento = new AsientoContable
        {
            EmpresaId = 1,
            PeriodoContableId = 0,
            NumeroComprobante = "TEST-002",
            FechaComprobante = new DateTime(2026, 10, 5),
            Concepto = "Apertura",
            TipoComprobante = "Diario",
            Estado = "Aprobado",
            UsuarioId = 1,
            Detalles = new List<AsientoDetalle>
            {
                new() { CuentaContableId = 0, Debe = 250m, Haber = 0m },
                new() { CuentaContableId = 0, Debe = 0m, Haber = 250m }
            }
        };

        context.PeriodosContables.Add(periodo);
        context.CuentasContables.AddRange(cuentaDebe, cuentaHaber);
        await context.SaveChangesAsync();

        asiento.PeriodoContableId = periodo.Id;
        asiento.Detalles.First().CuentaContableId = cuentaDebe.Id;
        asiento.Detalles.Last().CuentaContableId = cuentaHaber.Id;

        context.AsientosContables.Add(asiento);
        await context.SaveChangesAsync();

        var service = new ReportesContablesService(context);
        var balance = await service.GetBalanceComprobacionAsync(periodo.Id);

        Assert.NotNull(balance);
        Assert.NotEmpty(balance);
        Assert.Contains(balance, item => item.CuentaId == cuentaDebe.Id && item.TotalDebe == 250m && item.TotalHaber == 0m);
        Assert.Contains(balance, item => item.CuentaId == cuentaHaber.Id && item.TotalDebe == 0m && item.TotalHaber == 250m);
    }
}
