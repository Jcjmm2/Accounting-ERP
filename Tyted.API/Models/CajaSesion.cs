using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Tyted.API.Models
{
    public class CajaSesion
    {
        public int Id { get; set; }
        public DateTime FechaApertura { get; set; }
        public DateTime? FechaCierre { get; set; }
        public decimal MontoAperturaUSD { get; set; }
        public decimal? MontoCierreEfectivoUSD { get; set; }
        public decimal? MontoCierrePagoMovilUSD { get; set; }
        public string? ObservacionesCierre { get; set; }
        public string Usuario { get; set; }
        public bool IsAbierta { get; set; } // El "candado" del sistema
    }
}