public class ActualizarPrecioDTO
{
    // ID de la presentación (es INT en SQL)
    public int IdProductoUnidad { get; set; } 
    
    // El precio es decimal
    public decimal NuevoPrecioUSD { get; set; }
}