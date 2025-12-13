using Microsoft.EntityFrameworkCore;
using Tyted.API.Data; // Asumiendo que TytedContext está en la carpeta Data

var builder = WebApplication.CreateBuilder(args);

// =========================================================================
// 1. REGISTRO DEL CONTEXTO DE LA BASE DE DATOS (DbContext)
// =========================================================================
builder.Services.AddDbContext<TytedContext>(options =>
{
    // Obtiene la cadena de conexión llamada "DefaultConnection" del archivo appsettings.json
    var connectionString = builder.Configuration.GetConnectionString("DefaultConnection");
    
    // Configura Entity Framework Core para usar SQL Server con esa cadena de conexión
    options.UseSqlServer(connectionString);
});


// =========================================================================


// <-- AÑADIDO: CONFIGURACIÓN CORS (1/2: Definición de la Política)
var MyAllowSpecificOrigins = "_myAllowSpecificOrigins"; 

builder.Services.AddCors(options =>
{
    options.AddPolicy(name: MyAllowSpecificOrigins,
                      policy =>
                      {
                          // **IMPORTANTE: Permitir peticiones desde el puerto de React**
                          policy.WithOrigins("http://localhost:5173") 
                                .AllowAnyHeader()
                                .AllowAnyMethod(); // Permitir verbos GET, POST, DELETE, etc.
                      });
});
// =========================================================================


// Add services to the container.
builder.Services.AddControllers()
    .AddJsonOptions(options =>
    {
        // ESTO EVITA LOS ERRORES DE REFERENCIA CÍCLICA
        options.JsonSerializerOptions.ReferenceHandler = 
            System.Text.Json.Serialization.ReferenceHandler.IgnoreCycles;
    }); 
// Learn more about configuring Swagger/OpenAPI at https://aka.ms/aspnetcore/swashbuckle
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();

var app = builder.Build();

// Configure the HTTP request pipeline.
if (app.Environment.IsDevelopment())
{
    // Habilita Swagger UI para probar la API automáticamente en desarrollo
    app.UseSwagger();
    app.UseSwaggerUI();
}

app.UseHttpsRedirection();

// <-- AÑADIDO: CONFIGURACIÓN CORS (2/2: Uso de la Política)
// DEBE IR ANTES de app.UseAuthorization() y app.MapControllers()
app.UseCors(MyAllowSpecificOrigins); 

app.UseAuthorization();

// Mapea los controladores (como ProveedoresController) a sus rutas API
app.MapControllers();

app.Run();