using Microsoft.EntityFrameworkCore;
using Tyted.API.Data;
using Tyted.API.Models;
using System;
using System.Collections.Generic;
using System.Globalization;
using System.Linq;
using System.Threading.Tasks;

namespace Tyted.API.Services;

public class AsientoContableService
{
    private readonly TytedContext _context;

    public AsientoContableService(TytedContext context)
    {
        _context = context;
    }

    public async Task<List<AsientoContable>> GetAsientosAsync(int? periodoContableId = null, int? empresaId = null)
    {
        var query = _context.AsientosContables
            .Include(a => a.Detalles)
            .ThenInclude(d => d.CuentaContable)
            .AsQueryable();

        if (periodoContableId.HasValue)
        {
            query = query.Where(a => a.PeriodoContableId == periodoContableId.Value);
        }

        if (empresaId.HasValue)
        {
            query = query.Where(a => a.EmpresaId == empresaId.Value);
        }

        return await query
            .OrderByDescending(a => a.FechaComprobante)
            .ToListAsync();
    }

    public async Task<AsientoContable> CrearAsientoAsync(AsientoContable asiento)
    {
        if (asiento.Detalles == null || !asiento.Detalles.Any())
            throw new InvalidOperationException("El asiento debe incluir al menos un detalle.");

        if (asiento.EmpresaId <= 0)
            throw new InvalidOperationException("El asiento no tiene una empresa asignada. Seleccione la empresa activa e intente de nuevo.");

        if (asiento.PeriodoContableId <= 0)
            throw new InvalidOperationException("El asiento no tiene un periodo contable asignado. Seleccione el periodo activo e intente de nuevo.");

        if (string.IsNullOrWhiteSpace(asiento.Concepto))
            throw new InvalidOperationException("El concepto (glosa) del asiento es obligatorio.");

        // 1. Validar existencia y estado del periodo de forma aislada
        var periodo = await _context.PeriodosContables
            .AsNoTracking()
            .FirstOrDefaultAsync(p => p.Id == asiento.PeriodoContableId)
            ?? throw new InvalidOperationException("El periodo contable no existe.");

        if (periodo.EmpresaId != asiento.EmpresaId)
            throw new InvalidOperationException($"El periodo contable seleccionado pertenece a la empresa {periodo.EmpresaId} y no a la empresa activa ({asiento.EmpresaId}). Cambie el periodo o la empresa.");

        if (periodo.Cerrado || string.Equals(periodo.Estado, "Cerrado", StringComparison.OrdinalIgnoreCase))
            throw new InvalidOperationException("No se puede registrar un asiento en un periodo cerrado.");

        if (asiento.FechaComprobante.Date < periodo.FechaInicio.Date || asiento.FechaComprobante.Date > periodo.FechaFin.Date)
            throw new InvalidOperationException("La fecha del asiento debe estar dentro del periodo contable.");

        // 2. Calcular y validar totales de partida doble
        var totalDebe = asiento.Detalles.Sum(d => d.Debe);
        var totalHaber = asiento.Detalles.Sum(d => d.Haber);

        if (Math.Abs((decimal)(totalDebe - totalHaber)) > 0.01m)
            throw new InvalidOperationException("La suma del debe y el haber no coincide.");

        if (totalDebe <= 0)
            throw new InvalidOperationException("El asiento debe tener un monto mayor a cero.");

        // 3. Validar cada cuenta contable
        foreach (var detalle in asiento.Detalles)
        {
            var cuenta = await _context.CuentasContables
                .AsNoTracking()
                .FirstOrDefaultAsync(c => c.Id == detalle.CuentaContableId);

            if (cuenta == null)
                throw new InvalidOperationException($"La cuenta con ID {detalle.CuentaContableId} no existe.");

            if (!cuenta.Activa)
                throw new InvalidOperationException($"La cuenta {cuenta.CodigoCuenta} está inactiva.");

            NormalizarDetalle(detalle);
        }

        // Autogeneración del consecutivo del comprobante con formato YYMM0000001
        // (ej: 26100000001 = primer comprobante de octubre/2026). El frontend envía
        // la cadena vacía en modo creación y conserva el número al editar.
        if (string.IsNullOrWhiteSpace(asiento.NumeroComprobante))
            asiento.NumeroComprobante = await GenerarNumeroComprobanteAsync(asiento.EmpresaId, asiento.FechaComprobante);

        asiento.TotalDebe = totalDebe;
        asiento.TotalHaber = totalHaber;

        // 4. Guardar cabecera y detalles utilizando los IDs recibidos
        _context.AsientosContables.Add(asiento);
        await _context.SaveChangesAsync();

        // 5. Registrar auditoría de manera segura
        var usuario = await _context.Usuarios.AsNoTracking().FirstOrDefaultAsync(u => u.Id == asiento.UsuarioId);
        _context.AuditoriasContables.Add(new AuditoriaContable
        {
            Fecha = DateTime.Now,
            Usuario = usuario?.Username ?? "Sistema",
            Accion = "Creación de asiento",
            Detalle = $"Se registró el asiento {asiento.NumeroComprobante} con total debe {totalDebe} y haber {totalHaber}. Tipo: {asiento.TipoComprobante}",
            AsientoContableId = asiento.Id
        });

        await _context.SaveChangesAsync();
        return asiento;
    }

