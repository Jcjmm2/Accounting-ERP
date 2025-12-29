namespace Tyted.API.DTOs
{
    public class RegistrarAbonoDto
    {
        public int IdCuenta { get; set; } // El ID de la deuda (CXC o CXP)
        public decimal MontoAbonadoMonedaBase { get; set; } // El monto en $
        public string MetodoPago { get; set; } // Efectivo, Transferencia, etc.
        public string Notas { get; set; }
    }
}