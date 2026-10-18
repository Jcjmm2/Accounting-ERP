using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Tyted.API.Data;
using Tyted.API.Models;
using Tyted.API.Services;

namespace Tyted.API.Controllers
{
    /// <summary>
    /// Catálogo de CONCEPTOS DE OPERACIÓN por empresa (GASTO/VENTA/COMPRA):
    /// puente entre los formularios del módulo fiscal y el plan de cuentas.
    /// El frontend envía el Id del concepto; el motor contable usa su
    /// CuentaContable para generar la partida doble.
    /// </summary>
    [Route("api/conceptos-operacionales")]
    [ApiController]
    [Authorize(Roles = "AdministradorSistema,Administrador,Analista,Comprador,Cajero")]
    public class ConceptosOperacionalesController : ControllerBase
    {
        private readonly TytedContext _context;
        private readonly EmpresaAccessService _access;
        private readonly IConfiguration _config;
        private readonly ConfigService _configService;

        public ConceptosOperacionalesController(
            TytedContext context,
            EmpresaAccessService access,
            IConfiguration config,
            ConfigService configService)
        {
            _context = context;
            _access = access;
            _config = config;
            _configService = configService;
        }

        // -------------------------------------------------------------------------
        // TIPOS VÁLIDOS DEL CATÁLOGO
        // ISLR es una familia propia (retenciones del Decreto 1.808) gestionada
        // por el panel de Conceptos Operacionales. Excluirla del whitelist hacía
        // fallar con 400 cualquier alta/edición de un concepto ISLR desde el
        // frontend (PUT/POST /api/conceptos-operacionales).
        // -------------------------------------------------------------------------
        private static readonly string[] TiposValidos = { "COMPRA", "VENTA", "GASTO", "ISLR", "SISTEMA" };

        /// <summary>
        /// Normaliza los atributos fiscales ISLR del concepto. Sólo aplican cuando
        /// TipoOperacion == "ISLR" (en los demás tipos se limpian). El sustraendo
        /// se calcula SIEMPRE en el servidor con la Unidad Tributaria VIGENTE
        /// (configuración global cambiable por Gaceta Oficial); nunca se acepta
        /// un monto enviado por el cliente.
        /// </summary>
        private static void AplicarAtributosIslr(ConceptoOperacional concepto, decimal unidadTributariaVigente)
        {
            if (concepto.TipoOperacion != "ISLR")
            {
                concepto.CodigoSeniat = null;
                concepto.TipoPersona = null;
                concepto.PorcentajeRetencion = null;
                concepto.AplicaSustraendo = false;
                concepto.MontoSustraendoBs = null;
                return;
            }

            concepto.CodigoSeniat = string.IsNullOrWhiteSpace(concepto.CodigoSeniat)
                ? null
                : concepto.CodigoSeniat.Trim();
            concepto.TipoPersona = string.IsNullOrWhiteSpace(concepto.TipoPersona)
                ? "PNR"
                : concepto.TipoPersona.Trim().ToUpper();

            // El sustraendo sólo existe para personas naturales residentes (PNR).
            concepto.MontoSustraendoBs =
                concepto.AplicaSustraendo
                && concepto.TipoPersona == "PNR"
                && concepto.PorcentajeRetencion is > 0
                    ? CatalogoIslr.CalcularSustraendo(concepto.PorcentajeRetencion.Value, unidadTributariaVigente)
                    : null;
        }

        /// <summary>
        /// Normaliza la sujeción a ISLR de los conceptos tipo GASTO (modo
        /// híbrido): fuera de GASTO se limpia; si está marcada, el concepto
        /// ISLR sugerido debe existir y ser de tipo ISLR de la MISMA empresa.
        /// Es SÓLO una preselección para el formulario de gastos: la emisión
        /// de la retención siempre es explícita por documento.
        /// </summary>
        private async Task<string?> ValidarSujecionIslrAsync(ConceptoOperacional concepto)
        {
            if (concepto.TipoOperacion != "GASTO" || !concepto.AplicaRetencionIslr)
            {
                concepto.AplicaRetencionIslr = false;
                concepto.ConceptoIslrSugeridoId = null;
                return null;
            }

            // Marcada sin sugerido: el usuario elegirá el concepto ISLR en el
            // momento de emitir la retención sobre cada gasto.
            if (!concepto.ConceptoIslrSugeridoId.HasValue)
                return null;

            var sugerido = await _context.ConceptosOperacionales
                .AsNoTracking()
                .FirstOrDefaultAsync(c => c.Id == concepto.ConceptoIslrSugeridoId.Value);

            if (sugerido is null || sugerido.EmpresaId != concepto.EmpresaId || sugerido.TipoOperacion != "ISLR")
                return "El concepto ISLR sugerido no existe, no es de tipo ISLR o pertenece a otra empresa.";

            return null;
        }

