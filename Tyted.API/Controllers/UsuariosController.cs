using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using Tyted.API.Data;
using Tyted.API.Models;
using Microsoft.AspNetCore.Authorization;
using System.Security.Cryptography;

namespace Tyted.API.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    [AllowAnonymous]
    public class UsuariosController : ControllerBase
    {
        private readonly TytedContext _context;
        private readonly IConfiguration _config;

        public UsuariosController(TytedContext context, IConfiguration config)
        {
            _context = context;
            _config = config;
        }

        // 1. OBTENER LISTA DE USUARIOS (READ)
        [HttpGet]
        [AllowAnonymous]
        public async Task<ActionResult<IEnumerable<Usuario>>> GetUsuarios()
        {
            return await _context.Usuarios.ToListAsync();
        }

        // 2. REGISTRO DE USUARIOS (CREATE) - Ahora usa DTO para seguridad
        [HttpPost("registrar")]
        [AllowAnonymous]
        public async Task<IActionResult> Registrar([FromBody] RegistroUsuarioDto dto)
        {
            if (await _context.Usuarios.AnyAsync(u => u.Username == dto.Username))
                return BadRequest("El nombre de usuario ya existe.");

            var usuario = new Usuario
            {
                Username = dto.Username,
                NombreCompleto = dto.NombreCompleto,
                Rol = dto.Rol,
                Activo = dto.Activo,
                PasswordHash = BCrypt.Net.BCrypt.HashPassword(dto.Password)
            };
            
            _context.Usuarios.Add(usuario);
            await _context.SaveChangesAsync();

            return Ok(new { message = "Usuario creado exitosamente" });
        }

        // 3. EDITAR USUARIO (UPDATE)
        [HttpPut("{id}")]
        [AllowAnonymous]
        public async Task<IActionResult> UpdateUsuario(int id, [FromBody] UpdateUsuarioDto dto)
        {
            var usuario = await _context.Usuarios.FindAsync(id);
            if (usuario == null) return NotFound("Usuario no encontrado.");

            // Actualizamos campos básicos
            usuario.NombreCompleto = dto.NombreCompleto;
            usuario.Rol = dto.Rol;
            usuario.Activo = dto.Activo;

            // Solo actualizamos contraseña si el usuario escribió una nueva
            if (!string.IsNullOrEmpty(dto.Password))
            {
                usuario.PasswordHash = BCrypt.Net.BCrypt.HashPassword(dto.Password);
            }

            _context.Entry(usuario).State = EntityState.Modified;
            await _context.SaveChangesAsync();

            return Ok(new { message = "Usuario actualizado correctamente" });
        }

        // 4. ELIMINAR USUARIO (DELETE)
        [HttpDelete("{id}")]
        [AllowAnonymous]
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
    }

    public class UpdateUsuarioDto
    {
        public string NombreCompleto { get; set; }
        public string Rol { get; set; }
        public bool Activo { get; set; }
        public string? Password { get; set; } // Opcional al editar
    }
}