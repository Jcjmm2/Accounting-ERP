using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Tyted.API.Data;
using Tyted.API.Models;
using System.Linq;
using System; 

// ====================================================================
// ¡CORRECCIÓN CLAVE! Nombre del Controller en Singular para coincidir
// con la ruta que el Frontend está intentando llamar: /api/TasaCambio
// ====================================================================
[Route("api/[controller]")]
[ApiController]
public class TasaDeCambioController : ControllerBase // 1. CAMBIO DE NOMBRE
{
    private readonly TytedContext _context;

    public TasaDeCambioController(TytedContext context)
    {
        _context = context;
    }

    // ====================================================================
    // 1. GET (Obtener la Tasa Vigente)
    // Endpoint: GET /api/TasaCambio/Vigente
    // ====================================================================
    // 2. CORRECCIÓN MENOR: Se cambió 'vigente' por 'Vigente' por consistencia
    [HttpGet("Vigente")] 
    public async Task<ActionResult<TasaDeCambio>> GetTasaVigente()
    {
        // Busca la tasa más reciente por la fecha de vigencia
        var tasaVigente = await _context.TasaDeCambio
            .OrderByDescending(t => t.FechaVigencia)
            .FirstOrDefaultAsync();

        if (tasaVigente == null)
        {
            // Fallback: Si no hay registros, se usa la tasa 1.0, vigente desde hoy (hora local)
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
                FechaVigencia = venezuelaTime.Date, 
                MonedaOrigen = "USD", 
                MonedaDestino = "VES" 
            }); 
        }

        // Si se encuentra, devuelve la tasa (el tipo ActionResult<TasaDeCambio> se encarga del Ok)
        return tasaVigente;
    }
    
    // ====================================================================
    // 2. GET (Obtener el Historial Completo)
    // Endpoint: GET /api/TasaCambio
    // ====================================================================
    [HttpGet]
    public async Task<ActionResult<IEnumerable<TasaDeCambio>>> GetHistorial()
    {
        // Obtiene todas las tasas ordenadas de la más reciente a la más antigua
        return await _context.TasaDeCambio
            .OrderByDescending(t => t.FechaVigencia)
            .ToListAsync();
    }

    // ====================================================================
    // 3. POST (Registrar una Nueva Tasa)
    // Endpoint: POST /api/TasaCambio
    // ====================================================================
    [HttpPost]
    public async Task<ActionResult<TasaDeCambio>> PostTasaDeCambio(TasaDeCambio tasaDeCambio)
    {
        // 1. Definir la Zona Horaria de Venezuela
        TimeZoneInfo venezuelaTimeZone;
        try
        {
            venezuelaTimeZone = TimeZoneInfo.FindSystemTimeZoneById("Venezuela Standard Time");
        }
        catch (TimeZoneNotFoundException)
        {
            venezuelaTimeZone = TimeZoneInfo.FindSystemTimeZoneById("America/Caracas");
        }
        
        // 2. Convertir la hora UTC actual a la hora local de Venezuela
        DateTime venezuelaTime = TimeZoneInfo.ConvertTimeFromUtc(DateTime.UtcNow, venezuelaTimeZone);

        // 3. Forzar la vigencia al inicio del día (00:00:00) de la HORA LOCAL
        tasaDeCambio.FechaVigencia = venezuelaTime.Date;

        // Establecer valores por defecto si el Frontend no los envía
        if (string.IsNullOrEmpty(tasaDeCambio.MonedaOrigen)) tasaDeCambio.MonedaOrigen = "USD";
        if (string.IsNullOrEmpty(tasaDeCambio.MonedaDestino)) tasaDeCambio.MonedaDestino = "VES";

        _context.TasaDeCambio.Add(tasaDeCambio);
        await _context.SaveChangesAsync();

        // Devuelve el código 201 Created. Esto sigue funcionando porque el nombre del método
        // sigue siendo correcto, y CreatedAtAction lo busca en el controlador actual.
        return CreatedAtAction(nameof(GetTasaVigente), null, tasaDeCambio);
    }
}