// Tyted.API.Models/MaquinaFiscal.cs
using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Tyted.API.Models
{
    /// <summary>
    /// Maestro de Máquinas Fiscales por empresa. Centraliza el catálogo de
    /// máquinas (NumeroControl, alias, marca/modelo, correlativos iniciales)
    /// para el autocompletado del cierre Z y la captura en lote del Libro de
    /// Ventas SENIAT.
    /// La clave histórica inmutable (NumeroControlMaquina) vive congelada en
    /// ResumenVentaFiscal; aquí sólo se referencia vía MaquinaFiscalId opcional.
    /// </summary>
    [Table("MaquinasFiscales")]
    public class MaquinaFiscal
    {
        [Key]
        public int Id { get; set; }

        /// <summary>Empresa a la que pertenece la máquina (selector global empresaActiva).</summary>
        [Required]
        public int EmpresaId { get; set; }

        /// <summary>Serial / N° de registro de la máquina fiscal (ej. Z7C7038271).</summary>
        [Required, MaxLength(30)]
        public string NumeroControl { get; set; } = string.Empty;

        /// <summary>Nombre descriptivo para identificar la caja (ej. "Caja 1 - Mostrador").</summary>
        [Required, MaxLength(80)]
        public string Alias { get; set; } = string.Empty;

        [MaxLength(80)]
        public string? MarcaModelo { get; set; }

        /// <summary>Opcional: último N° Z previo al uso del sistema (para sugerir Z + 1 en el primer registro).</summary>
        [MaxLength(20)]
        public string? NumeroZInicial { get; set; }

        /// <summary>Opcional: última factura emitida previa al uso del sistema.</summary>
        [MaxLength(20)]
        public string? FacturaInicial { get; set; }

        public bool Activa { get; set; } = true;

        public bool EsPredeterminada { get; set; } = false;

        public DateTime FechaRegistro { get; set; } = DateTime.UtcNow;
    }
}