using Microsoft.EntityFrameworkCore;
using Tyted.API.Data;
using Tyted.API.Models;

namespace Tyted.API.Services;

public class PeriodoContableService
{
    private readonly TytedContext _context;
    // Se usa para crear el asiento de APERTURA DE BALANCE (traslado de saldos
    // al cerrar un periodo) reutilizando todas las validaciones del alta
    // normal de asientos (partida doble, comprobante, auditoría, etc.).
    private readonly AsientoContableService _asientos;

    public PeriodoContableService(TytedContext context, AsientoContableService asientos)
    {
        _context = context;
        _asientos = asientos;
    }

    /// <summary>
    /// VALIDACIONES DE SEGURIDAD FINANCIERA al crear o modificar periodos:
    /// 1) La fecha de fin debe ser posterior a la de inicio.
    /// 2) PERIODO DE APERTURA: el de menor FechaInicio de la empresa; no se
    ///    permiten periodos ANTERIORES a él (la contabilidad de la empresa
    ///    arranca en su apertura).
    /// 3) Sin solapamiento PARCIAL con periodos existentes. Se permite el
    ///    anidamiento jerárquico (mensual contenido en el anual o viceversa)
    ///    porque se superponen por diseño.
    /// </summary>
    private async Task ValidarFechasPeriodoAsync(
        int empresaId,
        DateTime fechaInicio,
        DateTime fechaFin,
        string tipoPeriodo,
        int? periodoExcluirId = null)
    {
        if (fechaFin.Date <= fechaInicio.Date)
            throw new InvalidOperationException("La fecha de fin del periodo debe ser posterior a la fecha de inicio.");

        var existentes = await _context.PeriodosContables
            .AsNoTracking()
            .Where(p => p.EmpresaId == empresaId)
            .Select(p => new { p.Id, p.Nombre, p.TipoPeriodo, p.FechaInicio, p.FechaFin })
            .ToListAsync();

        // El primer periodo registrado de la empresa ES su periodo de apertura.
        if (existentes.Count == 0) return;

        // El ancla de apertura se calcula con TODOS los periodos (incluido el
        // que se edita, con sus fechas actuales): así ni siquiera el periodo
        // de apertura puede retrocederse para redefinir la apertura hacia atrás.
        var apertura = existentes.OrderBy(p => p.FechaInicio).ThenBy(p => p.Id).First();
        if (fechaInicio.Date < apertura.FechaInicio.Date)
            throw new InvalidOperationException(
                $"No se permiten periodos anteriores al periodo de apertura de la empresa (apertura: {apertura.FechaInicio:dd/MM/yyyy}). " +
                "La contabilidad arranca en el periodo de apertura: cree un periodo igual o posterior.");

        // Para el solapamiento sí se excluye el periodo que se está editando.
        var paraSolape = periodoExcluirId.HasValue
            ? existentes.Where(p => p.Id != periodoExcluirId.Value).ToList()
            : existentes;

        var inicio = fechaInicio.Date;
        var fin = fechaFin.Date;
        foreach (var existente in paraSolape)
        {
            var exIni = existente.FechaInicio.Date;
            var exFin = existente.FechaFin.Date;
            if (!(inicio < exFin && fin > exIni)) continue; // no se solapan

            // Contención de fechas permitida SÓLO como anidamiento jerárquico
            // (fechas dentro de un contenedor de distinto tipo: anual↔mensual).
            var esContencion = (inicio >= exIni && fin <= exFin) || (exIni >= inicio && exFin <= fin);
            var tiposDiferentes = !string.Equals(
                existente.TipoPeriodo ?? string.Empty,
                tipoPeriodo ?? string.Empty,
                StringComparison.OrdinalIgnoreCase);
            if (esContencion && tiposDiferentes) continue;

            throw new InvalidOperationException(
                $"Las fechas del periodo se solapan con el periodo «{existente.Nombre}» " +
                $"({exIni:dd/MM/yyyy} al {exFin:dd/MM/yyyy}). Ajuste las fechas para evitar el solapamiento.");
        }
    }

    public async Task<List<PeriodoContable>> GetPeriodosAsync(int? empresaId = null)
    {
        var query = _context.PeriodosContables.AsNoTracking().Include(p => p.SubPeriodos).AsQueryable();

        if (empresaId.HasValue)
        {
            query = query.Where(p => p.EmpresaId == empresaId.Value);
        }

        var periodos = await query
            .Where(p => p.TipoPeriodo == "Anual" || p.PeriodoPadreId == null || p.TipoPeriodo == null)
            .OrderByDescending(p => p.Anio)
            .ToListAsync();

        // Ordenar hijos en memoria de forma segura
        foreach (var p in periodos)
        {
            if (p.SubPeriodos != null && p.SubPeriodos.Any())
            {
                p.SubPeriodos = p.SubPeriodos.OrderBy(s => s.Mes).ToList();
            }
        }

        return periodos;
    } 

    public async Task<PeriodoContable?> GetPeriodoActivoAsync(int empresaId)
    {
        var ahora = DateTime.Now;

        var subperiodo = await _context.PeriodosContables
            .Where(p => p.EmpresaId == empresaId && p.Anio == ahora.Year && p.Mes == ahora.Month && p.TipoPeriodo == "Mensual")
            .FirstOrDefaultAsync();

        if (subperiodo is not null) return subperiodo;

        return await _context.PeriodosContables
            .Where(p => p.EmpresaId == empresaId && p.Anio == ahora.Year && p.TipoPeriodo == "Anual")
            .FirstOrDefaultAsync();
    }

