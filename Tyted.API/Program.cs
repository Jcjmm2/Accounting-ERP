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
var jwtKey = builder.Configuration["Jwt:Key"] ?? "TuClaveSuperSecretaDeAlMenos32Caracteres";
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
// 3. REGISTRO DE SERVICIOS (Agregado TasaService)
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

// =========================================================================
// 4. CONFIGURACIÓN CORS, CONTROLADORES Y OPENAPI (Antes del Build)
// =========================================================================
var MyAllowSpecificOrigins = "_myAllowSpecificOrigins";
QuestPDF.Settings.License = QuestPDF.Infrastructure.LicenseType.Community;
builder.Services.AddCors(options =>
{
    options.AddPolicy(name: MyAllowSpecificOrigins,
        policy =>
        {
            policy.WithOrigins("http://localhost:5173")
                  .AllowAnyHeader()
                  .AllowAnyMethod();
        });
});

builder.Services.AddControllers()
    .AddJsonOptions(options =>
    {
        options.JsonSerializerOptions.ReferenceHandler =
            System.Text.Json.Serialization.ReferenceHandler.IgnoreCycles;
    })
    .ConfigureApiBehaviorOptions(options =>
    {
        options.SuppressModelStateInvalidFilter = true;
    });

builder.Services.AddEndpointsApiExplorer();

// MOVIDO AQUÍ: Toda la configuración de OpenAPI debe estar ANTES de builder.Build()
builder.Services.AddOpenApi(options =>
{
    options.AddDocumentTransformer((document, context, cancellationToken) =>
    {
        document.Info.Title = "Tyted API";
        document.Info.Version = "v1";
        return Task.CompletedTask;
    });
});

// =========================================================================
// 5. CONSTRUCCIÓN DE LA APLICACIÓN
// =========================================================================
var app = builder.Build(); 


using (var scope = app.Services.CreateScope())
{
    var services = scope.ServiceProvider;
    try
    {
        var context = services.GetRequiredService<TytedContext>();
        DbInitializer.Initialize(context);
    }
    catch (Exception ex)
    {
        var logger = services.GetRequiredService<ILogger<Program>>();
        logger.LogError(ex, "Ocurrió un error al sembrar la base de datos.");
    }
}


// =========================================================================
// 6. MIDDLEWARES (Configuración del Pipeline)
// =========================================================================
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

//app.UseHttpsRedirection();
app.UseCors(MyAllowSpecificOrigins);

//app.UseAuthentication();
//app.UseAuthorization();

app.MapControllers();

app.Run();