using System.Globalization;
using System.Text;
using System.Text.RegularExpressions;
using System.Xml;
using System.Xml.Linq;
using Tyted.API.Models;

namespace Tyted.API.Services;

/// <summary>
/// Generador de ARCHIVOS SENIAT (Fase 5):
///  - TXT de Retenciones de IVA por quincena (Forma 99035): 16 columnas A-P
///    separadas por TABULADOR, según la especificación técnica del Portal
///    Fiscal ("Cómo realizar un Archivo TXT de Retención de IVA").
///  - XML de Retenciones de ISLR mensual: Manual Técnico SENIAT v2.3
///    (N° 60.40.40.039), esquema 4.1 "Declaración de Salarios y Otras
///    Retenciones": raíz &lt;RelacionRetencionesISLR RifAgente Periodo&gt; y
///    &lt;DetalleRetencion&gt; con orden de secuencia fijo.
/// Todo el cálculo usa decimal (nunca double) con culture EXPLÍCITA: las
/// cifras fiscales no dependen de la configuración regional del servidor.
/// </summary>
public static class DeclaracionesSeniatService
{
    /// <summary>RIF SENIAT: letra (V,E,J,P,G) + 9 dígitos (t_Rif del XSD).</summary>
    private const string PatronRif = "^[VEJPG][0-9]{9}$";

    /// <summary>Código de concepto de retención: 3 dígitos (t_Codigo del XSD).</summary>
    private const string PatronCodigo = "^[0-9]{3}$";

    /// <summary>
    /// Montos del TXT: 2 decimales con SEPARADOR DECIMAL COMA y sin separador
    /// de miles (p. ej. 15000,63), como los produce el modelo oficial de Excel
    /// en español al "Guardar como texto (Delimitado por tabulaciones)".
    /// Constante centralizada: si la especificación vigente del Portal Fiscal
    /// exigiera otra variante, se ajusta aquí y los tests la reflejan.
    /// </summary>
    private static readonly CultureInfo CulturaMontoTxt = new("es-VE");

    /// <summary>
    /// Cortes de la quincena (art. 14 Providencia SNAT/2025/000054): 1-15 y
    /// 16-fin de mes.
    /// </summary>
    public static (DateTime fechaInicio, DateTime fechaFin) RangoQuincena(int anio, int mes, int quincena)
    {
        if (quincena == 1)
            return (new DateTime(anio, mes, 1), new DateTime(anio, mes, 15, 23, 59, 59));

        return (new DateTime(anio, mes, 16),
                new DateTime(anio, mes, DateTime.DaysInMonth(anio, mes), 23, 59, 59));
    }