        // GET: api/conceptos-operacionales?empresaId=1&tipo=GASTO
        [HttpGet]
        public async Task<ActionResult<IEnumerable<ConceptoOperacional>>> GetConceptos(
            [FromQuery] int? empresaId,
            [FromQuery] string? tipo)
        {
            // AISLAMIENTO POR EMPRESA
            if (empresaId.HasValue)
                await _access.ValidarAccesoAsync(User, empresaId.Value);

            var query = _context.ConceptosOperacionales
                .AsNoTracking()
                .AsQueryable();

            if (empresaId.HasValue)
                query = query.Where(c => c.EmpresaId == empresaId.Value);

            if (!string.IsNullOrWhiteSpace(tipo))
                query = query.Where(c => c.TipoOperacion == tipo.ToUpper());

            return await query.OrderBy(c => c.NombreConcepto).ToListAsync();
        }

        // GET: api/conceptos-operacionales/5
        [HttpGet("{id}")]
        public async Task<ActionResult<ConceptoOperacional>> GetConcepto(int id)
        {
            var concepto = await _context.ConceptosOperacionales
                .AsNoTracking()
                .FirstOrDefaultAsync(c => c.Id == id);

            if (concepto == null) return NotFound();

            // AISLAMIENTO POR EMPRESA: la empresa se toma de la fila en BD.
            await _access.ValidarAccesoAsync(User, concepto.EmpresaId);
            return concepto;
        }

        // POST: api/conceptos-operacionales
        [HttpPost]
        [Authorize(Roles = "AdministradorSistema,Administrador")]
        public async Task<ActionResult<ConceptoOperacional>> PostConcepto(ConceptoOperacional concepto)
        {
            if (concepto is null || string.IsNullOrWhiteSpace(concepto.NombreConcepto))
                return BadRequest(new { message = "El nombre del concepto es obligatorio." });

            await _access.ValidarAccesoAsync(User, concepto.EmpresaId);

            concepto.TipoOperacion = (concepto.TipoOperacion ?? "GASTO").ToUpper();
            if (!TiposValidos.Contains(concepto.TipoOperacion))
                return BadRequest(new { message = "El tipo de operación debe ser COMPRA, VENTA, GASTO, ISLR o SISTEMA." });

            // Atributos fiscales ISLR: normaliza persona/código SENIAT y calcula el
            // sustraendo en el SERVIDOR con la Unidad Tributaria VIGENTE.
            var utVigente = (await _configService.GetUnidadTributariaVigenteAsync()).Valor;
            AplicarAtributosIslr(concepto, utVigente);

            // Sujección ISLR de conceptos GASTO (modo híbrido): valida la marca
            // y el concepto ISLR sugerido (preselección; nunca emisión automática).
            var errorSujecion = await ValidarSujecionIslrAsync(concepto);
            if (errorSujecion != null)
                return BadRequest(new { message = errorSujecion });

            var duplicado = await _context.ConceptosOperacionales.AnyAsync(c =>
                c.EmpresaId == concepto.EmpresaId
                && c.NombreConcepto == concepto.NombreConcepto
                && c.TipoOperacion == concepto.TipoOperacion);
            if (duplicado)
                return BadRequest(new { message = "Ya existe un concepto con ese nombre para esta empresa y tipo de operación." });

            _context.ConceptosOperacionales.Add(concepto);
            await _context.SaveChangesAsync();
            return CreatedAtAction(nameof(GetConcepto), new { id = concepto.Id }, concepto);
        }

