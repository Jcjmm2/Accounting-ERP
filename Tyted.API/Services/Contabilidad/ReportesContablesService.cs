using Microsoft.EntityFrameworkCore;
using Tyted.API.Data;
using Tyted.API.Models;

namespace Tyted.API.Services;

public class ReportesContablesService
{
    private readonly TytedContext _context;

    public ReportesContablesService(TytedContext context)
    {
        _context = context;
    }

    public async Task<object> GetResumenAsync()
    {
        var cuentas = await _context.CuentasContables.CountAsync();
        var asientos = await _context.AsientosContables.CountAsync();
        var totalDebe = await _context.AsientosDetalles.SumAsync(d => (decimal?)d.Debe) ?? 0m;
        var totalHaber = await _context.AsientosDetalles.SumAsync(d => (decimal?)d.Haber) ?? 0m;

        return new
        {
            cuentas,
            asientos,
            totalDebe,
            totalHaber,
            diferencia = totalDebe - totalHaber
        };
    }

    /// <summary>
    /// Balance de comprobación de un periodo con la información que espera el frontend:
    /// saldo inicial, movimiento del debe/haber y saldo final de cada cuenta.
    /// Reglas aplicadas:
    /// - Solo la empresa a la que pertenece el periodo seleccionado.
    /// - El corte de fechas usa el rango del periodo (FechaInicio .. FechaFin), por lo que
    ///   un periodo anual (padre) también consolidan los asientos de sus subperiodos.
    /// - Saldo inicial = movimientos anteriores al inicio del periodo.
    /// - Saldo final se expresa con el signo natural de la cuenta (D:Debe-Haber, C:Haber-Debe).
    /// </summary>
    public async Task<List<BalanceComprobacionDto>> GetBalanceComprobacionAsync(int periodoId, int? empresaId = null)
    {
        var periodo = await _context.PeriodosContables
            .AsNoTracking()
            .FirstOrDefaultAsync(p => p.Id == periodoId)
            ?? throw new InvalidOperationException("El periodo contable no existe.");

        // Aislamiento por empresa: cuando el cliente indica la empresa activa
        // (selector único), un periodo perteneciente a otra empresa se rechaza
        // para no mostrar un reporte cruzado.
        if (empresaId.HasValue && periodo.EmpresaId != empresaId.Value)
            throw new InvalidOperationException("El periodo solicitado no pertenece a la empresa activa.");

        var empresaDelPeriodo = periodo.EmpresaId;
        var fechaInicio = periodo.FechaInicio.Date;
        // Se suma un día para cubrir asientos con hora dentro del último día del periodo.
        var fechaFinExclusiva = periodo.FechaFin.Date.AddDays(1);

        var movimientosAnteriores = await _context.AsientosDetalles
            .AsNoTracking()
            .Where(d => d.AsientoContable!.EmpresaId == empresaDelPeriodo
                        && d.AsientoContable.FechaComprobante < fechaInicio)
            .GroupBy(d => d.CuentaContableId)
            .Select(g => new { CuentaId = g.Key, Debe = g.Sum(x => x.Debe), Haber = g.Sum(x => x.Haber) })
            .ToListAsync();

        var movimientosPeriodo = await _context.AsientosDetalles
            .AsNoTracking()
            .Where(d => d.AsientoContable!.EmpresaId == empresaDelPeriodo
                        && d.AsientoContable.FechaComprobante >= fechaInicio
                        && d.AsientoContable.FechaComprobante < fechaFinExclusiva)
            .GroupBy(d => d.CuentaContableId)
            .Select(g => new { CuentaId = g.Key, Debe = g.Sum(x => x.Debe), Haber = g.Sum(x => x.Haber) })
            .ToListAsync();

        var cuentas = await _context.CuentasContables
            .AsNoTracking()
            .Where(c => c.EmpresaId == empresaDelPeriodo)
            .ToListAsync();

        var anterioresPorCuenta = movimientosAnteriores.ToDictionary(x => x.CuentaId, x => x);
        var periodoPorCuenta = movimientosPeriodo.ToDictionary(x => x.CuentaId, x => x);

        var resultado = new List<BalanceComprobacionDto>();

        foreach (var cuenta in cuentas.OrderBy(c => c.CodigoCuenta))
        {
            anterioresPorCuenta.TryGetValue(cuenta.Id, out var anterior);
            periodoPorCuenta.TryGetValue(cuenta.Id, out var movimiento);

            var debeAnterior = anterior?.Debe ?? 0m;
            var haberAnterior = anterior?.Haber ?? 0m;
            var debePeriodo = movimiento?.Debe ?? 0m;
            var haberPeriodo = movimiento?.Haber ?? 0m;

            var esDeudora = string.Equals(cuenta.Naturaleza, "D", StringComparison.OrdinalIgnoreCase);
            var saldoInicial = esDeudora ? debeAnterior - haberAnterior : haberAnterior - debeAnterior;
            var saldoFinal = esDeudora
                ? saldoInicial + debePeriodo - haberPeriodo
                : saldoInicial + haberPeriodo - debePeriodo;

            // Solo se listan cuentas con saldo o con movimiento en el periodo.
            if (saldoInicial == 0m && debePeriodo == 0m && haberPeriodo == 0m)
                continue;

            resultado.Add(new BalanceComprobacionDto
            {
                CuentaId = cuenta.Id,
                CodigoCuenta = cuenta.CodigoCuenta,
                NombreCuenta = cuenta.NombreCuenta,
                Naturaleza = cuenta.Naturaleza,
                TipoCuenta = cuenta.TipoCuenta,
                SaldoInicial = saldoInicial,
                MovimientoDebe = debePeriodo,
                MovimientoHaber = haberPeriodo,
                // TotalDebe/TotalHaber se mantienen por compatibilidad con clientes existentes
                // (equivale al movimiento del periodo).
                TotalDebe = debePeriodo,
                TotalHaber = haberPeriodo,
                SaldoFinal = saldoFinal
            });
        }

        return resultado;
    }

