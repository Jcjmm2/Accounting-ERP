using System.Text;
using System.Xml.Linq;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Diagnostics;
using System.Security.Claims;
using Tyted.API.Controllers;
using Tyted.API.Data;
using Tyted.API.Models;
using Tyted.API.Services;

namespace Tyted.Tests.Integracion;

/// <summary>
/// Pruebas de los generadores de ARCHIVOS SENIAT (Fase 5): TXT de Retenciones
/// de IVA quincenal (16 columnas A-P separadas por TABULADOR) y XML de
/// Retenciones de ISLR mensual (Manual Técnico SENIAT v2.3, esquema 4.1).
/// El formato se verifica contra las especificaciones del Portal Fiscal.
/// </summary>
public class DeclaracionesSeniatTests
{
    private static Empresa CrearEmpresa()
    {
        return new Empresa { Id = 1, RazonSocial = "Empresa de Pruebas C.A.", RIF = "J-308554839" };
    }

    // -------------------------------------------------------------------------
    // TXT DE RETENCIONES DE IVA (QUINCENAL — FORMA 99035)
    // -------------------------------------------------------------------------

    [Fact]
    public void GenerarTxtIva_SeparaPorTabulaciones_YFormateaLas16Columnas()
    {
        var retencion = new RetencionIvaEmitida
        {
            EmpresaId = 1,
            FechaRetencion = new DateTime(2026, 10, 5),
            NumeroComprobante = "20261000000804",
            ProveedorRif = "J-400123456",
            ProveedorNombre = "Proveedor de Pruebas",
            NumeroFactura = "F-00123",
            NumeroControl = "00-00123456",
            MontoFacturaBs = 1234.56m,
            BaseImponibleBs = 1000.00m,
            IvaCalculadoBs = 160.00m,
            PorcentajeRetencion = 75,
            MontoRetenidoBs = 120.00m,
            Estado = "Emitida"
        };
        // Sin Compra vinculada: se usa FechaRetencion y tipo de documento 01.

        var (contenido, nombre) = DeclaracionesSeniatService.GenerarTxtIva(
            CrearEmpresa(), new[] { retencion }, 2026, 10, quincena: 1);

        Assert.Equal("RetIVA_J308554839_202610_Q1.txt", nombre);

        var texto = Encoding.GetEncoding("ISO-8859-1").GetString(contenido);
        var lineas = texto.Split(new[] { "\r\n" }, StringSplitOptions.RemoveEmptyEntries);
        Assert.Single(lineas);

        var c = lineas[0].Split('\t');
        Assert.Equal(16, c.Length);                 // Columnas A-P
        Assert.Equal("J308554839", c[0]);           // A: RIF agente (sin guiones)
        Assert.Equal("202610", c[1]);               // B: Periodo impositivo AAAAMM
        Assert.Equal("05/10/2026", c[2]);           // C: Fecha dd/MM/aaaa
        Assert.Equal("C", c[3]);                    // D: compras
        Assert.Equal("01", c[4]);                   // E: Factura (sin Compra vinculada)
        Assert.Equal("J400123456", c[5]);           // F: RIF proveedor normalizado
        Assert.Equal("F-00123", c[6]);              // G: N° documento
        Assert.Equal("00-00123456", c[7]);          // H: N° control
        Assert.Equal("1234,56", c[8]);              // I: Monto total (coma decimal)
        Assert.Equal("1000,00", c[9]);              // J: Base imponible
        Assert.Equal("120,00", c[10]);              // K: IVA retenido
        Assert.Equal("0", c[11]);                   // L: Doc afectado (sin datos)
        Assert.Equal("20261000000804", c[12]);      // M: Comprobante
        Assert.Equal("74,56", c[13]);               // N: Exento = total - base - IVA
        Assert.Equal("75", c[14]);                  // O: Alícuota
        Assert.Equal(string.Empty, c[15]);          // P: Expediente (sin datos)
    }

