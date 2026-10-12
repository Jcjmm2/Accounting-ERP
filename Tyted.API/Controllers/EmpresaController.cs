using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.AspNetCore.Authorization;
using Tyted.API.Data;
using Tyted.API.Models;
using Tyted.API.Services;

namespace Tyted.API.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    [Authorize]
    public class EmpresaController : ControllerBase
    {
        private readonly TytedContext _context;
        private readonly EmpresaAccessService _access;

        public EmpresaController(TytedContext context, EmpresaAccessService access)
        {
            _context = context;
            _access = access;
        }

        // --- MÉTODOS PARA DATOS DE LA EMPRESA (Encabezado) ---

        /// <summary>
        /// Empresas visibles para el usuario autenticado (selector global).
        /// AdministradorSistema: TODAS. Demás roles: sólo las asignadas.
        /// La empresa predeterminada del usuario se ordena de PRIMERA.
        /// </summary>
        [HttpGet]
        public async Task<ActionResult<IEnumerable<Empresa>>> GetEmpresas()
        {
            var usuarioId = _access.GetUsuarioId(User);
            if (usuarioId == null) return Unauthorized();

            // IDs permitidos (null => todas, para AdministradorSistema)
            var permitidas = await _access.EmpresasPermitidasAsync(usuarioId.Value);

            var query = _context.Empresa.AsQueryable();
            if (permitidas != null)
                query = query.Where(e => permitidas.Contains(e.Id));

            var empresas = await query.OrderBy(e => e.RazonSocial).ToListAsync();

            // Ordenar de primera la empresa predeterminada del usuario (si la tiene
            // en su lista visible). Así el frontend, al tomar lista[0] sin valor
            // guardado en localStorage, selecciona la correcta.
            var predeterminadaId = await _context.Usuarios
                .AsNoTracking()
                .Where(u => u.Id == usuarioId.Value)
                .Select(u => u.EmpresaPredeterminadaId)
                .FirstOrDefaultAsync();

            if (predeterminadaId.HasValue)
            {
                empresas = empresas
                    .OrderByDescending(e => e.Id == predeterminadaId.Value)
                    .ThenBy(e => e.RazonSocial)
                    .ToList();
            }

            return Ok(empresas);
        }

        /// <summary>
        /// Catálogo COMPLETO de empresas, restringido a administradores. Lo usa
        /// la pantalla de Usuarios para asignar accesos (no depende del selector
        /// filtrado, evitando acoplar "catálogo que asigno" con "selector en el
        /// que trabajo"). Un Administrador (no Sistema) sólo ve aquí las suyas.
        /// </summary>
        [HttpGet("todas")]
        [Authorize(Roles = "AdministradorSistema,Administrador")]
        public async Task<ActionResult<IEnumerable<Empresa>>> GetTodasLasEmpresas()
        {
            var usuarioId = _access.GetUsuarioId(User);
            if (usuarioId == null) return Unauthorized();

            var permitidas = await _access.EmpresasPermitidasAsync(usuarioId.Value);

            var query = _context.Empresa.AsQueryable();
            if (permitidas != null)
                query = query.Where(e => permitidas.Contains(e.Id));

            var empresas = await query.OrderBy(e => e.RazonSocial).ToListAsync();
            return Ok(empresas);
        }

        [HttpGet("configuracion")]
        public async Task<ActionResult<Empresa>> GetEmpresa([FromQuery] int? id)
        {
            var empresa = id.HasValue
                ? await _context.Empresa.FirstOrDefaultAsync(e => e.Id == id.Value)
                : await _context.Empresa.FirstOrDefaultAsync();

            if (empresa == null) return NotFound("No se han configurado los datos de la empresa.");
            return empresa;
        }

        [HttpGet("contexto")]
        public async Task<ActionResult<object>> GetContexto([FromQuery] int? empresaId)
        {
            var empresa = empresaId.HasValue
                ? await _context.Empresa.FirstOrDefaultAsync(e => e.Id == empresaId.Value)
                : await _context.Empresa.FirstOrDefaultAsync();

            if (empresa == null)
            {
                return NotFound(new { message = "No hay empresas definidas." });
            }

            var periodo = await _context.PeriodosContables
                .Where(p => p.EmpresaId == empresa.Id)
                .OrderByDescending(p => p.FechaFin)
                .FirstOrDefaultAsync();

            return Ok(new
            {
                empresa,
                periodo
            });
        }

        [HttpPut("configuracion")]
        [Authorize(Roles = "AdministradorSistema,Administrador")]
        public async Task<IActionResult> UpdateEmpresa([FromBody] Empresa empresa)
        {
            if (empresa == null)
                return BadRequest("La información de la empresa es requerida.");

            var empresaExistente = await _context.Empresa.FindAsync(empresa.Id);

            if (empresaExistente == null)
            {
                if (empresa.Id <= 0)
                {
                    _context.Empresa.Add(empresa);
                }
                else
                {
                    _context.Empresa.Add(empresa);
                }
            }
            else
            {
                _context.Entry(empresaExistente).CurrentValues.SetValues(empresa);
            }

            try
            {
                await _context.SaveChangesAsync();
                return Ok(new { message = "Datos de empresa actualizados correctamente" });
            }
            catch (Exception ex)
            {
                return BadRequest($"Error al actualizar: {ex.Message}");
            }
        }

        // --- MÉTODOS PARA CONFIGURACIONES DEL SISTEMA (Modo Moneda, Stock, etc.) ---

        // Obtener todas las configuraciones (útil para una pantalla de ajustes)
        [HttpGet("ajustes")]
        public async Task<ActionResult<IEnumerable<EmpresaConfig>>> GetAjustes()
        {
            return await _context.EmpresaConfigs.ToListAsync();
        }

        // Actualizar una configuración específica por su Clave
        [HttpPut("ajustes/{clave}")]
        [Authorize(Roles = "AdministradorSistema,Administrador")]
        public async Task<IActionResult> UpdateAjuste(string clave, [FromBody] string nuevoValor)
        {
            var config = await _context.EmpresaConfigs
                .FirstOrDefaultAsync(c => c.Clave == clave);

            if (config == null) 
                return NotFound($"La configuración '{clave}' no existe.");

            // Validaciones específicas para el Modo de Impresión
            if (clave == "ModoImpresionFactura")
            {
                var opcionesValidas = new[] { "AMBAS", "SOLO_BASE", "SOLO_EXT" };
                if (!opcionesValidas.Contains(nuevoValor.ToUpper()))
                {
                    return BadRequest("Valor inválido. Use: AMBAS, SOLO_BASE o SOLO_EXT.");
                }
                config.Valor = nuevoValor.ToUpper();
            }
            else
            {
                config.Valor = nuevoValor;
            }

            await _context.SaveChangesAsync();
            return Ok(new { message = $"Ajuste '{clave}' actualizado a '{config.Valor}'" });
        }
        // --- NUEVO MÉTODO PARA CREAR EMPRESAS ---
    [HttpPost]
    [Authorize(Roles = "AdministradorSistema,Administrador")]
    public async Task<ActionResult<Empresa>> CreateEmpresa([FromBody] Empresa empresa)
    {
        if (empresa == null)
            return BadRequest("La información de la empresa es requerida.");

        // Opcional: Validar si ya existe un RIF igual
        var existeRif = await _context.Empresa.AnyAsync(e => e.RIF == empresa.RIF);
        if (existeRif)
            return BadRequest("Ya existe una empresa registrada con ese RIF.");

        _context.Empresa.Add(empresa);
        await _context.SaveChangesAsync();

        return Ok(empresa);
    }
    }
}