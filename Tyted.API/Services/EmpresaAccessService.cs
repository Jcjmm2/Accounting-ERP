using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;
using Tyted.API.Data;

namespace Tyted.API.Services;

/// <summary>
/// Servicio CENTRAL de autorización por empresa (Multi-Tenant). Único punto de
/// verdad para responder: ¿puede este usuario acceder a esta empresa?
///
/// REGLA DE NEGOCIO:
///  - "AdministradorSistema" ve TODAS las empresas (dinámicamente por rol, no
///    depende de la tabla intermedia; por eso las empresas creadas después
///    también le aparecen).
///  - Cualquier otro rol (Administrador, Cajero, etc.) ve SÓLO las empresas
///    asignadas en la tabla UsuarioEmpresa.
///
/// Uso en controladores: inyectar y llamar ValidarAccesoAsync(User, empresaId)
/// al inicio de cada endpoint que reciba un empresaId.
/// </summary>
public class EmpresaAccessService
{
    private readonly TytedContext _context;

    public EmpresaAccessService(TytedContext context)
    {
        _context = context;
    }

    /// <summary>Lee el Id del usuario desde los claims del JWT (NameIdentifier).</summary>
    public int? GetUsuarioId(ClaimsPrincipal user)
    {
        var raw = user?.FindFirstValue(ClaimTypes.NameIdentifier)
                  ?? user?.FindFirstValue("nameid")
                  ?? user?.FindFirstValue("sub");
        return int.TryParse(raw, out var id) && id > 0 ? id : null;
    }

    /// <summary>True si el usuario autenticado tiene el rolAdministradorSistema.</summary>
    public bool EsAdminSistema(ClaimsPrincipal user)
        => user?.IsInRole("AdministradorSistema") == true;

    /// <summary>
    /// IDs de empresas permitidas para el usuario. Devuelve null cuando es
    /// AdministradorSistema (significa "TODAS las empresas").
    /// </summary>
    public async Task<List<int>?> EmpresasPermitidasAsync(int usuarioId)
    {
        var usuario = await _context.Usuarios
            .AsNoTracking()
            .FirstOrDefaultAsync(u => u.Id == usuarioId);

        // AdministradorSistema: acceso total, sin depender de la tabla intermedia.
        if (usuario != null && usuario.Rol == "AdministradorSistema")
            return null;

        return await _context.UsuariosEmpresas
            .AsNoTracking()
            .Where(ue => ue.UsuarioId == usuarioId)
            .Select(ue => ue.EmpresaId)
            .ToListAsync();
    }

    /// <summary>True si el usuario puede acceder a la empresa indicada.</summary>
    public async Task<bool> TieneAccesoAsync(int usuarioId, int empresaId)
    {
        var permitidas = await EmpresasPermitidasAsync(usuarioId);
        if (permitidas == null) return true; // AdministradorSistema
        return permitidas.Contains(empresaId);
    }

    /// <summary>
    /// Valida el acceso y lanza Forbidden (403) si no puede operar esa empresa.
    /// Para llamar al inicio de cada endpoint que reciba empresaId. Se usa 403
    /// (y no 401) porque el usuario SÍ está autenticado; el 401 lo reserva el
    /// middleware para sesión inválida (evita que el frontend cierre sesión).
    /// </summary>
    public async Task ValidarAccesoAsync(ClaimsPrincipal? user, int empresaId)
    {
        if (user == null)
            throw new ForbiddenAccessException("No hay sesión activa.");

        var usuarioId = GetUsuarioId(user)
            ?? throw new ForbiddenAccessException("Token sin usuario válido.");

        if (!await TieneAccesoAsync(usuarioId, empresaId))
            throw new ForbiddenAccessException(
                $"El usuario no tiene acceso a la empresa {empresaId}.");
    }
}

/// <summary>Excepción de autorización: el usuario no tiene acceso al recurso.</summary>
public class ForbiddenAccessException : Exception
{
    public ForbiddenAccessException(string message) : base(message) { }
}