    [Fact]
    public void GenerarTxtIva_PagoCero_ArchivoSinLineas()
    {
        var (contenido, nombre) = DeclaracionesSeniatService.GenerarTxtIva(
            CrearEmpresa(), Array.Empty<RetencionIvaEmitida>(), 2026, 10, quincena: 2);

        Assert.Equal("RetIVA_J308554839_202610_Q2.txt", nombre);
        Assert.Empty(contenido); // Pago cero: sin líneas de detalle (art. 15)
    }

    [Fact]
    public void RangoQuincena_CortaEnDia15Y16()
    {
        var (inicio1, fin1) = DeclaracionesSeniatService.RangoQuincena(2026, 2, 1);
        Assert.Equal(new DateTime(2026, 2, 1), inicio1);
        Assert.Equal(new DateTime(2026, 2, 15, 23, 59, 59), fin1);

        var (inicio2, fin2) = DeclaracionesSeniatService.RangoQuincena(2026, 2, 2);
        Assert.Equal(new DateTime(2026, 2, 16), inicio2);
        Assert.Equal(new DateTime(2026, 2, 28, 23, 59, 59), fin2); // 2026 no bisiesto
    }

    // -------------------------------------------------------------------------
    // XML DE RETENCIONES DE ISLR (MENSUAL — MANUAL TÉCNICO v2.3, ESQUEMA 4.1)
    // -------------------------------------------------------------------------

    [Fact]
    public void GenerarXmlIslr_ProduceLaEstructuraDelManualV23()
    {
        var retencion = new RetencionIslrEmitida
        {
            EmpresaId = 1,
            FechaRetencion = new DateTime(2026, 10, 8),
            NumeroComprobante = "20261000000001",
            ProveedorRif = "v123456789",
            ProveedorNombre = "Proveedor",
            NumeroFactura = "A152365482",
            NumeroControl = "00-00123456",
            BaseImponibleBs = 123356.45m,
            CodigoConcepto = "002",
            SustraendoBs = 1079.96m,
            PorcentajeRetencion = 15m,
            MontoRetenidoBs = 17368.47m,
            Estado = "Emitida"
        };

        var (contenido, nombre) = DeclaracionesSeniatService.GenerarXmlIslr(
            CrearEmpresa(), new[] { retencion }, 2026, 10);

        Assert.Equal("RetISLR_J308554839_202610.xml", nombre);

        var texto = Encoding.UTF8.GetString(contenido);
        Assert.StartsWith("<?xml", texto);
        Assert.Contains("encoding=\"utf-8\"", texto);

        var doc = XDocument.Parse(texto);
        Assert.Equal("RelacionRetencionesISLR", doc.Root!.Name.LocalName);
        Assert.Equal("J308554839", doc.Root.Attribute("RifAgente")!.Value);
        Assert.Equal("202610", doc.Root.Attribute("Periodo")!.Value);

        var detalle = doc.Root.Elements("DetalleRetencion").Single();

        // Orden de secuencia EXACTO del XSD 4.1.
        Assert.Equal(
            new[] { "RifRetenido", "NumeroFactura", "NumeroControl", "CodigoConcepto", "MontoOperacion", "PorcentajeRetencion" },
            detalle.Elements().Select(e => e.Name.LocalName).ToArray());

        Assert.Equal("V123456789", detalle.Element("RifRetenido")!.Value);   // RIF en mayúscula
        Assert.Equal("A152365482", detalle.Element("NumeroFactura")!.Value);
        Assert.Equal("00123456", detalle.Element("NumeroControl")!.Value);   // Sólo dígitos, máx. 8
        Assert.Equal("002", detalle.Element("CodigoConcepto")!.Value);
        Assert.Equal("123356.45", detalle.Element("MontoOperacion")!.Value); // PUNTO decimal
        Assert.Equal("15", detalle.Element("PorcentajeRetencion")!.Value);
    }

    [Fact]
    public void GenerarXmlIslr_SinRetenciones_LanzaError()
    {
        var excepcion = Assert.Throws<InvalidOperationException>(() =>
            DeclaracionesSeniatService.GenerarXmlIslr(CrearEmpresa(), Array.Empty<RetencionIslrEmitida>(), 2026, 10));

        Assert.Contains("No hay retenciones", excepcion.Message);
    }

