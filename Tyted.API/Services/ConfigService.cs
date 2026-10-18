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

        // -----------------------------------------------------------------------
        // UNIDAD TRIBUTARIA VIGENTE (política de estado: se decreta por Gaceta
        // Oficial). Configuración GLOBAL (no por empresa) guardada en la tabla
        // clave/valor EmpresaConfigs; la Descripcion de la fila guarda la
        // referencia de la Gaceta. Fallback: el default de siembra (UT 2025).
        // -----------------------------------------------------------------------

        public const string ClaveUnidadTributaria = "UnidadTributariaVigente";

        /// <summary>UT vigente (Bs.) y referencia de Gaceta (si existe la fila).</summary>
        public async Task<(decimal Valor, string? Gaceta)> GetUnidadTributariaVigenteAsync()
        {
            var config = await _context.EmpresaConfigs
                .AsNoTracking()
                .FirstOrDefaultAsync(c => c.Clave == ClaveUnidadTributaria);

            if (config is null || !decimal.TryParse(config.Valor, out var valor) || valor <= 0)
                return (CatalogoIslr.UnidadTributariaDefault, config?.Descripcion);

            return (valor, config.Descripcion);
        }

        /// <summary>
        /// Actualiza la UT vigente (y su referencia de Gaceta). El caller debe
        /// combinarlo con RecalcularSustraendosIslrAsync (misma transacción).
        /// </summary>
        public async Task<EmpresaConfig> SetUnidadTributariaVigenteAsync(decimal valor, string? gaceta)
        {
            if (valor <= 0m)
                throw new InvalidOperationException("La Unidad Tributaria vigente debe ser mayor a cero.");

            var config = await _context.EmpresaConfigs
                .FirstOrDefaultAsync(c => c.Clave == ClaveUnidadTributaria);

            if (config is null)
            {
                config = new EmpresaConfig
                {
                    Clave = ClaveUnidadTributaria,
                    Valor = valor.ToString("0.####"),
                    Descripcion = string.IsNullOrWhiteSpace(gaceta) ? "Unidad Tributaria vigente" : gaceta.Trim()
                };
                _context.EmpresaConfigs.Add(config);
            }
            else
            {
                config.Valor = valor.ToString("0.####");
                if (!string.IsNullOrWhiteSpace(gaceta))
                    config.Descripcion = gaceta.Trim().Length > 255 ? gaceta.Trim()[..255] : gaceta.Trim();
            }

            await _context.SaveChangesAsync();
            return config;
        }

        /// <summary>
        /// Recalcula el sustraendo (Bs.) de TODOS los conceptos ISLR con
        /// sustraendo (PNR) contra la UT vigente. Las retenciones YA emitidas
        /// no se tocan: su sustraendo queda congelado en la propia retención.
        /// </summary>
        public async Task<int> RecalcularSustraendosIslrAsync(decimal unidadTributaria)
        {
            var conceptos = await _context.ConceptosOperacionales
                .Where(c => c.TipoOperacion == "ISLR"
                    && c.AplicaSustraendo
                    && c.TipoPersona == "PNR"
                    && c.PorcentajeRetencion > 0)
                .ToListAsync();

            foreach (var concepto in conceptos)
                concepto.MontoSustraendoBs = CatalogoIslr.CalcularSustraendo(concepto.PorcentajeRetencion!.Value, unidadTributaria);

            if (conceptos.Count > 0)
                await _context.SaveChangesAsync();

            return conceptos.Count;
        }
    }
}    