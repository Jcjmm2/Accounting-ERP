using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Tyted.API.Data;
using Tyted.API.Models;
using Tyted.API.Services;

namespace Tyted.API.Controllers.Contabilidad;

[Route("api/contabilidad")]
[ApiController]
[Authorize(Roles = "AdministradorSistema,Administrador,Analista")]
public class AsientosController : ControllerBase
{
    private readonly AsientoContableService _service;
    private readonly EmpresaAccessService _access;
    private readonly TytedContext _context;
    private readonly MotorAsientosAutomaticos _motor;

    public AsientosController(
        AsientoContableService service,
        EmpresaAccessService access,
        TytedContext context,
        MotorAsientosAutomaticos motor)
    {
        _service = service;
        _access = access;
        _context = context;
        _motor = motor;
    }

    // MEJORA 1: Se añade el parámetro opcional para filtrar por el periodo activo
    [HttpGet("asientos")]
    public async Task<ActionResult<List<AsientoContable>>> GetAsientos([FromQuery] int? periodoContableId, [FromQuery] int? empresaId)
    {
        // AISLAMIENTO POR EMPRESA
        if (empresaId.HasValue)
            await _access.ValidarAccesoAsync(User, empresaId.Value);

        // Filtros opcionales: el frontend puede traer los asientos de un periodo y/o de la empresa activa
        var asientos = await _service.GetAsientosAsync(periodoContableId, empresaId);
        return Ok(asientos);
    }