    // 1. Crear un periodo individual (valida nulos en Mes de forma segura)
    public async Task<PeriodoContable> CrearPeriodoAsync(PeriodoContable periodo)
    {
        if (periodo.Anio <= 0)
            throw new InvalidOperationException("El año del periodo contable no es válido.");

        var existe = await _context.PeriodosContables.AnyAsync(p => 
            p.EmpresaId == periodo.EmpresaId && 
            p.Anio == periodo.Anio && 
            p.Mes == periodo.Mes && 
            p.TipoPeriodo == periodo.TipoPeriodo);

        if (existe)
            throw new InvalidOperationException("Ya existe un periodo contable registrado con estas especificaciones.");

        int mesValido = periodo.Mes.HasValue && periodo.Mes.Value >= 1 && periodo.Mes.Value <= 12 ? periodo.Mes.Value : 1;

        if (periodo.FechaInicio == default)
        {
            periodo.FechaInicio = periodo.Mes.HasValue 
                ? new DateTime(periodo.Anio, mesValido, 1) 
                : new DateTime(periodo.Anio, 1, 1);
        }

        if (periodo.FechaFin == default)
        {
            periodo.FechaFin = periodo.Mes.HasValue 
                ? new DateTime(periodo.Anio, mesValido, DateTime.DaysInMonth(periodo.Anio, mesValido), 23, 59, 59) 
                : new DateTime(periodo.Anio, 12, 31, 23, 59, 59);
        }

        // Seguridad financiera: sin periodos anteriores a la apertura, con
        // fechas coherentes y sin solapamientos parciales.
        await ValidarFechasPeriodoAsync(periodo.EmpresaId, periodo.FechaInicio, periodo.FechaFin, periodo.TipoPeriodo);

        periodo.Estado = periodo.Cerrado ? "Cerrado" : "Abierto";

        _context.PeriodosContables.Add(periodo);
        await _context.SaveChangesAsync();

        return periodo;
    }

    // 2. Generar Ejercicio Fiscal Anual (Padre) con sus 12 Subperiodos Mensuales (Hijos)
    public async Task<PeriodoContable> CrearEjercicioFiscalCompletoAsync(int empresaId, int anio)
    {
        var existeAnual = await _context.PeriodosContables
            .AnyAsync(p => p.EmpresaId == empresaId && p.Anio == anio && p.TipoPeriodo == "Anual");

        if (existeAnual)
            throw new InvalidOperationException($"El Ejercicio Fiscal {anio} ya se encuentra registrado.");

        // Seguridad financiera: fechas coherentes, sin periodos anteriores a la
        // apertura de la empresa y sin solapamiento con otros ejercicios.
        var fechaInicioEjercicio = new DateTime(anio, 1, 1);
        var fechaFinEjercicio = new DateTime(anio, 12, 31, 23, 59, 59);
        await ValidarFechasPeriodoAsync(empresaId, fechaInicioEjercicio, fechaFinEjercicio, "Anual");

        var periodoPadre = new PeriodoContable
        {
            EmpresaId = empresaId,
            Anio = anio,
            Mes = null,
            TipoPeriodo = "Anual",
            Nombre = $"Ejercicio Fiscal {anio}",
            FechaInicio = fechaInicioEjercicio,
            FechaFin = fechaFinEjercicio,
            Estado = "Abierto",
            Cerrado = false
        };

        _context.PeriodosContables.Add(periodoPadre);
        await _context.SaveChangesAsync();

        string[] nombresMeses = { "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre" };

        for (int mes = 1; mes <= 12; mes++)
        {
            var subperiodo = new PeriodoContable
            {
                EmpresaId = empresaId,
                Anio = anio,
                Mes = mes,
                TipoPeriodo = "Mensual",
                PeriodoPadreId = periodoPadre.Id,
                Nombre = $"{nombresMeses[mes - 1]} {anio}",
                FechaInicio = new DateTime(anio, mes, 1),
                FechaFin = new DateTime(anio, mes, DateTime.DaysInMonth(anio, mes), 23, 59, 59),
                Estado = "Abierto",
                Cerrado = false
            };
            _context.PeriodosContables.Add(subperiodo);
        }

        await _context.SaveChangesAsync();
        return periodoPadre;
    }

    // 3. Comprobar si el periodo posee asientos contables vinculados
    public async Task<bool> TieneMovimientosAsync(int periodoId)
    {
        return await _context.AsientosContables
            .AnyAsync(a => a.PeriodoContableId == periodoId);
    }

    // 4. Modificar periodo existente si no tiene movimientos
    public async Task<PeriodoContable> ModificarPeriodoAsync(int periodoId, PeriodoContable periodoDTO)
    {
        var periodo = await _context.PeriodosContables
            .FirstOrDefaultAsync(p => p.Id == periodoId)
            ?? throw new InvalidOperationException("El periodo contable no existe.");

        bool tieneMovimientos = await TieneMovimientosAsync(periodoId);
        if (tieneMovimientos)
            throw new InvalidOperationException("No se puede modificar un periodo que ya posee asientos contables registrados.");

        // Un periodo CERRADO nunca es editable (ni siquiera sin asientos):
        // sus fechas son la base de los saldos arrastrados y de los traslados.
        if (periodo.Cerrado || string.Equals(periodo.Estado, "Cerrado", StringComparison.OrdinalIgnoreCase))
            throw new InvalidOperationException("No se puede modificar un periodo CERRADO. Ábralo primero (si procede) antes de editar sus fechas o datos.");

        // Seguridad financiera: mismo criterio que en la creación (apertura,
        // coherencia de fechas y sin solapamientos), excluyendo este periodo.
        var tipoEfectivo = string.IsNullOrWhiteSpace(periodoDTO.TipoPeriodo) ? periodo.TipoPeriodo : periodoDTO.TipoPeriodo;
        await ValidarFechasPeriodoAsync(periodo.EmpresaId, periodoDTO.FechaInicio, periodoDTO.FechaFin, tipoEfectivo, periodoId);

        periodo.Anio = periodoDTO.Anio;
        periodo.Mes = periodoDTO.Mes;
        periodo.Nombre = periodoDTO.Nombre;
        periodo.FechaInicio = periodoDTO.FechaInicio;
        periodo.FechaFin = periodoDTO.FechaFin;
        periodo.TipoPeriodo = periodoDTO.TipoPeriodo ?? periodo.TipoPeriodo;

        await _context.SaveChangesAsync();
        return periodo;
    }