    // ---------------------------------------------------------------------------
    // ASIENTO TEMPORAL DEL ESTADO DE SITUACIÓN FINANCIERA
    // ---------------------------------------------------------------------------

    /// <summary>
    /// Código de la cuenta de patrimonio que refleja el resultado del ejercicio
    /// en el Estado de Situación Financiera (plan VEN-NIF). Es la cuenta destino
    /// del asiento temporal que se genera al consultar el estado, y se toma del
    /// plan de cuentas de cada empresa.
    /// </summary>
    public const string CodigoCuentaResultadosSituacion = "3.1.3.1.02";

    /// <summary>
    /// Genera en memoria el ASIENTO TEMPORAL que traslada el resultado del
    /// periodo (utilidad o pérdida) a la cuenta 3.1.3.1.02 de la empresa para
    /// su presentación en el Estado de Situación Financiera.
    ///
    /// Reglas aplicadas:
    /// - Es un procedimiento contable, no una resta del cliente: el backend zera
    ///   cada cuenta de ingreso/egreso con una línea y traslada la diferencia neta
    ///   a la cuenta de resultados 3.1.3.1.02 (partida doble), con el mismo corte
    ///   de fechas y el mismo signo natural por tipo de cuenta que el balance de
    ///   comprobación (saldo inicial + movimientos hasta el fin del periodo).
    /// - NO se persiste: el asiento existe sólo para la consulta del estado. Así
    ///   el Estado de Resultado y el Balance de Comprobación siguen viendo los
    ///   movimientos reales, el estado puede consultarse en periodos cerrados y
    ///   no hay riesgo de duplicar el cierre real (CIERRE DE RESULTADOS).
    /// - Si el periodo ya fue cerrado (ingresos y egresos en cero) el resultado
    ///   vale 0,00 y no se aportan líneas: el resultado ya está en el patrimonio.
    /// - Si la empresa no tiene la cuenta 3.1.3.1.02 se indica en
    ///   CuentaResultadosEncontrada para que el frontend recupere el formato
    ///   histórico; el resultado se calcula igualmente.
    /// </summary>
    public async Task<AsientoTemporalSituacionDto> GetAsientoTemporalSituacionFinancieraAsync(int periodoId, int? empresaId = null)
    {
        var periodo = await _context.PeriodosContables
            .AsNoTracking()
            .FirstOrDefaultAsync(p => p.Id == periodoId)
            ?? throw new InvalidOperationException("El periodo contable no existe.");

        // Aislamiento por empresa: mismo criterio que el balance de comprobación.
        if (empresaId.HasValue && periodo.EmpresaId != empresaId.Value)
            throw new InvalidOperationException("El periodo solicitado no pertenece a la empresa activa.");

        var empresaDelPeriodo = periodo.EmpresaId;
        var fechaFinExclusiva = periodo.FechaFin.Date.AddDays(1);

        var cuentasEmpresa = await _context.CuentasContables
            .AsNoTracking()
            .Where(c => c.EmpresaId == empresaDelPeriodo)
            .ToListAsync();

        // Cuentas de resultado (ingresos y egresos) de la empresa activa.
        var cuentasResultado = cuentasEmpresa
            .Where(c => c.TipoCuenta.ToUpper().Contains("INGRESO")
                        || c.TipoCuenta.ToUpper().Contains("GASTO")
                        || c.TipoCuenta.ToUpper().Contains("COSTO")
                        || c.TipoCuenta.ToUpper().Contains("EGRESO"))
            .OrderBy(c => c.CodigoCuenta)
            .ToList();

        // Acumulado (saldo inicial + movimientos) hasta el fin del periodo, con
        // el mismo corte inclusivo que usa el balance de comprobación.
        var idsResultado = cuentasResultado.Select(c => c.Id).ToList();
        var acumuladoPorCuenta = idsResultado.Count == 0
            ? new Dictionary<int, (decimal Debe, decimal Haber)>()
            : (await _context.AsientosDetalles
                .AsNoTracking()
                .Where(d => d.AsientoContable!.EmpresaId == empresaDelPeriodo
                            && d.AsientoContable.FechaComprobante < fechaFinExclusiva
                            && idsResultado.Contains(d.CuentaContableId))
                .GroupBy(d => d.CuentaContableId)
                .Select(g => new { CuentaId = g.Key, Debe = g.Sum(x => x.Debe), Haber = g.Sum(x => x.Haber) })
                .ToListAsync())
                .ToDictionary(x => x.CuentaId, x => (x.Debe, x.Haber));

        // Líneas de cierre de cada cuenta de resultado con saldo (haber: ingresos,
        // debe: egresos), con la misma estructura que el asiento de cierre real.
        var detalles = new List<AsientoTemporalLineaDto>();
        decimal totalIngresos = 0m;
        decimal totalEgresos = 0m;

        foreach (var cuenta in cuentasResultado)
        {
            acumuladoPorCuenta.TryGetValue(cuenta.Id, out var mov);
            var esDeudora = AsientoContableService.EsDeudoraPorTipo(cuenta);
            var saldoNatural = esDeudora ? mov.Debe - mov.Haber : mov.Haber - mov.Debe;

            if (Math.Abs(saldoNatural) <= 0.01m) continue;

            if (esDeudora) totalEgresos += saldoNatural;
            else totalIngresos += saldoNatural;

            detalles.Add(new AsientoTemporalLineaDto
            {
                CuentaId = cuenta.Id,
                CodigoCuenta = cuenta.CodigoCuenta,
                NombreCuenta = cuenta.NombreCuenta,
                Debe = esDeudora ? 0m : saldoNatural,
                Haber = esDeudora ? saldoNatural : 0m
            });
        }

        var resultado = totalIngresos - totalEgresos; // > 0 utilidad, < 0 pérdida
        var esUtilidad = resultado >= 0m;

        // Cuenta destino fija por empresa: 3.1.3.1.02 del plan de cuentas.
        var cuentaResultados = cuentasEmpresa.FirstOrDefault(c =>
            string.Equals(c.CodigoCuenta?.Trim(), CodigoCuentaResultadosSituacion, StringComparison.Ordinal));

        if (cuentaResultados != null && Math.Abs(resultado) > 0.01m)
        {
            detalles.Add(new AsientoTemporalLineaDto
            {
                CuentaId = cuentaResultados.Id,
                CodigoCuenta = cuentaResultados.CodigoCuenta,
                NombreCuenta = cuentaResultados.NombreCuenta,
                Debe = esUtilidad ? 0m : Math.Abs(resultado),
                Haber = esUtilidad ? resultado : 0m
            });
        }

        var destino = cuentaResultados != null
            ? $"{cuentaResultados.CodigoCuenta} - {cuentaResultados.NombreCuenta}"
            : CodigoCuentaResultadosSituacion;

        var concepto = $"ASIENTO TEMPORAL DE SITUACIÓN FINANCIERA {periodo.Nombre}: " +
            $"traslado de {(esUtilidad ? "utilidad" : "pérdida")} por {Math.Abs(resultado):0.00} a la cuenta {destino}";

        return new AsientoTemporalSituacionDto
        {
            PeriodoId = periodo.Id,
            EmpresaId = empresaDelPeriodo,
            FechaComprobante = periodo.FechaFin.Date,
            TipoComprobante = "Temporal",
            Concepto = concepto.Length > 500 ? concepto[..500] : concepto,
            CuentaResultadosEncontrada = cuentaResultados != null,
            CuentaResultadosId = cuentaResultados?.Id ?? 0,
            CuentaResultadosCodigo = cuentaResultados?.CodigoCuenta ?? CodigoCuentaResultadosSituacion,
            CuentaResultadosNombre = cuentaResultados?.NombreCuenta ?? string.Empty,
            TotalIngresos = totalIngresos,
            TotalEgresos = totalEgresos,
            Resultado = resultado,
            EsUtilidad = esUtilidad,
            Detalles = detalles
        };
    }

