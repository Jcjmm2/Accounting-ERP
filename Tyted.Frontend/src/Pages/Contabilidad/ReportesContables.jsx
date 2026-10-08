import { useEffect, useMemo, useState } from 'react';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import { contabilidadApi } from '../../Services/Contabilidad/ContabilidadApi';

// Opciones adaptadas a los formatos formales solicitados
const REPORT_OPTIONS = [
  { id: 'balance-comprobacion', label: 'Balance de Comprobación', icon: '📑' },
  { id: 'estado-resultados', label: 'Estado de Resultado', icon: '📈' },
  { id: 'situacion-financiera', label: 'Situación Financiera', icon: '⚖️' },
  { id: 'resumen-diario', label: 'Resumen de Diario', icon: '📓' },
];

const moneyFormatter = new Intl.NumberFormat('es-VE', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const field = (obj, ...keys) => {
  for (const key of keys) {
    if (obj && obj[key] !== undefined && obj[key] !== null) {
      return obj[key];
    }
  }
  return undefined;
};

const formatMoney = (value) => moneyFormatter.format(Number(value ?? 0));

const formatearFecha = (fechaStr) => {
  if (!fechaStr || fechaStr === '---') return '---';
  try {
    // Si la fecha viene en formato "YYYY-MM-DD" o "YYYY/MM/DD"
    const partes = fechaStr.split(/[-/T]/);
    if (partes.length >= 3) {
      const [anio, mes, dia] = partes;
      return `${dia}/${mes}/${anio}`;
    }
    const d = new Date(fechaStr);
    return isNaN(d.getTime()) ? fechaStr : d.toLocaleDateString('es-VE');
  } catch {
    return fechaStr;
  }
};

// ---------------------------------------------------------------------------
// JERARQUÍA PADRE / HIJO DEL PLAN DE CUENTAS (para subtotalizar reportes)
// ---------------------------------------------------------------------------

// Sangría visual con espacios no separables (se conserva en HTML, PDF y Excel)
const sangria = (profundidad) => '\u00A0'.repeat(profundidad * 3);

// Construye el árbol padre/hijo de una lista de cuentas ya enriquecidas.
// Usa PadreCuentaId cuando existe y, si no, infiere el padre por prefijo de
// código (ej.: "1.1.01" bajo "1.1", o "1101" bajo "110").
const construirArbol = (lista) => {
  const ordenadas = [...lista].sort((a, b) =>
    String(a.codigo ?? '').localeCompare(String(b.codigo ?? ''), undefined, { numeric: true })
  );

  const porId = new Map();
  const porCodigo = new Map();
  ordenadas.forEach(c => {
    porId.set(Number(c.idCuenta), c);
    if (c.codigo) porCodigo.set(String(c.codigo), c);
  });

  const inferirPadreId = (c) => {
    const codigo = String(c.codigo ?? '');
    if (!codigo) return null;
    let mejorCodigo = null;
    for (const candidato of porCodigo.keys()) {
      if (candidato === codigo || codigo.length <= candidato.length) continue;
      if (!codigo.startsWith(candidato)) continue;
      // En esquemas con punto, el hijo debe separarse del padre por "." ("1.10"
      // no es hijo de "1.1"). En esquemas de dígitos puros gana el prefijo más largo.
      if (codigo.includes('.') && codigo[candidato.length] !== '.') continue;
      if (mejorCodigo === null || candidato.length > mejorCodigo.length) mejorCodigo = candidato;
    }
    return mejorCodigo !== null ? Number(porCodigo.get(mejorCodigo).idCuenta) : null;
  };

  const hijosMap = new Map();
  const raices = [];
  ordenadas.forEach(c => {
    const propioId = Number(c.idCuenta);
    const explicito = c.padreCuentaId !== null && c.padreCuentaId !== undefined ? Number(c.padreCuentaId) : null;
    let padreId = null;
    if (explicito !== null && explicito !== propioId && porId.has(explicito)) {
      padreId = explicito;
    } else {
      padreId = inferirPadreId(c);
    }
    if (padreId !== null && padreId !== propioId && porId.has(padreId)) {
      if (!hijosMap.has(padreId)) hijosMap.set(padreId, []);
      hijosMap.get(padreId).push(c);
    } else {
      raices.push(c);
    }
  });

  return { raices, hijosMap };
};

// Suma un campo de la cuenta y de todos sus descendientes (evita ciclos).
const sumarSubarbol = (cuenta, hijosMap, selector) => {
  const visitados = new Set();
  const recorrer = (c) => {
    const id = Number(c.idCuenta);
    if (visitados.has(id)) return 0;
    visitados.add(id);
    let total = Number(selector(c) ?? 0);
    (hijosMap.get(id) || []).forEach(hijo => { total += recorrer(hijo); });
    return total;
  };
  return recorrer(cuenta);
};

// Aplana el árbol en filas con profundidad para poder dibujar sangrías y
// subtotales. `obtenerValores` recibe (cuenta, esPadre, hijosMap) y debe
// devolver los montos a mostrar (consolidados para los padres).
const filasJerarquicas = (lista, obtenerValores) => {
  const { raices, hijosMap } = construirArbol(lista);
  const filas = [];
  const emitir = (cuenta, profundidad) => {
    const hijos = hijosMap.get(Number(cuenta.idCuenta)) || [];
    const esPadre = hijos.length > 0;
    filas.push({ cuenta, profundidad, esPadre, valores: obtenerValores(cuenta, esPadre, hijosMap) });
    hijos.forEach(hijo => emitir(hijo, profundidad + 1));
  };
  raices.forEach(raiz => emitir(raiz, 0));
  return filas;
};

// Inserta tras cada subárbol jerárquico una fila SUBTOTAL de cierre para los
// padres de profundidad ≥ 1 (p. ej. 1.1 CORRIENTE, 1.1.1 CAJA, 1.1.1.1
// Cajas de operación). Los padres de profundidad 0 los cubre el SUBTOTAL
// del título de sección. Recibe la salida en pre-orden de filasJerarquicas.
const insertarSubtotalesJerarquia = (filas) => {
  const salida = [];
  const recorrer = (desde, nivel) => {
    let i = desde;
    while (i < filas.length && filas[i].profundidad >= nivel) {
      const fila = filas[i];
      salida.push(fila);
      i += 1;
      if (fila.esPadre) {
        i = recorrer(i, fila.profundidad + 1);
        if (fila.profundidad > 0) {
          salida.push({ ...fila, esSubtotalCierre: true });
        }
      }
    }
    return i;
  };
  recorrer(0, 0);
  return salida;
};

export default function ReportesContables({ empresaActiva, periodoActivo }) {
  const [balance, setBalance] = useState([]);
  const [cuentas, setCuentas] = useState([]);
  const [selectedReporte, setSelectedReporte] = useState(null);
  const [loading, setLoading] = useState(false);

  // Periodo por el cual se CONSULTARON los datos (el usuario lo solicita con el botón)
  const [periodoConsultadoId, setPeriodoConsultadoId] = useState(null);

  // Jerarquía de periodos
  const [periodos, setPeriodos] = useState([]);
  const [periodoSeleccionadoId, setPeriodoSeleccionadoId] = useState(Number(periodoActivo?.id ?? 1));

  useEffect(() => {
    setPeriodoSeleccionadoId(Number(periodoActivo?.id ?? 1));
  }, [periodoActivo?.id]);

  useEffect(() => {
    const cargarPeriodos = async () => {
      try {
        const data = await contabilidadApi.getPeriodos();
        setPeriodos(Array.isArray(data) ? data : (data?.$values || []));
      } catch (error) {
        console.error('Error cargando periodos:', error);
      }
    };
    cargarPeriodos();
  }, []);

  // Aplanar la jerarquía Padre/Hijo para el selector
  const listaPeriodosJerarquia = useMemo(() => {
    const lista = [];
    periodos.forEach(p => {
      lista.push({ ...p, isPadre: true, label: `📁 [AÑO] ${p.nombre || p.anio}` });
      const subs = p.subPeriodos?.$values || p.subPeriodos || [];
      subs.forEach(sub => {
        lista.push({ ...sub, isPadre: false, label: `   └ 📄 ${sub.nombre || sub.mes}` });
      });
    });
    return lista;
  }, [periodos]);

  const periodoSeleccionadoData = useMemo(() => {
    return listaPeriodosJerarquia.find(p => Number(p.id) === periodoSeleccionadoId) || periodoActivo;
  }, [listaPeriodosJerarquia, periodoSeleccionadoId, periodoActivo]);

  // Periodo efectivamente consultado (el que originó los datos en pantalla)
  const periodoConsultadoData = useMemo(() => {
    if (periodoConsultadoId === null) return null;
    return listaPeriodosJerarquia.find(p => Number(p.id) === Number(periodoConsultadoId)) || periodoActivo;
  }, [listaPeriodosJerarquia, periodoConsultadoId, periodoActivo]);

  // TRUE cuando el periodo elegido en el selector difiere del consultado:
  // en ese caso los datos en pantalla están desactualizados y hay que volver
  // a pulsar "🔍 Consultar" para regenerar el reporte de ese periodo.
  const pendienteConsulta = periodoConsultadoId === null ||
    Number(periodoSeleccionadoId) !== Number(periodoConsultadoId);

  // Carga de datos contables bajo demanda: el usuario decide cuándo consultar
  // el reporte del periodo seleccionado mediante el botón "🔍 Consultar".
  const consultar = async (periodoId) => {
    const id = Number(periodoId);
    if (!id) return;
    try {
      setLoading(true);
      const [dataBalance, dataCuentas] = await Promise.all([
        contabilidadApi.getBalanceComprobacion(id).catch(() => []),
        contabilidadApi.getCuentas().catch(() => []),
      ]);
      setBalance(Array.isArray(dataBalance) ? dataBalance : (dataBalance?.$values || []));
      setCuentas(Array.isArray(dataCuentas) ? dataCuentas : (dataCuentas?.$values || []));
      setPeriodoConsultadoId(id);
    } catch (error) {
      console.error('Error cargando reportes:', error);
    } finally {
      setLoading(false);
    }
  };

  // Consulta inicial con el periodo activo al montar el componente;
  // a partir de ahí, cada nueva consulta se dispara con el botón.
  useEffect(() => {
    consultar(Number(periodoActivo?.id ?? 1));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Mapeo unificado para agrupar cuentas (Activo, Pasivo, Capital, Ingreso, Egreso)
  const cuentaMap = useMemo(() => {
    const map = new Map();
    cuentas.forEach((cuenta) => {
      const id = field(cuenta, 'id', 'Id', 'cuentaId', 'CuentaId');
      if (id !== undefined) map.set(Number(id), cuenta);
    });
    return map;
  }, [cuentas]);

  const cuentasEnriquecidas = useMemo(() => {
    return balance.map(b => {
      const cuenta = cuentaMap.get(Number(field(b, 'cuentaId', 'CuentaId')));
      return {
        ...b,
        idCuenta: Number(field(b, 'cuentaId', 'CuentaId') ?? field(cuenta, 'id', 'Id') ?? 0),
        padreCuentaId: (() => {
          const padre = field(cuenta, 'padreCuentaId', 'PadreCuentaId');
          return padre !== undefined && padre !== null ? Number(padre) : null;
        })(),
        codigo: field(cuenta, 'codigoCuenta', 'CodigoCuenta') || field(b, 'codigoCuenta', 'CodigoCuenta') || '',
        nombre: field(cuenta, 'nombreCuenta', 'NombreCuenta') || field(b, 'nombreCuenta', 'NombreCuenta') || '',
        tipo: String(field(cuenta, 'tipoCuenta', 'TipoCuenta') || field(b, 'tipoCuenta', 'TipoCuenta') || '').toUpperCase(),
        saldoInicial: Number(field(b, 'saldoInicial', 'SaldoInicial') ?? 0),
        debe: Number(field(b, 'movimientoDebe', 'MovimientoDebe') ?? 0),
        haber: Number(field(b, 'movimientoHaber', 'MovimientoHaber') ?? 0),
        saldoFinal: Number(field(b, 'saldoFinal', 'SaldoFinal') ?? 0),
      };
    }).sort((a, b) => a.codigo.localeCompare(b.codigo));
  }, [balance, cuentaMap]);

  // Plan completo de la empresa activa fusionado con el balance.
  // El backend (GetBalanceComprobacionAsync) OMITE las cuentas sin saldo ni
  // movimiento, por lo que los títulos y subtítulos nunca llegan y no es
  // posible subtotalizar la estructura. Se complementa con el plan de cuentas
  // completo: las cuentas ausentes del balance se incorporan con valores en
  // cero (son exactamente las que el backend descartó por tener todo en cero,
  // por lo que los totales del reporte no cambian).
  const cuentasBalancePlan = useMemo(() => {
    const idActiva = Number(empresaActiva?.id ?? 0);
    const planEmpresa = cuentas.filter(cu => Number(field(cu, 'empresaId', 'EmpresaId') ?? 0) === idActiva);

    // Sin plan identificado se usa el balance tal cual (comportamiento previo)
    if (planEmpresa.length === 0) return cuentasEnriquecidas;

    const enBalance = new Map(cuentasEnriquecidas.map(c => [c.idCuenta, c]));

    const filas = planEmpresa.map(cu => {
      const id = Number(field(cu, 'id', 'Id') ?? 0);
      const b = enBalance.get(id);
      const padre = field(cu, 'padreCuentaId', 'PadreCuentaId');
      return {
        idCuenta: id,
        padreCuentaId: padre !== undefined && padre !== null ? Number(padre) : null,
        codigo: field(cu, 'codigoCuenta', 'CodigoCuenta') || b?.codigo || '',
        nombre: field(cu, 'nombreCuenta', 'NombreCuenta') || b?.nombre || '',
        tipo: String(field(cu, 'tipoCuenta', 'TipoCuenta') || b?.tipo || '').toUpperCase(),
        saldoInicial: b?.saldoInicial ?? 0,
        debe: b?.debe ?? 0,
        haber: b?.haber ?? 0,
        saldoFinal: b?.saldoFinal ?? 0,
      };
    });

    // Defensa: filas del balance que no aparezcan en el plan no se descartan
    const ids = new Set(filas.map(f => f.idCuenta));
    cuentasEnriquecidas.forEach(c => { if (!ids.has(c.idCuenta)) filas.push(c); });

    return filas.sort((a, b) => a.codigo.localeCompare(b.codigo));
  }, [cuentas, cuentasEnriquecidas, empresaActiva]);

  // Generadores de estructuras (Basados en los PDFs adjuntos)
  const getEstructuraReporte = () => {
    switch (selectedReporte) {
      case 'balance-comprobacion': {
        // ---------------------------------------------------------------
        // FILTRADO: se muestran SÓLO las cuentas con saldo o movimiento y,
        // como excepción, los títulos/subtítulos ancestros que las contienen.
        // Los títulos sin movimiento en toda su rama se OCULTAN (no se lista
        // el plan completo, sólo la estructura operativa del periodo).
        // ---------------------------------------------------------------
        const conValores = (c) => c.saldoInicial !== 0 || c.debe !== 0 || c.haber !== 0 || c.saldoFinal !== 0;

        const arbolPlan = construirArbol(cuentasBalancePlan);
        const visibles = new Set();
        const visitados = new Set();

        // Post-orden: una cuenta se conserva si tiene movimiento O si su árbol
        // descendiente contiene alguna cuenta con movimiento.
        const marcarRama = (c) => {
          const id = c.idCuenta;
          if (visitados.has(id)) return visibles.has(id);
          visitados.add(id);
          let hayMovimiento = conValores(c);
          (arbolPlan.hijosMap.get(id) || []).forEach(hijo => {
            if (marcarRama(hijo)) hayMovimiento = true;
          });
          if (hayMovimiento) visibles.add(id);
          return hayMovimiento;
        };
        arbolPlan.raices.forEach(raiz => marcarRama(raiz));
        // Cuentas no alcanzadas desde las raíces (p. ej. por ciclos): si tienen
        // movimiento no se descartan.
        cuentasBalancePlan.forEach(c => {
          if (!visitados.has(c.idCuenta) && conValores(c)) visibles.add(c.idCuenta);
        });

        const planBalance = cuentasBalancePlan.filter(c => visibles.has(c.idCuenta));

        const totales = planBalance.reduce((acc, c) => ({
          inicial: acc.inicial + c.saldoInicial,
          debe: acc.debe + c.debe,
          haber: acc.haber + c.haber,
          final: acc.final + c.saldoFinal
        }), { inicial: 0, debe: 0, haber: 0, final: 0 });

        // Cuentas títulos del balance (grupos del plan). Cada título se muestra
        // con su detalle (jerarquía padre/hijo consolidada) y su respectivo
        // SUBTOTAL; la suma de los subtotales equivale al total general.
        const tituloSecciones = [
          { etiqueta: 'ACTIVO', test: t => t.includes('ACTIVO') },
          { etiqueta: 'PASIVO', test: t => t.includes('PASIVO') },
          { etiqueta: 'PATRIMONIO', test: t => t.includes('PATRIMONIO') || t.includes('CAPITAL') },
          { etiqueta: 'INGRESOS', test: t => t.includes('INGRESO') },
          { etiqueta: 'EGRESOS', test: t => t.includes('GASTO') || t.includes('COSTO') || t.includes('EGRESO') },
        ];

        const celdaNegrita = (texto) => ({ content: texto, styles: { fontStyle: 'bold' } });
        const celdaVaciaNegrita = () => ({ content: '', styles: { fontStyle: 'bold' } });

        const asignadas = new Set();
        const filas = [];
        // Subtotales firmados por título (para la comprobación de la ecuación)
        const subtotalesPorTitulo = new Map();

        const pintarTituloBalance = (etiqueta, lista) => {
          if (lista.length === 0) return;

          // Detalle del título: cada padre consolida su subárbol (sin doble
          // conteo porque el subtotal de la sección suma los valores propios).
          const jerarquia = filasJerarquicas(lista, (c, esPadre, hijosMap) => ({
            inicial: sumarSubarbol(c, hijosMap, x => x.saldoInicial),
            debe: sumarSubarbol(c, hijosMap, x => x.debe),
            haber: sumarSubarbol(c, hijosMap, x => x.haber),
            final: sumarSubarbol(c, hijosMap, x => x.saldoFinal),
          }));

          const subtotal = lista.reduce((acc, c) => ({
            inicial: acc.inicial + c.saldoInicial,
            debe: acc.debe + c.debe,
            haber: acc.haber + c.haber,
            final: acc.final + c.saldoFinal
          }), { inicial: 0, debe: 0, haber: 0, final: 0 });
          subtotalesPorTitulo.set(etiqueta, subtotal);

          // Encabezado de la cuenta título
          filas.push([
            celdaNegrita(` ${etiqueta}`),
            celdaVaciaNegrita(), celdaVaciaNegrita(), celdaVaciaNegrita(), celdaVaciaNegrita()
          ]);

          // Detalle: subtítulos y cuentas con sangría según su profundidad.
          // Tras cada subárbol (profundidad ≥ 1) se cierra con su fila
          // SUBTOTAL consolidada; los padres raíz los cubre el SUBTOTAL
          // del título de sección.
          const jerarquiaConSubtotales = insertarSubtotalesJerarquia(jerarquia);
          jerarquiaConSubtotales.forEach(r => {
            const estilo = r.esPadre || r.esSubtotalCierre ? { fontStyle: 'bold' } : {};
            const etiqueta = r.esSubtotalCierre
              ? `${sangria(r.profundidad)}SUBTOTAL ${r.cuenta.codigo} - ${r.cuenta.nombre}`
              : `${sangria(r.profundidad)}${r.cuenta.codigo} - ${r.cuenta.nombre}`;
            filas.push([
              { content: etiqueta, styles: estilo },
              { content: formatMoney(r.valores.inicial), styles: estilo },
              { content: formatMoney(r.valores.debe), styles: estilo },
              { content: formatMoney(r.valores.haber), styles: estilo },
              { content: formatMoney(r.valores.final), styles: estilo },
            ]);
          });

          // Subtotal de la cuenta título
          filas.push([
            celdaNegrita(`SUBTOTAL ${etiqueta}`),
            celdaNegrita(formatMoney(subtotal.inicial)),
            celdaNegrita(formatMoney(subtotal.debe)),
            celdaNegrita(formatMoney(subtotal.haber)),
            celdaNegrita(formatMoney(subtotal.final)),
          ]);

          // Fila separadora entre títulos
          filas.push([{ content: '', styles: { minCellHeight: 8 } }, '', '', '', '']);
        };

        // Cada cuenta se asigna a un solo título para evitar duplicidad de montos
        tituloSecciones.forEach(sec => {
          const lista = planBalance.filter(c => !asignadas.has(c.idCuenta) && sec.test(c.tipo));
          lista.forEach(c => asignadas.add(c.idCuenta));
          pintarTituloBalance(sec.etiqueta, lista);
        });

        // Cuentas sin tipo clasificado: no quedan fuera del reporte
        const resto = planBalance.filter(c => !asignadas.has(c.idCuenta));
        pintarTituloBalance('OTRAS CUENTAS', resto);

        // Se retira la última fila separadora (quedó al final del listado)
        if (filas.length > 0) filas.pop();

        // ---------------------------------------------------------------
        // VERIFICACIÓN DE LA ECUACIÓN CONTABLE usada únicamente en la fila
        // de TOTALES (no se pintan filas de ecuación en el cuerpo del
        // reporte). Títulos sin movimiento no aportan (suman 0):
        //   ACTIVO − (PASIVO + PATRIMONIO + INGRESOS − EGRESOS) = 0,00
        // ---------------------------------------------------------------
        const sumarTitulo = (etiqueta) => subtotalesPorTitulo.get(etiqueta)
          || { inicial: 0, debe: 0, haber: 0, final: 0 };

        // Títulos efectivamente pintados (con cuentas en movimiento)
        const terminos = [
          { etiqueta: 'ACTIVO', esIzquierdo: true },
          { etiqueta: 'PASIVO', esIzquierdo: false, signo: '+' },
          { etiqueta: 'PATRIMONIO', esIzquierdo: false, signo: '+' },
          { etiqueta: 'INGRESOS', esIzquierdo: false, signo: '+' },
          { etiqueta: 'EGRESOS', esIzquierdo: false, signo: '−' },
        ].filter(t => subtotalesPorTitulo.has(t.etiqueta));

        const acumular = (lista) => lista.reduce((acc, t) => {
          const v = sumarTitulo(t.etiqueta);
          acc.inicial += v.inicial;
          acc.final += v.final;
          return acc;
        }, { inicial: 0, final: 0 });

        const terminosIzquierdo = terminos.filter(t => t.esIzquierdo);
        const terminosDerecho = terminos.filter(t => !t.esIzquierdo);
        const ladoIzquierdo = acumular(terminosIzquierdo);
        const derechaSuma = acumular(terminosDerecho.filter(t => t.signo === '+'));
        const derechaResta = acumular(terminosDerecho.filter(t => t.signo === '−'));

        const ladoDerecho = {
          inicial: derechaSuma.inicial - derechaResta.inicial,
          final: derechaSuma.final - derechaResta.final
        };
        const difInicial = ladoIzquierdo.inicial - ladoDerecho.inicial;
        const difFinal = ladoIzquierdo.final - ladoDerecho.final;
        const formatearDiferencia = (v) => formatMoney(Math.abs(v) < 0.005 ? 0 : v);

        return {
          titulo: 'Balance de Comprobación',
          columnas: ['Nombre de La Cuenta', 'Saldo Inicial', 'Monto Debe', 'Monto Haber', 'Saldo Actual'],
          filas,
          // Saldo Inicial y Saldo Actual NO totalizan partidas: en esas dos
          // columnas la fila de totales muestra la VERIFICACIÓN de la ecuación
          // contable (ACTIVO − (PASIVO + PATRIMONIO + INGRESOS − EGRESOS)),
          // que debe ser 0,00 cuando el balance está cuadrado. Debe/Haber sí
          // suman (y deben ser iguales por partida doble).
          totales: [
            'TOTALES.. (VERIFICACIÓN ECUACIÓN)',
            formatearDiferencia(difInicial),
            formatMoney(totales.debe),
            formatMoney(totales.haber),
            formatearDiferencia(difFinal)
          ]
        };
      }
      case 'estado-resultados': {
        const ingresos = cuentasEnriquecidas.filter(c => c.tipo.includes('INGRESO'));
        const egresos = cuentasEnriquecidas.filter(c => c.tipo.includes('GASTO') || c.tipo.includes('COSTO'));

        const totalIngresos = ingresos.reduce((sum, c) => sum + Math.abs(c.saldoFinal), 0);
        const totalEgresos = egresos.reduce((sum, c) => sum + Math.abs(c.saldoFinal), 0);
        const utilidad = totalIngresos - totalEgresos;

        // Subárbol consolidado por partida: los padres subtotalizan la suma de
        // sus hijos (valores absolutos), sin alterar los totales existentes.
        const consolidarSeccion = (lista) =>
          filasJerarquicas(lista, (c, esPadre, hijosMap) => ({
            monto: sumarSubarbol(c, hijosMap, x => Math.abs(x.saldoFinal)),
          }));

        const filasIngresos = consolidarSeccion(ingresos);
        const filasEgresos = consolidarSeccion(egresos);

        const pintarSeccion = (etiqueta, filasSeccion) => [
          [{ content: etiqueta, styles: { fontStyle: 'bold' } }, ''],
          ...filasSeccion.map(r => {
            const estilo = r.esPadre ? { fontStyle: 'bold' } : {};
            return [
              { content: `${sangria(r.profundidad)}${r.cuenta.nombre}`, styles: estilo },
              { content: formatMoney(r.valores.monto), styles: estilo },
            ];
          }),
        ];

        const filas = [
          ...pintarSeccion('INGRESOS', filasIngresos),
          [{ content: 'TOTAL INGRESOS', styles: { fontStyle: 'bold' } }, { content: formatMoney(totalIngresos), styles: { fontStyle: 'bold' } }],
          [{ content: '', styles: { minCellHeight: 10 } }, ''],
          ...pintarSeccion('EGRESOS', filasEgresos),
          [{ content: 'TOTAL EGRESOS', styles: { fontStyle: 'bold' } }, { content: formatMoney(totalEgresos), styles: { fontStyle: 'bold' } }],
        ];

        return {
          titulo: 'Estado De Resultado',
          columnas: ['Descripción', 'Monto'],
          filas,
          totales: ['UTILIDAD O PERDIDA NETA DEL EJERCICIO', formatMoney(utilidad)]
        };
      }
      case 'situacion-financiera': {
        const activos = cuentasEnriquecidas.filter(c => c.tipo.includes('ACTIVO'));
        const pasivos = cuentasEnriquecidas.filter(c => c.tipo.includes('PASIVO'));
        const patrimonio = cuentasEnriquecidas.filter(c => c.tipo.includes('PATRIMONIO') || c.tipo.includes('CAPITAL'));

        const totalActivos = activos.reduce((sum, c) => sum + Math.abs(c.saldoFinal), 0);
        const totalPasivos = pasivos.reduce((sum, c) => sum + Math.abs(c.saldoFinal), 0);
        const totalPatrimonio = patrimonio.reduce((sum, c) => sum + Math.abs(c.saldoFinal), 0);

        const consolidarSeccion = (lista) =>
          filasJerarquicas(lista, (c, esPadre, hijosMap) => ({
            monto: sumarSubarbol(c, hijosMap, x => Math.abs(x.saldoFinal)),
          }));

        const filasActivos = consolidarSeccion(activos);
        const filasPasivos = consolidarSeccion(pasivos);
        const filasPatrimonio = consolidarSeccion(patrimonio);

        const pintarSeccion = (etiqueta, filasSeccion) => [
          [{ content: etiqueta, styles: { fontStyle: 'bold' } }, ''],
          ...filasSeccion.map(r => {
            const estilo = r.esPadre ? { fontStyle: 'bold' } : {};
            return [
              { content: `${sangria(r.profundidad)}${r.cuenta.nombre}`, styles: estilo },
              { content: formatMoney(r.valores.monto), styles: estilo },
            ];
          }),
        ];

        const filas = [
          ...pintarSeccion('ACTIVO', filasActivos),
          [{ content: 'TOTAL ACTIVO', styles: { fontStyle: 'bold' } }, { content: formatMoney(totalActivos), styles: { fontStyle: 'bold' } }],
          [{ content: '', styles: { minCellHeight: 10 } }, ''],
          ...pintarSeccion('PASIVO', filasPasivos),
          [{ content: 'TOTAL PASIVO', styles: { fontStyle: 'bold' } }, { content: formatMoney(totalPasivos), styles: { fontStyle: 'bold' } }],
          [{ content: '', styles: { minCellHeight: 10 } }, ''],
          ...pintarSeccion('PATRIMONIO', filasPatrimonio),
          [{ content: 'TOTAL PATRIMONIO', styles: { fontStyle: 'bold' } }, { content: formatMoney(totalPatrimonio), styles: { fontStyle: 'bold' } }],
        ];

        return {
          titulo: 'Estado de Situación Financiera',
          columnas: ['Descripción', 'Monto'],
          filas,
          totales: ['TOTAL PASIVO Y PATRIMONIO', formatMoney(totalPasivos + totalPatrimonio)]
        };
      }
      case 'resumen-diario': {
        // Filtrar cuentas que tuvieron movimiento en el mes
        const cuentasConMovimiento = cuentasEnriquecidas.filter(c => c.debe > 0 || c.haber > 0);
        const totales = cuentasConMovimiento.reduce((acc, c) => ({
          debe: acc.debe + c.debe, haber: acc.haber + c.haber
        }), { debe: 0, haber: 0 });

        return {
          titulo: 'Resumen de Diario',
          columnas: ['Código', 'NOMBRE DE LA CUENTA', 'DEBE', 'HABER'],
          filas: cuentasConMovimiento.map(c => [
            c.codigo, c.nombre, formatMoney(c.debe), formatMoney(c.haber)
          ]),
          totales: ['TOTALES..', '', formatMoney(totales.debe), formatMoney(totales.haber)]
        };
      }
      default:
        return null;
    }
  };

  const exportarPdf = () => {
    const estructura = getEstructuraReporte();
    if (!estructura) return;

    const pdf = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'letter' });

    // Encabezado según formato PDF (usa el periodo realmente consultado)
    const periodoInfo = periodoConsultadoData || periodoSeleccionadoData;
    pdf.setFontSize(10);
    pdf.setFont('helvetica', 'bold');
    pdf.text(`${empresaActiva?.nombre?.toUpperCase() || 'EMPRESA PRINCIPAL'}`, 40, 40);
    pdf.text(`RIF ${empresaActiva?.rif || 'J-000000000'}`, 40, 52);
    pdf.text(`${estructura.titulo} del ${formatearFecha(periodoInfo?.fechaInicio)} al ${formatearFecha(periodoInfo?.fechaFin)}`, 40, 64);
    pdf.setFont('helvetica', 'normal');
    pdf.text('Expresado en Bolívar', 40, 76);
    
    // Preparar filas: se conserva el contenido y la negrita de los subtotales
    // (padres) para que autotable los resalte igual que en la vista previa.
    const cleanFilas = estructura.filas.map(fila => fila.map(celda => {
      if (typeof celda === 'object' && celda !== null) {
        return {
          content: celda.content ?? '',
          styles: { fontStyle: celda.styles?.fontStyle === 'bold' ? 'bold' : 'normal' }
        };
      }
      return celda;
    }));
    const cleanTotales = estructura.totales.map(celda => typeof celda === 'object' && celda !== null ? celda.content : celda);

    const columnStyles = {};
    estructura.columnas.forEach((_, idx) => {
      if (estructura.columnas.length === 4) {
        // Para reportes como Resumen de Diario (Código y Nombre a la izquierda, Debe y Haber a la derecha)
        columnStyles[idx] = { halign: idx < 2 ? 'left' : 'right' };
      } else {
        // Para Balance de Comprobación, Estado de Resultados, etc. (Primera columna izq, resto der)
        columnStyles[idx] = { halign: idx === 0 ? 'left' : 'right' };
      }
    });

    autoTable(pdf, {
      startY: 105,
      head: [estructura.columnas],
      body: [...cleanFilas, cleanTotales],
      theme: 'plain', // Sin bordes ni colores de fondo, imitando el PDF
      styles: { fontSize: 8, cellPadding: 3, textColor: [0, 0, 0] },
      headStyles: { fontStyle: 'bold', borderBottom: '1px solid #000' },
      footStyles: { fontStyle: 'bold', borderTop: '1px solid #000' },
      margin: { left: 40, right: 40 },
    });

    pdf.save(`${estructura.titulo.replace(/\s+/g, '')}_${periodoInfo?.nombre || 'Reporte'}.pdf`);
  };

  const reporteData = getEstructuraReporte();

    const exportarExcel = () => {
        const estructura = getEstructuraReporte();
        if (!estructura) return;

        // Limpiar celdas con estilos (igual que en PDF)
        const cleanFilas = estructura.filas.map(fila => 
          fila.map(celda => (typeof celda === 'object' && celda !== null ? celda.content : celda))
        );
        const cleanTotales = estructura.totales.map(celda => 
          typeof celda === 'object' && celda !== null ? celda.content : celda
        );

        // Estructurar los datos con el mismo membrete formal del PDF
        const periodoInfo = periodoConsultadoData || periodoSeleccionadoData;
        const datosExcel = [
          [empresaActiva?.nombre?.toUpperCase() || 'EMPRESA PRINCIPAL, C.A'],
          [`RIF ${empresaActiva?.rif || 'J-000000000'}`],
          [`${estructura.titulo} del ${formatearFecha(periodoInfo?.fechaInicio)} al ${formatearFecha(periodoInfo?.fechaFin)}`],
          ['Expresado en Bolívar'],
          [], // Fila en blanco de separación
          estructura.columnas,
          ...cleanFilas,
          cleanTotales
        ];

        // Crear la hoja de trabajo y el libro con SheetJS (xlsx)
        const worksheet = XLSX.utils.aoa_to_sheet(datosExcel);

        // ---------------------------------------------------------------------------
        // ALINEACIÓN A LA DERECHA PARA LAS COLUMNAS NUMÉRICAS EN EXCEL
        // ---------------------------------------------------------------------------
        const range = XLSX.utils.decode_range(worksheet['!ref'] || "A1");
        for (let R = range.s.r; R <= range.e.r; ++R) {
          for (let C = range.s.c; C <= range.e.c; ++C) {
            const cellAddress = XLSX.utils.encode_cell({ r: R, c: C });
            if (!worksheet[cellAddress]) continue;

            // A partir de la fila de encabezados de la tabla (índice 5, donde está estructura.columnas) 
            // y para todas las columnas de montos (índice C > 0), alineamos a la derecha.
            if (R >= 5 && C > 0) {
              if (!worksheet[cellAddress].s) worksheet[cellAddress].s = {};
              worksheet[cellAddress].s.alignment = { horizontal: "right" };
            }
          }
        }

        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, 'Reporte Financiero');

        // Descargar archivo
        XLSX.writeFile(workbook, `${estructura.titulo.replace(/\s+/g, '')}_${periodoInfo?.nombre || 'Reporte'}.xlsx`);
      };

  return (
    <div style={{ padding: '24px', color: '#e2e8f0', minHeight: '80vh' }}>
      
      {/* 1. ZONA SUPERIOR: Selector de Periodo Padre/Hijo + Botón de Consulta */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#1e293b', padding: '16px 20px', borderRadius: '12px', marginBottom: '24px', border: '1px solid #334155', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h2 style={{ margin: '0 0 4px 0', color: '#60a5fa', fontSize: '1.2rem' }}>Generador de Documentos Financieros</h2>
          <span style={{ color: '#94a3b8', fontSize: '0.85rem' }}>Seleccione el periodo y pulse «🔍 Consultar» para generar el reporte.</span>
        </div>

        <div style={{ display: 'flex', alignItems: 'flex-end', gap: '10px', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', width: '300px' }}>
            <label style={{ color: '#cbd5e1', fontSize: '0.8rem', fontWeight: 600 }}>Periodo de Emisión (Padre / Hijo)</label>
            <select
              value={periodoSeleccionadoId}
              onChange={(e) => setPeriodoSeleccionadoId(Number(e.target.value))}
              style={{ width: '100%', background: '#0f172a', color: '#fff', border: '1px solid #475569', borderRadius: '8px', padding: '10px' }}
            >
              {listaPeriodosJerarquia.map((p) => (
                <option key={p.id} value={p.id} style={{ fontWeight: p.isPadre ? 'bold' : 'normal' }}>
                  {p.label}
                </option>
              ))}
            </select>
          </div>

          {/* Botón explícito de consulta: el reporte sólo se genera cuando el usuario lo pide */}
          <button
            onClick={() => consultar(periodoSeleccionadoId)}
            disabled={loading}
            title="Consultar el reporte del periodo seleccionado"
            style={{
              display: 'flex', alignItems: 'center', gap: '8px',
              background: pendienteConsulta ? '#f59e0b' : '#2563eb',
              color: pendienteConsulta ? '#1e293b' : '#fff',
              border: 'none', borderRadius: '8px', padding: '10px 18px',
              cursor: loading ? 'wait' : 'pointer', fontWeight: 'bold', fontSize: '0.9rem',
              opacity: loading ? 0.7 : 1, transition: 'background 0.2s ease'
            }}
          >
            {loading ? '⏳ Consultando...' : '🔍 Consultar'}
          </button>
        </div>
      </div>

      {/* Aviso: el periodo elegido aún no ha sido consultado */}
      {pendienteConsulta && !loading && (
        <div style={{
          background: '#1e293b', border: '1px solid #f59e0b', color: '#fcd34d',
          padding: '12px 16px', borderRadius: '8px', marginBottom: '24px', fontSize: '0.9rem',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap'
        }}>
          <span>
            ⏳ El periodo <strong>«{periodoSeleccionadoData?.nombre || 'seleccionado'}»</strong> está pendiente de consulta.
            {periodoConsultadoId !== null && ' Los datos en pantalla corresponden a otro periodo.'}
          </span>
          <button
            onClick={() => consultar(periodoSeleccionadoId)}
            style={{ background: '#f59e0b', color: '#1e293b', border: 'none', borderRadius: '6px', padding: '8px 14px', cursor: 'pointer', fontWeight: 'bold' }}
          >
            🔍 Consultar ahora
          </button>
        </div>
      )}

      {/* 2. ZONA MEDIA: Selector de Reportes (Iconos) */}
      <div style={{ display: 'flex', gap: '12px', overflowX: 'auto', paddingBottom: '16px', marginBottom: '10px' }}>
        {REPORT_OPTIONS.map((reporte) => (
          <button
            key={reporte.id}
            onClick={() => setSelectedReporte(reporte.id)}
            style={{
              display: 'flex', alignItems: 'center', gap: '10px',
              background: selectedReporte === reporte.id ? '#2563eb' : '#1e293b',
              color: selectedReporte === reporte.id ? '#ffffff' : '#94a3b8',
              border: selectedReporte === reporte.id ? '1px solid #3b82f6' : '1px solid #334155',
              borderRadius: '10px', padding: '12px 18px', cursor: 'pointer',
              transition: 'all 0.2s ease', whiteSpace: 'nowrap', fontWeight: 'bold'
            }}
          >
            <span style={{ fontSize: '1.4rem' }}>{reporte.icon}</span>
            {reporte.label}
          </button>
        ))}
      </div>

      {/* 3. ZONA INFERIOR: Previsualización de la "Hoja de Papel" */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '40px', color: '#94a3b8' }}>⏳ Consolidando datos del periodo...</div>
      ) : pendienteConsulta && selectedReporte ? (
        <div style={{ textAlign: 'center', padding: '40px', color: '#fcd34d', border: '2px dashed #f59e0b', borderRadius: '12px' }}>
          ⏳ El reporte corresponde al periodo consultado previamente. Pulse «🔍 Consultar» para generarlo con el periodo seleccionado.
        </div>
      ) : selectedReporte && reporteData ? (
        <div style={{ background: '#0f172a', padding: '24px', borderRadius: '12px', border: '1px solid #334155' }}>
          
          {/* Botonera de Exportación interna */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginBottom: '20px' }}>
             <button 
               onClick={exportarExcel} 
               style={{ display: 'flex', alignItems: 'center', gap: '8px', background: '#16a34a', color: '#fff', border: 'none', borderRadius: '8px', padding: '10px 16px', cursor: 'pointer', fontWeight: 'bold' }}
             >
               📊 Descargar Excel
             </button>
             <button 
               onClick={exportarPdf} 
               style={{ display: 'flex', alignItems: 'center', gap: '8px', background: '#dc2626', color: '#fff', border: 'none', borderRadius: '8px', padding: '10px 16px', cursor: 'pointer', fontWeight: 'bold' }}
             >
               📄 Descargar PDF
             </button>
          </div>

          {/* AVISO CUANDO EL PERIODO NO TIENE MOVIMIENTOS REGISTRADOS */}
          {reporteData.filas.length === 0 && (
            <div style={{
              background: '#1e293b', border: '1px solid #f59e0b', color: '#fcd34d',
              padding: '12px 16px', borderRadius: '8px', marginBottom: '20px', fontSize: '0.9rem'
            }}>
              ℹ️ No se encontraron movimientos contables para «{periodoConsultadoData?.nombre || periodoSeleccionadoData?.nombre || 'este periodo'}».
              Verifique que los asientos se hayan registrado en este periodo y que la empresa activa sea la correcta.
            </div>
          )}

          {/* HOJA DE PAPEL ESTILO PDF */}
          <div style={{ 
            background: '#ffffff', color: '#000000', padding: '40px 50px', 
            borderRadius: '4px', maxWidth: '850px', margin: '0 auto', 
            boxShadow: '0 10px 25px rgba(0,0,0,0.5)', fontFamily: 'Arial, sans-serif', fontSize: '12px'
          }}>
            {/* Encabezado del Documento */}
              <div style={{ marginBottom: '24px', lineHeight: '1.4' }}>
                <div style={{ fontWeight: 'bold', fontSize: '14px' }}>{empresaActiva?.nombre?.toUpperCase() || 'EMPRESA PRINCIPAL, C.A'}</div>
                <div>RIF {empresaActiva?.rif || 'J-000000000'}</div>
                <div style={{ fontWeight: 'bold' }}>
                  {reporteData.titulo} del {formatearFecha((periodoConsultadoData || periodoSeleccionadoData)?.fechaInicio)} al {formatearFecha((periodoConsultadoData || periodoSeleccionadoData)?.fechaFin)}
                </div>
                <div>Expresado en Bolívar</div>
              </div>

            {/* Tabla Principal */}
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1.5px solid #000' }}>
                  {reporteData.columnas.map((col, idx) => (
                    <th key={idx} style={{ textAlign: idx === 0 ? 'left' : 'right', padding: '8px 4px', fontWeight: 'bold' }}>{col}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {reporteData.filas.map((fila, idxFila) => (
                  <tr key={idxFila}>
                    {fila.map((celda, idxCelda) => {
                      const isBold = typeof celda === 'object' && celda?.styles?.fontStyle === 'bold';
                      const text = typeof celda === 'object' ? celda.content : celda;
                      return (
                        <td key={idxCelda} style={{ textAlign: idxCelda === 0 ? 'left' : 'right', padding: '4px', fontWeight: isBold ? 'bold' : 'normal', paddingTop: celda?.styles?.minCellHeight ? '15px' : '4px' }}>
                          {text}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr style={{ borderTop: '1.5px solid #000', fontWeight: 'bold' }}>
                  {reporteData.totales.map((total, idx) => (
                    <td key={idx} style={{ textAlign: idx === 0 ? 'left' : 'right', padding: '10px 4px' }}>{total}</td>
                  ))}
                </tr>
              </tfoot>
            </table>
          </div>

        </div>
      ) : (
        <div style={{ textAlign: 'center', padding: '40px', color: '#64748b', border: '2px dashed #334155', borderRadius: '12px' }}>
          ↑ Seleccione un reporte en el menú superior para generar la vista previa del documento.
        </div>
      )}
    </div>
  );
}