    public async Task<AsientoContable> ActualizarAsientoAsync(int id, AsientoContable asientoActualizado)
    {
        var asientoExistente = await _context.AsientosContables
            .Include(a => a.Detalles)
            .FirstOrDefaultAsync(a => a.Id == id);

        if (asientoExistente == null) return null;

        if (asientoActualizado.Detalles == null || !asientoActualizado.Detalles.Any())
            throw new InvalidOperationException("El asiento modificado debe incluir al menos un detalle.");

        var periodo = await _context.PeriodosContables
            .AsNoTracking()
            .FirstOrDefaultAsync(p => p.Id == asientoActualizado.PeriodoContableId)
            ?? throw new InvalidOperationException("El periodo contable asignado no existe.");

        if (periodo.EmpresaId != asientoExistente.EmpresaId)
            throw new InvalidOperationException("El periodo contable indicado no pertenece a la empresa de este asiento.");

        if (periodo.Cerrado || string.Equals(periodo.Estado, "Cerrado", StringComparison.OrdinalIgnoreCase))
            throw new InvalidOperationException("No se puede modificar un asiento que pertenece a un periodo cerrado.");

        if (asientoActualizado.FechaComprobante.Date < periodo.FechaInicio.Date || asientoActualizado.FechaComprobante.Date > periodo.FechaFin.Date)
            throw new InvalidOperationException("La fecha modificada del asiento debe estar dentro del periodo contable.");

        var totalDebe = asientoActualizado.Detalles.Sum(d => d.Debe);
        var totalHaber = asientoActualizado.Detalles.Sum(d => d.Haber);

        if (Math.Abs((decimal)(totalDebe - totalHaber)) > 0.01m)
            throw new InvalidOperationException("La suma del debe y el haber no coincide en el asiento modificado.");

        foreach (var detalle in asientoActualizado.Detalles)
        {
            var cuenta = await _context.CuentasContables
                .AsNoTracking()
                .FirstOrDefaultAsync(c => c.Id == detalle.CuentaContableId);

            if (cuenta == null) throw new InvalidOperationException($"La cuenta {detalle.CuentaContableId} no existe.");
            if (!cuenta.Activa) throw new InvalidOperationException($"La cuenta {cuenta.CodigoCuenta} está inactiva.");

            NormalizarDetalle(detalle);
            detalle.CuentaContable = null;
            detalle.AsientoContable = null;
        }

        asientoExistente.Concepto = asientoActualizado.Concepto;
        asientoExistente.FechaComprobante = asientoActualizado.FechaComprobante;
        asientoExistente.TipoComprobante = asientoActualizado.TipoComprobante;
        asientoExistente.TotalDebe = totalDebe;
        asientoExistente.TotalHaber = totalHaber;

        _context.RemoveRange(asientoExistente.Detalles);
        
        foreach (var nuevoDetalle in asientoActualizado.Detalles)
        {
            nuevoDetalle.Id = 0;
            asientoExistente.Detalles.Add(nuevoDetalle);
        }

        var usuario = await _context.Usuarios.AsNoTracking().FirstOrDefaultAsync(u => u.Id == asientoActualizado.UsuarioId);
        _context.AuditoriasContables.Add(new AuditoriaContable
        {
            Fecha = DateTime.Now,
            Usuario = usuario?.Username ?? "Sistema",
            Accion = "Modificación de asiento",
            Detalle = $"Se modificó el asiento {asientoExistente.NumeroComprobante}. Nuevo debe/haber: {totalDebe}. Concepto modificado: {asientoExistente.Concepto}",
            AsientoContableId = asientoExistente.Id
        });

        await _context.SaveChangesAsync();
        return asientoExistente;
    }