    // -------------------------------------------------------------------------
    // TXT DE RETENCIONES DE IVA (QUINCENAL — FORMA 99035)
    // Columnas: A RIF agente | B Periodo | C Fecha factura | D Tipo operación |
    // E Tipo doc | F RIF proveedor | G N° documento | H N° control |
    // I Monto total | J Base imponible | K IVA retenido | L Doc afectado |
    // M N° comprobante | N Monto exento | O Alícuota | P N° expediente
    // -------------------------------------------------------------------------
    public static (byte[] contenido, string nombreArchivo) GenerarTxtIva(
        Empresa empresa, IEnumerable<RetencionIvaEmitida> retenciones, int anio, int mes, int quincena)
    {
        var rifAgente = NormalizarRif(empresa?.RIF);
        if (!Regex.IsMatch(rifAgente, PatronRif))
            throw new InvalidOperationException(
                $"El RIF de la empresa («{empresa?.RIF}») no tiene el formato SENIAT (letra V/E/J/P/G + 9 dígitos).");

        var periodo = FormatoPeriodo(anio, mes);
        var errores = new List<string>();
        var lineas = new List<string>();

        foreach (var r in retenciones ?? Enumerable.Empty<RetencionIvaEmitida>())
        {
            var rifProveedor = NormalizarRif(r.ProveedorRif);
            if (!Regex.IsMatch(rifProveedor, PatronRif))
                errores.Add($"Comprobante {r.NumeroComprobante}: RIF del proveedor inválido («{r.ProveedorRif}»).");

            // C: fecha de la factura origen; sin vínculo se usa la de emisión.
            var fechaFactura = (r.Compra?.FechaCompra ?? r.FechaRetencion)
                .ToString("dd/MM/yyyy", CultureInfo.InvariantCulture);

            // E: 01 Factura, 02 Nota de Débito, 03 Nota de Crédito.
            var tipoDocumento = (r.Compra?.TipoTransaccion ?? "01").Trim();
            if (tipoDocumento is not ("01" or "02" or "03")) tipoDocumento = "01";

            var numeroFactura = string.IsNullOrWhiteSpace(r.NumeroFactura) ? "0" : r.NumeroFactura.Trim();
            var numeroControl = (r.NumeroControl ?? string.Empty).Trim();
            var montoExento = Math.Max(0m, r.MontoFacturaBs - r.BaseImponibleBs - r.IvaCalculadoBs);

            lineas.Add(string.Join("\t",
                rifAgente,                               // A: RIF del Agente de Retención
                periodo,                                 // B: Periodo Impositivo (AAAAMM)
                fechaFactura,                            // C: Fecha de Factura
                "C",                                     // D: Tipo de Operación (C = compras)
                tipoDocumento,                           // E: Tipo de documento
                rifProveedor,                            // F: RIF del Proveedor
                numeroFactura,                           // G: Número de Documento
                numeroControl,                           // H: Número de Control
                FormatearMontoTxt(r.MontoFacturaBs),     // I: Monto total del documento
                FormatearMontoTxt(r.BaseImponibleBs),    // J: Base Imponible
                FormatearMontoTxt(r.MontoRetenidoBs),    // K: Monto del IVA Retenido
                "0",                                     // L: Documento afectado (sin datos en el modelo)
                r.NumeroComprobante,                     // M: Número de Comprobante de Retención
                FormatearMontoTxt(montoExento),          // N: Monto Exento del IVA
                FormatearDecimal(r.PorcentajeRetencion), // O: Alícuota (75 | 100)
                string.Empty));                          // P: N° de Expediente (sin datos en el modelo)
        }

        if (errores.Count > 0)
            throw new InvalidOperationException("El TXT de IVA no puede generarse:\n- " + UnirErrores(errores));

        // PAGO CERO (art. 15 Providencia 0054): se declara aunque no haya habido
        // retenciones; en ese caso el archivo lleva UNA única línea con el RIF
        // del agente, el periodo (AAAAMM) y "0" en el resto de las 14 columnas:
        //   J300750949<TAB>202609<TAB>0<TAB>0… (16 columnas A-P).
        if (lineas.Count == 0)
            lineas.Add($"{rifAgente}\t{periodo}\t{string.Join("\t", Enumerable.Repeat("0", 14))}");

        var contenido = string.Join("\r\n", lineas) + "\r\n";

        var bytes = Encoding.GetEncoding("ISO-8859-1").GetBytes(contenido);
        return (bytes, $"RetIVA_{rifAgente}_{periodo}_Q{quincena}.txt");
    }

