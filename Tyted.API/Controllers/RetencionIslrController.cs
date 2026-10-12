using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Tyted.API.Models;
using Tyted.API.Services;

namespace Tyted.API.Controllers;

/// <summary>
/// API de Retenciones de ISLR emitidas (Impuesto Sobre la Renta): consulta por
/// periodo/empresa y emisión del comprobante. El monto retenido se guarda y
/// devuelve YA en Bolívares (Bs.), congelado al momento de emitir (valor legal
/// SENIAT, inmutable ante cambios de tasa).
/// </summary>
[Route("api/retenciones-islr")]
[ApiController]
[Authorize(Roles = "AdministradorSistema,Administrador,Analista,Comprador")]
public class RetencionIslrController : ControllerBase
{
    private readonly RetencionIslrService _service;
    private readonly EmpresaAccessService _access;

    public RetencionIslrController(RetencionIslrService service, EmpresaAccessService access)
    {
        _service = service;
        _access = access;
    }

    /// <summary>Retenciones ISLR del periodo/empresa activos (filtros opcionales).</summary>
    [HttpGet]
    public async Task<ActionResult<List<RetencionIslrEmitida>>> GetRetenciones(
        [FromQuery] int? empresaId,
        [FromQuery] DateTime? fechaInicio,
        [FromQuery] DateTime? fechaFin)
    {
        // AISLAMIENTO POR EMPRESA: si se pide una empresa concreta, validar acceso.
        if (empresaId.HasValue)
            await _access.ValidarAccesoAsync(User, empresaId.Value);

        var lista = await _service.GetListAsync(empresaId, fechaInicio, fechaFin);
        return Ok(lista);
    }

    /// <summary>Emite el comprobante de retención de ISLR (base imponible en Bs.).</summary>
    [HttpPost]
    public async Task<ActionResult<RetencionIslrEmitida>> Emitir([FromBody] EmitirRetencionIslrRequest request)
    {
        if (request is null)
            return BadRequest(new { message = "La petición no es válida." });
        if (request.EmpresaId <= 0)
            return BadRequest(new { message = "Indique la empresa activa (empresaId)." });
        if (request.BaseImponibleBs <= 0)
            return BadRequest(new { message = "La base imponible en Bolívares (baseImponibleBs) debe ser mayor a cero." });
        if (request.PorcentajeRetencion <= 0)
            return BadRequest(new { message = "Indique el porcentaje de retención de ISLR." });

        await _access.ValidarAccesoAsync(User, request.EmpresaId);

        try
        {
            var retencion = await _service.EmitirAsync(
                request.EmpresaId,
                request.BaseImponibleBs,
                request.PorcentajeRetencion,
                request.TasaDeCambio,
                request.CompraId,
                request.ProveedorRif,
                request.ProveedorNombre,
                request.NumeroFactura,
                request.NumeroControl);
            return Ok(retencion);
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }
}

/// <summary>Solicitud de emisión de un comprobante de retención de ISLR.</summary>
public class EmitirRetencionIslrRequest
{
    public int EmpresaId { get; set; }
    /// <summary>Base imponible sujeta a retención, EXPRESADA EN BOLÍVARES (Bs.).</summary>
    public decimal BaseImponibleBs { get; set; }
    /// <summary>Porcentaje de retención ISLR (ej: 2, 3, 4, 6, 34).</summary>
    public decimal PorcentajeRetencion { get; set; }
    /// <summary>Tasa Bs./USD congelada al momento de emitir (para referencia USD).</summary>
    public decimal TasaDeCambio { get; set; } = 1m;
    public int? CompraId { get; set; }
    public string? ProveedorRif { get; set; }
    public string? ProveedorNombre { get; set; }
    public string? NumeroFactura { get; set; }
    public string? NumeroControl { get; set; }
}