    [HttpPost("asientos")]
    public async Task<ActionResult<AsientoContable>> CrearAsiento([FromBody] AsientoContable asiento)
    {
        // Si el JSON venía con "id": null la deserialización falla y el parámetro llega en null.
        // Devolvemos un mensaje claro en vez de una NullReferenceException genérica.
        if (asiento is null)
        {
            return BadRequest(new { message = "El cuerpo de la petición no es un asiento válido. Verifica que 'id' no sea null y que los campos obligatorios estén presentes." });
        }

        await _access.ValidarAccesoAsync(User, asiento.EmpresaId);

        try
        {
            var creado = await _service.CrearAsientoAsync(asiento);
            return Ok(creado);
        }
        catch (Exception ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    // MEJORA 2: Se añade el endpoint PUT para procesar la edición del asiento y sus detalles
    [HttpPut("asientos/{id}")]
    public async Task<IActionResult> ActualizarAsiento(int id, [FromBody] AsientoContable asiento)
    {
        if (asiento is null)
        {
            return BadRequest(new { message = "El cuerpo de la petición no es un asiento válido. Verifica que 'id' no sea null." });
        }

        // Validación de seguridad básica
        if (asiento.Id != 0 && id != asiento.Id)
        {
            return BadRequest(new { message = "Inconsistencia de datos: El ID de la ruta no coincide con el cuerpo de la petición." });
        }

        await _access.ValidarAccesoAsync(User, asiento.EmpresaId);

        try
        {
            // Nota: Debes crear este método 'ActualizarAsientoAsync' en tu AsientoContableService
            var actualizado = await _service.ActualizarAsientoAsync(id, asiento);
            
            if (actualizado == null)
            {
                return NotFound(new { message = $"No se encontró el asiento con ID {id} en la base de datos." });
            }
            
            return Ok(actualizado);
        }
        catch (Exception ex)
        {
            return BadRequest(new { message = $"Error al actualizar el asiento: {ex.Message}" });
        }
    }

    /// <summary>
    /// Genera el asiento de cierre que traslada el resultado del periodo
    /// (utilidad o pérdida) a una cuenta de patrimonio ("Resultados del
    /// ejercicio"). Si el periodo ya tiene un cierre generado por el sistema,
    /// responde 400 salvo que se envíe regenerar=true (lo reemplaza).
    /// </summary>
    [HttpPost("asientos/cierre-resultados")]
    public async Task<ActionResult<CierreResultadosResponse>> GenerarCierreResultados([FromBody] CierreResultadosRequest? request)
    {
        if (request is null || request.PeriodoId <= 0)
            return BadRequest(new { message = "Indique el periodo contable a cerrar (periodoId)." });

        if (request.EmpresaId <= 0)
            return BadRequest(new { message = "Indique la empresa a la que pertenece el periodo (empresaId)." });

        await _access.ValidarAccesoAsync(User, request.EmpresaId);

        try
        {
            var resultado = await _service.GenerarAsientoCierreResultadosAsync(
                request.PeriodoId,
                request.EmpresaId,
                request.UsuarioId,
                request.Usuario,
                request.Regenerar);

            return Ok(resultado);
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    // -------------------------------------------------------------------------
    // REGENERACIÓN DE COMPROBANTES FISCALES EN BOLÍVARES (moneda legal del
    // libro contable). Reemplaza los asientos generados por el motor en otra
    // moneda (USD) para ventas/compras/gastos del rango indicado: SÓLO borra
    // comprobantes cuyo periodo esté ABIERTO y sólo si existe periodo abierto
    // para la fecha del documento; los periodos cerrados no se tocan.
    // -------------------------------------------------------------------------
    [HttpPost("asientos/regenerar-fiscal")]
    [Authorize(Roles = "AdministradorSistema,Administrador")]
    public async Task<ActionResult<RegenerarFiscalResponse>> RegenerarFiscal([FromBody] RegenerarFiscalRequest request)
    {
        if (request is null || request.EmpresaId <= 0)
            return BadRequest(new { message = "Indique la empresa (empresaId)." });
        if (request.FechaFin.Date < request.FechaInicio.Date)
            return BadRequest(new { message = "El rango de fechas no es válido (fin < inicio)." });

        await _access.ValidarAccesoAsync(User, request.EmpresaId);

        var inicio = request.FechaInicio.Date;
        var finExclusivo = request.FechaFin.Date.AddDays(1);
        var usuarioId = await ObtenerUsuarioIdAsync();
        var respuesta = new RegenerarFiscalResponse();

        var ventas = await _context.Ventas
            .Where(v => v.EmpresaId == request.EmpresaId
                && v.AsientoContableId != null
                && v.FechaVenta >= inicio && v.FechaVenta < finExclusivo)
            .ToListAsync();
        foreach (var venta in ventas)
        {
            if (venta.IsAnulada) { respuesta.Omitidos++; respuesta.Mensajes.Add($"Venta {venta.NumeroFactura}: anulada — no se regenera."); continue; }
            var id = venta.AsientoContableId!.Value;
            await RegenerarDocumentoAsync(
                id, venta.FechaVenta, venta.EmpresaId,
                $"Venta {venta.NumeroFactura}",
                () => venta.AsientoContableId = null,
                () => _motor.GenerarAsientoVentaAsync(venta, usuarioId),
                respuesta);
        }

        var compras = await _context.Compras
            .Where(c => c.EmpresaId == request.EmpresaId
                && c.AsientoContableId != null
                && c.FechaCompra >= inicio && c.FechaCompra < finExclusivo)
            .ToListAsync();
        foreach (var compra in compras)
        {
            if (compra.IsAnulada) { respuesta.Omitidos++; respuesta.Mensajes.Add($"Compra {compra.NumeroFactura}: anulada — no se regenera."); continue; }
            var id = compra.AsientoContableId!.Value;
            await RegenerarDocumentoAsync(
                id, compra.FechaCompra, compra.EmpresaId,
                $"Compra {compra.NumeroFactura}",
                () => compra.AsientoContableId = null,
                () => _motor.GenerarAsientoCompraAsync(compra, usuarioId),
                respuesta);
        }

        var gastos = await _context.Gastos
            .Where(g => g.EmpresaId == request.EmpresaId
                && g.AsientoContableId != null
                && g.Fecha >= inicio && g.Fecha < finExclusivo)
            .ToListAsync();
        foreach (var gasto in gastos)
        {
            if (gasto.IsAnulada) { respuesta.Omitidos++; respuesta.Mensajes.Add($"Gasto «{gasto.Concepto}»: anulado — no se regenera."); continue; }
            var id = gasto.AsientoContableId!.Value;
            await RegenerarDocumentoAsync(
                id, gasto.Fecha, gasto.EmpresaId,
                $"Gasto «{gasto.Concepto}»",
                () => gasto.AsientoContableId = null,
                () => _motor.GenerarAsientoGastoAsync(gasto, usuarioId),
                respuesta);
        }

        return Ok(respuesta);
    }

    /// <summary>
    /// Borra el comprobante viejo (sólo si su periodo está ABIERTO y existe
    /// periodo abierto para la fecha del documento) y lo regenera con el motor
    /// ya corregido a BOLÍVARES. Si la regeneración falla, el documento queda
    /// sin comprobante (vínculo limpio) para reintentarlo desde la UI.
    /// </summary>
    private async Task RegenerarDocumentoAsync(
        int asientoId,
        DateTime fechaDocumento,
        int empresaId,
        string etiqueta,
        Action limpiarVinculo,
        Func<Task<MotorAsientosResponse>> generar,
        RegenerarFiscalResponse respuesta)
    {
        var asiento = await _context.AsientosContables
            .Include(a => a.PeriodoContable)
            .FirstOrDefaultAsync(a => a.Id == asientoId);

        if (asiento is null)
        {
            limpiarVinculo();
            await _context.SaveChangesAsync();
            respuesta.Omitidos++;
            respuesta.Mensajes.Add($"{etiqueta}: el comprobante no existe; vínculo limpiado.");
            return;
        }

        if (asiento.PeriodoContable != null
            && (asiento.PeriodoContable.Cerrado || asiento.PeriodoContable.Estado == "Cerrado"))
        {
            respuesta.Omitidos++;
            respuesta.Mensajes.Add($"{etiqueta}: el comprobante está en un periodo CERRADO — no se regenera (abra el periodo para migrarlo).");
            return;
        }

        var hayPeriodoAbierto = await _context.PeriodosContables.AnyAsync(p => p.EmpresaId == empresaId
            && p.FechaInicio.Date <= fechaDocumento.Date
            && p.FechaFin.Date >= fechaDocumento.Date
            && !p.Cerrado
            && p.Estado != "Cerrado");
        if (!hayPeriodoAbierto)
        {
            respuesta.Omitidos++;
            respuesta.Mensajes.Add($"{etiqueta}: sin periodo ABIERTO para {fechaDocumento:dd/MM/yyyy} — no se regenera.");
            return;
        }

        // Limpia el vínculo, elimina el comprobante viejo (los detalles caen
        // en cascada) y regenera con el motor en Bs.
        limpiarVinculo();
        _context.AsientosContables.Remove(asiento);
        await _context.SaveChangesAsync();

        try
        {
            var r = await generar();
            if (r.Generada)
            {
                respuesta.Regenerados++;
                respuesta.Mensajes.Add($"{etiqueta}: regenerado {r.NumeroComprobante} (total Bs. {r.TotalDebe:0.00}).");
            }
            else
            {
                respuesta.Fallidos++;
                respuesta.Mensajes.Add($"{etiqueta}: NO regenerado — {r.Advertencia ?? r.Mensaje}");
            }
        }
        catch (Exception ex)
        {
            respuesta.Fallidos++;
            respuesta.Mensajes.Add($"{etiqueta}: ERROR al regenerar — {ex.Message}");
        }
    }

    /// <summary>Id real del usuario autenticado (auditoría y comprobantes).</summary>
    private async Task<int> ObtenerUsuarioIdAsync()
    {
        var nombre = User.Identity?.Name;
        if (string.IsNullOrEmpty(nombre)) return 1;
        var usuario = await _context.Usuarios.AsNoTracking().FirstOrDefaultAsync(u => u.Username == nombre);
        return usuario?.Id ?? 1;
    }
}

/// <summary>Solicitud de regeneración de comprobantes fiscales en Bolívares.</summary>
public class RegenerarFiscalRequest
{
    public int EmpresaId { get; set; }
    /// <summary>Inicio del rango (inclusive, sólo fecha).</summary>
    public DateTime FechaInicio { get; set; }
    /// <summary>Fin del rango (inclusive, sólo fecha).</summary>
    public DateTime FechaFin { get; set; }
}

/// <summary>Resultado de la regeneración de comprobantes en Bolívares.</summary>
public class RegenerarFiscalResponse
{
    public int Regenerados { get; set; }
    public int Omitidos { get; set; }
    public int Fallidos { get; set; }
    public List<string> Mensajes { get; set; } = new();
}

/// <summary>Solicitud de generación del asiento de cierre de resultados.</summary>
/// <summary>Solicitud de generación del asiento de cierre de resultados.</summary>
public class CierreResultadosRequest
{
    public int PeriodoId { get; set; }
    public int EmpresaId { get; set; }
    public int UsuarioId { get; set; } = 1;
    public string? Usuario { get; set; }
    /// <summary>Reemplaza el cierre previo del sistema si ya existía.</summary>
    public bool Regenerar { get; set; }
}