    /// <summary>
    /// Elimina un periodo SIN asientos contables (ni en él ni en sus
    /// subperiodos). Si es un ejercicio anual, sus subperiodos vacíos se
    /// eliminan en cascada (FK PeriodoPadreId). Sirve para corregir en la
    /// aplicación periodos antiguos erróneos (p. ej. un mal periodo de
    /// apertura) sin tener que tocar la base de datos. Reglas:
    /// - Cualquier asiento en el periodo (incluido un APERTURA DE BALANCE
    ///   recibido de un cierre previo) bloquea la eliminación.
    /// - El periodo de apertura NO está marcado: al eliminar el más antiguo,
    ///   el siguiente pasa automáticamente a ser la apertura (regla derivada).
    /// - Se registra auditoría de la eliminación.
    /// </summary>
    public async Task<EliminacionPeriodoResponse> EliminarPeriodoAsync(int periodoId, string usuario = "Sistema")
    {
        var periodo = await _context.PeriodosContables
            .Include(p => p.SubPeriodos)
            .FirstOrDefaultAsync(p => p.Id == periodoId)
            ?? throw new InvalidOperationException("El periodo contable no existe.");

        var ids = new List<int> { periodo.Id };
        var nombresPorId = new Dictionary<int, string>
        {
            [periodo.Id] = periodo.Nombre ?? $"Periodo {periodo.Id}"
        };

        if (periodo.SubPeriodos != null)
        {
            foreach (var sub in periodo.SubPeriodos)
            {
                ids.Add(sub.Id);
                nombresPorId[sub.Id] = sub.Nombre ?? $"Subperiodo {sub.Id}";
            }
        }

        // Ni el periodo ni sus subperiodos pueden tener asientos.
        var conAsientos = await _context.AsientosContables
            .AsNoTracking()
            .Where(a => ids.Contains(a.PeriodoContableId))
            .Select(a => a.PeriodoContableId)
            .Distinct()
            .ToListAsync();

        if (conAsientos.Count > 0)
        {
            var afectados = string.Join(", ", conAsientos.Select(id => $"«{(nombresPorId.TryGetValue(id, out var n) ? n : id)}»"));
            throw new InvalidOperationException(
                $"No se puede eliminar: el periodo {afectados} tiene asientos contables registrados. " +
                "La eliminación sólo está permitida para periodos vacíos; los periodos con movimientos forman parte del historial contable.");
        }

        var subperiodosEliminados = periodo.SubPeriodos?.Count ?? 0;

        if (periodo.SubPeriodos?.Any() == true)
            _context.PeriodosContables.RemoveRange(periodo.SubPeriodos);
        _context.PeriodosContables.Remove(periodo);

        _context.AuditoriasContables.Add(new AuditoriaContable
        {
            Fecha = DateTime.Now,
            Usuario = usuario,
            Accion = "Eliminación de periodo",
            Detalle = $"Se eliminó el periodo «{nombresPorId[periodo.Id]}» de la empresa {periodo.EmpresaId}" +
                (subperiodosEliminados > 0 ? $" junto con {subperiodosEliminados} subperiodo(s) vacío(s)." : ".")
        });
        await _context.SaveChangesAsync();

        // El nuevo periodo de apertura (si lo hay) es el de menor fecha entre
        // los que quedan: la regla derivada se re-ancora automáticamente.
        var nuevoApertura = await _context.PeriodosContables
            .AsNoTracking()
            .Where(p => p.EmpresaId == periodo.EmpresaId)
            .OrderBy(p => p.FechaInicio)
            .ThenBy(p => p.Id)
            .FirstOrDefaultAsync();

        return new EliminacionPeriodoResponse
        {
            PeriodoId = periodo.Id,
            Nombre = nombresPorId[periodo.Id],
            SubperiodosEliminados = subperiodosEliminados,
            NuevoPeriodoAperturaNombre = nuevoApertura?.Nombre ?? string.Empty,
            NuevoPeriodoAperturaFechaInicio = nuevoApertura?.FechaInicio
        };
    }

