using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Tyted.API.Models;
using Tyted.API.Services;

namespace Tyted.API.Controllers;

/// <summary>
/// API de Retenciones de IVA emitidas (Libro de Compras SENIAT, plan BE-TAX-201):
/// consulta por periodo/empresa y emisión del comprobante oficial (75%/100%)
/// con correlativo SENIAT AAAAMM + 8 dígitos.
/// </summary>
[Route("api/retenciones-iva")]
[ApiController]
[Authorize(Roles = "AdministradorSistema,Administrador,Analista,Comprador")]
public class RetencionesIvaController : ControllerBase
{
    private readonly RetencionIvaService _service;

    public RetencionesIvaController(RetencionIvaService service)
    {
        _service = service;
    }

    /// <summary>Retenciones del periodo/empresa activos (filtros opcionales).</summary>
    [HttpGet]
    public async Task<ActionResult<List<RetencionIvaEmitida>>> GetRetenciones(
        [FromQuery] int? empresaId,
        [FromQuery] DateTime? fechaInicio,
        [FromQuery] DateTime? fechaFin)
    {
        var lista = await _service.GetListAsync(empresaId, fechaInicio, fechaFin);
        return Ok(lista);
    }

    /// <summary>Emite el comprobante de retención del IVA de una factura de compra.</summary>
    [HttpPost]
    public async Task<ActionResult<RetencionIvaEmitida>> Emitir([FromBody] EmitirRetencionIvaRequest request)
    {
        if (request is null || request.CompraId <= 0)
            return BadRequest(new { message = "Indique la factura de compra (compraId)." });
        if (request.EmpresaId <= 0)
            return BadRequest(new { message = "Indique la empresa activa (empresaId)." });

        try
        {
            var retencion = await _service.EmitirAsync(request.CompraId, request.EmpresaId, request.Porcentaje);
            return Ok(retencion);
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }
}

/// <summary>Solicitud de emisión de un comprobante de retención de IVA.</summary>
public class EmitirRetencionIvaRequest
{
    public int CompraId { get; set; }
    public int EmpresaId { get; set; }
    /// <summary>75 o 100 (porcentaje sobre el IVA de la factura).</summary>
    public int Porcentaje { get; set; } = 75;
}