using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
//using Microsoft.AspNetCore.Authorization;
using Tyted.API.Data;
using Tyted.API.Models;

namespace Tyted.API.Controllers
{
    [Route("api/[controller]")]
    //[Authorize(Roles = "AdministradorSistema,Administrador")]
    [ApiController]
    public class EmpresaController : ControllerBase
    {
        private readonly TytedContext _context;

        public EmpresaController(TytedContext context)
        {
            _context = context;
        }

        // --- MÉTODOS PARA DATOS DE LA EMPRESA (Encabezado) ---

        [HttpGet("configuracion")]
        public async Task<ActionResult<Empresa>> GetEmpresa()
        {
            var empresa = await _context.Empresa.FirstOrDefaultAsync();
            if (empresa == null) return NotFound("No se han configurado los datos de la empresa.");
            return empresa;
        }

        [HttpPut("configuracion")]
        public async Task<IActionResult> UpdateEmpresa(Empresa empresa)
        {
            empresa.Id = 1; // Forzamos el ID 1 para que siempre sea el único registro
            _context.Entry(empresa).State = EntityState.Modified;

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
    }
}