    public async Task<List<LibroMayorDto>> GetLibroMayorAsync(int cuentaId, DateTime? fechaInicio = null, DateTime? fechaFin = null, int? empresaId = null)
    {
        var query = _context.AsientosDetalles
            .Include(d => d.AsientoContable)
            .Include(d => d.CuentaContable)
            .Where(d => d.CuentaContableId == cuentaId);

        // Aislamiento por empresa: si el cliente indica la empresa activa
        // (selector único) y la cuenta pertenece a otra empresa, no se
        // devuelve ningún movimiento.
        if (empresaId.HasValue)
            query = query.Where(d => d.CuentaContable!.EmpresaId == empresaId.Value);

        // Signo natural de la cuenta: Deudora (D/Deudora) acumula Debe − Haber
        // y Acreedora (C/Acreedora) acumula Haber − Debe.
        var cuenta = await _context.CuentasContables
            .AsNoTracking()
            .FirstOrDefaultAsync(c => c.Id == cuentaId);
        var naturaleza = (cuenta?.Naturaleza ?? string.Empty).Trim();
        var esAcreedora = naturaleza.StartsWith("A", StringComparison.OrdinalIgnoreCase)
                          || naturaleza.StartsWith("C", StringComparison.OrdinalIgnoreCase);
        var factor = esAcreedora ? -1 : 1;

        // Saldo inicial: movimientos de la cuenta anteriores al inicio del
        // rango consultado (0 cuando no se indica fecha de inicio).
        var saldoAcumulado = 0m;
        if (fechaInicio.HasValue)
        {
            var sumaAnteriores = await query
                .Where(d => d.AsientoContable!.FechaComprobante < fechaInicio.Value)
                .SumAsync(d => (decimal?)(d.Debe - d.Haber)) ?? 0m;
            saldoAcumulado = sumaAnteriores * factor;
        }

        if (fechaInicio.HasValue)
            query = query.Where(d => d.AsientoContable!.FechaComprobante >= fechaInicio.Value);

        if (fechaFin.HasValue)
            query = query.Where(d => d.AsientoContable!.FechaComprobante <= fechaFin.Value);

        var movimientos = await query
            .OrderBy(d => d.AsientoContable!.FechaComprobante)
            .ThenBy(d => d.Id)
            .Select(d => new LibroMayorDto
            {
                AsientoId = d.AsientoContableId,
                NumeroComprobante = d.AsientoContable!.NumeroComprobante,
                FechaComprobante = d.AsientoContable.FechaComprobante,
                Concepto = d.AsientoContable.Concepto,
                CuentaId = d.CuentaContableId,
                CodigoCuenta = d.CuentaContable!.CodigoCuenta,
                NombreCuenta = d.CuentaContable.NombreCuenta,
                Debe = d.Debe,
                Haber = d.Haber
            })
            .ToListAsync();

        // Saldo acumulado corrido: saldo inicial del rango más cada movimiento
        // en orden cronológico (fecha de comprobante y luego Id).
        foreach (var movimiento in movimientos)
        {
            saldoAcumulado += factor * (movimiento.Debe - movimiento.Haber);
            movimiento.SaldoAcumulado = saldoAcumulado;
        }

        return movimientos;
    }
}