        // PUT: api/conceptos-operacionales/5
        [HttpPut("{id}")]
        [Authorize(Roles = "AdministradorSistema,Administrador")]
        public async Task<IActionResult> PutConcepto(int id, ConceptoOperacional datos)
        {
            var concepto = await _context.ConceptosOperacionales.FindAsync(id);
            if (concepto == null) return NotFound();

            // AISLAMIENTO POR EMPRESA (misma regla que GET/POST): la empresa se
            // toma de la fila en BD, nunca del payload del cliente.
            await _access.ValidarAccesoAsync(User, concepto.EmpresaId);

            concepto.NombreConcepto = datos.NombreConcepto?.Trim() ?? concepto.NombreConcepto;
            concepto.CuentaContable = datos.CuentaContable?.Trim() ?? concepto.CuentaContable;
            if (!string.IsNullOrWhiteSpace(datos.TipoOperacion))
            {
                var tipo = datos.TipoOperacion.ToUpper();
                if (!TiposValidos.Contains(tipo))
                    return BadRequest(new { message = "El tipo de operación debe ser COMPRA, VENTA, GASTO, ISLR o SISTEMA." });
                concepto.TipoOperacion = tipo;
            }

            // Atributos fiscales ISLR (Decreto 1.808): el formulario los envía en
            // cada guardado; sin este bloque la edición NO persistía el código
            // SENIAT, la tarifa, el tipo de persona ni el sustraendo.
            concepto.CodigoSeniat = datos.CodigoSeniat;
            concepto.TipoPersona = datos.TipoPersona;
            concepto.PorcentajeRetencion = datos.PorcentajeRetencion;
            concepto.AplicaSustraendo = datos.AplicaSustraendo;
            var utVigente = (await _configService.GetUnidadTributariaVigenteAsync()).Valor;
            AplicarAtributosIslr(concepto, utVigente);

            // Sujección ISLR de conceptos GASTO (modo híbrido): persiste la
            // marca y el concepto sugerido; fuera de GASTO se limpia.
            concepto.AplicaRetencionIslr = datos.AplicaRetencionIslr;
            concepto.ConceptoIslrSugeridoId = datos.ConceptoIslrSugeridoId;
            var errorSujecion = await ValidarSujecionIslrAsync(concepto);
            if (errorSujecion != null)
                return BadRequest(new { message = errorSujecion });

            // Paridad con POST: el nombre debe ser único por empresa y tipo.
            var duplicado = await _context.ConceptosOperacionales.AnyAsync(c =>
                c.EmpresaId == concepto.EmpresaId
                && c.Id != id
                && c.NombreConcepto == concepto.NombreConcepto
                && c.TipoOperacion == concepto.TipoOperacion);
            if (duplicado)
                return BadRequest(new { message = "Ya existe un concepto con ese nombre para esta empresa y tipo de operación." });

            try
            {
                await _context.SaveChangesAsync();
            }
            catch (DbUpdateConcurrencyException)
            {
                if (!await _context.ConceptosOperacionales.AnyAsync(c => c.Id == id))
                    return NotFound();
                throw;
            }
            return NoContent();
        }

        // DELETE: api/conceptos-operacionales/5 (bloqueado si ya está en uso)
        [HttpDelete("{id}")]
        [Authorize(Roles = "AdministradorSistema,Administrador")]
        public async Task<IActionResult> DeleteConcepto(int id)
        {
            var concepto = await _context.ConceptosOperacionales.FindAsync(id);
            if (concepto == null) return NotFound();

            // AISLAMIENTO POR EMPRESA: la empresa se toma de la fila en BD.
            await _access.ValidarAccesoAsync(User, concepto.EmpresaId);

            var enUso = await _context.Gastos.AnyAsync(g => g.ConceptoOperacionalId == id)
                || await _context.VentasDetalle.AnyAsync(d => d.ConceptoOperacionalId == id);
            if (enUso)
                return BadRequest(new { message = "El concepto está en uso por gastos o ventas; no puede eliminarse." });

            _context.ConceptosOperacionales.Remove(concepto);
            await _context.SaveChangesAsync();
            return NoContent();
        }

