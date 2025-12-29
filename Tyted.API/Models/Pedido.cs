using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Tyted.API.Models
{
    public class Pedido
    {
        public int Id { get; set; }
        public DateTime Fecha { get; set; }
    
        public int ClienteId { get; set; } // Coincide con tu DB actual
    
        [ForeignKey("ClienteId")] 
        public Cliente? Cliente { get; set; }
    
        public decimal MontoTotalUSD { get; set; }
        public string Estado { get; set; } = "Pendiente";
        public List<PedidoDetalle>? Detalles { get; set; } = new();
    }

    public class PedidoDetalle
    {
        public int? Id { get; set; }
        public int? PedidoId { get; set; }
        public string? CodigoProd { get; set; } = string.Empty;
        public decimal? Cantidad { get; set; }
        public decimal? PrecioUnitarioUSD { get; set; }
        public decimal? SubtotalUSD { get; set; }
    }
}