using DotNet.Testcontainers.Builders;
using Microsoft.EntityFrameworkCore;
using Testcontainers.PostgreSql;
using Tyted.API.Data;
using Tyted.API.Services;

namespace Tyted.Tests.Integracion.Postgres;

/// <summary>
/// Fixture xUnit (una por colección) que levanta un PostgreSQL 18 EFÍMERO con
/// Testcontainers, aplica las migraciones del proveedor Npgsql y ejecuta la
/// semilla idempotente (DbInitializer.SembrarDatosIniciales). Es el sitial de
/// validación de la Fase 3: los unitarios siguen en InMemory; ESTA suite
/// comprueba que las traducciones reales del proveedor (numeric, timestamp
/// without time zone, identity, índices filtrados, LIKE con StartsWith, …)
/// funcionan contra un motor PostgreSQL de verdad, con el mismo image que usará
/// producción (postgres:18-alpine).
/// </summary>
public sealed class PostgresFixture : IAsyncLifetime
{
    static PostgresFixture()
    {
        // ANTES de la primera operación Npgsql del proceso de tests: conserva la
        // semántica naive de DateTime heredada de SQL Server (columnas
        // timestamp without time zone, escritura/lectura sin conversión a UTC).
        // Es el mismo switch que activa la API en Program.cs.
        AppContext.SetSwitch("Npgsql.EnableLegacyTimestampBehavior", true);
    }

    private readonly PostgreSqlContainer _container = new PostgreSqlBuilder()
        .WithImage("postgres:18-alpine")
        // Timeout generoso: la PRIMERA ejecución en una máquina descarga la
        // imagen y el arranque de PostgreSQL puede superar el default (30 s).
        .WithWaitStrategy(Wait.ForUnixContainer()
            .UntilCommandIsCompleted("pg_isready -U postgres", ws => ws.WithTimeout(TimeSpan.FromMinutes(3))))
        .Build();

    /// <summary>Cadena de conexión al contenedor efímero (por si un test la necesita).</summary>
    public string ConnectionString => _container.GetConnectionString();

    public async Task InitializeAsync()
    {
        await _container.StartAsync();

        // Esquema + datos base exactamente como los haría la API al arrancar.
        await using var context = CrearContexto();
        await context.Database.MigrateAsync();
        DbInitializer.SembrarDatosIniciales(context);
    }

    public async Task DisposeAsync() => await _container.DisposeAsync();

    /// <summary>
    /// Nuevo contexto EF contra el contenedor. Cada test usa el SUYO (patrón
    /// scope de DI de la API) para que no haya change-tracker compartido.
    /// </summary>
    public TytedContext CrearContexto()
    {
        var options = new DbContextOptionsBuilder<TytedContext>()
            .UseNpgsql(_container.GetConnectionString())
            .Options;

        return new TytedContext(options);
    }
}

/// <summary>
/// Colección compartida: todos los tests marcados con [Collection(Nombre)]
/// corren secuenciales contra el MISMO contenedor (xUnit no paraleliza dentro
/// de una colección), evitando el costo de levantar un PostgreSQL por test.
/// </summary>
[CollectionDefinition(Nombre)]
public class PostgresCollection : ICollectionFixture<PostgresFixture>
{
    public const string Nombre = "Postgres";
}