    // ---------------------------------------------------------------------------
    // ASIENTO DE CIERRE DE RESULTADOS (traslado a patrimonio)
    // ---------------------------------------------------------------------------

    /// <summary>
    /// Prefijo del concepto que identifica los asientos de cierre de resultados
    /// generados por el sistema. Permite distinguirlos de los asientos de
    /// cierre manuales para poder regenerarlos sin tocar asientos del usuario.
    /// </summary>
    public const string PrefijoCierreResultados = "CIERRE DE RESULTADOS";

    /// <summary>
    /// Genera el asiento de cierre que traslada el resultado del periodo
    /// (utilidad o pérdida) a una cuenta de patrimonio ("Resultados del
    /// ejercicio"), cumpliendo la ecuación contable del estado de situación
    /// financiera: ACTIVO = PASIVO + PATRIMONIO (con el resultado ya incluido).
    ///
    /// Reglas aplicadas:
    /// - Calcula el saldo acumulado (signo natural) de cada cuenta de ingresos
    ///   y egresos de la empresa hasta el cierre del periodo; incluye los
    ///   saldos arrastrados de periodos anteriores (mismo corte de fechas que
    ///   el balance de comprobación).
    /// - Zera cada cuenta con un asiento contrario (ingreso: Debe; gasto: Haber).
    /// - La diferencia neta se acredita (utilidad) o debita (pérdida) a la
    ///   cuenta de patrimonio "Resultados del ejercicio"; si la empresa no
    ///   tiene esa cuenta, el sistema la crea automáticamente bajo Patrimonio.
    /// - Si el periodo ya tiene un cierre generado por el sistema, se rechaza
    ///   salvo que se pida regenerar (regenerar = true), en cuyo caso se
    ///   reemplaza para reflejar los últimos movimientos registrados.
    /// </summary>
    public async Task<CierreResultadosResponse> GenerarAsientoCierreResultadosAsync(
        int periodoId,
        int empresaId,
        int usuarioId,
        string? usuario = null,
        bool regenerar = false)
    {
        var periodo = await _context.PeriodosContables
            .AsNoTracking()
            .FirstOrDefaultAsync(p => p.Id == periodoId)
            ?? throw new InvalidOperationException("El periodo contable no existe.");

        if (periodo.EmpresaId != empresaId)
            throw new InvalidOperationException("El periodo solicitado no pertenece a la empresa activa.");

        if (periodo.Cerrado || string.Equals(periodo.Estado, "Cerrado", StringComparison.OrdinalIgnoreCase))
            throw new InvalidOperationException("No se puede generar el asiento de cierre en un periodo cerrado. Abra el periodo e intente de nuevo.");

        // Cierre previo generado por el sistema para este periodo (se identifica
        // por tipo "Cierre" + el prefijo del concepto, nunca toca asientos manuales).
        var cierrePrevio = await _context.AsientosContables
            .Include(a => a.Detalles)
            .FirstOrDefaultAsync(a => a.PeriodoContableId == periodoId
                && a.EmpresaId == empresaId
                && a.TipoComprobante == "Cierre"
                && a.Concepto.StartsWith(PrefijoCierreResultados));

        if (cierrePrevio != null && !regenerar)
            throw new InvalidOperationException($"El periodo «{periodo.Nombre}» ya tiene un asiento de cierre de resultados ({cierrePrevio.NumeroComprobante}). Use la opción «Regenerar» para reemplazarlo con los últimos movimientos.");

        // Acumulado (saldo inicial + movimientos) de las cuentas de resultado
        // hasta el fin del periodo, con el mismo corte inclusivo que usa el
        // balance de comprobación (FechaFin cubre asientos del último día).
        var fechaFinExclusiva = periodo.FechaFin.Date.AddDays(1);

        var cuentasResultado = await _context.CuentasContables
            .AsNoTracking()
            .Where(c => c.EmpresaId == empresaId
                && (c.TipoCuenta.ToUpper().Contains("INGRESO")
                    || c.TipoCuenta.ToUpper().Contains("GASTO")
                    || c.TipoCuenta.ToUpper().Contains("COSTO")
                    || c.TipoCuenta.ToUpper().Contains("EGRESO")))
            .OrderBy(c => c.CodigoCuenta)
            .ToListAsync();

        if (cuentasResultado.Count == 0)
            throw new InvalidOperationException("La empresa no tiene cuentas de ingresos ni de egresos en su plan de cuentas: no hay nada que cerrar.");

        var idsCuentas = cuentasResultado.Select(c => c.Id).ToList();
        var acumulado = await _context.AsientosDetalles
            .AsNoTracking()
            .Where(d => d.AsientoContable!.EmpresaId == empresaId
                && d.AsientoContable.FechaComprobante < fechaFinExclusiva
                // Al regenerar se excluyen los movimientos del cierre previo
                // para calcular los saldos como si el cierre no existiera.
                && (cierrePrevio == null || d.AsientoContableId != cierrePrevio.Id)
                && idsCuentas.Contains(d.CuentaContableId))
            .GroupBy(d => d.CuentaContableId)
            .Select(g => new { CuentaId = g.Key, Debe = g.Sum(x => x.Debe), Haber = g.Sum(x => x.Haber) })
            .ToListAsync();
        var acumuladoPorCuenta = acumulado.ToDictionary(x => x.CuentaId, x => x);

        // Cierre de cada cuenta de resultado con saldo distinto de cero.
        var detalles = new List<AsientoDetalle>();
        decimal totalIngresos = 0m;
        decimal totalEgresos = 0m;

        foreach (var cuenta in cuentasResultado)
        {
            acumuladoPorCuenta.TryGetValue(cuenta.Id, out var mov);
            var debe = mov?.Debe ?? 0m;
            var haber = mov?.Haber ?? 0m;

            // Signo natural según el TIPO de la cuenta (los ingresos son
            // acreedores; los gastos y costos, deudores), usando la naturaleza
            // declarada ("D"/"Deudora" vs "C"/"Acreedora") como respaldo.
            var esDeudora = EsDeudoraPorTipo(cuenta);
            var saldoNatural = esDeudora ? debe - haber : haber - debe;

            if (Math.Abs(saldoNatural) <= 0.01m) continue;

            if (esDeudora) totalEgresos += saldoNatural;
            else totalIngresos += saldoNatural;

            // Zerar la cuenta con un movimiento contrario al saldo acumulado.
            detalles.Add(new AsientoDetalle
            {
                CuentaContableId = cuenta.Id,
                Debe = esDeudora ? 0m : saldoNatural,
                Haber = esDeudora ? saldoNatural : 0m
            });
        }

        if (detalles.Count == 0)
            throw new InvalidOperationException($"No hay cuentas de ingresos o egresos con saldo que cerrar en el periodo «{periodo.Nombre}». Es posible que el resultado ya haya sido transferido a patrimonio.");

        var resultado = totalIngresos - totalEgresos; // > 0 utilidad, < 0 pérdida
        var esUtilidad = resultado >= 0m;

        // Cuenta de patrimonio destino ("Resultados del ejercicio")
        var (cuentaResultados, creada) = await ObtenerOCrearCuentaResultadosAsync(empresaId);

        detalles.Add(new AsientoDetalle
        {
            CuentaContableId = cuentaResultados.Id,
            Debe = esUtilidad ? 0m : Math.Abs(resultado),
            Haber = esUtilidad ? resultado : 0m
        });

        // Regeneración: se retira el cierre previo (y sus detalles) antes de
        // crear el nuevo para no duplicar el traslado del resultado.
        if (cierrePrevio != null)
        {
            _context.AsientosDetalles.RemoveRange(cierrePrevio.Detalles);
            _context.AsientosContables.Remove(cierrePrevio);
            _context.AuditoriasContables.Add(new AuditoriaContable
            {
                Fecha = DateTime.Now,
                Usuario = usuario ?? "Sistema",
                Accion = "Eliminación de asiento de cierre",
                Detalle = $"Se reemplazó el asiento de cierre {cierrePrevio.NumeroComprobante} del periodo «{periodo.Nombre}» al regenerar los resultados."
            });
            await _context.SaveChangesAsync();
        }

        var concepto = $"{PrefijoCierreResultados} {periodo.Nombre}: traslado de {(esUtilidad ? "utilidad" : "pérdida")} por {Math.Abs(resultado):0.00} a la cuenta {cuentaResultados.CodigoCuenta} - {cuentaResultados.NombreCuenta}";

        // CrearAsientoAsync reutiliza todas las validaciones del alta normal
        // (partida doble, cuenta activa, rango del periodo, auditoría y
        // autogeneración del comprobante con formato YYMM0000001).
        var asiento = await CrearAsientoAsync(new AsientoContable
        {
            EmpresaId = empresaId,
            PeriodoContableId = periodoId,
            NumeroComprobante = string.Empty,
            FechaComprobante = periodo.FechaFin.Date,
            Concepto = concepto.Length > 500 ? concepto[..500] : concepto,
            TipoComprobante = "Cierre",
            Estado = "Aprobado",
            UsuarioId = usuarioId,
            Detalles = detalles
        });

        return new CierreResultadosResponse
        {
            AsientoId = asiento.Id,
            NumeroComprobante = asiento.NumeroComprobante,
            Concepto = asiento.Concepto,
            FechaComprobante = asiento.FechaComprobante,
            TotalIngresos = totalIngresos,
            TotalEgresos = totalEgresos,
            Resultado = resultado,
            EsUtilidad = esUtilidad,
            CuentaResultadosId = cuentaResultados.Id,
            CuentaResultadosCodigo = cuentaResultados.CodigoCuenta,
            CuentaResultadosNombre = cuentaResultados.NombreCuenta,
            CuentaResultadosCreada = creada,
            CantidadDetalles = detalles.Count
        };
    }