public class BalanceComprobacionDto
{
    public int CuentaId { get; set; }
    public string CodigoCuenta { get; set; } = string.Empty;
    public string NombreCuenta { get; set; } = string.Empty;
    public string Naturaleza { get; set; } = string.Empty;
    /// <summary>Tipo de cuenta (Activo, Pasivo, Patrimonio, Ingreso, Gasto) usado para clasificar los reportes.</summary>
    public string TipoCuenta { get; set; } = string.Empty;
    /// <summary>Saldo al cierre del periodo anterior, expresado con el signo natural de la cuenta.</summary>
    public decimal SaldoInicial { get; set; }
    /// <summary>Suma del Debe generada dentro del periodo.</summary>
    public decimal MovimientoDebe { get; set; }
    /// <summary>Suma del Haber generada dentro del periodo.</summary>
    public decimal MovimientoHaber { get; set; }
    /// <summary>Alias del movimiento del debe, conservado por compatibilidad con consumidores existentes.</summary>
    public decimal TotalDebe { get; set; }
    /// <summary>Alias del movimiento del haber, conservado por compatibilidad con consumidores existentes.</summary>
    public decimal TotalHaber { get; set; }
    /// <summary>Saldo al cierre del periodo, expresado con el signo natural de la cuenta.</summary>
    public decimal SaldoFinal { get; set; }
}