    // -------------------------------------------------------------------------
    // XML DE RETENCIONES DE ISLR (MENSUAL) — Manual Técnico SENIAT v2.3, 4.1
    // -------------------------------------------------------------------------
    public static (byte[] contenido, string nombreArchivo) GenerarXmlIslr(
        Empresa empresa, IEnumerable<RetencionIslrEmitida> retenciones, int anio, int mes)
    {
        var rifAgente = NormalizarRif(empresa?.RIF);
        if (!Regex.IsMatch(rifAgente, PatronRif))
            throw new InvalidOperationException(
                $"El RIF de la empresa («{empresa?.RIF}») no tiene el formato SENIAT (letra V/E/J/P/G + 9 dígitos).");

        var lista = (retenciones ?? Enumerable.Empty<RetencionIslrEmitida>()).ToList();
        if (lista.Count == 0)
            throw new InvalidOperationException(
                "No hay retenciones de ISLR emitidas en el periodo seleccionado: no hay archivo XML que generar.");

        var errores = new List<string>();
        var detalles = new List<XElement>();

        foreach (var r in lista)
        {
            var rifRetenido = NormalizarRif(r.ProveedorRif);
            if (!Regex.IsMatch(rifRetenido, PatronRif))
                errores.Add($"Comprobante {r.NumeroComprobante}: RIF del proveedor inválido («{r.ProveedorRif}»).");

            // Máximo 10 caracteres alfanuméricos; sin factura se declara "0".
            var factura = SanitizarAlfanumerico(r.NumeroFactura);
            if (factura.Length == 0) factura = "0";
            else if (factura.Length > 10) factura = factura[^10..];

            // Sólo el secuencial numérico del control (máx. 8); si no existe: NA.
            var control = SanitizarAlfanumerico(r.NumeroControl);
            if (control.Length == 0) control = "NA";
            else if (control.Length > 8) control = control[^8..];

            var codigo = (r.CodigoConcepto ?? string.Empty).Trim();
            if (!Regex.IsMatch(codigo, PatronCodigo))
                errores.Add($"Comprobante {r.NumeroComprobante}: código de concepto SENIAT ausente o inválido " +
                            $"(«{r.CodigoConcepto}»). Corrija el concepto del catálogo y re-emita la retención.");

            if (r.BaseImponibleBs < 0)
                errores.Add($"Comprobante {r.NumeroComprobante}: la base imponible no puede ser negativa.");

            // El sustraendo lo aplica automáticamente el portal (códigos 002,
            // 006, 010... del Decreto 1.808): aquí va la base imponible ENTERA.
            var porcentaje = Math.Round(r.PorcentajeRetencion, 2);
            if (porcentaje < 0 || porcentaje > 100)
                errores.Add($"Comprobante {r.NumeroComprobante}: porcentaje de retención fuera de rango (0-100): {r.PorcentajeRetencion}.");

            detalles.Add(new XElement("DetalleRetencion",
                new XElement("RifRetenido", rifRetenido),
                new XElement("NumeroFactura", factura),
                new XElement("NumeroControl", control),
                new XElement("CodigoConcepto", codigo),
                new XElement("MontoOperacion", FormatearMontoXml(r.BaseImponibleBs)),
                new XElement("PorcentajeRetencion", FormatearDecimal(porcentaje))));
        }

        if (errores.Count > 0)
            throw new InvalidOperationException("El XML de ISLR no puede generarse:\n- " + UnirErrores(errores));

        var documento = new XDocument(
            new XDeclaration("1.0", "utf-8", null),
            new XElement("RelacionRetencionesISLR",
                new XAttribute("RifAgente", rifAgente),
                new XAttribute("Periodo", FormatoPeriodo(anio, mes)),
                detalles));

        using var memoria = new MemoryStream();
        using (var escritor = XmlWriter.Create(memoria, new XmlWriterSettings
        {
            Encoding = new UTF8Encoding(false), // UTF-8 SIN BOM
            Indent = true
        }))
        {
            documento.Save(escritor);
        }

        var periodo = FormatoPeriodo(anio, mes);
        return (memoria.ToArray(), $"RetISLR_{rifAgente}_{periodo}.xml");
    }

    // -------------------------------------------------------------------------
    // AUXILIARES
    // -------------------------------------------------------------------------
    private static string NormalizarRif(string rif)
    {
        var limpio = new string((rif ?? string.Empty).Trim().ToUpperInvariant().Where(char.IsLetterOrDigit).ToArray());
        return limpio;
    }

    private static string SanitizarAlfanumerico(string valor)
    {
        return new string((valor ?? string.Empty).Trim().Where(char.IsLetterOrDigit).ToArray());
    }

    private static string FormatoPeriodo(int anio, int mes)
    {
        return anio.ToString("0000", CultureInfo.InvariantCulture) + mes.ToString("00", CultureInfo.InvariantCulture);
    }

    /// <summary>Montos del TXT: "0.00" con coma decimal (p. ej. 15000,63).</summary>
    private static string FormatearMontoTxt(decimal valor)
    {
        return valor.ToString("0.00", CulturaMontoTxt);
    }

    /// <summary>Montos del XML: PUNTO decimal, 2 decimales (p. ej. 15000.63).</summary>
    private static string FormatearMontoXml(decimal valor)
    {
        return valor.ToString("0.00", CultureInfo.InvariantCulture);
    }

    /// <summary>Decimales sin ceros sobrantes: 20 → "20", 4.95 → "4.95".</summary>
    private static string FormatearDecimal(decimal valor)
    {
        return valor.ToString("0.##", CultureInfo.InvariantCulture);
    }

    private static string UnirErrores(List<string> errores)
    {
        var muestra = string.Join("\n- ", errores.Take(10));
        return errores.Count > 10
            ? $"- {muestra}\n… y {errores.Count - 10} más."
            : $"- {muestra}";
    }
}


