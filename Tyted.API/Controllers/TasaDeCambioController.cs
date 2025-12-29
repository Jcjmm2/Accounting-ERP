using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
//using Microsoft.AspNetCore.Authorization;
using Tyted.API.Data;
using Tyted.API.Models;
using System.Text.Json.Serialization; // Agrega este using arriba

namespace Tyted.API.Controllers
{
    [Route("api/[controller]")]
    //[Authorize(Roles = "AdministradorSistema,Administrador,Analista")]
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

        //[HttpGet("Vigente")]
        //public async Task<ActionResult<TasaDeCambio>> GetTasaVigente()
        //{
        //    var tasaVigente = await _context.TasaDeCambio
        //        .OrderByDescending(t => t.FechaVigencia)
        //        .FirstOrDefaultAsync();

        //    if (tasaVigente == null)
        //    {
        //        return Ok(new TasaDeCambio { 
        //            Tasa = 1.0m, 
        //           FactorSugerido = 1.0m,
        //            FechaVigencia = GetVenezuelaTime(), 
        //            MonedaOrigen = "USD", 
        //            MonedaDestino = "VES" 
        //        });
        //    }
        //    return tasaVigente;
        //}

        [HttpGet]
        public async Task<ActionResult<IEnumerable<TasaDeCambio>>> GetHistorial()
        {
            return await _context.TasaDeCambio.OrderByDescending(t => t.FechaVigencia).ToListAsync();
        }

        //[HttpPost]
        //public async Task<ActionResult<TasaDeCambio>> PostTasaDeCambio(TasaDeCambio tasaDeCambio)
        //{
        //    tasaDeCambio.FechaVigencia = GetVenezuelaTime();
        //    if (string.IsNullOrEmpty(tasaDeCambio.MonedaOrigen)) tasaDeCambio.MonedaOrigen = "USD";
        //    if (string.IsNullOrEmpty(tasaDeCambio.MonedaDestino)) tasaDeCambio.MonedaDestino = "VES";

            // Si no envían factor sugerido, usamos la tasa base por defecto
        //    if (!tasaDeCambio.FactorSugerido.HasValue) tasaDeCambio.FactorSugerido = tasaDeCambio.Tasa;

        //    _context.TasaDeCambio.Add(tasaDeCambio);
        //    await _context.SaveChangesAsync();

            // Sincronizar usando el Factor Sugerido (Tasa de venta)
        //    await SincronizarPreciosVes(tasaDeCambio.FactorSugerido.Value);

            // Importante: El CreatedAtAction debe coincidir con el nombre del método
        //    return CreatedAtAction(nameof(GetTasaVigente), new { id = tasaDeCambio.IdTasa }, tasaDeCambio);
        //}

        [HttpPut("ActualizarPreciosManualmente")]
        public async Task<IActionResult> UpdatePreciosVes()
        {
            var tasaActual = await _context.TasaDeCambio
                .Where(t => t.MonedaOrigen == "USD" && t.MonedaDestino == "VES")
                .OrderByDescending(t => t.FechaVigencia)
                .FirstOrDefaultAsync();

            if (tasaActual == null || tasaActual.FactorSugerido == 0) 
                return BadRequest("No hay una tasa válida registrada.");

            await SincronizarPreciosVes(tasaActual.FactorSugerido ?? tasaActual.Tasa);
            return Ok(new { mensaje = "Precios en BS actualizados", tasaUSD = tasaActual.FactorSugerido });
        }

        private async Task SincronizarPreciosVes(decimal tasa)
        {
            // Cargamos solo los datos necesarios para no saturar la memoria
            var unidades = await _context.ProductosUnidad.ToListAsync();
            
            foreach (var u in unidades)
            {
                // MonedaExt = Bolívares | MonedaBase = Dólares
                u.CostoUnitarioMonedaExt = u.CostoUnitarioMonedaBase * tasa;
                
                // Corregido: Agregado de paréntesis para asegurar que la multiplicación se haga antes del redondeo
                u.PrecioMonedaExt = Math.Round((u.PrecioMonedaBase ?? 0) * tasa, 2);

                if (u.Precio2MonedaBase.HasValue)
                    u.Precio2MonedaExt = Math.Round(u.Precio2MonedaBase.Value * tasa, 2);

                if (u.Precio3MonedaBase.HasValue)
                    u.Precio3MonedaExt = Math.Round(u.Precio3MonedaBase.Value * tasa, 2);
            }
            await _context.SaveChangesAsync();
        }
        [HttpPost("registrar-nueva-tasa")]
        public async Task<IActionResult> RegistrarTasa([FromBody] TasaRegistroDTO modelo)
        {
            // Si llegas aquí con 0, el sistema te va a rebotar con un error 400
            if (modelo == null || modelo.ValorTasa <= 0)
            {
                return BadRequest(new { 
                    error = "La tasa enviada es 0 o el JSON está mal formado",
                    ejemploCorrecto = new { valorTasa = 64.50, usuario = "Admin" }
                });
            }

            var nuevaTasa = new TasaDeCambio
            {
                Tasa = modelo.ValorTasa,
                FactorSugerido = modelo.ValorTasa,
                FechaVigencia = GetVenezuelaTime(),
                MonedaOrigen = "USD",
                MonedaDestino = "VES",
                UsuarioRegistro = modelo.Usuario ?? "Sistema"
            };

            _context.TasaDeCambio.Add(nuevaTasa);
            await _context.SaveChangesAsync();

            await SincronizarPreciosVes(nuevaTasa.Tasa);

            return Ok(new { 
                mensaje = "Tasa registrada correctamente", 
                valor = nuevaTasa.Tasa,
                id = nuevaTasa.IdTasa 
            });
        }
        [HttpGet("ultima")]
        public async Task<IActionResult> GetUltimaTasa()
        {
            var tasaActual = await _context.TasaDeCambio
                .OrderByDescending(t => t.FechaVigencia)
                .FirstOrDefaultAsync();

            if (tasaActual == null)
            {
                // Si no hay tasas en la BD, devolvemos un valor por defecto para que el POS no explote
                return Ok(new { valor = 1.0m }); 
            }

            // Devolvemos el objeto con la propiedad "valor" para que coincida con lo que espera el Frontend
            return Ok(new { 
                valor = tasaActual.FactorSugerido ?? tasaActual.Tasa,
                fecha = tasaActual.FechaVigencia 
            });
        }
    }

    public class TasaRegistroDTO
    {
    [JsonPropertyName("valorTasa")] // Esto obliga a reconocer "valorTasa" en minúsculas
    public decimal ValorTasa { get; set; }

    [JsonPropertyName("usuario")]
    public string? Usuario { get; set; }
    }
}