public class LibroMayorDto
{
    public int AsientoId { get; set; }
    public string NumeroComprobante { get; set; } = string.Empty;
    public DateTime FechaComprobante { get; set; }
    public string Concepto { get; set; } = string.Empty;
    public int CuentaId { get; set; }
    public string CodigoCuenta { get; set; } = string.Empty;
    public string NombreCuenta { get; set; } = string.Empty;
    public decimal Debe { get; set; }
    public decimal Haber { get; set; }
    /// <summary>
    /// Saldo acumulado de la cuenta: saldo inicial del rango consultado
    /// (movimientos anteriores a FechaInicio) más cada movimiento en orden
    /// cronológico, expresado con el signo natural de la cuenta
    /// (Deudora: Debe − Haber; Acreedora: Haber − Debe).
    /// </summary>
    public decimal SaldoAcumulado { get; set; }
}

/// <summary>
/// Asiento temporal (en memoria, NO persistido) que el backend genera al
/// consultar el Estado de Situación Financiera para trasladar el resultado del
/// periodo a la cuenta 3.1.3.1.02 de la empresa. Expone el resultado y las
/// líneas Debe/Haber del asiento para que el estado lo presente como un
/// procedimiento contable en lugar de una resta en el cliente.
/// </summary>
public class AsientoTemporalSituacionDto
{
    public int PeriodoId { get; set; }
    public int EmpresaId { get; set; }
    /// <summary>Fecha del asiento temporal: el cierre del periodo consultado.</summary>
    public DateTime FechaComprobante { get; set; }
    /// <summary>Tipo de comprobante identificativo ("Temporal"). No se graba en la BD.</summary>
    public string TipoComprobante { get; set; } = "Temporal";
    public string Concepto { get; set; } = string.Empty;
    /// <summary>FALSE cuando la empresa no tiene la cuenta 3.1.3.1.02 en su plan.</summary>
    public bool CuentaResultadosEncontrada { get; set; }
    public int CuentaResultadosId { get; set; }
    public string CuentaResultadosCodigo { get; set; } = string.Empty;
    public string CuentaResultadosNombre { get; set; } = string.Empty;
    /// <summary>Suma de los saldos naturales (acumulados) de las cuentas de ingreso.</summary>
    public decimal TotalIngresos { get; set; }
    /// <summary>Suma de los saldos naturales (acumulados) de las cuentas de gasto/costo/egreso.</summary>
    public decimal TotalEgresos { get; set; }
    /// <summary>Resultado del periodo: utilidad (&gt; 0) o pérdida (&lt; 0).</summary>
    public decimal Resultado { get; set; }
    public bool EsUtilidad { get; set; }
    public List<AsientoTemporalLineaDto> Detalles { get; set; } = new();
}

/// <summary>Línea (detalle) del asiento temporal de situación financiera.</summary>
public class AsientoTemporalLineaDto
{
    public int CuentaId { get; set; }
    public string CodigoCuenta { get; set; } = string.Empty;
    public string NombreCuenta { get; set; } = string.Empty;
    public decimal Debe { get; set; }
    public decimal Haber { get; set; }
}
