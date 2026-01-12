using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Tyted.API.Data;
using Tyted.API.Models;
using System.Text.Json.Serialization;

namespace Tyted.API.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class TasaDeCambioController : ControllerBase
    {
        private readonly TytedContext _context;

        public TasaDeCambioController(TytedContext context)
        {
            _context = context;
        }

        private DateTime GetVenezuelaTime()
        {
            TimeZoneInfo tz;
            try { tz = TimeZoneInfo.FindSystemTimeZoneById("Venezuela Standard Time"); }
            catch { tz = TimeZoneInfo.FindSystemTimeZoneById("America/Caracas"); }
            return TimeZoneInfo.ConvertTimeFromUtc(DateTime.UtcNow, tz);
        }

        [HttpGet]
        public async Task<ActionResult<IEnumerable<TasaDeCambio>>> GetHistorial()
        {
            return await _context.TasaDeCambio.OrderByDescending(t => t.FechaVigencia).ToListAsync();
        }

        [HttpPost("registrar-nueva-tasa")]
        public async Task<IActionResult> RegistrarTasa([FromBody] TasaRegistroDTO modelo)
        {
            // Validación de entrada para evitar registros en cero
            if (modelo == null || modelo.ValorTasa <= 0) 
                return BadRequest("Tasa inválida");

            var nuevaTasa = new TasaDeCambio
            {
                Tasa = modelo.ValorTasa,
                FactorSugerido = modelo.ValorTasa,
                FechaVigencia = GetVenezuelaTime(),
                NombreTasa = modelo.NombreTasa ?? "General",
                // DINÁMICO: Ahora guarda "1.00", "0.78" o "0.63" según el frontend
                MonedaOrigen = modelo.MonedaOrigen ?? "USD", 
                MonedaDestino = modelo.MonedaDestino ?? "VES",
                UsuarioRegistro = modelo.Usuario ?? "Admin_POS"
            };

            _context.TasaDeCambio.Add(nuevaTasa);
            await _context.SaveChangesAsync();

            // Solo sincronizamos el inventario completo si la tasa es la base USDT
            if (nuevaTasa.NombreTasa.ToUpper() == "USDT")
            {
                await SincronizarPreciosVes(nuevaTasa.Tasa);
            }

            return Ok(new { 
                valor = nuevaTasa.Tasa, 
                nombre = nuevaTasa.NombreTasa,
                origen = nuevaTasa.MonedaOrigen 
            });
        }

        [HttpGet("ultima")]
        public async Task<IActionResult> GetUltimaTasa()
        {
            var tasaActual = await _context.TasaDeCambio
                .Where(t => t.Tasa > 0 && t.NombreTasa == "USDT") // Priorizamos USDT como base
                .OrderByDescending(t => t.FechaVigencia)
                .FirstOrDefaultAsync();

            if (tasaActual == null) return Ok(new { valor = 1.0m });

            return Ok(new { valor = tasaActual.Tasa, fecha = tasaActual.FechaVigencia });
        }

        [HttpGet("comparativa-compras")]
        public async Task<IActionResult> GetComparativa()
        {
            try 
            {
                var listaTasas = await _context.TasaDeCambio
                    .Where(t => t.Tasa > 0)
                    .OrderByDescending(t => t.FechaVigencia)
                    .Take(15)
                    .ToListAsync();

                if (listaTasas == null || !listaTasas.Any()) return Ok(new List<object>());

                var resultado = listaTasas.Select(t => new {
                    idTasa = t.IdTasa,
                    nombreTasa = string.IsNullOrEmpty(t.NombreTasa) ? "General" : t.NombreTasa,
                    tasa = t.Tasa,
                    fecha = t.FechaVigencia.ToString("dd/MM/yyyy hh:mm tt")
                });

                return Ok(resultado);
            }
            catch (Exception ex)
            {
                return StatusCode(500, $"Error interno: {ex.Message}");
            }
        }

        private async Task SincronizarPreciosVes(decimal tasa)
        {
            var unidades = await _context.ProductosUnidad.ToListAsync();
            foreach (var u in unidades)
            {
                u.CostoUnitarioMonedaExt = u.CostoUnitarioMonedaBase * tasa;
                u.PrecioMonedaExt = Math.Round((u.PrecioMonedaBase ?? 0) * tasa, 2);
                if (u.Precio2MonedaBase.HasValue)
                    u.Precio2MonedaExt = Math.Round(u.Precio2MonedaBase.Value * tasa, 2);
                if (u.Precio3MonedaBase.HasValue)
                    u.Precio3MonedaExt = Math.Round(u.Precio3MonedaBase.Value * tasa, 2);
            }
            await _context.SaveChangesAsync();
        }
    }

    public class TasaRegistroDTO
    {
        [JsonPropertyName("valorTasa")]
    public decimal ValorTasa { get; set; }

    [JsonPropertyName("nombreTasa")]
    public string? NombreTasa { get; set; }

    [JsonPropertyName("monedaOrigen")] // Campo nuevo para la proporción
    public string? MonedaOrigen { get; set; }

    [JsonPropertyName("monedaDestino")]
    public string? MonedaDestino { get; set; }

    [JsonPropertyName("usuario")]
    public string? Usuario { get; set; }
    }
}