namespace Tyted.API.Models
{
    public class ArqueoCajaDTO
    {
        public string Usuario { get; set; } = string.Empty;
        
        // Lo que el cajero cuenta físicamente
        public decimal EfectivoUSDDeclarado { get; set; }
        public decimal EfectivoVESDeclarado { get; set; }
        public decimal PagoMovilDeclarado { get; set; }
        
        // Observaciones (por si hay algún billete roto, etc.)
        public string? Observaciones { get; set; }
        
    }
    public class ResultadoArqueoDTO
    {
        public decimal DiferenciaUSD { get; set; }
        public decimal DiferenciaVES { get; set; }
        public string Estado { get; set; } = string.Empty; // "Cuadrado", "Faltante", "Sobrante"
        public string Mensaje { get; set; } = string.Empty;
    }

}