    /// <summary>
    /// Naturaleza de una cuenta de resultado según su TIPO: los gastos, costos
    /// y egresos son deudores; los ingresos, acreedores. Si el tipo no permite
    /// decidir se usa el campo Naturaleza, aceptando tanto "D"/"C" como las
    /// etiquetas "Deudora"/"Acreedora" que envía el formulario del plan.
    /// Es `public` porque también la usa ReportesContablesService para
    /// calcular el resultado del periodo del asiento temporal del Estado de
    /// Situación Financiera con el mismo criterio de signo.
    /// </summary>
    public static bool EsDeudoraPorTipo(CuentaContable cuenta)
    {
        var tipo = (cuenta.TipoCuenta ?? string.Empty).ToUpperInvariant();
        if (tipo.Contains("GASTO") || tipo.Contains("COSTO") || tipo.Contains("EGRESO")) return true;
        if (tipo.Contains("INGRESO")) return false;
        return (cuenta.Naturaleza ?? "D").TrimStart()
            .StartsWith("D", StringComparison.OrdinalIgnoreCase);
    }

    /// <summary>
    /// Busca la cuenta de patrimonio destino del resultado ("Resultados del
    /// ejercicio") y, si no existe, la crea automáticamente bajo la cuenta
    /// título de patrimonio. El código generado evita chocar con el índice
    /// único (EmpresaId, CodigoCuenta) de la tabla CuentasContables.
    /// </summary>
    private async Task<(CuentaContable cuenta, bool creada)> ObtenerOCrearCuentaResultadosAsync(int empresaId)
    {
        var existente = await _context.CuentasContables
            .AsNoTracking()
            .Where(c => c.EmpresaId == empresaId
                && (c.TipoCuenta.ToUpper().Contains("PATRIMONIO") || c.TipoCuenta.ToUpper().Contains("CAPITAL"))
                && c.NombreCuenta.ToUpper().Contains("RESULTADO"))
            .OrderBy(c => c.CodigoCuenta)
            .FirstOrDefaultAsync();

        if (existente != null) return (existente, false);

        var tituloPatrimonio = await _context.CuentasContables
            .AsNoTracking()
            .Where(c => c.EmpresaId == empresaId
                && (c.TipoCuenta.ToUpper().Contains("PATRIMONIO") || c.TipoCuenta.ToUpper().Contains("CAPITAL")))
            .OrderBy(c => c.Nivel).ThenBy(c => c.CodigoCuenta)
            .FirstOrDefaultAsync();

        var baseCodigo = (tituloPatrimonio?.CodigoCuenta ?? "3").Trim().TrimEnd('.');
        var codigo = $"{baseCodigo}.99";
        for (var intento = 99; intento >= 1; intento--)
        {
            var candidato = $"{baseCodigo}.{intento:D2}";
            var ocupado = await _context.CuentasContables
                .AnyAsync(c => c.EmpresaId == empresaId && c.CodigoCuenta == candidato);
            if (!ocupado)
            {
                codigo = candidato;
                break;
            }
        }

        var cuenta = new CuentaContable
        {
            EmpresaId = empresaId,
            CodigoCuenta = codigo,
            NombreCuenta = "RESULTADOS DEL EJERCICIO",
            TipoCuenta = "Patrimonio",
            Naturaleza = "C",
            EsMovimiento = true,
            Nivel = (tituloPatrimonio?.Nivel ?? 0) + 1,
            PadreCuentaId = tituloPatrimonio?.Id,
            AceptaTerceros = false,
            AceptaCentroCosto = false,
            Activa = true
        };

        _context.CuentasContables.Add(cuenta);
        await _context.SaveChangesAsync();
        return (cuenta, true);
    }

