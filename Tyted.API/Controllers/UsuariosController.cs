using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using Tyted.API.Data;
using Tyted.API.Models;
using Tyted.API.Services;
using Microsoft.AspNetCore.Authorization;
using System.Security.Cryptography;

namespace Tyted.API.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    [Authorize(Roles = "AdministradorSistema,Administrador")]
    public class UsuariosController : ControllerBase
    {
        private readonly TytedContext _context;
        private readonly IConfiguration _config;
        private readonly EmpresaAccessService _access;

        public UsuariosController(TytedContext context, IConfiguration config, EmpresaAccessService access)
        {
            _context = context;
            _config = config;
            _access = access;
        }

        // 1. OBTENER LISTA DE USUARIOS (READ) — con sus empresas asignadas
        // proyectadas a un DTO seguro (sin PasswordHash).
        [HttpGet]
        public async Task<ActionResult<IEnumerable<UsuarioListDto>>> GetUsuarios()
        {
            var usuarios = await _context.Usuarios
                .AsNoTracking()
                .Select(u => new UsuarioListDto
                {
                    Id = u.Id,
                    Username = u.Username,
                    NombreCompleto = u.NombreCompleto,
                    Rol = u.Rol,
                    Activo = u.Activo,
                    EmpresaPredeterminadaId = u.EmpresaPredeterminadaId,
                    EmpresasPermitidas = u.EmpresasAsignadas != null
                        ? u.EmpresasAsignadas.Select(ue => ue.EmpresaId).ToList()
                        : new List<int>()
                })
                .ToListAsync();

            return Ok(usuarios);
        }

        // 2. REGISTRO DE USUARIOS (CREATE) - Ahora usa DTO para seguridad
        [HttpPost("registrar")]
        [AllowAnonymous] // Solo admite crear el PRIMER usuario; después exige admin (ver lógica interna)
        public async Task<IActionResult> Registrar([FromBody] RegistroUsuarioDto dto)
        {
            var hayUsuarios = await _context.Usuarios.AnyAsync();

            // Bootstrap: sin usuarios en la BD se permite crear la primera cuenta sin token,
            // y siempre como administrador. En adelante el alta exige un administrador
            // autenticado (evita que cualquiera cree cuentas con privilegios).
            if (hayUsuarios)
            {
                var esAdmin = User?.Identity?.IsAuthenticated == true &&
                              (User.IsInRole("AdministradorSistema") || User.IsInRole("Administrador"));
                if (!esAdmin) return Forbid();
            }

            if (await _context.Usuarios.AnyAsync(u => u.Username == dto.Username))
                return BadRequest("El nombre de usuario ya existe.");

            // MULTI-EMPRESA: validar asignaciones. Si el cliente NO envía empresas
            // (registro por API o primer usuario bootstrap), se asigna por defecto
            // la EMPRESA MODELO (ajuste EmpresaModeloId → fallback: primera empresa).
            var empresas = (dto.EmpresasPermitidas ?? new List<int>()).Distinct().ToList();
            if (empresas.Count == 0)
            {
                var empresaModeloId = await ResolverEmpresaModeloIdAsync();
                if (empresaModeloId.HasValue)
                    empresas.Add(empresaModeloId.Value);
            }
            if (empresas.Count == 0)
                return BadRequest("Debe asignar al menos una empresa al usuario.");
            // Sin predeterminada explícita se usa la primera asignada (la modelo
            // cuando vino vacío); si viene inválida, se rechaza sin silenciar.
            if (!dto.EmpresaPredeterminadaId.HasValue)
                dto.EmpresaPredeterminadaId = empresas[0];
            else if (!empresas.Contains(dto.EmpresaPredeterminadaId.Value))
                return BadRequest("La empresa predeterminada debe estar entre las empresas asignadas.");

            // ANTI-ESCALACIÓN: un Administrador (no Sistema) no puede crear usuarios
            // con rol AdministradorSistema.
            if (!User.IsInRole("AdministradorSistema") && dto.Rol == "AdministradorSistema")
                return Forbid();

            var usuario = new Usuario
            {
                Username = dto.Username,
                NombreCompleto = dto.NombreCompleto,
                Rol = hayUsuarios ? dto.Rol : "AdministradorSistema", // 1er usuario siempre admin
                Activo = dto.Activo,
                PasswordHash = BCrypt.Net.BCrypt.HashPassword(dto.Password),
                EmpresaPredeterminadaId = dto.EmpresaPredeterminadaId,
                EmpresasAsignadas = empresas.Select(id => new UsuarioEmpresa { EmpresaId = id }).ToList()
            };
            
            _context.Usuarios.Add(usuario);
            await _context.SaveChangesAsync();

            return Ok(new { message = "Usuario creado exitosamente" });
        }

        // 3. EDITAR USUARIO (UPDATE) — incluye reemplazo de empresas asignadas
        [HttpPut("{id}")]
        public async Task<IActionResult> UpdateUsuario(int id, [FromBody] UpdateUsuarioDto dto)
        {
            var usuario = await _context.Usuarios.FindAsync(id);
            if (usuario == null) return NotFound("Usuario no encontrado.");

            // MULTI-EMPRESA: validar asignaciones (mismo criterio que en el alta).
            var empresas = (dto.EmpresasPermitidas ?? new List<int>()).Distinct().ToList();
            if (empresas.Count == 0)
                return BadRequest("Debe asignar al menos una empresa al usuario.");
            if (!dto.EmpresaPredeterminadaId.HasValue || !empresas.Contains(dto.EmpresaPredeterminadaId.Value))
                return BadRequest("La empresa predeterminada debe estar entre las empresas asignadas.");

            // ANTI-ESCALACIÓN: un Administrador (no Sistema) no puede asignar el
            // rol AdministradorSistema ni modificar a un AdministradorSistema.
            if (!User.IsInRole("AdministradorSistema"))
            {
                if (dto.Rol == "AdministradorSistema" || usuario.Rol == "AdministradorSistema")
                    return Forbid();
            }

            // Actualizamos campos básicos
            usuario.NombreCompleto = dto.NombreCompleto;
            usuario.Rol = dto.Rol;
            usuario.Activo = dto.Activo;
            usuario.EmpresaPredeterminadaId = dto.EmpresaPredeterminadaId;

            // Solo actualizamos contraseña si el usuario escribió una nueva
            if (!string.IsNullOrEmpty(dto.Password))
            {
                usuario.PasswordHash = BCrypt.Net.BCrypt.HashPassword(dto.Password);
            }

            _context.Entry(usuario).State = EntityState.Modified;

            // Reemplazamos la colección de empresas asignadas (borra las viejas,
            // inserta las nuevas) en la misma transacción de SaveChanges.
            var viejas = await _context.UsuariosEmpresas
                .Where(ue => ue.UsuarioId == id)
                .ToListAsync();
            _context.UsuariosEmpresas.RemoveRange(viejas);
            foreach (var empId in empresas)
                _context.UsuariosEmpresas.Add(new UsuarioEmpresa { UsuarioId = id, EmpresaId = empId });

            await _context.SaveChangesAsync();

            return Ok(new { message = "Usuario actualizado correctamente" });
        }

        // 4. ELIMINAR USUARIO (DELETE)
        [HttpDelete("{id}")]
        public async Task<IActionResult> DeleteUsuario(int id)
        {
            var usuario = await _context.Usuarios.FindAsync(id);
            if (usuario == null) return NotFound("Usuario no encontrado.");

            // Opcional: Evitar que se borre a sí mismo o al admin principal
            // if (usuario.Username == "admin") return BadRequest("No se puede eliminar al admin principal.");

            _context.Usuarios.Remove(usuario);
            await _context.SaveChangesAsync();

            return Ok(new { message = "Usuario eliminado correctamente" });
        }

        // 5. LOGIN
        [HttpPost("login")]
        [AllowAnonymous]
        public async Task<IActionResult> Login([FromBody] LoginDto login)
        {
            var usuario = await _context.Usuarios
                .FirstOrDefaultAsync(u => u.Username == login.Username && u.Activo);

            if (usuario == null)
                return Unauthorized("Credenciales incorrectas.");

            if (!usuario.Activo)
                return Unauthorized("Usuario inactivo. Contacte al administrador.");

            if (!BCrypt.Net.BCrypt.Verify(login.Password, usuario.PasswordHash))
                return Unauthorized("Credenciales incorrectas.");


            var token = GenerarJwtToken(usuario);

            return Ok(new { 
                token = token, 
                usuario = usuario.Username, 
                rol = usuario.Rol 
            });
        }

        /// <summary>
        /// Empresa modelo (plantilla) del sistema: la que indica el ajuste global
        /// EmpresaModeloId; si no existe o apunta a una empresa borrada, la
        /// primera de la BD. Null sólo si la BD no tiene empresas.
        /// </summary>
        private async Task<int?> ResolverEmpresaModeloIdAsync()
        {
            var ajuste = await _context.EmpresaConfigs
                .AsNoTracking()
                .FirstOrDefaultAsync(c => c.Clave == "EmpresaModeloId");

            if (ajuste != null && int.TryParse(ajuste.Valor, out var id) && id > 0
                && await _context.Empresa.AnyAsync(e => e.Id == id))
                return id;

            return await _context.Empresa.OrderBy(e => e.Id).Select(e => (int?)e.Id).FirstOrDefaultAsync();
        }

        private string GenerarJwtToken(Usuario usuario)
        {
            var claims = new[]
            {
                new Claim(ClaimTypes.NameIdentifier, usuario.Id.ToString()),
                new Claim(ClaimTypes.Name, usuario.Username),
                new Claim(ClaimTypes.Role, usuario.Rol)
            };

            var jwtKey = _config["Jwt:Key"];
            if (string.IsNullOrEmpty(jwtKey) || jwtKey.Length < 32)
            {
                throw new Exception("ERROR DE SEGURIDAD: La clave JWT no está configurada en el entorno o es demasiado corta.");
            }

            var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtKey));
            var creds = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);

            var token = new JwtSecurityToken(
                issuer: null,
                audience: null,
                claims: claims,
                expires: DateTime.Now.AddHours(8),
                signingCredentials: creds
            );

            return new JwtSecurityTokenHandler().WriteToken(token);
        }
    }

    // --- DTOs PARA MANEJAR DATOS SEGUROS ---
    public class LoginDto
    {
        public string Username { get; set; } = string.Empty;
        public string Password { get; set; } = string.Empty;
    }

    public class RegistroUsuarioDto
    {
        public string Username { get; set; }
        public string Password { get; set; }
        public string NombreCompleto { get; set; }
        public string Rol { get; set; }
        public bool Activo { get; set; }
        // MULTI-EMPRESA: empresas a las que el usuario tendrá acceso y la
        // predeterminada (la que se carga al iniciar sesión).
        public List<int>? EmpresasPermitidas { get; set; }
        public int? EmpresaPredeterminadaId { get; set; }
    }

    public class UpdateUsuarioDto
    {
        public string NombreCompleto { get; set; }
        public string Rol { get; set; }
        public bool Activo { get; set; }
        public string? Password { get; set; } // Opcional al editar
        // MULTI-EMPRESA
        public List<int>? EmpresasPermitidas { get; set; }
        public int? EmpresaPredeterminadaId { get; set; }
    }

    /// <summary>DTO de salida de la lista de usuarios (sin PasswordHash).</summary>
    public class UsuarioListDto
    {
        public int Id { get; set; }
        public string Username { get; set; } = string.Empty;
        public string NombreCompleto { get; set; } = string.Empty;
        public string Rol { get; set; } = string.Empty;
        public bool Activo { get; set; }
        public int? EmpresaPredeterminadaId { get; set; }
        public List<int> EmpresasPermitidas { get; set; } = new();
    }
}