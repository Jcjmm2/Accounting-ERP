using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Tyted.API.Models
{
    public class NotaEntregaCompra
    {
        public int Id { get; set; }
        public string NumeroNota { get; set; } = string.Empty; // El número físico del papel
        public int ProveedorId { get; set; }
        public DateTime FechaRecepcion { get; set; }
        public decimal TotalEstimadoUSD { get; set; }
        public bool ProcesadoAFactura { get; set; } = false;
        public List<NotaEntregaCompraDetalle> Detalles { get; set; } = new();
        public int IdProductoUnidad { get; set; }
    }

    public class NotaEntregaCompraDetalle
    {
        public int Id { get; set; }
        public int NotaEntregaCompraId { get; set; }
        public string CodigoProd { get; set; } = string.Empty;
        public decimal CantidadRecibida { get; set; }
        public decimal CostoUnitarioUSD { get; set; }
    }
}