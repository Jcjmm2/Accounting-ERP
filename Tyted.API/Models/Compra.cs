// Tyted.API.Models/Compra.cs
using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using Tyted.API.Models;

namespace Tyted.API.Models
{
    public class Compra
    {
        [Key]
        public int Id { get; set; }

        [Required]
        public int? CodigoProv { get; set; } // FK de Proveedor

        [Required]
        public DateTime FechaCompra { get; set; }

        [Required, MaxLength(3)]
        public string? TipoMoneda { get; set; } // Ejemplo: HNL, VES, etc.

        [Column(TypeName = "decimal(18, 4)")]
        public decimal TasaDeCambio { get; set; }

        // -------------------------------------------------------------
        // NUEVOS CAMPOS PARA DESGLOSE DE TOTALES (REQUERIDO)
        // -------------------------------------------------------------
        [Column(TypeName = "decimal(18, 4)")]
        public decimal SubtotalMonedaBase { get; set; } // Valor sin IVA, en Moneda Base

        [Column(TypeName = "decimal(18, 4)")]
        public decimal IvaMonedaBase { get; set; }      // Monto de IVA, en Moneda Base

        [Column(TypeName = "decimal(18, 4)")]
        public decimal SubtotalMonedaExt { get; set; }  // Valor sin IVA, en Moneda Extranjera

        [Column(TypeName = "decimal(18, 4)")]
        public decimal IvaMonedaExt { get; set; }       // Monto de IVA, en Moneda Extranjera
        // -------------------------------------------------------------


        // Totales finales 
        [Column(TypeName = "decimal(18, 4)")]
        public decimal TotalMonedaBase { get; set; }

        [Column(TypeName = "decimal(18, 4)")]
        public decimal TotalMonedaExt { get; set; }

        
        // =============================================================
        // ✅ CORRECCIÓN 1: PROPIEDAD DE ESTADO DE ANULACIÓN
        // =============================================================
        [Required]
        public bool IsAnulada { get; set; } = false; 


        // --- PROPIEDADES DE NAVEGACIÓN ---

        // ✅ CORRECCIÓN 2: Se añade el atributo ForeignKey para ser explícito.
        [ForeignKey("CodigoProv")]
        public Proveedor? Proveedor { get; set; }

        // Esta es la relación correcta: Una compra tiene muchos detalles
        public virtual ICollection<CompraDetalle> Detalles { get; set; } = new List<CompraDetalle>();

        // --- Datos Fiscales ---
        [StringLength(50)]
        public string? NumeroFactura { get; set; }

        [StringLength(50)]
        public string? NumeroControl { get; set; }

        // --- Opciones de Reporte ---
        public bool AplicaLibroCompras { get; set; } = true;

        // --- Gastos por Servicios ---
        public bool EsGastoServicio { get; set; } = false;

        // Dentro de Compra.cs
        public bool EsCredito { get; set; } = false;
        public DateTime? FechaVencimiento { get; set; }

        // --- MULTIEMPRESA E INTEGRACIÓN FISCAL/CONTABLE (Libro de Compras SENIAT) ---
        /// <summary>Empresa a la que pertenece la compra (selector global empresaActiva).</summary>
        public int EmpresaId { get; set; } = 1;

        /// <summary>Tipo de transacción SENIAT: 01-Registro, 02-Complemento, 03-Anulación.</summary>
        [StringLength(2)]
        public string TipoTransaccion { get; set; } = "01";

        /// <summary>Comprobante contable generado por el motor de asientos (integración administrativo-contable).</summary>
        public int? AsientoContableId { get; set; }
    }

}