    [Fact]
    public void GenerarXmlIslr_ConCodigoSeniatAusente_LanzaErrorIdentificandoElComprobante()
    {
        var retencion = new RetencionIslrEmitida
        {
            EmpresaId = 1,
            FechaRetencion = new DateTime(2026, 10, 8),
            NumeroComprobante = "20261000000009",
            ProveedorRif = "J308554839",
            NumeroFactura = "1",
            NumeroControl = "NA",
            BaseImponibleBs = 100m,
            CodigoConcepto = null, // El XSD exige 3 dígitos
            PorcentajeRetencion = 3m,
            MontoRetenidoBs = 3m,
            Estado = "Emitida"
        };

        var excepcion = Assert.Throws<InvalidOperationException>(() =>
            DeclaracionesSeniatService.GenerarXmlIslr(CrearEmpresa(), new[] { retencion }, 2026, 10));

        Assert.Contains("20261000000009", excepcion.Message);
        Assert.Contains("código de concepto", excepcion.Message);
    }

    // -------------------------------------------------------------------------
    // CONTROLADOR (aislamiento por empresa + descarga del archivo)
    // -------------------------------------------------------------------------

    private static TytedContext CrearContexto()
    {
        var options = new DbContextOptionsBuilder<TytedContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .ConfigureWarnings(w => w.Ignore(InMemoryEventId.TransactionIgnoredWarning))
            .Options;

        return new TytedContext(options);
    }

    private static DeclaracionesController CrearController(TytedContext context, string rol = "AdministradorSistema")
    {
        context.Usuarios.Add(new Usuario
        {
            Id = 1,
            Username = "admin.test",
            NombreCompleto = "Admin de Pruebas",
            Rol = rol,
            Activo = true
        });
        context.SaveChanges();

        var identity = new ClaimsIdentity(new[]
        {
            new Claim(ClaimTypes.NameIdentifier, "1"),
            new Claim(ClaimTypes.Role, rol)
        }, "Test");

        return new DeclaracionesController(context, new EmpresaAccessService(context))
        {
            ControllerContext = new ControllerContext
            {
                HttpContext = new DefaultHttpContext { User = new ClaimsPrincipal(identity) }
            }
        };
    }

    [Fact]
    public async Task GetTxtIva_UsuarioSinAccesoALaEmpresa_ReturnsForbidden()
    {
        using var context = CrearContexto();
        // Rol sin empresas asignadas: el aislamiento multiempresa debe bloquear.
        var controller = CrearController(context, rol: "Cajero");

        await Assert.ThrowsAsync<ForbiddenAccessException>(() =>
            controller.GetTxtIva(empresaId: 1, anio: 2026, mes: 10, quincena: 1));
    }

    [Fact]
    public async Task GetTxtIva_Admin_DevuelveElArchivoConNombreSeniat()
    {
        using var context = CrearContexto();
        context.Empresa.Add(new Empresa { Id = 1, RazonSocial = "Pruebas", RIF = "J308554839" });
        context.RetencionesIvaEmitidas.Add(new RetencionIvaEmitida
        {
            EmpresaId = 1,
            FechaRetencion = new DateTime(2026, 10, 5),
            NumeroComprobante = "20261000000001",
            ProveedorRif = "J400123456",
            NumeroFactura = "1",
            MontoFacturaBs = 100m,
            BaseImponibleBs = 100m,
            IvaCalculadoBs = 16m,
            PorcentajeRetencion = 75,
            MontoRetenidoBs = 12m,
            Estado = "Emitida"
        });
        var controller = CrearController(context);

        var accion = await controller.GetTxtIva(empresaId: 1, anio: 2026, mes: 10, quincena: 1);

        var archivo = Assert.IsType<FileContentResult>(accion);
        Assert.Equal("text/plain", archivo.ContentType);
        Assert.Equal("RetIVA_J308554839_202610_Q1.txt", archivo.FileDownloadName);
        Assert.NotEmpty(archivo.FileContents);
    }
}
