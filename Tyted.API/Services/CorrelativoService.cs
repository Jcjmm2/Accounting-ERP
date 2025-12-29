using Microsoft.EntityFrameworkCore;
using Tyted.API.Data;

namespace Tyted.API.Services
{
    public class CorrelativoService
    {
        private readonly TytedContext _context;

        public CorrelativoService(TytedContext context)
        {
            _context = context;
        }

        public async Task<string> GenerarSiguienteNumeroVenta()
        {
            // Buscamos la última venta realizada
            var ultimaVenta = await _context.Ventas
                .OrderByDescending(v => v.VentaId)
                .FirstOrDefaultAsync();

            int siguienteNumero = 1;

            if (ultimaVenta != null && !string.IsNullOrEmpty(ultimaVenta.NumeroFactura))
            {
                // Intentamos extraer el número actual e incrementar
                if (int.TryParse(ultimaVenta.NumeroFactura, out int ultimoNum))
                {
                    siguienteNumero = ultimoNum + 1;
                }
            }

            // Retornamos el número formateado con 6 ceros a la izquierda
            return siguienteNumero.ToString("D6"); // Resultado: "000001"
        }
    }
}