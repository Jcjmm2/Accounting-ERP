// Tyted.API.Controllers/MaquinasFiscalesController.cs
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Tyted.API.Data;
using Tyted.API.Models;
using Tyted.API.Services;

namespace Tyted.API.Controllers
{
    /// <summary>
    /// Maestro de Máquinas Fiscales por empresa. Calcula el estado real de cada
    /// máquina ordenando los cierres por (Fecha DESC, NumeroZ DESC, Id DESC) —lo
    /// cual maneja múltiples cierres Z en un mismo día— y devuelve los
    /// correlativos sugeridos conservando los ceros a la izquierda.
    /// En la primera consulta auto-registra cualquier serial histórico presente
    /// en ResumenesVentasFiscales que aún no exista en el catálogo.
    /// </summary>
    [ApiController]
    [Authorize(Roles = "AdministradorSistema,Administrador,Analista,Cajero")]
    public class MaquinasFiscalesController : ControllerBase
    {
        private readonly TytedContext _db;
        private readonly EmpresaAccessService _access;

        public MaquinasFiscalesController(TytedContext db, EmpresaAccessService access)
        {
            _db = db;
            _access = access;
        }

        public record MaquinaFiscalDto(
            int EmpresaId,
            string NumeroControl,
            string Alias,
            string? MarcaModelo,
            string? NumeroZInicial,
            string? FacturaInicial,
            bool Activa,
            bool EsPredeterminada
        );

        // GET: api/maquinas-fiscales?empresaId=&soloActivas=
        [HttpGet]
        public async Task<IActionResult> GetPorEmpresa([FromQuery] int empresaId, [FromQuery] bool soloActivas = false)
        {
            if (empresaId <= 0) return BadRequest(new { message = "EmpresaId inválido." });

            // AISLAMIENTO POR EMPRESA
            await _access.ValidarAccesoAsync(User, empresaId);

            // 1. Auto-registro de máquinas históricas presentes en ResumenesVentasFiscales
            var serialesRegistrados = await _db.MaquinasFiscales
                .Where(m => m.EmpresaId == empresaId)
                .Select(m => m.NumeroControl)
                .ToListAsync();

            var setRegistrados = new HashSet<string>(serialesRegistrados, StringComparer.OrdinalIgnoreCase);

            var serialesHistoricos = await _db.ResumenesVentasFiscales
                .Where(r => r.EmpresaId == empresaId && !string.IsNullOrWhiteSpace(r.NumeroControlMaquina))
                .Select(r => r.NumeroControlMaquina.Trim().ToUpper())
                .Distinct()
                .ToListAsync();

            var nuevasAuto = serialesHistoricos
                .Where(s => !setRegistrados.Contains(s))
                .Select((serial, idx) => new MaquinaFiscal
                {
                    EmpresaId = empresaId,
                    NumeroControl = serial,
                    Alias = setRegistrados.Count == 0 && idx == 0 ? "Caja Principal" : $"Caja ({serial})",
                    Activa = true,
                    EsPredeterminada = setRegistrados.Count == 0 && idx == 0
                })
                .ToList();

            if (nuevasAuto.Count > 0)
            {
                _db.MaquinasFiscales.AddRange(nuevasAuto);
                await _db.SaveChangesAsync();
            }

            // 2. Consultar catálogo de máquinas
            var query = _db.MaquinasFiscales.Where(m => m.EmpresaId == empresaId);
            if (soloActivas) query = query.Where(m => m.Activa);

            var maquinas = await query
                .OrderByDescending(m => m.EsPredeterminada)
                .ThenBy(m => m.Alias)
                .ToListAsync();

            // 3. Obtener todos los resúmenes activos de la empresa para calcular
            //    último estado y N° Z existentes.
            var resumenesActivos = await _db.ResumenesVentasFiscales
                .Where(r => r.EmpresaId == empresaId && !r.IsAnulada)
                .Select(r => new
                {
                    r.Id,
                    Serial = r.NumeroControlMaquina.Trim().ToUpper(),
                    r.Fecha,
                    r.NumeroZ,
                    r.FacturaHasta
                })
                .ToListAsync();

            var resultado = maquinas.Select(m =>
            {
                var historial = resumenesActivos
                    .Where(r => r.Serial == m.NumeroControl.ToUpper())
                    .OrderByDescending(r => r.Fecha)
                    .ThenByDescending(r => ParsearNumero(r.NumeroZ))
                    .ThenByDescending(r => r.Id)
                    .ToList();

                var ultimo = historial.FirstOrDefault();

                string? ultimoZ = ultimo?.NumeroZ ?? m.NumeroZInicial;
                string? ultimaFactura = ultimo?.FacturaHasta ?? m.FacturaInicial;

                return new
                {
                    m.Id,
                    m.EmpresaId,
                    m.NumeroControl,
                    m.Alias,
                    m.MarcaModelo,
                    m.NumeroZInicial,
                    m.FacturaInicial,
                    m.Activa,
                    m.EsPredeterminada,
                    FechaUltimoZ = ultimo?.Fecha,
                    UltimoNumeroZ = ultimoZ,
                    SiguienteNumeroZ = IncrementarCorrelativo(ultimoZ),
                    UltimaFacturaHasta = ultimaFactura,
                    SiguienteFacturaDesde = IncrementarCorrelativo(ultimaFactura),
                    NumerosZRegistrados = historial.Select(h => h.NumeroZ.Trim()).Distinct().ToList()
                };
            });

            return Ok(resultado);
        }