        // -------------------------------------------------------------------------
        // SEMILLA DEL CATÁLOGO DE RETENCIONES ISLR (DECRETO 1.808)
        // POST: api/conceptos-operacionales/seed-islr?empresaId=1
        // Precarga el catálogo completo de conceptos de retención de ISLR de la
        // empresa (códigos SENIAT, tarifas PNR/PNNR/PJD y sustraendo para personas
        // naturales residentes). Idempotente: sólo inserta los que falten. La cuenta
        // por defecto es el pasivo "ISLR retenido por pagar" del mapping; el
        // administrador puede reasignarla desde el panel.
        // -------------------------------------------------------------------------
        [HttpPost("seed-islr")]
        [Authorize(Roles = "AdministradorSistema,Administrador")]
        public async Task<IActionResult> SeedIslr([FromQuery] int empresaId)
        {
            if (empresaId <= 0)
                return BadRequest(new { message = "Indique la empresa (empresaId)." });

            await _access.ValidarAccesoAsync(User, empresaId);

            var cuentaDefault = _config["Contabilidad:Mapping:IslrRetenidoPorPagar"] ?? "2.1.1.02";

            var existentes = await _context.ConceptosOperacionales
                .AsNoTracking()
                .Where(c => c.EmpresaId == empresaId && c.TipoOperacion == "ISLR")
                .Select(c => c.CodigoSeniat)
                .ToListAsync();

            // UT vigente (configuración global cambiable por Gaceta Oficial).
            var utVigente = (await _configService.GetUnidadTributariaVigenteAsync()).Valor;

            var creados = 0;
            foreach (var fila in CatalogoIslr.Completar)
            {
                if (existentes.Contains(fila.Codigo)) continue;

                _context.ConceptosOperacionales.Add(new ConceptoOperacional
                {
                    EmpresaId = empresaId,
                    NombreConcepto = $"{fila.Nombre} ({fila.TipoPersona})",
                    TipoOperacion = "ISLR",
                    CuentaContable = cuentaDefault,
                    CodigoSeniat = fila.Codigo,
                    TipoPersona = fila.TipoPersona,
                    PorcentajeRetencion = fila.Porcentaje,
                    AplicaSustraendo = fila.AplicaSustraendo,
                    MontoSustraendoBs = fila.AplicaSustraendo
                        ? CatalogoIslr.CalcularSustraendo(fila.Porcentaje, utVigente)
                        : null
                });
                creados++;
            }

            await _context.SaveChangesAsync();
            return Ok(new
            {
                mensaje = $"Catálogo ISLR precargado: {creados} conceptos nuevos de {CatalogoIslr.Completar.Length}.",
                creados,
                totalCatalogo = CatalogoIslr.Completar.Length,
                cuentaDefault,
                unidadTributaria = utVigente
            });
        }

        // -------------------------------------------------------------------------
        // UNIDAD TRIBUTARIA VIGENTE (política de estado: se decreta por Gaceta
        // Oficial). Configuración GLOBAL; al cambiarla se recalcula el sustraendo
        // (Bs.) de todos los conceptos ISLR del sistema. Las retenciones YA
        // emitidas NO se modifican (sustraendo congelado en cada comprobante).
        // -------------------------------------------------------------------------
        [HttpGet("ut-vigente")]
        public async Task<IActionResult> GetUtVigente()
        {
            var (valor, gaceta) = await _configService.GetUnidadTributariaVigenteAsync();
            return Ok(new { valor, gaceta });
        }

        [HttpPut("ut-vigente")]
        [Authorize(Roles = "AdministradorSistema,Administrador")]
        public async Task<IActionResult> SetUtVigente([FromBody] ActualizarUtVigenteRequest request)
        {
            if (request is null || request.Valor <= 0)
                return BadRequest(new { message = "Indique el valor de la Unidad Tributaria vigente (mayor a cero)." });

            await _configService.SetUnidadTributariaVigenteAsync(request.Valor, request.Gaceta);
            // Recálculo atómico de los sustraendos cacheados de los conceptos ISLR.
            var recalculados = await _configService.RecalcularSustraendosIslrAsync(request.Valor);

            return Ok(new
            {
                message = $"Unidad Tributaria vigente actualizada a Bs. {request.Valor:0.####}. " +
                          $"Sustraendos recalculados en {recalculados} concepto(s) ISLR. " +
                          "Las retenciones ya emitidas no se modifican.",
                valor = request.Valor,
                gaceta = request.Gaceta,
                recalculados
            });
        }
    }

    /// <summary>Solicitud de actualización de la Unidad Tributaria vigente (Gaceta Oficial).</summary>
    public class ActualizarUtVigenteRequest
    {
        /// <summary>Nuevo valor de la UT en Bolívares (decretado en Gaceta Oficial).</summary>
        public decimal Valor { get; set; }

        /// <summary>Referencia de la Gaceta Oficial/Resolución (ej: «G.O. N° 6.906 de 30/12/2024»).</summary>
        public string? Gaceta { get; set; }
    }
}
