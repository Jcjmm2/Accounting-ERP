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
    //[Authorize(Roles = "AdministradorSistema,Administrador")]
    [ApiController]
    public class UsuariosController : ControllerBase
    {
        private readonly TytedContext _context;
        private readonly IConfiguration _config;

        public UsuariosController(TytedContext context, IConfiguration config)
        {
            _context = context;
            _config = config;
        }

        // 1. REGISTRO DE USUARIOS (Solo AdminSistema puede crear usuarios)
        [Authorize(Roles = "AdministradorSistema")]
        [HttpPost("registrar")]
        public async Task<IActionResult> Registrar(Usuario usuario, string password)
        {
            if (await _context.Usuarios.AnyAsync(u => u.Username == usuario.Username))
                return BadRequest("El nombre de usuario ya existe.");

            usuario.PasswordHash = BCrypt.Net.BCrypt.HashPassword(password); // Se recomienda usar la librería BCrypt.Net-Next
            
            _context.Usuarios.Add(usuario);
            await _context.SaveChangesAsync();

            return Ok(new { message = "Usuario creado exitosamente" });
        }

        // 2. LOGIN (Genera el Token JWT)
        [HttpPost("login")]
        public async Task<IActionResult> Login([FromBody] LoginDto login)
        {
            var usuario = await _context.Usuarios
                .FirstOrDefaultAsync(u => u.Username == login.Username && u.Activo);

            if (usuario == null || !BCrypt.Net.BCrypt.Verify(login.Password, usuario.PasswordHash))
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
                new Claim(ClaimTypes.Role, usuario.Rol) // Aquí es donde se asigna el permiso
            };

            var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(_config["Jwt:Key"] ?? "TuClaveSuperSecretaDe32Caracteres"));
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

    public class LoginDto
    {
        public string Username { get; set; } = string.Empty;
        public string Password { get; set; } = string.Empty;
    }
}