        // POST: api/maquinas-fiscales
        [HttpPost]
        public async Task<IActionResult> Crear([FromBody] MaquinaFiscalDto dto)
        {
            var serial = (dto.NumeroControl ?? "").Trim().ToUpper();
            if (dto.EmpresaId <= 0 || string.IsNullOrWhiteSpace(serial))
                return BadRequest(new { message = "Debe indicar la empresa y el N° de Control de la máquina fiscal." });

            await _access.ValidarAccesoAsync(User, dto.EmpresaId);

            var existe = await _db.MaquinasFiscales
                .AnyAsync(m => m.EmpresaId == dto.EmpresaId && m.NumeroControl == serial);
            if (existe)
                return Conflict(new { message = $"La máquina fiscal {serial} ya está registrada en esta empresa." });

            if (dto.EsPredeterminada)
                await QuitarPredeterminadaEmpresa(dto.EmpresaId);

            var entidad = new MaquinaFiscal
            {
                EmpresaId = dto.EmpresaId,
                NumeroControl = serial,
                Alias = string.IsNullOrWhiteSpace(dto.Alias) ? $"Caja ({serial})" : dto.Alias.Trim(),
                MarcaModelo = dto.MarcaModelo?.Trim(),
                NumeroZInicial = dto.NumeroZInicial?.Trim(),
                FacturaInicial = dto.FacturaInicial?.Trim(),
                Activa = dto.Activa,
                EsPredeterminada = dto.EsPredeterminada
            };

            _db.MaquinasFiscales.Add(entidad);
            await _db.SaveChangesAsync();
            return Ok(entidad);
        }

        // PUT: api/maquinas-fiscales/5
        [HttpPut("{id:int}")]
        public async Task<IActionResult> Actualizar(int id, [FromBody] MaquinaFiscalDto dto)
        {
            var entidad = await _db.MaquinasFiscales.FindAsync(id);
            if (entidad == null) return NotFound(new { message = "Máquina fiscal no encontrada." });

            await _access.ValidarAccesoAsync(User, entidad.EmpresaId);

            var serial = (dto.NumeroControl ?? "").Trim().ToUpper();
            if (string.IsNullOrWhiteSpace(serial))
                return BadRequest(new { message = "El N° de Control es obligatorio." });

            var duplicada = await _db.MaquinasFiscales
                .AnyAsync(m => m.EmpresaId == entidad.EmpresaId && m.NumeroControl == serial && m.Id != id);
            if (duplicada)
                return Conflict(new { message = $"Ya existe otra máquina con el N° de Control {serial}." });

            if (dto.EsPredeterminada && !entidad.EsPredeterminada)
                await QuitarPredeterminadaEmpresa(entidad.EmpresaId);

            entidad.NumeroControl = serial;
            entidad.Alias = string.IsNullOrWhiteSpace(dto.Alias) ? entidad.Alias : dto.Alias.Trim();
            entidad.MarcaModelo = dto.MarcaModelo?.Trim();
            entidad.NumeroZInicial = dto.NumeroZInicial?.Trim();
            entidad.FacturaInicial = dto.FacturaInicial?.Trim();
            entidad.Activa = dto.Activa;
            entidad.EsPredeterminada = dto.EsPredeterminada;

            await _db.SaveChangesAsync();
            return Ok(entidad);
        }

        private async Task QuitarPredeterminadaEmpresa(int empresaId)
        {
            var previas = await _db.MaquinasFiscales
                .Where(m => m.EmpresaId == empresaId && m.EsPredeterminada)
                .ToListAsync();
            previas.ForEach(m => m.EsPredeterminada = false);
        }

        private static long ParsearNumero(string? valor)
            => long.TryParse(valor?.Trim(), out var n) ? n : 0;

        private static string IncrementarCorrelativo(string? valor)
        {
            var limpio = (valor ?? "").Trim();
            if (string.IsNullOrEmpty(limpio) || !limpio.All(char.IsDigit)) return "";
            var siguiente = (long.Parse(limpio) + 1).ToString();
            return limpio.StartsWith('0') && limpio.Length > 1
                ? siguiente.PadLeft(limpio.Length, '0')
                : siguiente;
        }
    }
}