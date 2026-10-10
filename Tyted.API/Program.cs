using Microsoft.EntityFrameworkCore;
using Tyted.API.Data; 
using Tyted.API.Services;
using System.Globalization;
using Microsoft.AspNetCore.Localization;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.IdentityModel.Tokens;
using System.Text;
using Scalar.AspNetCore;
using QuestPDF.Infrastructure;

var builder = WebApplication.CreateBuilder(args);

// =========================================================================
// 1. REGISTRO DEL CONTEXTO DE LA BASE DE DATOS
// =========================================================================
builder.Services.AddDbContext<TytedContext>(options =>
{
    var connectionString = builder.Configuration.GetConnectionString("DefaultConnection");
    options.UseSqlServer(connectionString);
});

// =========================================================================
// 2. CONFIGURACIÓN DE AUTENTICACIÓN JWT
// =========================================================================
var jwtKey = builder.Configuration["Jwt:Key"];
if (string.IsNullOrWhiteSpace(jwtKey) || jwtKey.Length < 32)
{
    throw new InvalidOperationException(
        "Falta 'Jwt:Key' o es demasiado corta (mínimo 32 caracteres). " +
        "Por seguridad NO se guarda en appsettings.json (ese archivo va en git). " +
        "Configúrala con: dotnet user-secrets set \"Jwt:Key\" \"<clave aleatoria de 48+ caracteres>\" " +
        "o con la variable de entorno Jwt__Key.");
}
var keyBytes = Encoding.UTF8.GetBytes(jwtKey);

builder.Services.AddAuthentication(options =>
{
    options.DefaultAuthenticateScheme = JwtBearerDefaults.AuthenticationScheme;
    options.DefaultChallengeScheme = JwtBearerDefaults.AuthenticationScheme;
})
.AddJwtBearer(options =>
{
    options.TokenValidationParameters = new TokenValidationParameters
    {
        ValidateIssuerSigningKey = true,
        IssuerSigningKey = new SymmetricSecurityKey(keyBytes),
        ValidateIssuer = false,
        ValidateAudience = false,
        ClockSkew = TimeSpan.Zero
    };
});

// =========================================================================
// 3. REGISTRO DE SERVICIOS
// =========================================================================
builder.Services.AddScoped<CompraService>();
builder.Services.AddScoped<VentaService>();
builder.Services.AddScoped<ConfigService>();
builder.Services.AddScoped<CorrelativoService>();
builder.Services.AddScoped<TasaService>(); 
builder.Services.AddScoped<PedidoService>();
builder.Services.AddScoped<NotaEntregaService>();
builder.Services.AddScoped<IReportService, ReportService>();
builder.Services.AddScoped<EstadisticasService>();
builder.Services.AddScoped<PlanCuentasService>();
builder.Services.AddScoped<AsientoContableService>();
builder.Services.AddScoped<PeriodoContableService>();
builder.Services.AddScoped<ReportesContablesService>();
// Integración administrativo-contable (plan BE-F4): mapping de cuentas VEN-NIF
// para el motor de asientos automáticos de ventas y compras. Se lee de
// appsettings.json → "Contabilidad:Mapping" con defaults del plan base.
builder.Services.AddSingleton(
    builder.Configuration.GetSection("Contabilidad:Mapping").Get<MappingContable>() ?? new MappingContable());
builder.Services.AddScoped<MotorAsientosAutomaticos>();
// Fiscal F2: retenciones de IVA emitidas con correlativo SENIAT
builder.Services.AddScoped<RetencionIvaService>();

// =========================================================================
// 4. CONFIGURACIÓN CORS (Actualizada)
// =========================================================================
QuestPDF.Settings.License = QuestPDF.Infrastructure.LicenseType.Community;
builder.Services.AddControllers()
    .AddJsonOptions(options =>
    {
        // 1. Evita errores de ciclos infinitos en relaciones anidadas (Pedido -> Detalle -> Producto)
        options.JsonSerializerOptions.ReferenceHandler = System.Text.Json.Serialization.ReferenceHandler.IgnoreCycles;
        
        // 2. Hace que no importe si el JSON viene como "descripcion" o "Descripcion"
        options.JsonSerializerOptions.PropertyNameCaseInsensitive = true;
        
        // 3. (Opcional) Mantiene las mayúsculas/minúsculas tal cual están en C# 
        // options.JsonSerializerOptions.PropertyNamingPolicy = null; 
    })
    .ConfigureApiBehaviorOptions(options =>
    {
        options.SuppressModelStateInvalidFilter = true;
    });

builder.Services.AddEndpointsApiExplorer();
builder.Services.AddOpenApi(options =>
{
    options.AddDocumentTransformer((document, context, cancellationToken) =>
    {
        document.Info.Title = "Tyted API";
        document.Info.Version = "v1";
        return Task.CompletedTask;
    });
});

// Orígenes permitidos leídos de la configuración (appsettings.json o variables de entorno:
// AllowedOrigins__0, AllowedOrigins__1, ...). Nunca se combina un origen abierto con
// AllowCredentials: eso permitiría a cualquier sitio hacer peticiones autenticadas.
var allowedOrigins = builder.Configuration.GetSection("AllowedOrigins").Get<string[]>() ?? Array.Empty<string>();
if (allowedOrigins.Length == 0)
{
    throw new InvalidOperationException(
        "No hay orígenes CORS configurados. Define la sección 'AllowedOrigins' en appsettings.json " +
        "o usa variables de entorno (ej: AllowedOrigins__0=http://localhost:5173).");
}

builder.Services.AddCors(options =>
{
    options.AddPolicy("TytedPolicy", policy =>
    {
        policy.WithOrigins(allowedOrigins)
              .AllowAnyMethod()
              .AllowAnyHeader()
              .SetPreflightMaxAge(TimeSpan.FromMinutes(10));
    });
});


var app = builder.Build(); 

// Inicialización de DB
using (var scope = app.Services.CreateScope())
{
    var services = scope.ServiceProvider;
    try
    {
        var context = services.GetRequiredService<TytedContext>();
        DbInitializer.Initialize(context, app.Environment.IsDevelopment());
    }
    catch (Exception ex)
    {
        var logger = services.GetRequiredService<ILogger<Program>>();
        logger.LogError(ex, "Ocurrió un error al sembrar la base de datos.");
    }
}

// =========================================================================
// 6. MIDDLEWARES (Orden de ejecución crítico)
// =========================================================================

// Localización
var defaultCulture = new CultureInfo("en-US");
var localizationOptions = new RequestLocalizationOptions
{
    DefaultRequestCulture = new RequestCulture(defaultCulture),
    SupportedCultures = new List<CultureInfo> { defaultCulture },
    SupportedUICultures = new List<CultureInfo> { defaultCulture }
};
app.UseRequestLocalization(localizationOptions);

if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
    app.MapScalarApiReference(options => 
    {
        options.WithTitle("Tyted API - Gestión en Dólares")
               .WithTheme(ScalarTheme.Moon)
               .WithDefaultHttpClient(ScalarTarget.CSharp, ScalarClient.HttpClient);
    });
}

// 1. CORS debe ir antes que cualquier ruta o autorización
app.UseCors("TytedPolicy");


// 2. Autenticación y Autorización (Descoméntalos si vas a usar seguridad JWT)
app.UseAuthentication();
app.UseAuthorization();

// 3. Mapeo de Controladores
app.MapControllers();

app.Run();