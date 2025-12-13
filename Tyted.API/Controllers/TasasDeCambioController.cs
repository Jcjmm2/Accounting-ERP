using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Tyted.API.Data;
using Tyted.API.Models;
using System.Linq;
using System; // Necesario para DateTime y TimeZoneInfo

[Route("api/[controller]")]
[ApiController]
public class TasasDeCambioController : ControllerBase
{
    private readonly TytedContext _context;

    public TasasDeCambioController(TytedContext context)
    {
        _context = context;
    }

    // ====================================================================
    // 1. GET (Obtener la Tasa Vigente)
    // Endpoint: GET /api/TasasDeCambio/vigente
    // ====================================================================
    [HttpGet("vigente")]
    public async Task<ActionResult<TasaDeCambio>> GetTasaVigente()
    {
        // Busca la tasa más reciente por la fecha de vigencia
        var tasaVigente = await _context.TasasDeCambio
            .OrderByDescending(t => t.FechaVigencia)
            .FirstOrDefaultAsync();

        if (tasaVigente == null)
        {
            // Fallback: Si no hay registros, se usa la tasa 1.0, vigente desde hoy (hora local)
            // Se usa la lógica de conversión aquí para que el fallback también sea local
            TimeZoneInfo venezuelaTimeZone;
            try
            {
                venezuelaTimeZone = TimeZoneInfo.FindSystemTimeZoneById("Venezuela Standard Time");
            }
            catch (TimeZoneNotFoundException)
            {
                venezuelaTimeZone = TimeZoneInfo.FindSystemTimeZoneById("America/Caracas");
            }
            DateTime venezuelaTime = TimeZoneInfo.ConvertTimeFromUtc(DateTime.UtcNow, venezuelaTimeZone);

            return Ok(new TasaDeCambio 
            { 
                Tasa = 1.000000m, 
                FechaVigencia = venezuelaTime.Date, // <-- Usa la fecha local (00:00:00)
                MonedaOrigen = "USD", 
                MonedaDestino = "VES" 
            }); 
        }

        return tasaVigente;
    }
    
    // ====================================================================
    // 2. GET (Obtener el Historial Completo)
    // Endpoint: GET /api/TasasDeCambio
    // ====================================================================
    [HttpGet]
    public async Task<ActionResult<IEnumerable<TasaDeCambio>>> GetHistorial()
    {
        // Obtiene todas las tasas ordenadas de la más reciente a la más antigua
        return await _context.TasasDeCambio
            .OrderByDescending(t => t.FechaVigencia)
            .ToListAsync();
    }

    // ====================================================================
    // 3. POST (Registrar una Nueva Tasa)
    // Endpoint: POST /api/TasasDeCambio
    // ====================================================================
    [HttpPost]
    public async Task<ActionResult<TasaDeCambio>> PostTasaDeCambio(TasaDeCambio tasaDeCambio)
    {
        // 1. Definir la Zona Horaria de Venezuela
        TimeZoneInfo venezuelaTimeZone;
        try
        {
            // Opción para Windows
            venezuelaTimeZone = TimeZoneInfo.FindSystemTimeZoneById("Venezuela Standard Time");
        }
        catch (TimeZoneNotFoundException)
        {
            // Opción para Linux/macOS
            venezuelaTimeZone = TimeZoneInfo.FindSystemTimeZoneById("America/Caracas");
        }
        
        // 2. Convertir la hora UTC actual a la hora local de Venezuela
        DateTime venezuelaTime = TimeZoneInfo.ConvertTimeFromUtc(DateTime.UtcNow, venezuelaTimeZone);

        // 3. Forzar la vigencia al inicio del día (00:00:00) de la HORA LOCAL
        tasaDeCambio.FechaVigencia = venezuelaTime.Date;

        // Establecer valores por defecto si el Frontend no los envía
        if (string.IsNullOrEmpty(tasaDeCambio.MonedaOrigen)) tasaDeCambio.MonedaOrigen = "USD";
        if (string.IsNullOrEmpty(tasaDeCambio.MonedaDestino)) tasaDeCambio.MonedaDestino = "VES";

        _context.TasasDeCambio.Add(tasaDeCambio);
        await _context.SaveChangesAsync();

        // Devuelve el código 201 Created
        // Se llama a GetTasaVigente para que el Frontend pueda recargar el dato
        return CreatedAtAction(nameof(GetTasaVigente), null, tasaDeCambio);
    }
}