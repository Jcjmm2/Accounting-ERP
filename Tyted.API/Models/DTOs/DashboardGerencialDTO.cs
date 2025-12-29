public class DashboardGerencialDTO
{
    public decimal ValorInventarioCostoUSD { get; set; }
    public decimal UtilidadBrutaDiaUSD { get; set; }
    public List<VentasMetodoPagoDTO> VentasPorMetodo { get; set; }
    public int CambiosDeTasaDelDia { get; set; }
    public List<HistoricoTasaDTO> DetalleTasasDia { get; set; }
}

public class VentasMetodoPagoDTO
{
    public string Metodo { get; set; }
    public decimal MontoUSD { get; set; }
    public decimal MontoVES { get; set; }
}

public class HistoricoTasaDTO
{
    public DateTime Hora { get; set; }
    public decimal Valor { get; set; }
}

public class TopProductoDTO
{
    public string Codigo { get; set; } = string.Empty;
    public string Descripcion { get; set; } = string.Empty;
    public decimal CantidadTotal { get; set; } // Este es el nombre unificado
    public decimal TotalVendidoUSD { get; set; } // Este es el nombre unificado
}