    /// <summary>
    /// Cierra un periodo y (opcionalmente) TRASLADA los saldos de las cuentas
    /// reales (activo, pasivo y patrimonio) al periodo siguiente mediante un
    /// asiento «APERTURA DE BALANCE» (TipoComprobante "Apertura" con prefijo de
    /// sistema). Reglas de seguridad financiera: orden cronológico (periodos
    /// anteriores cerrados), Cierre de Resultados previo obligatorio (ingresos
    /// y egresos en cero para que la ecuación contable cuadre), periodo
    /// siguiente abierto que reciba el traslado y reemplazo (nunca duplicado)
    /// de un traspaso previo en el destino. Los traspasos se excluyen de las
    /// sumatorias de saldo (modelo de exclusión simple).
    /// </summary>
    public async Task<CierrePeriodoResponse> CerrarPeriodoAsync(
        int periodoId,
        string usuario = "Sistema",
        bool trasladarSaldos = true,
        int usuarioId = 1)
    {
        await using var transaccion = _context.Database.IsRelational()
            ? await _context.Database.BeginTransactionAsync()
            : null;

        var periodo = await _context.PeriodosContables
            .Include(p => p.SubPeriodos)
            .FirstOrDefaultAsync(p => p.Id == periodoId)
            ?? throw new InvalidOperationException("El periodo contable no existe.");

        if (periodo.Cerrado || string.Equals(periodo.Estado, "Cerrado", StringComparison.OrdinalIgnoreCase))
            throw new InvalidOperationException($"El periodo «{periodo.Nombre}» ya está cerrado.");

        // 1) Orden cronológico: no se puede cerrar con periodos previos abiertos.
        var anterioresAbiertos = await _context.PeriodosContables.AnyAsync(p =>
            p.EmpresaId == periodo.EmpresaId
            && p.Id != periodo.Id
            && p.FechaFin.Date < periodo.FechaInicio.Date
            && !p.Cerrado
            && p.Estado != "Cerrado");

        if (anterioresAbiertos)
            throw new InvalidOperationException(
                "No se puede cerrar un periodo si existen periodos anteriores aún abiertos. Cierre primero en orden cronológico.");

        var respuesta = new CierrePeriodoResponse
        {
            PeriodoId = periodo.Id,
            Nombre = periodo.Nombre ?? string.Empty
        };

        if (trasladarSaldos)
        {
            // 2) Ingresos y egresos en cero: exige el Cierre de Resultados previo.
            await VerificarResultadosEnCeroAsync(periodo);

            // 3) Periodo siguiente que recibe el traslado: el de menor fecha
            //    (a igual fecha se prefiere el subperiodo mensual).
            var candidatos = await _context.PeriodosContables
                .AsNoTracking()
                .Where(p => p.EmpresaId == periodo.EmpresaId
                            && p.Id != periodo.Id
                            && p.FechaInicio.Date > periodo.FechaFin.Date)
                .ToListAsync();

            var destino = candidatos
                .OrderBy(p => p.FechaInicio)
                .ThenBy(p => string.Equals(p.TipoPeriodo, "Mensual", StringComparison.OrdinalIgnoreCase) ? 0 : 1)
                .ThenBy(p => p.Id)
                .FirstOrDefault();

            if (destino == null)
                throw new InvalidOperationException(
                    "No existe un periodo contable posterior al periodo a cerrar. Cree primero el periodo siguiente para recibir el traslado de saldos.");

            if (destino.Cerrado || string.Equals(destino.Estado, "Cerrado", StringComparison.OrdinalIgnoreCase))
                throw new InvalidOperationException(
                    $"El periodo siguiente «{destino.Nombre}» está cerrado: ábralo para recibir el traslado de saldos.");

            // 4) Saldos de las cuentas reales al cierre del periodo.
            var lineas = await CalcularLineasTrasladoAsync(periodo);

            if (lineas.Count > 0)
            {
                var totalDebe = lineas.Sum(l => l.Debe);
                var totalHaber = lineas.Sum(l => l.Haber);

                if (Math.Abs(totalDebe - totalHaber) > 0.01m)
                    throw new InvalidOperationException(
                        $"El traslado no cuadra (Debe {totalDebe:0.00} vs Haber {totalHaber:0.00}): " +
                        "verifique que el Cierre de Resultados del periodo esté generado y que los saldos de las cuentas reales sean consistentes.");

                // Sólo se reemplaza un traspaso del MISMO origen. Nunca se
                // elimina una apertura ajena ni se escoge arbitrariamente la
                // primera cuando el destino tiene más de un traslado.
                var trasladosDestino = await _context.AsientosContables
                    .Include(a => a.Detalles)
                    .Include(a => a.PeriodoOrigen)
                    .Where(a => a.PeriodoContableId == destino.Id
                        && a.EmpresaId == periodo.EmpresaId
                        && a.TipoComprobante == "Apertura"
                        && (a.OrigenGeneracion == OrigenGeneracionAsiento.TrasladoApertura
                            || a.Concepto.StartsWith(AsientoContableService.PrefijoAperturaBalance)))
                    .ToListAsync();

                var previos = trasladosDestino
                    .Where(a => EsTrasladoDelPeriodo(a, periodo))
                    .ToList();
                if (previos.Count > 1)
                    throw new InvalidOperationException(
                        $"El periodo «{destino.Nombre}» tiene traslados duplicados originados en «{periodo.Nombre}». " +
                        "Revise la conciliación antes de volver a cerrar.");

                var ajeno = trasladosDestino.FirstOrDefault(a => !EsTrasladoDelPeriodo(a, periodo));
                if (ajeno != null)
                    throw new InvalidOperationException(
                        $"El periodo «{destino.Nombre}» ya contiene el traslado {ajeno.NumeroComprobante} con otro origen. " +
                        "Revierta primero ese traslado desde el comprobante para no sustituir una apertura ajena.");

                var previo = previos.SingleOrDefault();
                if (previo != null)
                {
                    _context.AsientosDetalles.RemoveRange(previo.Detalles);
                    _context.AsientosContables.Remove(previo);
                    // Se guarda junto con la nueva apertura y el cierre dentro
                    // de la misma transacción; no se deja el destino sin saldo
                    // inicial si falla una operación posterior.
                }

                var concepto = $"{AsientoContableService.PrefijoAperturaBalance} {periodo.Nombre}: " +
                    $"traslado de saldos de activo, pasivo y patrimonio al periodo {destino.Nombre}";
                if (concepto.Length > 500) concepto = concepto[..500];

                // CrearAsientoAsync aplica todas las validaciones del alta
                // normal (partida doble, cuentas activas, rango del periodo
                // destino, comprobante consecutivo y auditoría).
                var apertura = await _asientos.CrearAsientoAsync(new AsientoContable
                {
                    EmpresaId = periodo.EmpresaId,
                    PeriodoContableId = destino.Id,
                    PeriodoOrigenId = periodo.Id,
                    OrigenGeneracion = OrigenGeneracionAsiento.TrasladoApertura,
                    NumeroComprobante = string.Empty,
                    FechaComprobante = destino.FechaInicio.Date,
                    Concepto = concepto,
                    TipoComprobante = "Apertura",
                    Estado = "Aprobado",
                    UsuarioId = usuarioId,
                    Detalles = lineas
                });

                respuesta.TrasladoGenerado = true;
                respuesta.NumeroComprobante = apertura.NumeroComprobante;
                respuesta.PeriodoDestinoNombre = destino.Nombre ?? string.Empty;
                respuesta.CuentasTrasladadas = lineas.Count;
                respuesta.TotalDebe = totalDebe;
                respuesta.TotalHaber = totalHaber;
            }
            else
            {
                respuesta.Mensaje = "No hay cuentas reales con saldo: no se generó asiento de apertura.";
            }
        }

        // 5) Cierre del periodo y sus subperiodos (cascada).
        periodo.Cerrado = true;
        periodo.Estado = "Cerrado";
        periodo.FechaCierre = DateTime.Now;
        periodo.UsuarioCierre = usuario;

        if (periodo.TipoPeriodo == "Anual" && periodo.SubPeriodos?.Any() == true)
        {
            foreach (var sub in periodo.SubPeriodos)
            {
                sub.Cerrado = true;
                sub.Estado = "Cerrado";
                sub.FechaCierre = DateTime.Now;
                sub.UsuarioCierre = usuario;
            }
        }

        await _context.SaveChangesAsync();

        // 6) Auditoría del cierre (y del traslado, si se generó).
        _context.AuditoriasContables.Add(new AuditoriaContable
        {
            Fecha = DateTime.Now,
            Usuario = usuario,
            Accion = "Cierre de periodo",
            Detalle = respuesta.TrasladoGenerado
                ? $"Se cerró el periodo «{periodo.Nombre}» y se trasladaron los saldos al periodo «{respuesta.PeriodoDestinoNombre}» con el comprobante {respuesta.NumeroComprobante} (Debe {respuesta.TotalDebe:0.00} / Haber {respuesta.TotalHaber:0.00})."
                : $"Se cerró el periodo «{periodo.Nombre}» sin traslado de saldos."
        });
        await _context.SaveChangesAsync();

        respuesta.Cerrado = true;
        if (string.IsNullOrEmpty(respuesta.Mensaje))
            respuesta.Mensaje = respuesta.TrasladoGenerado
                ? $"Periodo cerrado y saldos trasladados al periodo «{respuesta.PeriodoDestinoNombre}»."
                : "Periodo cerrado.";

        if (transaccion != null) await transaccion.CommitAsync();
        return respuesta;
    }

