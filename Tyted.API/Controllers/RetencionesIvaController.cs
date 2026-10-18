using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Tyted.API.Data;
using Tyted.API.Models;
using Tyted.API.Services;

namespace Tyted.API.Controllers;

/// <summary>
/// API de Retenciones de IVA emitidas (Libro de Compras SENIAT, plan BE-TAX-201):
/// consulta por periodo/empresa, emision del comprobante oficial (75%/100%)
/// con correlativo SENIAT AAAAMM + 8 digitos y contabilizacion en compras de
/// CONTADO (el asiento de CRÉDITO se genera con el pago de la factura).
/// </summary>
[Route("api/retenciones-iva")]
[ApiController]
[Authorize(Roles = "AdministradorSistema,Administrador,Analista,Comprador")]
public class RetencionesIvaController : ControllerBase
{
    private readonly RetencionIvaService _service;
    private readonly EmpresaAccessService _access;
    private readonly TytedContext _context;

    public RetencionesIvaController(RetencionIvaService service, EmpresaAccessService access, TytedContext context)
    {
        _service = service;
        _access = access;
        _context = context;
    }

    /// <summary>Retenciones del periodo/empresa activos (filtros opcionales).</summary>
    [HttpGet]
    public async Task<ActionResult<List<RetencionIvaEmitida>>> GetRetenciones(
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

    /// <summary>Emite el comprobante de retencion del IVA de una factura de compra.</summary>
    [HttpPost]
    public async Task<ActionResult<RetencionIvaEmitida>> Emitir([FromBody] EmitirRetencionIvaRequest request)
    {
        if (request is null || request.CompraId <= 0)
            return BadRequest(new { message = "Indique la factura de compra (compraId)." });
        if (request.EmpresaId <= 0)
            return BadRequest(new { message = "Indique la empresa activa (empresaId)." });

        await _access.ValidarAccesoAsync(User, request.EmpresaId);

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

    /// <summary>
    /// Contabiliza la retencion de IVA de una factura de CONTADO
    /// (Debe Caja | Haber IVA Retenido por Entregar). En compras a CREDITO el
    /// asiento se genera al registrar el pago (POST Compras/{id}/registrar-pago).
    /// Idempotente: si ya tiene comprobante no se duplica.
    /// </summary>
    [HttpPost("{id}/contabilizar")]
    public async Task<ActionResult<MotorAsientosResponse>> Contabilizar(int id)
    {
        var retencion = await _service.GetPorIdAsync(id);
        if (retencion == null) return NotFound(new { message = "La retención de IVA no existe." });

        await _access.ValidarAccesoAsync(User, retencion.EmpresaId);

        try
        {
            var usuarioId = await ObtenerUsuarioIdAsync();
            var respuesta = await _service.ContabilizarAsync(id, usuarioId);
            return Ok(respuesta);
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { message = ex.Message });
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

/// <summary>Solicitud de emision de un comprobante de retencion de IVA.</summary>
public class EmitirRetencionIvaRequest
{
    public int CompraId { get; set; }
    public int EmpresaId { get; set; }
    /// <summary>75 o 100 (porcentaje sobre el IVA de la factura).</summary>
    public int Porcentaje { get; set; } = 75;
}