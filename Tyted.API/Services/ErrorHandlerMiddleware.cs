using System.Net;
using System.Text.Json;

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
                    UnauthorizedAccessException => (int)HttpStatusCode.Unauthorized, // 401
                    _ => (int)HttpStatusCode.InternalServerError, // 500 para el resto
                };

                _logger.LogError(error, "Error no controlado en el servidor: {Message}", error.Message);

                var result = JsonSerializer.Serialize(new 
                { 
                    message = error.Message,
                    status = response.StatusCode 
                });

                await response.WriteAsync(result);
            }
        }
    }
}