    /// <summary>
    /// Reabre un periodo. Se BLOQUEA cuando el sistema ya generó asientos de
    /// APERTURA DE BALANCE en periodos posteriores a partir del cierre de este
    /// periodo: reabrirlo invalidaría los traslados realizados (el saldo del
    /// periodo siguiente dejaría de corresponder al cierre registrado).
    /// </summary>
    public async Task<PeriodoContable> AbrirPeriodoAsync(int periodoId, string usuario = "Sistema")
    {
        var periodo = await _context.PeriodosContables.FirstOrDefaultAsync(p => p.Id == periodoId)
            ?? throw new InvalidOperationException("El periodo contable no existe.");

        var idsPosteriores = await _context.PeriodosContables
            .AsNoTracking()
            .Where(p => p.EmpresaId == periodo.EmpresaId && p.FechaFin.Date > periodo.FechaFin.Date)
            .Select(p => p.Id)
            .ToListAsync();

        var hayVinculado = idsPosteriores.Count > 0 && await _context.AsientosContables.AnyAsync(a =>
            idsPosteriores.Contains(a.PeriodoContableId)
            && a.PeriodoOrigenId == periodo.Id
            && a.OrigenGeneracion == OrigenGeneracionAsiento.TrasladoApertura);

        var hayLegado = false;
        if (!hayVinculado && idsPosteriores.Count > 0)
        {
            var legados = await _context.AsientosContables
                .AsNoTracking()
                .Where(a => idsPosteriores.Contains(a.PeriodoContableId)
                    && a.PeriodoOrigenId == null
                    && a.Concepto.StartsWith(AsientoContableService.PrefijoAperturaBalance))
                .ToListAsync();
            hayLegado = legados.Any(a => EsTrasladoDelPeriodo(a, periodo));
        }

        if (hayVinculado || hayLegado)
            throw new InvalidOperationException(
                "No se puede reabrir el periodo porque su cierre generó una apertura de balance posterior. " +
                "Use Recalcular o revierta ese traslado desde el comprobante para ejecutar ambas acciones de forma segura.");

        periodo.Cerrado = false;
        periodo.Estado = "Abierto";
        periodo.FechaCierre = null;
        periodo.UsuarioCierre = null;

        await _context.SaveChangesAsync();
        return periodo;
    }

    /// <summary>
    /// Revierte el traslado identificado por su comprobante y reabre el cierre
    /// que realmente lo generó. Es la acción usada desde el listado de asientos.
    /// </summary>
    public async Task<ReabrirParaCorreccionResponse> RevertirTrasladoAperturaAsync(
        int asientoId,
        string usuario = "Sistema")
    {
        var traslado = await _context.AsientosContables
            .AsNoTracking()
            .FirstOrDefaultAsync(a => a.Id == asientoId)
            ?? throw new InvalidOperationException("El asiento de apertura indicado no existe.");

        if (traslado.TipoComprobante != "Apertura"
            || (traslado.OrigenGeneracion != OrigenGeneracionAsiento.TrasladoApertura
                && !AsientoContableService.EsTraspasoApertura(traslado.Concepto)))
        {
            throw new InvalidOperationException(
                "Sólo se puede revertir una APERTURA DE BALANCE generada por un cierre. " +
                "Los asientos manuales y operativos no se eliminan mediante esta acción.");
        }

        var origen = await ResolverPeriodoOrigenTrasladoAsync(traslado)
            ?? throw new InvalidOperationException(
                $"No se pudo conciliar el periodo de origen del comprobante {traslado.NumeroComprobante}. " +
                "El asiento no fue eliminado. Revise su concepto y la auditoría del cierre antes de continuar.");

        return await ReabrirParaCorreccionAsync(origen.Id, usuario, asientoId);
    }

    /// <summary>
    /// Resuelve el origen nuevo por FK y el legado por el encabezado exacto del
    /// concepto o, como respaldo, por la auditoría que contiene el comprobante.
    /// Nunca devuelve un origen ambiguo.
    /// </summary>
    private async Task<PeriodoContable> ResolverPeriodoOrigenTrasladoAsync(AsientoContable traslado)
    {
        if (traslado.PeriodoOrigenId.HasValue)
        {
            return await _context.PeriodosContables
                .AsNoTracking()
                .FirstOrDefaultAsync(p => p.Id == traslado.PeriodoOrigenId.Value
                    && p.EmpresaId == traslado.EmpresaId);
        }

        var candidatos = await _context.PeriodosContables
            .AsNoTracking()
            .Where(p => p.EmpresaId == traslado.EmpresaId
                && p.Id != traslado.PeriodoContableId
                && p.FechaFin.Date < traslado.FechaComprobante.Date)
            .ToListAsync();

        var porConcepto = candidatos
            .Where(p => traslado.Concepto.StartsWith(
                $"{AsientoContableService.PrefijoAperturaBalance} {p.Nombre}:",
                StringComparison.Ordinal))
            .ToList();
        if (porConcepto.Count == 1) return porConcepto[0];

        var auditorias = await _context.AuditoriasContables
            .AsNoTracking()
            .Where(a => a.Accion == "Cierre de periodo"
                && a.Detalle.Contains(traslado.NumeroComprobante))
            .ToListAsync();

        var porAuditoria = candidatos
            .Where(p => auditorias.Any(a => a.Detalle.Contains($"Se cerró el periodo «{p.Nombre}»")))
            .GroupBy(p => p.Id)
            .Select(g => g.First())
            .ToList();
        return porAuditoria.Count == 1 ? porAuditoria[0] : null;
    }

