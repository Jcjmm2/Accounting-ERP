using Tyted.API.Data;
using Tyted.API.Models;
using Microsoft.EntityFrameworkCore;
using Tyted.API.Helpers;

namespace Tyted.API.Services
{
    public class TasaService
    {
        private readonly TytedContext _context;

        public TasaService(TytedContext context)
        {
            _context = context;
        }

        public async Task<decimal> GetTasaActualAsync()
        {
            // Sincronizado con tus nombres de propiedades:
            // Usamos FechaVigencia en lugar de Fecha
            var tasa = await _context.TasaDeCambio
                .OrderByDescending(t => t.FechaVigencia) 
                .FirstOrDefaultAsync();
            
            // Usamos FactorSugerido y Tasa como respaldo (fallback)
            // Si no hay factor sugerido, usamos la tasa BCV; si no hay nada, 1.
            return tasa?.FactorSugerido ?? tasa?.Tasa ?? 1.0m; 
        }

        public async Task<TasaDeCambio> RegistrarTasaNueva(decimal valorBcv, decimal valorSugerido, string usuario)
        {
            var nueva = new TasaDeCambio
            {
                Tasa = valorBcv,
                FactorSugerido = valorSugerido,
                FechaVigencia = DateHelper.GetVenezuelaTime(),
                UsuarioRegistro = usuario,
                MonedaOrigen = "USD", // Tu moneda base
                MonedaDestino = "VES" // Moneda local
            };

            _context.TasaDeCambio.Add(nueva);
            await _context.SaveChangesAsync();
            return nueva;
        }
    }
}