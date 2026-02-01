public class AjusteInventarioDto
{
    public string CodigoProd { get; set; }
    public int IdUnidadMedida { get; set; } // ID de la tabla ProductosUnidad (ej: 5 para cartón)
    public decimal Cantidad { get; set; }   // Ej: 2 (cartones)
    public string TipoMovimiento { get; set; } // "Entrada" o "Salida"
    public string Concepto { get; set; } // "Ajuste por merma", "Inventario Inicial", etc.
}