    /// <summary>
    /// REAPERTURA PARA CORRECCIÓN (recalcular cierre): reabre un periodo
    /// CERRADO eliminando antes, y sólo si corresponde, el asiento «APERTURA
    /// DE BALANCE» que su cierre generó en el periodo siguiente, de modo que
    /// el usuario pueda corregir asientos y volver a ejecutar «Cerrar y
    /// Trasladar» (que regenera el Cierre de Resultados si hace falta y
    /// REEMPLAZA el nuevo saldo inicial del destino, sin duplicarlo).
    /// Reglas de seguridad financiera:
    /// 1) El periodo debe estar CERRADO (si no, no hay cierre que recalcular).
    /// 2) El periodo siguiente que recibió el traslado (misma selección que
    ///    CerrarPeriodoAsync) debe estar ABIERTO.
    /// 3) Ese destino y los periodos posteriores sólo pueden contener asientos
    ///    DEL SISTEMA («APERTURA DE BALANCE» o «CIERRE DE RESULTADOS»): si ya
    ///    hay actividad propia, la cadena de saldos quedaría inconsistente.
    /// 4) El traslado que se elimina debe referir ESTE periodo en su concepto
    ///    (nunca se borra un traslado ajeno).
    /// El periodo y sus subperiodos se reabren en cascada y todo queda
    /// registrado en auditoría.
    /// </summary>
    public async Task<ReabrirParaCorreccionResponse> ReabrirParaCorreccionAsync(
        int periodoId,
        string usuario = "Sistema",
        int? asientoTrasladoId = null)
    {
        await using var transaccion = _context.Database.IsRelational()
            ? await _context.Database.BeginTransactionAsync()
            : null;

        var periodo = await _context.PeriodosContables
            .Include(p => p.SubPeriodos)
            .FirstOrDefaultAsync(p => p.Id == periodoId)
            ?? throw new InvalidOperationException("El periodo contable no existe.");

        if (!periodo.Cerrado && !string.Equals(periodo.Estado, "Cerrado", StringComparison.OrdinalIgnoreCase))
            throw new InvalidOperationException(
                $"El periodo «{periodo.Nombre}» no está cerrado: no hay cierre que recalcular. " +
                "Corrija los asientos directamente y vuelva a ejecutar «Cerrar y Trasladar».");

        var respuesta = new ReabrirParaCorreccionResponse
        {
            PeriodoId = periodo.Id,
            EmpresaId = periodo.EmpresaId,
            Nombre = periodo.Nombre ?? string.Empty
        };

        AsientoContable traslado = null;
        if (asientoTrasladoId.HasValue)
        {
            traslado = await _context.AsientosContables
                .Include(a => a.Detalles)
                .Include(a => a.PeriodoOrigen)
                .FirstOrDefaultAsync(a => a.Id == asientoTrasladoId.Value
                    && a.EmpresaId == periodo.EmpresaId)
                ?? throw new InvalidOperationException("El traslado de apertura indicado no existe.");

            var origenReal = await ResolverPeriodoOrigenTrasladoAsync(traslado);
            if (origenReal == null || origenReal.Id != periodo.Id
                || !EsTrasladoDelPeriodo(traslado, periodo))
            {
                var nombreReal = origenReal?.Nombre ?? "un origen no conciliado";
                throw new InvalidOperationException(
                    $"El comprobante {traslado.NumeroComprobante} pertenece a «{nombreReal}», " +
                    $"no al cierre de «{periodo.Nombre}». No se eliminó ningún asiento.");
            }
        }
        else
        {
            // La relación persistida manda sobre cualquier cambio posterior en
            // el calendario: el destino real no se vuelve a adivinar.
            var vinculados = await _context.AsientosContables
                .Include(a => a.Detalles)
                .Include(a => a.PeriodoOrigen)
                .Where(a => a.EmpresaId == periodo.EmpresaId
                    && a.PeriodoOrigenId == periodo.Id
                    && a.OrigenGeneracion == OrigenGeneracionAsiento.TrasladoApertura)
                .ToListAsync();
            if (vinculados.Count > 1)
                throw new InvalidOperationException(
                    $"El periodo «{periodo.Nombre}» tiene varios traslados vinculados. " +
                    "Revierta el comprobante concreto que desea corregir.");
            traslado = vinculados.SingleOrDefault();
        }

        // 1) Periodo siguiente que recibió el traslado (mismo criterio de
        //    selección que CerrarPeriodoAsync: menor fecha, mensual en empate).
        var candidatos = await _context.PeriodosContables
            .AsNoTracking()
            .Where(p => p.EmpresaId == periodo.EmpresaId
                        && p.Id != periodo.Id
                        && p.FechaInicio.Date > periodo.FechaFin.Date)
            .ToListAsync();

        var destino = traslado != null
            ? await _context.PeriodosContables
                .AsNoTracking()
                .FirstOrDefaultAsync(p => p.Id == traslado.PeriodoContableId)
            : candidatos
                .OrderBy(p => p.FechaInicio)
                .ThenBy(p => string.Equals(p.TipoPeriodo, "Mensual", StringComparison.OrdinalIgnoreCase) ? 0 : 1)
                .ThenBy(p => p.Id)
                .FirstOrDefault();

        if (destino != null)
        {
            if (destino.Cerrado || string.Equals(destino.Estado, "Cerrado", StringComparison.OrdinalIgnoreCase))
                throw new InvalidOperationException(
                    $"El periodo destino «{destino.Nombre}» está cerrado: ábralo (y rehaga su propio cierre) " +
                    $"antes de recalcular el cierre de «{periodo.Nombre}».");

            // 2) El destino y los posteriores sólo pueden tener asientos del
            //    sistema: cualquier movimiento propio invalida la cadena de
            //    saldos acumulados que depende del cierre que se va a rehacer.
            var idsPosteriores = candidatos.Select(p => p.Id).ToList();
            if (!idsPosteriores.Contains(destino.Id)) idsPosteriores.Add(destino.Id);
            var movimientosPropios = await _context.AsientosContables
                .AsNoTracking()
                .Where(a => a.EmpresaId == periodo.EmpresaId
                    && idsPosteriores.Contains(a.PeriodoContableId)
                    && !a.Concepto.StartsWith(AsientoContableService.PrefijoAperturaBalance)
                    && !a.Concepto.StartsWith(AsientoContableService.PrefijoCierreResultados))
                .CountAsync();

            if (movimientosPropios > 0)
                throw new InvalidOperationException(
                    $"No se puede recalcular el cierre de «{periodo.Nombre}»: el periodo «{destino.Nombre}» " +
                    $"(u otros periodos posteriores) ya tiene {movimientosPropios} asiento(s) con actividad propia. " +
                    "Recalcular dejaría el saldo inicial del periodo siguiente inconsistente con esos movimientos. " +
                    "Anule o elimine primero esos asientos (o rehaga el cierre del periodo siguiente) y vuelva a intentar.");

            // 3) Resolver el traslado exacto. Si se llegó desde un periodo que
            //    no es su origen, se informa cuál debe recalcularse en vez de
            //    emitir un bloqueo genérico o borrar una apertura ajena.
            if (traslado == null)
            {
                var trasladosDestino = await _context.AsientosContables
                    .Include(a => a.Detalles)
                    .Include(a => a.PeriodoOrigen)
                    .Where(a => a.PeriodoContableId == destino.Id
                        && a.EmpresaId == periodo.EmpresaId
                        && a.TipoComprobante == "Apertura"
                        && (a.OrigenGeneracion == OrigenGeneracionAsiento.TrasladoApertura
                            || a.Concepto.StartsWith(AsientoContableService.PrefijoAperturaBalance)))
                    .ToListAsync();

                var propios = trasladosDestino.Where(a => EsTrasladoDelPeriodo(a, periodo)).ToList();
                if (propios.Count > 1)
                    throw new InvalidOperationException(
                        $"Existen varios traslados de «{periodo.Nombre}» hacia «{destino.Nombre}». " +
                        "Concilie los duplicados antes de reabrir el periodo.");

                traslado = propios.SingleOrDefault();
                if (traslado == null && trasladosDestino.Count > 0)
                {
                    var otro = trasladosDestino[0];
                    var origenReal = await ResolverPeriodoOrigenTrasladoAsync(otro);
                    if (origenReal != null)
                        throw new InvalidOperationException(
                            $"El comprobante {otro.NumeroComprobante} de «{destino.Nombre}» fue generado por " +
                            $"«{origenReal.Nombre}», no por «{periodo.Nombre}». Use Recalcular en «{origenReal.Nombre}» " +
                            "o revierta el traslado directamente desde ese comprobante.");

                    throw new InvalidOperationException(
                        $"El asiento «{otro.NumeroComprobante}» de «{destino.Nombre}» es un traslado de apertura " +
                        $"que no referencia al periodo «{periodo.Nombre}»: no se puede eliminar. Verifique el origen del traslado.");
                }
            }

            if (traslado != null)
            {
                _context.AsientosDetalles.RemoveRange(traslado.Detalles);
                _context.AsientosContables.Remove(traslado);
                respuesta.TrasladoEliminado = true;
                respuesta.NumeroComprobanteTraslado = traslado.NumeroComprobante;
                respuesta.PeriodoDestinoId = destino.Id;
                respuesta.PeriodoDestinoNombre = destino.Nombre ?? string.Empty;
            }
        }

        // 4) Reapertura en cascada: el periodo y sus subperiodos (simétrico al
        //    cierre anual, que los cerró en cascada).
        periodo.Cerrado = false;
        periodo.Estado = "Abierto";
        periodo.FechaCierre = null;
        periodo.UsuarioCierre = null;

        if (periodo.SubPeriodos?.Any() == true)
        {
            foreach (var sub in periodo.SubPeriodos)
            {
                if (sub.Cerrado || string.Equals(sub.Estado, "Cerrado", StringComparison.OrdinalIgnoreCase))
                {
                    sub.Cerrado = false;
                    sub.Estado = "Abierto";
                    sub.FechaCierre = null;
                    sub.UsuarioCierre = null;
                    respuesta.SubperiodosReabiertos++;
                }
            }
        }

        // 5) Auditoría de la reapertura para corrección.
        _context.AuditoriasContables.Add(new AuditoriaContable
        {
            Fecha = DateTime.Now,
            Usuario = usuario,
            Accion = "Reapertura para corrección",
            Detalle = respuesta.TrasladoEliminado
                ? $"Se reabrió el periodo «{periodo.Nombre}» para corrección y se eliminó el traslado {respuesta.NumeroComprobanteTraslado} del periodo «{respuesta.PeriodoDestinoNombre}»."
                : $"Se reabrió el periodo «{periodo.Nombre}» para corrección (sin traslado que eliminar)."
        });
        await _context.SaveChangesAsync();

        respuesta.Mensaje = respuesta.TrasladoEliminado
            ? $"Periodo «{periodo.Nombre}» reabierto; traslado {respuesta.NumeroComprobanteTraslado} eliminado de «{respuesta.PeriodoDestinoNombre}». Corrija los asientos y vuelva a cerrar y trasladar."
            : $"Periodo «{periodo.Nombre}» reabierto para corrección. Corrija los asientos y vuelva a cerrar y trasladar.";

        if (transaccion != null) await transaccion.CommitAsync();
        return respuesta;
    }

