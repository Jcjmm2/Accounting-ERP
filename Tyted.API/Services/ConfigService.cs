using Tyted.API.Data;
using Tyted.API.Models;
using Microsoft.EntityFrameworkCore;

namespace Tyted.API.Services
{


    public class ConfigService
    {
        private readonly TytedContext _context;
        public ConfigService(TytedContext context) => _context = context;

        public async Task<bool> EsStockNegativoPermitidoAsync()
        {
            // Cambiamos _context.EmpresaConfig por _context.EmpresaConfigs
            var config = await _context.EmpresaConfigs
                .FirstOrDefaultAsync(c => c.Clave == "PermitirStockNegativo");
    
            return config?.Valor?.ToLower() == "true";
        }
    }
}    