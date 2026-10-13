namespace Tyted.API.Services;

/// <summary>
/// Catálogo estático del Decreto 1.808 (retenciones de ISLR) para la semilla.
/// Cada concepto lleva su código de operación SENIAT, tipo de persona, tarifa y
/// si aplica sustraendo (sólo personas naturales residentes). La Unidad
/// Tributaria 2025 es Bs. 43 y el sustraendo se calcula como 83,3334 × UT × %.
/// </summary>
public static class CatalogoIslr
{
    /// <summary>Unidad Tributaria vigente 2025 (Bs.) usada para el sustraendo.</summary>
    public const decimal UnidadTributaria = 43m;

    private const decimal FactorSustraendo = 83.3334m;

    /// <summary>Sustraendo = 83,3334 × UT × % (redondeado a 2 decimales).</summary>
    public static decimal CalcularSustraendo(decimal porcentaje)
        => Math.Round(FactorSustraendo * UnidadTributaria * (porcentaje / 100m), 2);

    /// <summary>
    /// Fila del catálogo: código SENIAT, nombre, tipo de persona (PNR/PNNR/PJD),
    /// tarifa y si aplica sustraendo.
    /// </summary>
    public record FilaIslr(string Codigo, string Nombre, string TipoPersona, decimal Porcentaje, bool AplicaSustraendo);

    /// <summary>
    /// Catálogo completo de conceptos del Decreto 1.808 usados en el libro de
    /// compras. Cada familia de operación se expande en sus variantes por tipo
    /// de persona. Los códigos con tramos de UT (PJND: 15/22/34%) se excluyen de
    /// esta semilla por requerir lógica de tramos; el admin puede darlos de alta.
    /// </summary>
    public static readonly FilaIslr[] Completar =
    {
        // HONORARIOS PROFESIONALES NO MERCANTILES
        new("002", "Honorarios Profesionales No Mercantiles", "PNR", 3m, true),
        new("003", "Honorarios Profesionales No Mercantiles", "PNNR", 34m, false),
        new("004", "Honorarios Profesionales No Mercantiles", "PJD", 5m, false),
        new("006", "Honorarios Profesionales Mancomunados No Mercantiles", "PNR", 3m, true),
        new("007", "Honorarios Profesionales Mancomunados No Mercantiles", "PNNR", 34m, false),
        new("008", "Honorarios Profesionales Mancomunados No Mercantiles", "PJD", 5m, false),
        new("010", "Honorarios a Jinetes, Veterinarios, Preparadores o Entrenadores", "PNR", 3m, true),
        new("011", "Honorarios a Jinetes, Veterinarios, Preparadores o Entrenadores", "PNNR", 34m, false),
        new("012", "Honorarios pagados por Clínicas, Hospitales, Bufetes, Colegios Profesionales", "PNR", 3m, true),
        new("013", "Honorarios pagados por Clínicas, Hospitales, Bufetes, Colegios Profesionales", "PNNR", 34m, false),

        // COMISIONES
        new("014", "Comisiones por venta de bienes inmuebles", "PNR", 3m, true),
        new("015", "Comisiones por venta de bienes inmuebles", "PNNR", 34m, false),
        new("016", "Comisiones por venta de bienes inmuebles", "PJD", 5m, false),
        new("018", "Otras Comisiones (distintas a remuneraciones accesorias)", "PNR", 3m, true),
        new("019", "Otras Comisiones (distintas a remuneraciones accesorias)", "PNNR", 34m, false),
        new("020", "Otras Comisiones (distintas a remuneraciones accesorias)", "PJD", 5m, false),

        // INTERESES
        new("024", "Intereses pagados por concepto de préstamos y créditos", "PNR", 3m, true),
        new("025", "Intereses pagados por concepto de préstamos y créditos", "PNNR", 34m, false),
        new("026", "Intereses pagados por concepto de préstamos y créditos", "PJD", 5m, false),

        // SERVICIOS TECNOLÓGICOS
        new("038", "Servicios Tecnológicos utilizados en el país o cedidos a terceros", "PJD", 34m, false),

        // SERVICIOS (EN GENERAL)
        new("053", "Servicios (en general)", "PNR", 1m, true),
        new("054", "Servicios (en general)", "PNNR", 34m, false),
        new("055", "Servicios (en general)", "PJD", 2m, false),

        // ARRENDAMIENTO DE BIENES INMUEBLES
        new("057", "Arrendamiento de Bienes Inmuebles", "PNR", 3m, true),
        new("058", "Arrendamiento de Bienes Inmuebles", "PNNR", 34m, false),
        new("059", "Arrendamiento de Bienes Inmuebles", "PJD", 5m, false),

        // ARRENDAMIENTO DE BIENES MUEBLES
        new("061", "Arrendamiento de Bienes Muebles", "PNR", 3m, true),
        new("062", "Arrendamiento de Bienes Muebles", "PNNR", 34m, false),
        new("063", "Arrendamiento de Bienes Muebles", "PJD", 5m, false),

        // FLETES Y GASTOS DE TRANSPORTE NACIONAL
        new("071", "Fletes y Gastos de Transporte Nacional", "PNR", 1m, true),
        new("072", "Fletes y Gastos de Transporte Nacional", "PJD", 3m, false),

        // PAGOS DE EMPRESAS DE SEGURO A CORREDORES
        new("073", "Pagos de Empresas de Seguro a Corredores", "PNR", 3m, true),
        new("074", "Pagos de Empresas de Seguro a Corredores", "PJD", 5m, false),

        // ADQUISICIÓN DE FONDOS DE COMERCIO
        new("079", "Adquisición de Fondos de Comercio", "PNR", 3m, true),
        new("080", "Adquisición de Fondos de Comercio", "PNNR", 34m, false),
        new("081", "Adquisición de Fondos de Comercio", "PJD", 5m, false),

        // PUBLICIDAD Y PROPAGANDA
        new("083", "Servicios de Publicidad y Propaganda", "PNR", 3m, true),
        new("084", "Servicios de Publicidad y Propaganda", "PJD", 5m, false),
    };
}