    private static bool EsTrasladoDelPeriodo(AsientoContable traslado, PeriodoContable periodo)
    {
        if (traslado.PeriodoOrigenId.HasValue)
            return traslado.PeriodoOrigenId.Value == periodo.Id;

        // Compatibilidad estricta para los conceptos generados antes de existir
        // PeriodoOrigenId. No basta con Contains: debe coincidir el encabezado.
        var encabezado = $"{AsientoContableService.PrefijoAperturaBalance} {periodo.Nombre}:";
        return traslado.Concepto.StartsWith(encabezado, StringComparison.Ordinal);
    }

    /// <summary>
    /// Exige que las cuentas de ingresos y egresos de la empresa estén en cero
    /// al cierre del periodo (es decir, que el Cierre de Resultados ya se haya
    /// generado): sólo entonces ACTIVO = PASIVO + PATRIMONIO y el asiento de
    /// apertura de balance cuadra por partida doble.
    /// </summary>
    private async Task VerificarResultadosEnCeroAsync(PeriodoContable periodo)
    {
        var empresaId = periodo.EmpresaId;
        var fechaFinExclusiva = periodo.FechaFin.Date.AddDays(1);

        var cuentasResultado = await _context.CuentasContables
            .AsNoTracking()
            .Where(c => c.EmpresaId == empresaId
                && (c.TipoCuenta.ToUpper().Contains("INGRESO")
                    || c.TipoCuenta.ToUpper().Contains("GASTO")
                    || c.TipoCuenta.ToUpper().Contains("COSTO")
                    || c.TipoCuenta.ToUpper().Contains("EGRESO")))
            .ToListAsync();

        if (cuentasResultado.Count == 0) return;

        var ids = cuentasResultado.Select(c => c.Id).ToList();
        var acumulado = await _context.AsientosDetalles
            .AsNoTracking()
            .Where(d => d.AsientoContable!.EmpresaId == empresaId
                        && d.AsientoContable.FechaComprobante < fechaFinExclusiva
                        && ids.Contains(d.CuentaContableId))
            .GroupBy(d => d.CuentaContableId)
            .Select(g => new { CuentaId = g.Key, Debe = g.Sum(x => x.Debe), Haber = g.Sum(x => x.Haber) })
            .ToListAsync();
        var porCuenta = acumulado.ToDictionary(x => x.CuentaId, x => x);

        foreach (var cuenta in cuentasResultado)
        {
            // Sin movimientos la clave no existe: el valor (tipo anónimo) es null.
            porCuenta.TryGetValue(cuenta.Id, out var mov);
            var debe = mov?.Debe ?? 0m;
            var haber = mov?.Haber ?? 0m;
            var esDeudora = AsientoContableService.EsDeudoraPorTipo(cuenta);
            var saldo = esDeudora ? debe - haber : haber - debe;
            if (Math.Abs(saldo) > 0.01m)
                throw new InvalidOperationException(
                    $"La cuenta de resultado {cuenta.CodigoCuenta} - {cuenta.NombreCuenta} aún tiene saldo {saldo:0.00}. " +
                    "Genere primero el Cierre de Resultados del periodo antes de cerrarlo y trasladar los saldos.");
        }
    }

