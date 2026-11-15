using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Tyted.API.Data;
using Tyted.API.Models;
using Tyted.API.Services;

namespace Tyted.API.Controllers;

/// <summary>
/// Actualización de GASTOS fiscales desde el modal unificado de Consulta/Edición
/// (endpoint PUT /api/fiscal/gastos/{id}). Aplica protección contable: cuando el
/// gasto ya tiene comprobante (AsientoContableId) o una retención de ISLR emitida,
/// sólo se permiten corregir metadatos fiscales (N° factura / N° control / tipo
/// SENIAT / descripción); los montos, proveedor, fecha y concepto contable quedan
/// bloqueados para no romper el cuadre.
/// </summary>
[Route("api/fiscal/gastos")]
[ApiController]
[Authorize(Roles = "AdministradorSistema,Administrador,Analista,Comprador")]
public class GastosFiscalesController : ControllerBase
{
    private readonly TytedContext _context;
    private readonly EmpresaAccessService _access;

    public GastosFiscalesController(TytedContext context, EmpresaAccessService access)
    {
        _context = context;
        _access = access;
    }

    [HttpPut("{id:int}")]
    public async Task<IActionResult> Actualizar(int id, [FromBody] ActualizarGastoFiscalDto dto)
    {
        var gasto = await _context.Gastos
            .Include(g => g.Proveedor)
            .FirstOrDefaultAsync(g => g.Id == id);
        if (gasto == null) return NotFound(new { message = "Gasto fiscal no encontrado." });
        if (gasto.IsAnulada) return BadRequest(new { message = "No se puede editar un gasto anulado." });

        await _access.ValidarAccesoAsync(User, gasto.EmpresaId);

        // Protección contable: asiento contable o retención de ISLR vigente.
        var tieneRetencion = await _context.RetencionesIslrEmitidas
            .AnyAsync(r => r.GastoId == id && r.Estado == "Emitida");
        bool bloqueadoContable = gasto.AsientoContableId.HasValue || tieneRetencion;

        if (dto is null)
            return BadRequest(new { message = "Cuerpo de actualización inválido." });

        // Metadatos fiscales SIEMPRE editables (no alteran el cuadre contable).
        if (!string.IsNullOrWhiteSpace(dto.NumeroFactura))
            gasto.NumeroFactura = dto.NumeroFactura.Trim();
        if (!string.IsNullOrWhiteSpace(dto.NumeroControl))
            gasto.NumeroControl = dto.NumeroControl.Trim();
        if (!string.IsNullOrWhiteSpace(dto.TipoTransaccion))
        {
            if (dto.TipoTransaccion is not ("01" or "02" or "03"))
                return BadRequest(new { message = "El tipo de transacción SENIAT debe ser 01, 02 o 03." });
            gasto.TipoTransaccion = dto.TipoTransaccion;
        }
        if (!string.IsNullOrWhiteSpace(dto.Concepto))
            gasto.Concepto = dto.Concepto.Trim();

        // Datos con impacto contable/tributario: solo si no está bloqueado.
        if (!bloqueadoContable)
        {
            if (dto.Fecha != default)
                gasto.Fecha = dto.Fecha;
            // Permitido en ambos sentidos: elegir proveedor o dejarlo en «SIN PROVEEDOR».
            gasto.CodigoProv = dto.ProveedorId;
            gasto.ConceptoOperacionalId = dto.ConceptoOperacionalId;

            // Montos congelados en Bs.: base = exento + gravada; IVA por separado.
            decimal baseBs = (dto.Exento ?? 0m) + (dto.BaseGravada ?? 0m);
            if (baseBs > 0)
            {
                gasto.MontoMonedaExt = Math.Round(baseBs, 2, MidpointRounding.AwayFromZero);
                gasto.IvaMonedaExt = Math.Round(dto.Iva ?? 0m, 2, MidpointRounding.AwayFromZero);
                // Moneda base (USD) derivada con la tasa congelada para el asiento.
                if (gasto.TasaDeCambio > 0)
                    gasto.Monto = Math.Round(baseBs / gasto.TasaDeCambio, 2, MidpointRounding.AwayFromZero);
            }
        }

        await _context.SaveChangesAsync();
        return Ok(gasto);
    }
}

/// <summary>Cuerpo del PUT /api/fiscal/gastos/{id} (nombres del modal de edición).</summary>
public class ActualizarGastoFiscalDto
{
    public DateTime Fecha { get; set; }
    public int? ProveedorId { get; set; }
    public string? NumeroFactura { get; set; }
    public string? NumeroControl { get; set; }
    public string? TipoTransaccion { get; set; }
    public int? ConceptoOperacionalId { get; set; }
    public string? Concepto { get; set; }
    public decimal? Exento { get; set; }
    public decimal? BaseGravada { get; set; }
    public decimal? TasaIVA { get; set; }
    public decimal? Iva { get; set; }
    public decimal? Total { get; set; }
}