    /// <summary>
    /// Genera el consecutivo del comprobante con el formato solicitado YYMM0000001:
    /// 2 dígitos de año + 2 de mes + secuencia de 7 dígitos (ej: 26100000001).
    /// La secuencia se reinicia cada mes y es independiente por empresa, de modo que
    /// cada compañía mantiene su propia serie contable.
    /// Los comprobantes legados (ej: COMP-261007143055) no alteran la secuencia porque
    /// su sufijo no es numérico.
    /// </summary>
    private async Task<string> GenerarNumeroComprobanteAsync(int empresaId, DateTime fechaComprobante)
    {
        var prefijo = fechaComprobante.ToString("yyMM", CultureInfo.InvariantCulture);

        var existentes = await _context.AsientosContables
            .AsNoTracking()
            .Where(a => a.EmpresaId == empresaId && a.NumeroComprobante.StartsWith(prefijo))
            .Select(a => a.NumeroComprobante)
            .ToListAsync();

        var siguiente = 1;
        foreach (var numero in existentes)
        {
            if (numero.Length <= prefijo.Length) continue;

            if (int.TryParse(numero.AsSpan(prefijo.Length), out var secuencia) && secuencia >= siguiente)
                siguiente = secuencia + 1;
        }

        // Reintento básico ante una condición de carrera (dos usuarios creando en el mismo
        // mes al mismo tiempo): si el candidato ya existe se incrementa la secuencia.
        for (var intento = 0; intento < 50; intento++)
        {
            var candidato = string.Format(CultureInfo.InvariantCulture, "{0}{1:D7}", prefijo, siguiente++);
            var ocupado = await _context.AsientosContables
                .AnyAsync(a => a.EmpresaId == empresaId && a.NumeroComprobante == candidato);
            if (!ocupado) return candidato;
        }

        // Último recurso si el bucle se agota: se devuelve el siguiente número calculado.
        return string.Format(CultureInfo.InvariantCulture, "{0}{1:D7}", prefijo, siguiente);
    }

