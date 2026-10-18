// ---------------------------------------------------------------------------
// HELPERS DEL PERIODO CONTABLE POR REGISTRO (regla «fecha ∈ periodo»)
// El periodo al que afecta un documento fiscal lo define su FECHA: el
// formulario muestra el periodo elegido, acota la fecha a su rango y exige que
// la fecha caiga dentro del periodo ABIERTO seleccionado. El default es el
// periodo que contiene la fecha del computador (o el primer periodo abierto
// si hoy no cae en ninguno). Funciones puras: sin estado de React.
// ---------------------------------------------------------------------------

// Fecha del computador en formato 'YYYY-MM-DD' (mismo formato que los inputs date).
export const fechaHoy = () => new Date().toISOString().slice(0, 10);

// 'YYYY-MM-DD' a partir de fechas ISO con/sin hora ('2026-10-07T12:00:00').
export const diaIso = (fecha) => (fecha ? String(fecha).slice(0, 10) : '');

// Etiqueta corta de un periodo: nombre · rango · estado.
export const etiquetaPeriodo = (p) => {
  if (!p) return '—';
  const nombre = p.nombre || (p.mes ? `Periodo ${p.mes}/${p.anio}` : `Ejercicio ${p.anio}`);
  const rango = `${diaIso(p.fechaInicio)} al ${diaIso(p.fechaFin)}`;
  const estado = (p.estado || (p.cerrado ? 'Cerrado' : 'Abierto')).toUpperCase();
  return `${nombre} · ${rango} · ${estado}`;
};

export const esPeriodoCerrado = (p) => Boolean(!p || p.cerrado || String(p.estado || '').toLowerCase() === 'cerrado');

// ¿El periodo contiene el día de la fecha? (comparación por día, ignora hora)
export const periodoContieneFecha = (p, fecha) => {
  if (!p || !fecha) return false;
  const dia = diaIso(fecha);
  return diaIso(p.fechaInicio) <= dia && dia <= diaIso(p.fechaFin);
};

// Periodo que contiene la fecha. A igual fecha (ejercicio anual + subperiodos
// mensuales) se prefiere el SUBPERIODO MENSUAL — el mismo criterio de
// desempate que usa el backend (ValidacionPeriodoFiscal y el cierre de
// periodo) — y en empate total el de menor id.
export const periodoPorFecha = (periodos, fecha) => {
  const candidatos = (periodos || []).filter((p) => periodoContieneFecha(p, fecha));
  if (candidatos.length === 0) return null;
  const mensual = candidatos
    .filter((p) => String(p.tipoPeriodo || (p.mes ? 'Mensual' : 'Anual')).toLowerCase() === 'mensual')
    .sort((a, b) => Number(a.id) - Number(b.id));
  return mensual[0] || candidatos.sort((a, b) => Number(a.id) - Number(b.id))[0];
};

// Periodo por defecto de un formulario: el que contiene la FECHA DEL
// COMPUTADOR; si hoy no cae en ningún periodo, el primer periodo ABIERTO de
// la empresa; si no hay ninguno, null (el formulario bloquea el guardado).
export const periodoDefecto = (periodos) => {
  const porFecha = periodoPorFecha(periodos, fechaHoy());
  if (porFecha) return porFecha;
  const abiertos = (periodos || []).filter((p) => !esPeriodoCerrado(p));
  if (abiertos.length === 0) return null;
  return abiertos.sort((a, b) => diaIso(a.fechaInicio).localeCompare(diaIso(b.fechaInicio)))[0];
};

// Ajusta la fecha al rango del periodo: si cae dentro se conserva; si es
// anterior se usa el primer día del periodo; si es posterior el último.
export const fechaAjustadaAlPeriodo = (periodo, fecha) => {
  if (!periodo) return fecha;
  if (periodoContieneFecha(periodo, fecha)) return diaIso(fecha);
  const dia = diaIso(fecha);
  return dia < diaIso(periodo.fechaInicio) ? diaIso(periodo.fechaInicio) : diaIso(periodo.fechaFin);
};

// Validación previa al guardado. Devuelve el mensaje de error o null si todo
// está bien. Comprueba: periodo elegido, periodo abierto, fecha dentro del
// rango y empresa coherente con el periodo.
export const validarFechaPeriodo = ({ periodo, fecha, empresaId, periodoEmpresaId }) => {
  if (!periodo) return 'Seleccione el periodo contable al que afecta este documento.';
  if (esPeriodoCerrado(periodo)) {
    return `El periodo «${periodo.nombre || etiquetaPeriodo(periodo)}» está CERRADO. Elija un periodo ABIERTO (o ábralo en Configuración).`;
  }
  if (!fecha) return 'Indique la fecha del documento.';
  if (!periodoContieneFecha(periodo, fecha)) {
    return `La fecha ${diaIso(fecha)} no está dentro del periodo «${periodo.nombre || etiquetaPeriodo(periodo)}» (${diaIso(periodo.fechaInicio)} al ${diaIso(periodo.fechaFin)}). Ajuste la fecha o el periodo.`;
  }
  if (periodoEmpresaId && empresaId && Number(periodoEmpresaId) !== Number(empresaId)) {
    return 'El periodo elegido pertenece a otra empresa. Seleccione un periodo de la empresa activa.';
  }
  return null;
};

// Aviso (no bloqueante) cuando el documento afecta a un periodo distinto del
// periodo ACTIVO del contexto global: el libro/reporte consultado no mostrará
// el documento hasta que el usuario cambie el contexto al periodo del doc.
export const avisoPeriodoDistinto = (periodoDoc, periodoActivo) => {
  if (!periodoDoc || !periodoActivo) return null;
  if (Number(periodoDoc.id) === Number(periodoActivo.id)) return null;
  return `Este documento afecta al periodo «${periodoDoc.nombre || etiquetaPeriodo(periodoDoc)}»; no aparecerá en el libro/reporte del periodo activo («${periodoActivo.nombre || '—'}») hasta que cambie el contexto del periodo.`;
};
