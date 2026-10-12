using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Tyted.API.Data;
using Tyted.API.Models;
using Tyted.API.Services;

namespace Tyted.API.Controllers;

/// <summary>
/// API de GASTOS del módulo fiscal (Origen='Fiscal'): consulta por periodo/
/// empresa, alta y contabilización con el motor de asientos automáticos.
/// No tocan inventario ni el módulo de compras.
/// </summary>
[Route("api/gastos")]
[ApiController]
[Authorize(Roles = "AdministradorSistema,Administrador,Analista,Comprador")]
public class GastosController : ControllerBase
{
    private readonly GastoService _gastoService;
    private readonly MotorAsientosAutomaticos _motor;
    private readonly TytedContext _context;
    private readonly EmpresaAccessService _access;

    public GastosController(GastoService gastoService, MotorAsientosAutomaticos motor, TytedContext context, EmpresaAccessService access)
    {
        _gastoService = gastoService;
        _motor = motor;
        _context = context;
        _access = access;
    }

    /// <summary>Gastos del periodo/empresa activos (filtros opcionales).</summary>
    [HttpGet]
    public async Task<ActionResult<List<Gasto>>> GetGastos(
        [FromQuery] int? empresaId,
        [FromQuery] DateTime? fechaInicio,
        [FromQuery] DateTime? fechaFin)
    {
        // AISLAMIENTO POR EMPRESA
        if (empresaId.HasValue)
            await _access.ValidarAccesoAsync(User, empresaId.Value);

        var lista = await _gastoService.GetListAsync(empresaId, fechaInicio, fechaFin);
        return Ok(lista);
    }

    /// <summary>Alta de un gasto fiscal (valida periodo contable abierto).</summary>
    [HttpPost]
    public async Task<ActionResult<Gasto>> CrearGasto([FromBody] Gasto gasto)
    {
        if (gasto is null)
            return BadRequest(new { message = "El cuerpo de la petición no es un gasto válido." });

        await _access.ValidarAccesoAsync(User, gasto.EmpresaId);

        try
        {
            var usuario = User.Identity?.Name;
            var creado = await _gastoService.CrearGastoAsync(gasto, usuario);
            return Ok(creado);
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
        catch (Exception ex)
        {
            return BadRequest(new { message = $"No se pudo registrar el gasto: {ex.Message}" });
        }
    }

    /// <summary>
    /// Genera el comprobante contable del gasto (Debe Gastos | Haber Caja o
    /// Proveedores) con el motor de asientos; idempotente.
    /// </summary>
    [HttpPost("{id}/contabilizar")]
    public async Task<ActionResult<MotorAsientosResponse>> ContabilizarGasto(int id)
    {
        var gasto = await _context.Gastos.FirstOrDefaultAsync(g => g.Id == id);
        if (gasto == null) return NotFound(new { message = "El gasto no existe." });

        try
        {
            var usuarioId = await ObtenerUsuarioIdAsync();
            var respuesta = await _motor.GenerarAsientoGastoAsync(gasto, usuarioId);
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