    /// <summary>
    /// AsientoDetalle.Referencia está limitado a 100 caracteres en la BD.
    /// El frontend envía el concepto completo (hasta 500), así que se recorta
    /// aquí para evitar un error 400/500 proveniente de SQL Server.
    /// </summary>
    private static void NormalizarDetalle(AsientoDetalle detalle)
    {
        detalle.Referencia ??= string.Empty;

        if (detalle.Referencia.Length > 100)
            detalle.Referencia = detalle.Referencia[..100];
    }
}

/// <summary>
/// Resultado del proceso de generación del asiento de cierre de resultados:
/// resume el traslado del resultado del periodo a la cuenta de patrimonio.
/// </summary>
public class CierreResultadosResponse
{
    public int AsientoId { get; set; }
    public string NumeroComprobante { get; set; } = string.Empty;
    public string Concepto { get; set; } = string.Empty;
    public DateTime FechaComprobante { get; set; }
    /// <summary>Suma de los saldos naturales (acumulados) de las cuentas de ingresos.</summary>
    public decimal TotalIngresos { get; set; }
    /// <summary>Suma de los saldos naturales (acumulados) de las cuentas de gastos y costos.</summary>
    public decimal TotalEgresos { get; set; }
    /// <summary>Utilidad (positivo) o pérdida (negativo) transferida a patrimonio.</summary>
    public decimal Resultado { get; set; }
    public bool EsUtilidad { get; set; }
    public int CuentaResultadosId { get; set; }
    public string CuentaResultadosCodigo { get; set; } = string.Empty;
    public string CuentaResultadosNombre { get; set; } = string.Empty;
    /// <summary>Indica si la cuenta de patrimonio tuvo que ser creada por el sistema.</summary>
    public bool CuentaResultadosCreada { get; set; }
    public int CantidadDetalles { get; set; }
}
