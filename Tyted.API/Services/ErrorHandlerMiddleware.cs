using System.Net;
using System.Text.Json;
using Tyted.API.Services;

namespace Tyted.API.Middleware
{
    public class ErrorHandlerMiddleware
    {
        private readonly RequestDelegate _next;
        private readonly ILogger<ErrorHandlerMiddleware> _logger;

        public ErrorHandlerMiddleware(RequestDelegate next, ILogger<ErrorHandlerMiddleware> logger)
        {
            _next = next;
            _logger = logger;
        }

        public async Task Invoke(HttpContext context)
        {
            try
            {
                await _next(context);
            }
            catch (Exception error)
            {
                var response = context.Response;
                response.ContentType = "application/json";

                // Diferenciamos el tipo de error para asignar el StatusCode
                response.StatusCode = error switch
                {
                    KeyNotFoundException => (int)HttpStatusCode.NotFound, // 404
                    ForbiddenAccessException => (int)HttpStatusCode.Forbidden, // 403 (autorización por empresa)
                    UnauthorizedAccessException => (int)HttpStatusCode.Unauthorized, // 401
                    _ => (int)HttpStatusCode.InternalServerError, // 500 para el resto
                };

                _logger.LogError(error, "Error no controlado en el servidor: {Message}", error.Message);

                // En PRODUCCIÓN la respuesta es genérica: nunca se filtran detalles
                // internos (mensajes de EF/Npgsql, rutas, archivos) al cliente. El
                // mensaje real queda solo en el log del servidor.
                var esDesarrollo = context.RequestServices
                    .GetService<IWebHostEnvironment>()?.IsDevelopment() == true;
                var mensaje = esDesarrollo
                    ? error.Message
                    : "Se produjo un error interno en el servidor. Intente de nuevo o contacte al administrador.";

                var result = JsonSerializer.Serialize(new 
                { 
                    message = mensaje,
                    status = response.StatusCode 
                });

                await response.WriteAsync(result);
            }
        }
    }
}