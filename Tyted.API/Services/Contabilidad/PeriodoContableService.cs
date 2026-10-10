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

                // Reemplaza un traspaso previo del sistema en el destino.
                var previo = await _context.AsientosContables
                    .Include(a => a.Detalles)
                    .FirstOrDefaultAsync(a => a.PeriodoContableId == destino.Id
                        && a.EmpresaId == periodo.EmpresaId
                        && a.TipoComprobante == "Apertura"
                        && a.Concepto.StartsWith(AsientoContableService.PrefijoAperturaBalance));

                if (previo != null)
                {
                    _context.AsientosDetalles.RemoveRange(previo.Detalles);
                    _context.AsientosContables.Remove(previo);
                    await _context.SaveChangesAsync();
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

        var hayTraspasoPosterior = idsPosteriores.Count > 0 && await _context.AsientosContables.AnyAsync(a =>
            idsPosteriores.Contains(a.PeriodoContableId)
            && a.Concepto.StartsWith(AsientoContableService.PrefijoAperturaBalance));

        if (hayTraspasoPosterior)
            throw new InvalidOperationException(
                "No se puede reabrir el periodo: el sistema ya generó asientos de apertura de balance en periodos posteriores a partir de su cierre. Corrija o reemplace esos traslados antes de reabrir.");

        periodo.Cerrado = false;
        periodo.Estado = "Abierto";
        periodo.FechaCierre = null;
        periodo.UsuarioCierre = null;

        await _context.SaveChangesAsync();
        return periodo;
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