    /// <summary>
    /// Líneas del asiento de apertura de balance: cada cuenta real (activo,
    /// pasivo y patrimonio) con saldo distinto de cero al cierre del periodo,
    /// con el signo natural (deudora → Debe, acreedora → Haber; un saldo
    /// anómalo se invierte de lado). Excluye los traspasos previos del sistema
    /// para no acumular sobre un traslado ya realizado.
    /// </summary>
    private async Task<List<AsientoDetalle>> CalcularLineasTrasladoAsync(PeriodoContable periodo)
    {
        var empresaId = periodo.EmpresaId;
        var fechaFinExclusiva = periodo.FechaFin.Date.AddDays(1);

        var cuentasReales = await _context.CuentasContables
            .AsNoTracking()
            .Where(c => c.EmpresaId == empresaId
                && (c.TipoCuenta.ToUpper().Contains("ACTIVO")
                    || c.TipoCuenta.ToUpper().Contains("PASIVO")
                    || c.TipoCuenta.ToUpper().Contains("PATRIMONIO")
                    || c.TipoCuenta.ToUpper().Contains("CAPITAL")))
            .OrderBy(c => c.CodigoCuenta)
            .ToListAsync();

        var movimientos = new Dictionary<int, (decimal Debe, decimal Haber)>();
        var ids = cuentasReales.Select(c => c.Id).ToList();
        if (ids.Count > 0)
        {
            var acumulado = await _context.AsientosDetalles
                .AsNoTracking()
                .Where(d => d.AsientoContable!.EmpresaId == empresaId
                            && d.AsientoContable.FechaComprobante < fechaFinExclusiva
                            && !d.AsientoContable.Concepto.StartsWith(AsientoContableService.PrefijoAperturaBalance)
                            && ids.Contains(d.CuentaContableId))
                .GroupBy(d => d.CuentaContableId)
                .Select(g => new { CuentaId = g.Key, Debe = g.Sum(x => x.Debe), Haber = g.Sum(x => x.Haber) })
                .ToListAsync();

            foreach (var x in acumulado) movimientos[x.CuentaId] = (x.Debe, x.Haber);
        }

        var lineas = new List<AsientoDetalle>();
        foreach (var cuenta in cuentasReales)
        {
            movimientos.TryGetValue(cuenta.Id, out var mov);
            var esDeudora = AsientoContableService.EsDeudoraPorTipo(cuenta);
            var saldo = esDeudora ? mov.Debe - mov.Haber : mov.Haber - mov.Debe;
            if (Math.Abs(saldo) <= 0.01m) continue;

            lineas.Add(new AsientoDetalle
            {
                CuentaContableId = cuenta.Id,
                Debe = esDeudora ? Math.Max(saldo, 0m) : Math.Max(-saldo, 0m),
                Haber = esDeudora ? Math.Max(-saldo, 0m) : Math.Max(saldo, 0m)
            });
        }
        return lineas;
    }
}

/// <summary>
/// Respuesta del cierre de periodo: estado del cierre y detalle del asiento de
/// apertura de balance generado (traslado de saldos al periodo siguiente).
/// </summary>
public class CierrePeriodoResponse
{
    public int PeriodoId { get; set; }
    public string Nombre { get; set; } = string.Empty;
    public bool Cerrado { get; set; }
    /// <summary>TRUE cuando se generó el asiento de apertura de balance.</summary>
    public bool TrasladoGenerado { get; set; }
    public string NumeroComprobante { get; set; } = string.Empty;
    public string PeriodoDestinoNombre { get; set; } = string.Empty;
    public int CuentasTrasladadas { get; set; }
    public decimal TotalDebe { get; set; }
    public decimal TotalHaber { get; set; }
    public string Mensaje { get; set; } = string.Empty;
}

/// <summary>
/// Respuesta de la eliminación de un periodo vacío: informa qué se eliminó y
/// cuál es el NUEVO periodo de apertura de la empresa (regla derivada: el de
/// menor fecha entre los que quedan), o vacío si la empresa queda sin periodos.
/// </summary>
public class EliminacionPeriodoResponse
{
    public int PeriodoId { get; set; }
    public string Nombre { get; set; } = string.Empty;
    /// <summary>Cantidad de subperiodos mensuales eliminados en cascada.</summary>
    public int SubperiodosEliminados { get; set; }
    /// <summary>Nombre del nuevo periodo de apertura (vacío si no quedan periodos).</summary>
    public string NuevoPeriodoAperturaNombre { get; set; } = string.Empty;
    public DateTime? NuevoPeriodoAperturaFechaInicio { get; set; }
}

/// <summary>
/// Respuesta de la reapertura para corrección (recalcular cierre): informa si
/// se eliminó el asiento «APERTURA DE BALANCE» del periodo destino y cuántos
/// subperiodos se reabrieron en cascada.
/// </summary>
public class ReabrirParaCorreccionResponse
{
    public int PeriodoId { get; set; }
    public int EmpresaId { get; set; }
    public string Nombre { get; set; } = string.Empty;
    /// <summary>TRUE cuando se eliminó el traslado de apertura del destino.</summary>
    public bool TrasladoEliminado { get; set; }
    /// <summary>Comprobante del asiento «APERTURA DE BALANCE» eliminado.</summary>
    public string NumeroComprobanteTraslado { get; set; } = string.Empty;
    /// <summary>Id del periodo que recibía el traslado.</summary>
    public int PeriodoDestinoId { get; set; }
    /// <summary>Nombre del periodo que recibía el traslado.</summary>
    public string PeriodoDestinoNombre { get; set; } = string.Empty;
    /// <summary>Cantidad de subperiodos reabiertos en cascada.</summary>
    public int SubperiodosReabiertos { get; set; }
    public string Mensaje { get; set; } = string.Empty;
}
