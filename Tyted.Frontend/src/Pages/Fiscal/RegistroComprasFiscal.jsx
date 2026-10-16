import { useState, useContext, useEffect, useCallback } from 'react';
import { ConfigContext } from '../../Context/ConfigContext';
import { fiscalApi, mensajeErrorApi } from '../../Services/Fiscal/FiscalApi';
import {
  estructuraLibroCompras,
  desgloseGasto,
  exportarLibroPdf,
  exportarLibroXls,
  esColumnaMonto
} from './reportesLibrosFiscal';
import { generarComprobanteIVA, generarComprobanteISLR } from './reportesRetenciones';

const fmt = (v) => Number(v ?? 0).toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const formatearFecha = (fecha) => {
  if (!fecha) return '—';
  const partes = String(fecha).split(/[-T]/);
  if (partes.length >= 3) return `${partes[2].slice(0, 2)}/${partes[1]}/${partes[0]}`;
  const d = new Date(fecha);
  return isNaN(d.getTime()) ? fecha : d.toLocaleDateString('es-VE');
};

const TIPOS_TRANSACCION = [
  { valor: '01', etiqueta: '01 Registro' },
  { valor: '02', etiqueta: '02 Complemento' },
  { valor: '03', etiqueta: '03 Anulación' }
];

// Desglose por alícuota (Providencia 0049): exentas, base reducida 8%,
// base general 16% y crédito fiscal total. Se leen los montos congelados en
// Bolívares (*MonedaExt) del backend; el frontend NO convierte con tasa.
const desgloseCompra = (compra) => {
  const lineas = compra?.detalles?.$values || compra?.detalles || [];
  const base = Number(compra?.subtotalMonedaExt ?? 0)
    || lineas.reduce((s, l) => s + Number(l.subtotalLineaMonedaExt ?? 0), 0);
  const iva = Number(compra?.ivaMonedaExt ?? 0);
  const total = Number(compra?.totalMonedaExt ?? 0) || base + iva;
  const porTasa = (tasa) => lineas
    .filter((l) => Number(l.tasaIVA ?? 0) === tasa)
    .reduce((s, l) => s + Number(l.subtotalLineaMonedaExt ?? 0), 0);
  const exento = porTasa(0);
  const base8 = porTasa(8);
  const base16 = porTasa(16);
  return { base, exento, base8, base16, iva, total };
};

const thStyle = { padding: '10px 8px', textAlign: 'left', fontWeight: 'bold', whiteSpace: 'nowrap' };
const tdStyle = { padding: '8px', borderTop: '1px solid #1f2937', verticalAlign: 'middle' };
const inputChico = {
  background: '#0f172a', color: '#fff', border: '1px solid #475569',
  borderRadius: '6px', padding: '6px 8px', fontSize: '0.8rem'
};

// Cuando el motor aborta por cuentas base ausentes (caja/proveedores, IVA o
// compras/gastos), amplía el aviso con el paso a paso para corregirlo desde la
// UI (plan de cuentas o panel de conceptos SISTEMA), en vez de sólo el código.
const guiaCuentasBase = (texto) => {
  if (!texto || !String(texto).includes('No se encontraron activas')) return '';
  return '\n\n🔧 Cómo corregirlo:\n' +
    '1) Contabilidad → Plan de Cuentas: cree/reactive la(s) cuenta(s) indicada(s) y verifique que estén ACTIVAS y sean de MOVIMIENTO.\n' +
    '2) O bien 🧮 Conceptos → pestaña ⚙️ SISTEMA: reasigne la cuenta base (CAJA_PRINCIPAL, PROVEEDORES, IVA_CREDITO…).\n' +
    '3) Vuelva a pulsar 🧾 (el proceso es idempotente: no duplica el asiento).';
};

// ---------------------------------------------------------------------------
// REGISTRO DE COMPRAS (LIBRO DE COMPRAS IVA): alimenta la parte fiscal con
// sus comprobantes contables (BE-F4). El selector global empresa/periodo rige
// el rango de fechas consultado.
// ---------------------------------------------------------------------------
export default function RegistroComprasFiscal() {
  const { empresaActiva, periodoActivo, tasa } = useContext(ConfigContext);

  const [compras, setCompras] = useState([]);
  const [retenciones, setRetenciones] = useState([]);
  // Retenciones de ISLR emitidas (Decreto 1.808) del periodo/empresa.
  const [retencionesIslr, setRetencionesIslr] = useState([]);
  // Conceptos de retención ISLR (catálogo de la empresa) para el modal.
  const [conceptosIslr, setConceptosIslr] = useState([]);
  // Modal de emisión de retención ISLR: { compra | gasto (documento origen),
  // conceptoId elegido } — la apertura puede traer el concepto sugerido.
  const [modalIslr, setModalIslr] = useState(null);
  const [emitiendoIslr, setEmitiendoIslr] = useState(false);
  const [cargando, setCargando] = useState(false);
  const [editandoId, setEditandoId] = useState(null);
  const [formFiscal, setFormFiscal] = useState({ tipoTransaccion: '01', numeroControl: '' });
  const [procesandoId, setProcesandoId] = useState(null);

  // --- ALTA ÚNICA DE DOCUMENTOS FISCALES (FACTURA | GASTO) ---
  // Un solo formulario con selector de tipo: en el backend siguen siendo
  // entidades separadas (Compra / Gasto), sólo se unifica la capa de UI.
  const [mostrarForm, setMostrarForm] = useState(false);
  const [tipoAlta, setTipoAlta] = useState('FACTURA');
  const [guardandoCompra, setGuardandoCompra] = useState(false);
  const [contabilizarAuto, setContabilizarAuto] = useState(true);
  const [proveedores, setProveedores] = useState([]);
  const [formCompra, setFormCompra] = useState({
    fecha: new Date().toISOString().slice(0, 10),
    codigoProv: '',
    numeroFactura: '',
    numeroControl: '',
    tipoTransaccion: '01'
  });
  const [lineasCompra, setLineasCompra] = useState([]);
  const [buscadorProd, setBuscadorProd] = useState('');
  const [resultadosProd, setResultadosProd] = useState([]);

  // --- GASTOS FISCALES (entidad propia, sin inventario) ---
  const [gastos, setGastos] = useState([]);
  const [guardandoGasto, setGuardandoGasto] = useState(false);
  const [contabilizarGastoAuto, setContabilizarGastoAuto] = useState(true);
  // Conceptos de operación tipo GASTO (catálogo por empresa, puente con el
  // plan de cuentas): reemplazan la lista estática de categorías.
  const [conceptosGasto, setConceptosGasto] = useState([]);
  const [formGasto, setFormGasto] = useState({
    fecha: new Date().toISOString().slice(0, 10),
    concepto: '',
    conceptoId: '',
    codigoProv: '',
    // Datos fiscales del documento soporte (Libro de Compras SENIAT):
    // N° de factura/boleta y N° de control son OBLIGATORIOS («S/N» si el
    // documento no tiene control) y el tipo de transacción es elegible.
    numeroFactura: '',
    numeroControl: '',
    tipoTransaccion: '01',
    monto: '',
    // Alícuota del gasto: 0 (EXENTO) | 8 | 16. El monto tecleado es la BASE
    // sin IVA y la alícuota calcula el IVA aparte (Bs.).
    alicuota: '0'
  });
  // Modo híbrido ISLR: el concepto GASTO puede marcar «sujeta a ISLR», lo que
  // preselecciona esta casilla (siempre desmarcable). La emisión de la
  // retención es SIEMPRE explícita por documento, nunca automática.
  const [islrEnGasto, setIslrEnGasto] = useState(false);

  const empresaId = Number(empresaActiva?.id ?? 0);
  const fechaInicio = periodoActivo?.fechaInicio;
  const fechaFin = periodoActivo?.fechaFin;

  // --- CONSULTA BAJO DEMANDA Y PANEL DE REPORTES ---
  // El libro NO se lista al entrar a la página: el usuario lo carga con el
  // botón «🔍 Consultas y edición» o al generar un reporte.
  const [mostrarConsultas, setMostrarConsultas] = useState(false);
  const [mostrarReporte, setMostrarReporte] = useState(false);

  const cargarCompras = useCallback(async () => {
    if (!empresaId || !fechaInicio || !fechaFin) {
      setCompras([]);
      return;
    }
    setCargando(true);
    try {
      const data = await fiscalApi.getCompras({ fechaInicio, fechaFin, empresaId });
      setCompras(Array.isArray(data) ? data : (data?.$values || []));
      // Retenciones de IVA del mismo periodo/empresa (F2); un fallo aquí no
      // debe impedir ver el libro de compras.
      try {
        const rets = await fiscalApi.getRetencionesIva({ fechaInicio, fechaFin, empresaId });
        setRetenciones(Array.isArray(rets) ? rets : (rets?.$values || []));
      } catch (errorRet) {
        console.warn('Error cargando retenciones de IVA:', errorRet);
        setRetenciones([]);
      }
      // Retenciones de ISLR del mismo periodo/empresa (Decreto 1.808).
      try {
        const retsIslr = await fiscalApi.getRetencionesIslr({ fechaInicio, fechaFin, empresaId });
        setRetencionesIslr(Array.isArray(retsIslr) ? retsIslr : (retsIslr?.$values || []));
      } catch (errorIslr) {
        console.warn('Error cargando retenciones de ISLR:', errorIslr);
        setRetencionesIslr([]);
      }
      // Gastos fiscales del mismo periodo/empresa (pestaña Compras y Gastos)
      try {
        const gas = await fiscalApi.getGastos({ fechaInicio, fechaFin, empresaId });
        setGastos(Array.isArray(gas) ? gas : (gas?.$values || []));
      } catch (errorGasto) {
        console.warn('Error cargando gastos:', errorGasto);
        setGastos([]);
      }
    } catch (error) {
      console.error('Error cargando el Libro de Compras:', error);
      alert(`❌ No se pudo cargar el Libro de Compras:\n${mensajeErrorApi(error)}`);
    } finally {
      setCargando(false);
    }
  }, [empresaId, fechaInicio, fechaFin]);

  // Retención vigente por factura (una sola por compra) y total retenido.
  // Monto en Bolívares (Bs.) congelado por el backend (montoRetenidoBs).
  const retencionPorCompra = new Map(retenciones.map((r) => [Number(r.compraId), r]));
  const totalRetenido = retenciones.reduce((s, r) => s + Number(r.montoRetenidoBs ?? r.montoRetenido ?? 0), 0);

  // Retención de ISLR vigente por compra y por gasto (una sola por documento).
  const retencionIslrPorCompra = new Map(retencionesIslr.map((r) => [Number(r.compraId), r]));
  const retencionIslrPorGasto = new Map(retencionesIslr.filter((r) => r.gastoId).map((r) => [Number(r.gastoId), r]));

  // Base imponible en Bs. del documento origen ISLR: para la compra usa el
  // subtotal congelado (*MonedaExt) o el desglose de líneas; para el gasto usa
  // la BASE sin IVA digitada (montoMonedaExt) — el IVA nunca integra la base
  // del ISLR.
  const baseImponibleIslrBs = (doc, esGasto) => {
    if (!doc) return 0;
    if (esGasto) return Number(doc?.montoMonedaExt ?? 0) || Number(doc?.monto ?? 0);
    const d = desgloseCompra(doc);
    return Number(doc?.subtotalMonedaExt ?? 0) || d.base;
  };

  // Abre el modal de retención ISLR con un documento origen (compra o gasto),
  // cargando el catálogo de conceptos de la empresa. El concepto ISLR puede
  // venir sugerido por el concepto GASTO (modo híbrido), pero la emisión es
  // siempre explícita (botón por documento).
  const abrirModalIslr = async ({ compra = null, gasto = null, conceptoId = '' } = {}) => {
    const doc = compra || gasto;
    if (!doc || doc.isAnulada) return;
    const yaEmitida = compra
      ? retencionIslrPorCompra.has(Number(compra.id))
      : retencionIslrPorGasto.has(Number(gasto.id));
    if (yaEmitida) return;

    // Carga el catálogo ISLR una sola vez (o si está vacío).
    if (conceptosIslr.length === 0) {
      try {
        const data = await fiscalApi.getConceptos({ empresaId, tipo: 'ISLR' });
        const lista = Array.isArray(data) ? data : (data?.$values || []);
        setConceptosIslr(lista);
        if (lista.length === 0) {
          alert('⚠️ No hay conceptos ISLR para esta empresa.\n\nVaya a 🧮 Conceptos → pestaña 📑 Retenciones ISLR y pulse «📚 Precargar catálogo ISLR».');
          return;
        }
      } catch (error) {
        console.error('Error cargando conceptos ISLR:', error);
        alert(`❌ No se pudieron cargar los conceptos ISLR:\n${mensajeErrorApi(error)}`);
        return;
      }
    }

    // Exclusividad de paneles: abrir el modal cancela la edición en fila y
    // cierra los paneles superpuestos (la tabla de consultas permanece).
    setEditandoId(null);
    setMostrarForm(false);
    setMostrarReporte(false);
    setModalIslr({ compra, gasto, conceptoId: conceptoId ? String(conceptoId) : '' });
  };

  // Emite la retención ISLR con el concepto elegido sobre el documento origen
  // (compra o gasto). El backend calcula (Base × %) − Sustraendo y congela el
  // monto en Bs. (inmutabilidad fiscal).
  const emitirRetencionIslr = async () => {
    if (!modalIslr?.conceptoId) return;
    const compra = modalIslr.compra || null;
    const gasto = modalIslr.gasto || null;
    const doc = compra || gasto;
    if (!doc) return;
    const concepto = conceptosIslr.find((x) => Number(x.id) === Number(modalIslr.conceptoId));
    if (!concepto) return;

    // Sujeto retenido: el comprobante y el XML exigen el RIF del proveedor.
    const rif = String(compra?.proveedor?.rif || gasto?.proveedor?.rif || '').trim();
    if (!rif) {
      alert('⚠️ El documento no tiene proveedor con RIF: la retención de ISLR requiere el RIF del sujeto retenido.');
      return;
    }

    // Base imponible en Bs. (MonedaExt congelado) del documento origen.
    const baseBs = baseImponibleIslrBs(doc, Boolean(gasto));
    if (!(baseBs > 0)) {
      alert('⚠️ El documento no tiene base imponible en Bolívares (Bs.) para retener ISLR.');
      return;
    }

    const pct = Number(concepto.porcentajeRetencion ?? 0);
    const sustraendo = concepto.aplicaSustraendo ? Number(concepto.montoSustraendoBs ?? 0) : 0;
    const bruto = baseBs * pct / 100;
    const neto = Math.max(0, bruto - sustraendo);

    const etiquetaDoc = gasto
      ? `el gasto «${gasto.concepto || '(s/n)'}» (Doc. ${gasto.numeroFactura || '—'})`
      : `la factura ${compra.numeroFactura || '(s/n)'}`;

    const ok = window.confirm(
      `Emitir retención de ISLR (Decreto 1.808) sobre ${etiquetaDoc}?\n\n` +
      `Sujeto retenido (RIF): ${rif}\n` +
      `Concepto: ${concepto.nombreConcepto} (Cód. ${concepto.codigoSeniat})\n` +
      `Base imponible (Bs.): ${fmt(baseBs)}\n` +
      `Tarifa: ${pct}%\n` +
      `Sustraendo (Bs.): ${fmt(sustraendo)}\n` +
      `Monto a retener (Bs.): ${fmt(neto)}\n\n` +
      'El monto se congelará en Bolívares al momento de emitir.'
    );
    if (!ok) return;

    setEmitiendoIslr(true);
    try {
      const r = await fiscalApi.emitirRetencionIslr({
        compraId: compra ? compra.id : null,
        gastoId: gasto ? gasto.id : null,
        empresaId,
        conceptoOperacionalId: Number(concepto.id),
        baseImponibleBs: baseBs,
        porcentajeRetencion: pct,
        tasaDeCambio: Number(tasa) || 1
      });
      alert(
        `✅ Comprobante de retención ISLR ${r.numeroComprobante} emitido.\n` +
        `Base (Bs.): ${fmt(r.baseImponibleBs)} · Retenido (${r.porcentajeRetencion}%): ${fmt(r.montoRetenidoBs)} Bs.`
      );
      setModalIslr(null);
      await cargarCompras();
    } catch (error) {
      console.error('Error emitiendo retención ISLR:', error);
      alert(`❌ No se pudo emitir la retención ISLR:\n${mensajeErrorApi(error)}`);
    } finally {
      setEmitiendoIslr(false);
    }
  };

  // NOTA: el libro ya NO se carga automáticamente al entrar ni al cambiar de
  // contexto; se consulta bajo demanda (botón «🔍 Consultas y edición» o
  // «📊 Reportes»). Si el contexto cambia con el libro abierto, se recarga.
  useEffect(() => {
    if (mostrarConsultas || mostrarReporte) cargarCompras();
  }, [cargarCompras, mostrarConsultas, mostrarReporte]);

  // Apertura/cierre del panel de consultas (la carga la dispara el useEffect).
  // EXCLUSIVIDAD: al abrirlo se cierran el formulario de alta, el panel de
  // reportes, el modal ISLR y cualquier edición en fila en curso; al cerrarlo
  // se cancela además la edición en fila.
  const alternarConsultas = () => {
    if (mostrarConsultas) {
      setMostrarConsultas(false);
      setEditandoId(null);
      return;
    }
    setMostrarForm(false);
    setMostrarReporte(false);
    setModalIslr(null);
    setEditandoId(null);
    setMostrarConsultas(true);
  };

  // Apertura/cierre del panel de reportes con la misma exclusividad.
  const alternarReporte = () => {
    if (mostrarReporte) {
      setMostrarReporte(false);
      return;
    }
    setMostrarForm(false);
    setMostrarConsultas(false);
    setModalIslr(null);
    setEditandoId(null);
    setMostrarReporte(true);
  };

  // UX de modal: mientras el modal ISLR está abierto, Escape lo cierra y el
  // scroll de fondo queda bloqueado (se restaura al cerrar).
  useEffect(() => {
    if (!modalIslr) return undefined;
    const alPulsarTecla = (e) => { if (e.key === 'Escape') setModalIslr(null); };
    window.addEventListener('keydown', alPulsarTecla);
    const overflowAnterior = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', alPulsarTecla);
      document.body.style.overflow = overflowAnterior;
    };
  }, [modalIslr]);

  // Resumen COMBINADO del período (líneas 30/33/34 del formato SENIAT):
  // facturas de compra + gastos, cada uno con sus alícuotas.
  const totales = compras.reduce((acc, c) => {
    const d = desgloseCompra(c);
    acc.documentos += 1;
    acc.exento += d.exento;
    acc.base8 += d.base8;
    acc.base16 += d.base16;
    acc.iva += d.iva;
    acc.total += d.total;
    if (c.isAnulada) acc.anuladas += 1;
    return acc;
  }, { documentos: 0, exento: 0, base8: 0, base16: 0, iva: 0, total: 0, anuladas: 0 });

  gastos.forEach((g) => {
    const d = desgloseGasto(g);
    totales.documentos += 1;
    totales.exento += d.exento;
    totales.base8 += d.base8;
    totales.base16 += d.base16;
    totales.iva += d.iva;
    totales.total += d.total;
    if (g.isAnulada) totales.anuladas += 1;
  });

  const abrirEdicion = (c) => {
    // Exclusividad: editar en fila cancela el formulario de alta, el panel de
    // reportes y el modal ISLR (la tabla de consultas permanece: es el contexto
    // en el que se edita).
    setMostrarForm(false);
    setMostrarReporte(false);
    setModalIslr(null);
    setEditandoId(c.id);
    setFormFiscal({ tipoTransaccion: c.tipoTransaccion || '01', numeroControl: c.numeroControl || '' });
  };

  const guardarFiscal = async (c) => {
    if (!['01', '02', '03'].includes(formFiscal.tipoTransaccion)) {
      alert('⚠️ Tipo de transacción inválido: use 01, 02 o 03.');
      return;
    }
    try {
      await fiscalApi.actualizarFiscalCompra(c.id, {
        tipoTransaccion: formFiscal.tipoTransaccion,
        numeroControl: formFiscal.numeroControl || null
      });
      setEditandoId(null);
      await cargarCompras();
    } catch (error) {
      console.error('Error guardando datos fiscales:', error);
      alert(`❌ No se pudo actualizar el documento:\n${mensajeErrorApi(error)}`);
    }
  };

  const contabilizar = async (c) => {
    const confirmado = window.confirm(
      `Generar el comprobante contable de la compra ${c.numeroFactura || '(s/n)'}?\n\n` +
      'Partida doble: compras + IVA crédito fiscal / proveedores. Idempotente: no se duplicará.'
    );
    if (!confirmado) return;

    setProcesandoId(c.id);
    try {
      const r = await fiscalApi.contabilizarCompra(c.id);
      if (r.generada) {
        alert(`✅ Comprobante ${r.numeroComprobante} generado.\nDebe/Haber: ${fmt(r.totalDebe)}`);
      } else {
        alert(`⚠️ ${r.mensaje || 'No se generó el comprobante.'}\n${r.advertencia || ''}${guiaCuentasBase(r.advertencia)}`);
      }
      await cargarCompras();
    } catch (error) {
      console.error('Error contabilizando la compra:', error);
      alert(`❌ No se pudo contabilizar:\n${mensajeErrorApi(error)}`);
    } finally {
      setProcesandoId(null);
    }
  };

  // Emisión del comprobante de retención de IVA (F2): 75% o 100% sobre el IVA
  // de la factura, con correlativo oficial SENIAT AAAAMM + 8 dígitos.
  const emitirRetencion = async (c) => {
    if (c.isAnulada || retencionPorCompra.has(Number(c.id))) return;

    const respuesta = window.prompt('Porcentaje de retención de IVA sobre el IVA de la factura (75 o 100):', '75');
    if (respuesta === null) return;
    const porcentaje = Number(respuesta);
    if (porcentaje !== 75 && porcentaje !== 100) {
      alert('⚠️ El porcentaje debe ser 75 o 100.');
      return;
    }

    const confirmado = window.confirm(
      `Emitir el comprobante de retención de IVA (${porcentaje}%) sobre la factura ${c.numeroFactura || '(s/n)'}?\n\n` +
      'Se generará el número correlativo oficial SENIAT (AAAAMM + 8 dígitos). Una sola retención vigente por factura.'
    );
    if (!confirmado) return;

    try {
      const r = await fiscalApi.emitirRetencionIva({ compraId: c.id, empresaId, porcentaje });
      alert(
        `✅ Comprobante de retención ${r.numeroComprobante} emitido.\n` +
        `IVA (Bs.): ${fmt(r.ivaCalculadoBs ?? r.ivaCalculado)} · Retenido (${r.porcentajeRetencion}%): ${fmt(r.montoRetenidoBs ?? r.montoRetenido)} Bs.`
      );
      await cargarCompras(); // recarga compras y retenciones
    } catch (error) {
      console.error('Error emitiendo la retención de IVA:', error);
      alert(`❌ No se pudo emitir la retención:\n${mensajeErrorApi(error)}`);
    }
  };

  // -------------------------------------------------------------------------
  // ALTA DE COMPRA FISCAL Y GASTOS
  // -------------------------------------------------------------------------
  // Totales del formulario en Bs. con desglose por alícuota (Providencia 0049):
  // exento, base reducida 8%, base general 16% y total con IVA.
  const totalesFormCompra = lineasCompra.reduce((acc, l) => {
    const base = Number(l.costo) * Number(l.cantidad);
    const iva = base * (Number(l.tasaIVA) / 100);
    acc.subtotal += base;
    acc.iva += iva;
    if (Number(l.tasaIVA) === 0) acc.exento += base;
    else if (Number(l.tasaIVA) === 8) { acc.base8 += base; acc.iva8 += iva; }
    else { acc.base16 += base; acc.iva16 += iva; }
    return acc;
  }, { subtotal: 0, iva: 0, exento: 0, base8: 0, iva8: 0, base16: 0, iva16: 0 });
  totalesFormCompra.total = totalesFormCompra.subtotal + totalesFormCompra.iva;

  // Gasto en curso: base en Bs. digitada por el usuario + IVA derivado de la
  // alícuota seleccionada (la base es la verdad fiscal; el IVA va aparte).
  const alicuotaGasto = Number(formGasto.alicuota || 0);
  const baseGastoBs = Number(formGasto.monto) || 0;
  const ivaGastoBs = Number((baseGastoBs * alicuotaGasto / 100).toFixed(2));

  // Abre el formulario ÚNICO con el tipo elegido, limpia el estado del modo
  // seleccionado y precarga los catálogos que necesiten ambos (proveedores;
  // conceptos contable GASTO cuando aplica).
  const abrirFormUnico = async (tipo) => {
    // Exclusividad de paneles: abrir el formulario cierra el panel de
    // reportes, la tabla de consultas, el modal ISLR y la edición en fila.
    setMostrarConsultas(false);
    setMostrarReporte(false);
    setModalIslr(null);
    setEditandoId(null);
    setTipoAlta(tipo);
    if (tipo === 'FACTURA') {
      setFormCompra({
        fecha: new Date().toISOString().slice(0, 10),
        codigoProv: '',
        numeroFactura: '',
        numeroControl: '',
        tipoTransaccion: '01'
      });
      setLineasCompra([]);
      setBuscadorProd('');
      setResultadosProd([]);
    } else {
      setFormGasto({
        fecha: new Date().toISOString().slice(0, 10),
        concepto: '',
        conceptoId: '',
        codigoProv: '',
        numeroFactura: '',
        numeroControl: '',
        tipoTransaccion: '01',
        monto: '',
        alicuota: '0'
      });
      setIslrEnGasto(false);
    }
    setMostrarForm(true);

    if (proveedores.length === 0) {
      try {
        const data = await fiscalApi.getProveedores();
        setProveedores(Array.isArray(data) ? data : (data?.$values || []));
      } catch (error) {
        console.warn('Error cargando proveedores:', error);
      }
    }

    // Conceptos de operación tipo GASTO (catálogo por empresa, puente con el
    // plan de cuentas): sólo hace falta en el modo GASTO.
    if (tipo === 'GASTO' && conceptosGasto.length === 0) {
      try {
        const data = await fiscalApi.getConceptos({ empresaId, tipo: 'GASTO' });
        setConceptosGasto(Array.isArray(data) ? data : (data?.$values || []));
      } catch (error) {
        console.warn('Error cargando conceptos de gasto:', error);
      }
    }
  };

  const buscarProdFiscal = async (valor) => {
    setBuscadorProd(valor);
    if (valor.trim().length < 2) { setResultadosProd([]); return; }
    try {
      const data = await fiscalApi.buscarProductos(valor, Number(tasa) || 1);
      const unicos = [];
      const vistos = new Set();
      (Array.isArray(data) ? data : []).forEach((p) => {
        if (!vistos.has(p.codigoProd)) { vistos.add(p.codigoProd); unicos.push(p); }
      });
      setResultadosProd(unicos);
    } catch {
      setResultadosProd([]);
    }
  };

  const agregarLineaCompra = (prod) => {
    // El formulario fiscal captura en BOLÍVARES: el costo del producto se
    // precarga convertido a Bs. con la tasa del día (USD × tasa).
    const tasaDia = Number(tasa) || 1;
    const costoUsd = Number(prod.costoUSD || prod.costoUnitarioMonedaBase || prod.precioUSD || 0);
    setLineasCompra(prev => [...prev, {
      idProductoUnidad: prod.idProductoUnidad,
      codigoProd: prod.codigoProd,
      descripcion: prod.descripcion || 'PRODUCTO',
      unidad: prod.unidad || 'UND',
      costo: Number((costoUsd * tasaDia).toFixed(2)),
      cantidad: 1,
      tasaIVA: Number(prod.porcentajeIva || 0)
    }]);
    setBuscadorProd('');
    setResultadosProd([]);
  };

  const modificarLineaCompra = (idx, campo, valor) => {
    setLineasCompra(prev => prev.map((l, i) => (i === idx ? { ...l, [campo]: valor } : l)));
  };

  const quitarLineaCompra = (idx) => {
    setLineasCompra(prev => prev.filter((_, i) => i !== idx));
  };

  const guardarCompraFiscal = async () => {
    if (lineasCompra.length === 0) { alert('⚠️ Agregue al menos una línea a la compra fiscal.'); return; }
    if (!formCompra.fecha) { alert('⚠️ Indique la fecha de la factura (debe estar dentro del periodo contable).'); return; }
    if (!formCompra.codigoProv) { alert('⚠️ Seleccione el proveedor (su RIF alimenta el Libro de Compras).'); return; }
    if (!formCompra.numeroFactura?.trim()) { alert('⚠️ Indique el N° de factura (dato obligatorio del Libro de Compras).'); return; }
    if (formCompra.tipoTransaccion === '01' && !formCompra.numeroControl?.trim()) {
      alert('⚠️ El N° de control es obligatorio para el tipo 01 (Registro).\n\nEs un dato obligatorio del Libro de Compras; si el documento no tiene control, escriba «S/N».');
      return;
    }

    const confirmado = window.confirm(
      'Registrar la compra fiscal (documento declarativo).\n\n' +
      'NO afecta el inventario: sin aumento de stock, sin actualización de costos y sin kardex.' +
      (contabilizarAuto ? '\nSe generará además su comprobante contable.' : '')
    );
    if (!confirmado) return;

    setGuardandoCompra(true);
    try {
      const creada = await fiscalApi.crearCompraFiscal({
        empresaId,
        codigoProv: Number(formCompra.codigoProv),
        fechaCompra: `${formCompra.fecha}T12:00:00`,
        numeroFactura: formCompra.numeroFactura,
        numeroControl: formCompra.numeroControl || null,
        tipoTransaccion: formCompra.tipoTransaccion,
        // El formulario fiscal captura en BOLÍVARES: TipoMoneda VES le indica al
        // backend que los costos llegan en CostoUnitarioMonedaExt (Bs. exactos).
        tipoMoneda: 'VES',
        tasaDeCambio: Number(tasa) || 1,
        aplicaLibroCompras: true,
        esGastoServicio: false,
        detalles: lineasCompra.map(l => ({
          codigoProd: l.codigoProd,
          idProductoUnidad: Number(l.idProductoUnidad),
          unidadCompra: l.unidad,
          cantidad: Number(l.cantidad),
          // En modo VES la verdad fiscal vive en *MonedaExt (Bs.).
          costoUnitarioMonedaBase: 0,
          costoUnitarioMonedaExt: Number(l.costo),
          tasaIVA: Number(l.tasaIVA)
        }))
      });

      if (contabilizarAuto && creada?.id) {
        try {
          const r = await fiscalApi.contabilizarCompra(creada.id);
          if (!r.generada) alert(`⚠️ Compra registrada, pero el comprobante no se generó:\n${r.advertencia || r.mensaje || ''}${guiaCuentasBase(r.advertencia)}`);
        } catch (errorC) {
          alert(`⚠️ Compra registrada; el comprobante contable falló:\n${mensajeErrorApi(errorC)}`);
        }
      }

      alert('✅ Compra fiscal registrada (sin efectos en inventario).');
      setMostrarForm(false);
      await cargarCompras();
    } catch (error) {
      console.error('Error creando compra fiscal:', error);
      alert(`❌ No se pudo registrar la compra fiscal:\n${mensajeErrorApi(error)}`);
    } finally {
      setGuardandoCompra(false);
    }
  };

  const guardarGasto = async () => {
    if (!formGasto.fecha) { alert('⚠️ Indique la fecha del gasto (debe estar dentro del periodo contable abierto).'); return; }
    if (!formGasto.concepto.trim()) { alert('⚠️ Indique el concepto del gasto.'); return; }
    if (!formGasto.conceptoId) { alert('⚠️ Seleccione el concepto contable (GASTO).'); return; }
    if (!formGasto.numeroFactura?.trim()) { alert('⚠️ Indique el N° de factura/documento del gasto (dato obligatorio del Libro de Compras).'); return; }
    if (!formGasto.numeroControl?.trim()) {
      alert('⚠️ Indique el N° de control del gasto (dato obligatorio del Libro de Compras).\n\nSi el documento no tiene control (p. ej. boleta de pago), escriba «S/N».');
      return;
    }
    if (!(Number(formGasto.monto) > 0)) { alert('⚠️ El monto debe ser mayor a cero.'); return; }
    // Gasto GRAVADO (IVA > 0) ⇒ exige proveedor con RIF: su base aporta crédito
    // fiscal al Libro de Compras y el RIF del proveedor es obligatorio ahí.
    if (alicuotaGasto > 0 && !formGasto.codigoProv) {
      alert('⚠️ Los gastos con IVA (crédito fiscal) requieren proveedor con RIF.\n\nSeleccione el proveedor o registre el gasto como EXENTO si aplica.');
      return;
    }
    // Retención ISLR desde el formulario (modo híbrido): exige sujeto retenido.
    if (islrEnGasto && !formGasto.codigoProv) {
      alert('⚠️ Marcó «Emitir retención ISLR»: seleccione el proveedor (sujeto retenido con RIF) o desmarque la casilla.');
      return;
    }
    // Capturas previas al confirm (el estado se limpia tras guardar).
    const emitirIslrAlFinalizar = islrEnGasto;
    const conceptoGastoId = formGasto.conceptoId;
    const codigoProvGasto = formGasto.codigoProv;

    const tasaDia = Number(tasa) || 1;
    const etiquetaIva = alicuotaGasto === 0
      ? 'exento de IVA'
      : `IVA ${alicuotaGasto}%: Bs. ${fmt(ivaGastoBs)} (total Bs. ${fmt(baseGastoBs + ivaGastoBs)})`;

    const confirmado = window.confirm(
      `Registrar el gasto «${formGasto.concepto}» por Bs. ${fmt(baseGastoBs)} — ${etiquetaIva}.\n\n` +
      'El monto es la BASE sin IVA; el gasto es un documento fiscal propio: NO toca inventario ni compras.' +
      (contabilizarGastoAuto ? ' Se generará su comprobante contable (Debe Gastos + IVA Crédito / Haber Caja o Proveedores).' : '')
    );
    if (!confirmado) return;

    setGuardandoGasto(true);
    try {
      const creado = await fiscalApi.crearGasto({
        empresaId,
        fecha: `${formGasto.fecha}T12:00:00`,
        concepto: formGasto.concepto.trim(),
        // Concepto operacional (puente con el plan de cuentas): su CuentaContable
        // define la cuenta del Debe del comprobante contable.
        conceptoOperacionalId: Number(formGasto.conceptoId),
        codigoProv: formGasto.codigoProv ? Number(formGasto.codigoProv) : null,
        // Datos fiscales del documento soporte (columnas N° Factura/N° Control
        // y Tipo de transacción del Libro de Compras SENIAT).
        numeroFactura: formGasto.numeroFactura.trim(),
        numeroControl: formGasto.numeroControl.trim(),
        tipoTransaccion: formGasto.tipoTransaccion,
        // Verdad fiscal en Bs. EXACTOS (montoMonedaExt/ivaMonedaExt) + moneda
        // base USD derivada con la tasa para el asiento contable.
        monto: Number((baseGastoBs / tasaDia).toFixed(2)),
        montoMonedaExt: baseGastoBs,
        ivaMonedaExt: ivaGastoBs,
        tasaDeCambio: tasaDia
      });

      if (contabilizarGastoAuto && creado?.id) {
        try {
          const r = await fiscalApi.contabilizarGasto(creado.id);
          if (!r.generada) alert(`⚠️ Gasto registrado, pero el comprobante no se generó:\n${r.advertencia || r.mensaje || ''}${guiaCuentasBase(r.advertencia)}`);
        } catch (errorC) {
          alert(`⚠️ Gasto registrado; el comprobante contable falló:\n${mensajeErrorApi(errorC)}`);
        }
      }

      alert('✅ Gasto fiscal registrado.');
      setMostrarForm(false);
      setIslrEnGasto(false);
      await cargarCompras();

      // Modo híbrido ISLR: si se pidió emitir la retención al finalizar, se
      // abre el modal de emisión con el gasto creado y el concepto ISLR
      // sugerido por el concepto GASTO preseleccionado (la emisión sigue
      // siendo explícita: el usuario confirma y puede cambiar el concepto).
      if (emitirIslrAlFinalizar && creado?.id) {
        const conceptoSel = conceptosGasto.find((x) => Number(x.id) === Number(conceptoGastoId));
        const prov = proveedores.find((p) => Number(p.codigoProv) === Number(codigoProvGasto)) || null;
        await abrirModalIslr({
          gasto: { ...creado, proveedor: prov },
          conceptoId: conceptoSel?.conceptoIslrSugeridoId || ''
        });
      }
    } catch (error) {
      console.error('Error creando gasto:', error);
      alert(`❌ No se pudo registrar el gasto:\n${mensajeErrorApi(error)}`);
    } finally {
      setGuardandoGasto(false);
    }
  };

  const contabilizarGastoAccion = async (g) => {
    const confirmado = window.confirm(`Generar el comprobante contable del gasto «${g.concepto}»? (idempotente: no se duplica)`);
    if (!confirmado) return;
    try {
      const r = await fiscalApi.contabilizarGasto(g.id);
      if (r.generada) alert(`✅ Comprobante ${r.numeroComprobante} generado.\nDebe/Haber: ${fmt(r.totalDebe)}`);
      else alert(`⚠️ ${r.mensaje || 'No se generó el comprobante.'}\n${r.advertencia || ''}${guiaCuentasBase(r.advertencia)}`);
      await cargarCompras();
    } catch (error) {
      console.error('Error contabilizando el gasto:', error);
      alert(`❌ No se pudo contabilizar:\n${mensajeErrorApi(error)}`);
    }
  };

  // Libro COMBINADO (facturas de compra + gastos) para la vista previa y la
  // exportación a PDF/Excel: un solo documento con todas las operaciones del
  // período, sus alícuotas y su concepto contable.
  const totalesComprasReporte = {
    ...totales,
    retenciones: totalRetenido
  };
  const reporteLibro = estructuraLibroCompras({
    empresa: empresaActiva,
    periodo: periodoActivo,
    totales: totalesComprasReporte,
    compras,
    gastos,
    retencionPorCompra
  });

  // Lista COMBINADA facturas + gastos ordenada por fecha (una sola tabla de
  // consulta/edición en lugar de las antiguas pestañas separadas).
  const documentosCombinados = [
    ...compras.map((c) => ({ tipo: 'FACTURA', fecha: c.fechaCompra, datos: c })),
    ...gastos.map((g) => ({ tipo: 'GASTO', fecha: g.fecha, datos: g }))
  ].sort((a, b) => new Date(a.fecha) - new Date(b.fecha));

  const hayContexto = Boolean(empresaId && fechaInicio && fechaFin);

  return (
    <div style={{ padding: '24px', color: '#e2e8f0', minHeight: '80vh' }}>
      {/* Cabecera con el contexto global (empresa/periodo) que rige el libro */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px',
        background: '#1e293b', padding: '16px 20px', borderRadius: '12px', border: '1px solid #334155', marginBottom: '20px'
      }}>
        <div>
          <h2 style={{ margin: '0 0 4px 0', color: '#34d399', fontSize: '1.2rem' }}>📗 Libro de Compras · IVA (SENIAT)</h2>
          <span style={{ color: '#94a3b8', fontSize: '0.85rem' }}>
            🏢 <b style={{ color: '#60a5fa' }}>{empresaActiva?.razonSocial || empresaActiva?.nombre || '—'}</b>
            {' · '}📅 {formatearFecha(fechaInicio)} al {formatearFecha(fechaFin)}
            {' · '}<b style={{ color: '#fbbf24' }}>{periodoActivo?.nombre || 'Sin periodo'}</b>
          </span>
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button
            onClick={() => abrirFormUnico('FACTURA')}
            disabled={!hayContexto || cargando}
            style={{
              background: '#059669', color: '#fff', border: 'none', borderRadius: '8px',
              padding: '10px 16px', cursor: hayContexto && !cargando ? 'pointer' : 'not-allowed',
              fontWeight: 'bold', opacity: hayContexto ? 1 : 0.5
            }}
            title="Registrar una factura de compra o un gasto fiscal (un solo formulario, sin inventario)"
          >
            ➕ Nuevo documento fiscal
          </button>
          <button
            onClick={alternarConsultas}
            disabled={!hayContexto}
            style={{
              background: mostrarConsultas ? '#0ea5e9' : '#2563eb', color: '#fff', border: 'none', borderRadius: '8px',
              padding: '10px 16px', cursor: hayContexto ? 'pointer' : 'not-allowed', fontWeight: 'bold',
              opacity: hayContexto ? 1 : 0.5
            }}
            title="Consultar y editar los documentos del libro del periodo (carga bajo demanda)"
          >
            {mostrarConsultas ? '📋 Cerrar consultas' : '🔍 Consultas y edición'}
          </button>
          <button
            onClick={alternarReporte}
            disabled={!hayContexto}
            style={{
              background: mostrarReporte ? '#f59e0b' : '#d97706', color: '#fff', border: 'none', borderRadius: '8px',
              padding: '10px 16px', cursor: hayContexto ? 'pointer' : 'not-allowed', fontWeight: 'bold',
              opacity: hayContexto ? 1 : 0.5
            }}
            title="Vista previa del libro combinado (facturas + gastos) con exportación a PDF y Excel"
          >
            {mostrarReporte ? '📄 Cerrar reportes' : '📊 Reportes'}
          </button>
          {mostrarConsultas && (
            <button
              onClick={cargarCompras}
              disabled={cargando}
              style={{
                background: '#475569', color: '#fff', border: 'none', borderRadius: '8px',
                padding: '10px 16px', cursor: cargando ? 'wait' : 'pointer', fontWeight: 'bold'
              }}
            >
              {cargando ? '⏳ Cargando…' : '🔄 Recargar'}
            </button>
          )}
        </div>
      </div>

      {/* --- PANEL DE REPORTES: vista previa del libro COMBINADO + PDF/Excel --- */}
      {hayContexto && mostrarReporte && (
        <div style={{ background: '#0f172a', padding: '24px', borderRadius: '12px', border: '1px solid #f59e0b', marginBottom: '20px' }}>
          {/* Botonera de exportación */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px', marginBottom: '20px' }}>
            <h3 style={{ margin: 0, color: '#fbbf24', fontSize: '1.05rem' }}>📊 Vista previa: {reporteLibro.titulo}</h3>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button
                onClick={() => exportarLibroXls(reporteLibro)}
                style={{ display: 'flex', alignItems: 'center', gap: '8px', background: '#16a34a', color: '#fff', border: 'none', borderRadius: '8px', padding: '10px 16px', cursor: 'pointer', fontWeight: 'bold' }}
              >
                📊 Descargar Excel
              </button>
              <button
                onClick={() => exportarLibroPdf(reporteLibro)}
                style={{ display: 'flex', alignItems: 'center', gap: '8px', background: '#dc2626', color: '#fff', border: 'none', borderRadius: '8px', padding: '10px 16px', cursor: 'pointer', fontWeight: 'bold' }}
              >
                📄 Descargar PDF
              </button>
            </div>
          </div>

          {cargando ? (
            <div style={{ textAlign: 'center', padding: '40px', color: '#94a3b8' }}>⏳ Cargando el libro para el reporte…</div>
          ) : (
            <div style={{ background: '#ffffff', color: '#000000', padding: '20px', borderRadius: '8px', overflowX: 'auto' }}>
              {/* Membrete del documento */}
              <div style={{ marginBottom: '14px', fontSize: '0.85rem' }}>
                <div style={{ fontWeight: 'bold' }}>{(empresaActiva?.razonSocial || empresaActiva?.nombre || 'EMPRESA').toUpperCase()}</div>
                <div>RIF {empresaActiva?.rif || '—'}</div>
                <div>{reporteLibro.titulo} del {formatearFecha(fechaInicio)} al {formatearFecha(fechaFin)}</div>
                <div>Expresado en Bs. (moneda fiscal)</div>
              </div>

              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
                <thead>
                  <tr style={{ borderBottom: '1.5px solid #000' }}>
                    {reporteLibro.columnas.map((col, idx) => (
                      <th key={`col-${idx}`} style={{ textAlign: esColumnaMonto(reporteLibro, idx) ? 'right' : 'left', padding: '8px 4px', fontWeight: 'bold' }}>{col}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {reporteLibro.filas.length === 0 ? (
                    <tr>
                      <td colSpan={reporteLibro.columnas.length} style={{ textAlign: 'center', padding: '20px', color: '#64748b' }}>
                        No hay documentos en el periodo para generar el libro.
                      </td>
                    </tr>
                  ) : reporteLibro.filas.map((fila, idxFila) => (
                    <tr key={`rep-${idxFila}`} style={{ borderBottom: '1px solid #e5e7eb' }}>
                      {fila.map((celda, idxCelda) => (
                        <td key={idxCelda} style={{ textAlign: esColumnaMonto(reporteLibro, idxCelda) ? 'right' : 'left', padding: '5px 4px' }}>
                          {celda}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr style={{ borderTop: '1.5px solid #000', fontWeight: 'bold' }}>
                    {reporteLibro.totales.map((total, idx) => (
                      <td key={idx} style={{ textAlign: esColumnaMonto(reporteLibro, idx) ? 'right' : 'left', padding: '10px 4px' }}>{total}</td>
                    ))}
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </div>
      )}

      {!hayContexto ? (
        <div style={{ background: '#1e293b', border: '1px solid #f59e0b', color: '#fcd34d', padding: '16px', borderRadius: '10px' }}>
          ⚠️ Seleccione una empresa y un periodo contable en el menú lateral para cargar el Libro de Compras.
        </div>
      ) : (
        <>
          {/*
            FORMULARIO ÚNICO: FACTURA (compra con líneas de producto) o GASTO
            (concepto contable + alícuota en Bs.). El selector decide el modo;
            en el backend cada uno sigue creando su entidad (Compra / Gasto).
          */}
          {mostrarForm && (
            <div style={{ background: '#1e293b', border: `1px solid ${tipoAlta === 'FACTURA' ? '#16a34a' : '#f59e0b'}`, borderRadius: '12px', padding: '20px', marginBottom: '20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px', marginBottom: '6px' }}>
                <h3 style={{ margin: 0, color: tipoAlta === 'FACTURA' ? '#34d399' : '#fbbf24', fontSize: '1.05rem' }}>➕ Nuevo documento fiscal</h3>
                <div style={{ display: 'flex', gap: '6px' }}>
                  {[{ id: 'FACTURA', etiqueta: '🧾 Factura de compra' }, { id: 'GASTO', etiqueta: '💸 Gasto' }].map((t) => (
                    <button
                      key={t.id}
                      onClick={() => abrirFormUnico(t.id)}
                      style={{
                        background: tipoAlta === t.id ? (t.id === 'FACTURA' ? '#34d399' : '#f59e0b') : '#0f172a',
                        color: tipoAlta === t.id ? '#052e16' : '#94a3b8',
                        border: '1px solid #334155', borderRadius: '8px',
                        padding: '7px 14px', cursor: 'pointer', fontWeight: 'bold', fontSize: '0.82rem'
                      }}
                    >
                      {t.etiqueta}
                    </button>
                  ))}
                </div>
              </div>
              <p style={{ margin: '0 0 14px 0', color: '#94a3b8', fontSize: '0.8rem' }}>
                {tipoAlta === 'FACTURA'
                  ? 'Documento declarativo: NO afecta el inventario (sin aumento de stock, sin costos, sin kardex).'
                  : 'Documento propio del módulo fiscal: NO toca inventario ni compras. Requiere periodo contable ABIERTO.'}
              </p>

              {tipoAlta === 'FACTURA' && (
                <>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '12px', marginBottom: '14px' }}>
                    <div>
                      <label style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Fecha</label>
                      <input type="date" value={formCompra.fecha} onChange={(e) => setFormCompra({ ...formCompra, fecha: e.target.value })} style={inputChico} />
                    </div>
                    <div>
                      <label style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Proveedor</label>
                      <select value={formCompra.codigoProv} onChange={(e) => setFormCompra({ ...formCompra, codigoProv: e.target.value })} style={inputChico}>
                        <option value="">Seleccione…</option>
                        {proveedores.map((p) => (
                          <option key={p.codigoProv} value={p.codigoProv}>{p.razonsocial} ({p.rif || 'S/RIF'})</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label style={{ fontSize: '0.75rem', color: '#94a3b8' }}>N° Factura *</label>
                      <input type="text" value={formCompra.numeroFactura} onChange={(e) => setFormCompra({ ...formCompra, numeroFactura: e.target.value })} placeholder="F-0001" style={inputChico} />
                    </div>
                    <div>
                      <label style={{ fontSize: '0.75rem', color: '#94a3b8' }}>N° Control {formCompra.tipoTransaccion === '01' ? '*' : '(opcional 02/03)'}</label>
                      <input type="text" value={formCompra.numeroControl} onChange={(e) => setFormCompra({ ...formCompra, numeroControl: e.target.value })} placeholder="00-00000000 (o S/N)" style={inputChico} />
                    </div>
                    <div>
                      <label style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Tipo (SENIAT)</label>
                      <select value={formCompra.tipoTransaccion} onChange={(e) => setFormCompra({ ...formCompra, tipoTransaccion: e.target.value })} style={inputChico}>
                        {TIPOS_TRANSACCION.map((t) => <option key={t.valor} value={t.valor}>{t.etiqueta}</option>)}
                      </select>
                    </div>
                  </div>

                  <div style={{ position: 'relative', marginBottom: '10px' }}>
                    <input
                      type="text"
                      value={buscadorProd}
                      onChange={(e) => buscarProdFiscal(e.target.value)}
                      placeholder="🔍 Buscar producto para agregar una línea…"
                      style={{ ...inputChico, width: '100%' }}
                    />
                    {resultadosProd.length > 0 && (
                      <div style={{ position: 'absolute', left: 0, right: 0, top: '100%', zIndex: 30, background: '#0f172a', border: '1px solid #334155', borderRadius: '8px', maxHeight: '220px', overflowY: 'auto' }}>
                        {resultadosProd.map((p) => (
                          <div key={`${p.idProductoUnidad}-${p.codigoProd}`} onClick={() => agregarLineaCompra(p)} style={{ padding: '8px 12px', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #1f2937' }}>
                            <span style={{ fontSize: '0.8rem' }}>{p.descripcion} <b style={{ color: '#94a3b8' }}>({p.unidad})</b></span>
                            <b style={{ color: '#34d399' }}>Bs. {(Number(p.costoUSD || p.costoUnitarioMonedaBase || p.precioUSD || 0) * (Number(tasa) || 1)).toFixed(2)} · IVA {p.porcentajeIva || 0}%</b>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {lineasCompra.length > 0 && (
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem', marginBottom: '12px' }}>
                      <thead>
                        <tr style={{ color: '#86efac', textAlign: 'left' }}>
                          <th style={{ padding: '6px' }}>Producto</th>
                          <th style={{ padding: '6px' }}>Cant.</th>
                          <th style={{ padding: '6px' }}>Costo (Bs.)</th>
                          <th style={{ padding: '6px' }}>IVA %</th>
                          <th style={{ padding: '6px', textAlign: 'right' }}>IVA (Bs.)</th>
                          <th style={{ padding: '6px', textAlign: 'right' }}>Subtotal (Bs.)</th>
                          <th style={{ padding: '6px' }}></th>
                        </tr>
                      </thead>
                      <tbody>
                        {lineasCompra.map((l, idx) => (
                          <tr key={`${l.idProductoUnidad}-${idx}`} style={{ borderTop: '1px solid #1f2937' }}>
                            <td style={{ padding: '6px' }}>{l.descripcion} <span style={{ color: '#64748b' }}>({l.unidad})</span></td>
                            <td style={{ padding: '6px' }}>
                              <input type="number" min="0.001" step="0.001" value={l.cantidad} onChange={(e) => modificarLineaCompra(idx, 'cantidad', e.target.value)} style={{ ...inputChico, width: '80px' }} />
                            </td>
                            <td style={{ padding: '6px' }}>
                              <input type="number" min="0" step="0.01" value={l.costo} onChange={(e) => modificarLineaCompra(idx, 'costo', e.target.value)} style={{ ...inputChico, width: '90px' }} />
                            </td>
                            <td style={{ padding: '6px' }}>
                              <select value={l.tasaIVA} onChange={(e) => modificarLineaCompra(idx, 'tasaIVA', Number(e.target.value))} style={inputChico}>
                                <option value={0}>0%</option>
                                <option value={8}>8%</option>
                                <option value={16}>16%</option>
                              </select>
                            </td>
                            <td style={{ padding: '6px', textAlign: 'right' }}>
                              {Number(l.tasaIVA) === 0
                                ? <span style={{ background: '#334155', color: '#cbd5e1', borderRadius: '6px', padding: '1px 6px', fontSize: '0.7rem', fontWeight: 'bold' }}>EXENTO</span>
                                : fmt(Number(l.costo) * Number(l.cantidad) * (Number(l.tasaIVA) / 100))}
                            </td>
                            <td style={{ padding: '6px', textAlign: 'right' }}>{fmt(Number(l.costo) * Number(l.cantidad))}</td>
                            <td style={{ padding: '6px', textAlign: 'center' }}>
                              <button onClick={() => quitarLineaCompra(idx)} title="Quitar línea" style={{ background: '#7f1d1d', color: '#fff', border: 'none', borderRadius: '5px', padding: '3px 8px', cursor: 'pointer' }}>🗑️</button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
                    <div style={{ fontSize: '0.85rem', lineHeight: '1.7' }}>
                      <div>
                        <b style={{ color: '#94a3b8' }}>Exento:</b> Bs. {fmt(totalesFormCompra.exento)}
                        {' · '}<b style={{ color: '#a78bfa' }}>Base 8%:</b> Bs. {fmt(totalesFormCompra.base8)}
                        {' + '}<b style={{ color: '#a78bfa' }}>IVA 8%:</b> Bs. {fmt(totalesFormCompra.iva8)}
                        {' · '}<b style={{ color: '#34d399' }}>Base 16%:</b> Bs. {fmt(totalesFormCompra.base16)}
                        {' + '}<b style={{ color: '#34d399' }}>IVA 16%:</b> Bs. {fmt(totalesFormCompra.iva16)}
                      </div>
                      <div>
                        <b>Base:</b> Bs. {fmt(totalesFormCompra.subtotal)} · <b>IVA:</b> Bs. {fmt(totalesFormCompra.iva)} ·{' '}
                        <b style={{ color: '#34d399', fontSize: '1.05rem' }}>Total: Bs. {fmt(totalesFormCompra.total)}</b>
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                      <label style={{ fontSize: '0.8rem', color: '#cbd5e1', display: 'flex', gap: '6px', alignItems: 'center' }}>
                        <input type="checkbox" checked={contabilizarAuto} onChange={(e) => setContabilizarAuto(e.target.checked)} />
                        🧾 Contabilizar automáticamente
                      </label>
                      <button onClick={() => setMostrarForm(false)} style={{ background: '#475569', color: '#fff', border: 'none', borderRadius: '8px', padding: '9px 16px', cursor: 'pointer', fontWeight: 'bold' }}>Cancelar</button>
                      <button onClick={guardarCompraFiscal} disabled={guardandoCompra} style={{ background: '#16a34a', color: '#fff', border: 'none', borderRadius: '8px', padding: '9px 18px', cursor: guardandoCompra ? 'wait' : 'pointer', fontWeight: 'bold', opacity: guardandoCompra ? 0.6 : 1 }}>
                        {guardandoCompra ? '⏳ Guardando…' : '💾 Guardar factura'}
                      </button>
                    </div>
                  </div>
                </>
              )}

              {/* --- MODO GASTO: concepto contable + alícuota (Bs.) --- */}
              {tipoAlta === 'GASTO' && (
                <>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: '12px', marginBottom: '14px' }}>
                    <div>
                      <label style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Fecha</label>
                      <input type="date" value={formGasto.fecha} onChange={(e) => setFormGasto({ ...formGasto, fecha: e.target.value })} style={inputChico} />
                    </div>
                    <div style={{ gridColumn: 'span 2' }}>
                      <label style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Concepto</label>
                      <input type="text" value={formGasto.concepto} onChange={(e) => setFormGasto({ ...formGasto, concepto: e.target.value })} placeholder="Ej: Pago de servicios públicos" style={inputChico} />
                    </div>
                    <div>
                      <label style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Concepto Contable</label>
                      <select
                        value={formGasto.conceptoId}
                        onChange={(e) => {
                          const concepto = conceptosGasto.find((x) => Number(x.id) === Number(e.target.value));
                          setFormGasto({ ...formGasto, conceptoId: e.target.value });
                          // Modo híbrido ISLR: si el concepto está marcado «sujeta
                          // a ISLR» se premarca la casilla de emisión (siempre
                          // desmarcable: la emisión es explícita por documento).
                          setIslrEnGasto(Boolean(concepto?.aplicaRetencionIslr));
                        }}
                        style={inputChico}
                      >
                        <option value="">Seleccione un concepto…</option>
                        {conceptosGasto.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.nombreConcepto} (Cta: {c.cuentaContable}{c.aplicaRetencionIslr ? ' · 📑 ISLR' : ''})
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
                        Proveedor {alicuotaGasto > 0 ? '*' : '(opcional)'}
                      </label>
                      <select value={formGasto.codigoProv} onChange={(e) => setFormGasto({ ...formGasto, codigoProv: e.target.value })} style={inputChico}>
                        <option value="">— Caja —</option>
                        {proveedores.map((p) => (
                          <option key={p.codigoProv} value={p.codigoProv}>{p.razonsocial} ({p.rif || 'S/RIF'})</option>
                        ))}
                      </select>
                      {alicuotaGasto > 0 && (
                        <span style={{ fontSize: '0.7rem', color: '#fbbf24' }}>Obligatorio: gasto gravado ⇒ crédito fiscal con RIF.</span>
                      )}
                    </div>
                  </div>

                  {/* --- DATOS FISCALES DEL DOCUMENTO SOPORTE (Libro de Compras) --- */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: '12px', marginBottom: '14px' }}>
                    <div>
                      <label style={{ fontSize: '0.75rem', color: '#94a3b8' }}>N° Factura/Documento *</label>
                      <input type="text" value={formGasto.numeroFactura} onChange={(e) => setFormGasto({ ...formGasto, numeroFactura: e.target.value })} placeholder="F-0001 / Boleta" style={inputChico} />
                    </div>
                    <div>
                      <label style={{ fontSize: '0.75rem', color: '#94a3b8' }}>N° Control *</label>
                      <input type="text" value={formGasto.numeroControl} onChange={(e) => setFormGasto({ ...formGasto, numeroControl: e.target.value })} placeholder="00-00000000 (o S/N)" style={inputChico} />
                    </div>
                    <div>
                      <label style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Tipo (SENIAT)</label>
                      <select value={formGasto.tipoTransaccion} onChange={(e) => setFormGasto({ ...formGasto, tipoTransaccion: e.target.value })} style={inputChico}>
                        {TIPOS_TRANSACCION.map((t) => <option key={t.valor} value={t.valor}>{t.etiqueta}</option>)}
                      </select>
                    </div>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: '12px', marginBottom: '14px' }}>
                    <div>
                      <label style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Monto base (Bs.) — sin IVA</label>
                      <input type="number" min="0.01" step="0.01" value={formGasto.monto} onChange={(e) => setFormGasto({ ...formGasto, monto: e.target.value })} placeholder="0.00" style={inputChico} />
                    </div>
                    <div>
                      <label style={{ fontSize: '0.75rem', color: '#93c5fd' }}>Alícuota IVA</label>
                      <select value={formGasto.alicuota} onChange={(e) => setFormGasto({ ...formGasto, alicuota: e.target.value })} style={{ ...inputChico, width: '100%' }}>
                        <option value="0">0% — EXENTO</option>
                        <option value="8">8% — reducida</option>
                        <option value="16">16% — general</option>
                      </select>
                    </div>
                    <div>
                      <label style={{ fontSize: '0.75rem', color: '#93c5fd' }}>IVA (Bs.) — calculado</label>
                      <input
                        type="text"
                        readOnly
                        value={alicuotaGasto === 0 ? 'EXENTO' : fmt(ivaGastoBs)}
                        style={{ ...inputChico, width: '100%', background: '#111827', color: alicuotaGasto === 0 ? '#94a3b8' : '#93c5fd', cursor: 'not-allowed' }}
                      />
                      {alicuotaGasto > 0 && baseGastoBs > 0 && (
                        <span style={{ fontSize: '0.7rem', color: '#64748b' }}>Total con IVA: Bs. {fmt(baseGastoBs + ivaGastoBs)}</span>
                      )}
                    </div>
                  </div>

                  {/* --- SUJECIÓN A ISLR (MODO HÍBRIDO): el concepto GASTO puede
                      marcarlo; la emisión sigue siendo SIEMPRE explícita
                      (casilla desmarcable y confirmación en el modal). --- */}
                  {(() => {
                    const conceptoSel = conceptosGasto.find((x) => Number(x.id) === Number(formGasto.conceptoId));
                    if (!conceptoSel?.aplicaRetencionIslr) return null;
                    return (
                      <div style={{ background: '#0c2947', border: '1px solid #2563eb', borderRadius: '8px', padding: '10px 14px', marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                        <label style={{ fontSize: '0.82rem', color: '#93c5fd', display: 'flex', gap: '6px', alignItems: 'center', cursor: 'pointer', fontWeight: 'bold' }}>
                          <input type="checkbox" checked={islrEnGasto} onChange={(e) => setIslrEnGasto(e.target.checked)} />
                          📑 Emitir retención ISLR al finalizar
                        </label>
                        <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
                          El concepto «{conceptoSel.nombreConcepto}» está marcado como sujeto a ISLR
                          {Number(conceptoSel.conceptoIslrSugeridoId) > 0 ? ' (concepto ISLR sugerido preseleccionado)' : ''}.
                          La emisión es explícita por documento: se confirma en el modal y el monto se congela en Bs. con correlativo SENIAT.
                        </span>
                      </div>
                    );
                  })()}

                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', alignItems: 'center' }}>
                    <label style={{ fontSize: '0.8rem', color: '#cbd5e1', display: 'flex', gap: '6px', alignItems: 'center' }}>
                      <input type="checkbox" checked={contabilizarGastoAuto} onChange={(e) => setContabilizarGastoAuto(e.target.checked)} />
                      🧾 Contabilizar automáticamente
                    </label>
                    <button onClick={() => setMostrarForm(false)} style={{ background: '#475569', color: '#fff', border: 'none', borderRadius: '8px', padding: '9px 16px', cursor: 'pointer', fontWeight: 'bold' }}>Cancelar</button>
                    <button onClick={guardarGasto} disabled={guardandoGasto} style={{ background: '#16a34a', color: '#fff', border: 'none', borderRadius: '8px', padding: '9px 18px', cursor: guardandoGasto ? 'wait' : 'pointer', fontWeight: 'bold', opacity: guardandoGasto ? 0.6 : 1 }}>
                      {guardandoGasto ? '⏳ Guardando…' : '💾 Guardar gasto'}
                    </button>
                  </div>
                </>
              )}
            </div>
          )}

          {/* --- CONSULTA Y EDICIÓN DEL LIBRO (bajo demanda) --- */}
          {mostrarConsultas && (
            <>
          {/* Resumen COMBINADO del período (facturas + gastos con sus alícuotas) */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '12px', marginBottom: '20px' }}>
            {[
              { etiqueta: 'Documentos (facturas + gastos)', valor: totales.documentos, entero: true, color: '#60a5fa' },
              { etiqueta: 'Exentas', valor: totales.exento, color: '#94a3b8' },
              { etiqueta: 'Base 8%', valor: totales.base8, color: '#a78bfa' },
              { etiqueta: 'Base 16%', valor: totales.base16, color: '#34d399' },
              { etiqueta: 'IVA Crédito Fiscal', valor: totales.iva, color: '#fbbf24' },
              { etiqueta: 'IVA Retenido (75/100)', valor: totalRetenido, color: '#f472b6' },
              { etiqueta: 'Total (facturas + gastos)', valor: totales.total, color: '#fff' }
            ].map((c) => (
              <div key={c.etiqueta} style={{ background: '#0f172a', border: '1px solid #334155', borderRadius: '10px', padding: '12px' }}>
                <div style={{ fontSize: '0.7rem', color: '#94a3b8', marginBottom: '4px' }}>{c.etiqueta}</div>
                <div style={{ fontSize: '1.05rem', fontWeight: 'bold', color: c.color }}>
                  {c.entero ? c.valor : fmt(c.valor)}
                </div>
              </div>
            ))}
          </div>

          {cargando ? (
            <div style={{ textAlign: 'center', padding: '40px', color: '#94a3b8' }}>⏳ Cargando el libro (facturas y gastos)…</div>
          ) : documentosCombinados.length === 0 ? (
            <div style={{ background: '#0f172a', border: '1px dashed #475569', padding: '30px', textAlign: 'center', borderRadius: '12px', color: '#94a3b8' }}>
              No hay facturas de compra ni gastos registrados en el periodo seleccionado.
            </div>
          ) : (
            <div style={{ background: '#111827', borderRadius: '12px', overflowX: 'auto', border: '1px solid #334155' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                <thead>
                  <tr style={{ background: '#1e293b', color: '#86efac' }}>
                    <th style={thStyle}>Fecha</th>
                    <th style={thStyle}>Tipo</th>
                    <th style={thStyle}>Documento / Concepto</th>
                    <th style={thStyle}>Proveedor (RIF)</th>
                    <th style={thStyle}>Concepto Contable</th>
                    <th style={{ ...thStyle, textAlign: 'right' }}>Exento</th>
                    <th style={{ ...thStyle, textAlign: 'right' }}>Base 8%</th>
                    <th style={{ ...thStyle, textAlign: 'right' }}>Base 16%</th>
                    <th style={{ ...thStyle, textAlign: 'right' }}>IVA Crédito</th>
                    <th style={{ ...thStyle, textAlign: 'right' }}>Total</th>
                    <th style={thStyle}>Retenciones</th>
                    <th style={thStyle}>Comprobante</th>
                    <th style={{ ...thStyle, textAlign: 'center' }}>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {documentosCombinados.map(({ tipo, datos: c }) => {
                    const esGasto = tipo === 'GASTO';
                    const d = esGasto ? desgloseGasto(c) : desgloseCompra(c);
                    const editando = !esGasto && editandoId === c.id;
                    const proveedor = c.proveedor || {};
                    return (
                      <tr key={`${tipo}-${c.id}`} style={{ background: c.isAnulada ? '#2d1215' : 'transparent', opacity: c.isAnulada ? 0.7 : 1 }}>
                        <td style={tdStyle}>{formatearFecha(esGasto ? c.fecha : c.fechaCompra)}</td>
                        <td style={tdStyle}>
                          {esGasto ? (
                            <span style={{ background: '#78350f', color: '#fbbf24', padding: '2px 8px', borderRadius: '10px', fontSize: '0.75rem', fontWeight: 'bold' }}>💸 GASTO</span>
                          ) : (
                            <span style={{ background: '#064e3b', color: '#6ee7b7', padding: '2px 8px', borderRadius: '10px', fontSize: '0.75rem', fontWeight: 'bold' }}>🧾 FACTURA</span>
                          )}
                        </td>
                        <td style={tdStyle}>
                          {esGasto ? (
                            <>
                              <span>{c.concepto}</span>
                              <span style={{ display: 'block', color: '#94a3b8', fontSize: '0.72rem', fontFamily: 'monospace' }}>
                                {c.numeroFactura || '—'} · {c.numeroControl || '—'} · {d.alicuota === 0 ? 'EXENTO' : `IVA ${d.alicuota}%`}
                              </span>
                            </>
                          ) : editando ? (
                            <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexWrap: 'wrap' }}>
                              <select
                                value={formFiscal.tipoTransaccion}
                                onChange={(e) => setFormFiscal({ ...formFiscal, tipoTransaccion: e.target.value })}
                                style={inputChico}
                              >
                                {TIPOS_TRANSACCION.map((t) => <option key={t.valor} value={t.valor}>{t.etiqueta}</option>)}
                              </select>
                              <input
                                type="text"
                                value={formFiscal.numeroControl}
                                onChange={(e) => setFormFiscal({ ...formFiscal, numeroControl: e.target.value })}
                                placeholder="N° Control 00-000000"
                                style={{ ...inputChico, width: '140px' }}
                              />
                            </div>
                          ) : (
                            <>
                              <span style={{ fontFamily: 'monospace' }}>{c.numeroFactura || '—'}</span>
                              {c.isAnulada && <span style={{ color: '#f87171', marginLeft: '6px', fontSize: '0.7rem' }}>ANULADA</span>}
                              <span style={{ display: 'block', color: '#94a3b8', fontFamily: 'monospace', fontSize: '0.75rem' }}>
                                {c.numeroControl || '—'}
                              </span>
                            </>
                          )}
                        </td>
                        <td style={tdStyle}>
                          <b>{proveedor.razonsocial || (esGasto ? '— CAJA —' : '—')}</b>
                          <span style={{ display: 'block', color: '#94a3b8', fontSize: '0.75rem' }}>{proveedor.rif || 'S/RIF'}</span>
                        </td>
                        <td style={tdStyle}>
                          {esGasto
                            ? <b style={{ color: '#fbbf24' }}>{c.categoria || 'GASTO'}</b>
                            : (c.esGastoServicio ? 'Gastos' : 'Compras')}
                        </td>
                        <td style={{ ...tdStyle, textAlign: 'right' }}>{fmt(d.exento)}</td>
                        <td style={{ ...tdStyle, textAlign: 'right' }}>{fmt(d.base8)}</td>
                        <td style={{ ...tdStyle, textAlign: 'right' }}>{fmt(d.base16)}</td>
                        <td style={{ ...tdStyle, textAlign: 'right', color: '#fbbf24' }}>{fmt(d.iva)}</td>
                        <td style={{ ...tdStyle, textAlign: 'right', fontWeight: 'bold' }}>{fmt(d.total)}</td>
                        <td style={tdStyle}>
                          {esGasto ? (
                            retencionIslrPorGasto.has(Number(c.id)) ? (
                              <span style={{ color: '#60a5fa', fontSize: '0.75rem', fontWeight: 'bold' }}>
                                📑 ISLR {retencionIslrPorGasto.get(Number(c.id)).numeroComprobante}
                              </span>
                            ) : (
                              <span style={{ color: '#64748b' }}>—</span>
                            )
                          ) : (
                            <>
                              {retencionPorCompra.has(Number(c.id)) && (
                                <span style={{ display: 'block', color: '#f472b6', fontSize: '0.75rem', fontWeight: 'bold' }}>
                                  🧮 IVA {retencionPorCompra.get(Number(c.id)).numeroComprobante} ({retencionPorCompra.get(Number(c.id)).porcentajeRetencion}%)
                                </span>
                              )}
                              {retencionIslrPorCompra.has(Number(c.id)) && (
                                <span style={{ display: 'block', color: '#60a5fa', fontSize: '0.75rem', fontWeight: 'bold' }}>
                                  📑 ISLR {retencionIslrPorCompra.get(Number(c.id)).numeroComprobante}
                                </span>
                              )}
                              {!retencionPorCompra.has(Number(c.id)) && !retencionIslrPorCompra.has(Number(c.id)) && (
                                <span style={{ color: '#64748b' }}>—</span>
                              )}
                            </>
                          )}
                        </td>
                        <td style={tdStyle}>
                          {c.asientoContableId
                            ? <span style={{ color: '#34d399', fontWeight: 'bold' }}>✅ Asiento #{c.asientoContableId}</span>
                            : <span style={{ color: '#64748b' }}>— sin comprobante</span>}
                        </td>
                        <td style={{ ...tdStyle, textAlign: 'center', whiteSpace: 'nowrap' }}>
                          {esGasto ? (
                            <>
                              {c.asientoContableId ? (
                                <span style={{ color: '#34d399', fontWeight: 'bold' }} title={`Asiento #${c.asientoContableId}`}>✅</span>
                              ) : (
                                <button
                                  onClick={() => contabilizarGastoAccion(c)}
                                  title="Generar comprobante contable del gasto"
                                  style={{ background: '#1d4ed8', color: '#fff', border: 'none', borderRadius: '5px', padding: '5px 9px', cursor: 'pointer' }}
                                >
                                  🧾
                                </button>
                              )}
                              {/* Retención de ISLR del gasto (Decreto 1.808): emisión o impresión */}
                              <button
                                onClick={() => retencionIslrPorGasto.has(Number(c.id))
                                  ? generarComprobanteISLR(retencionIslrPorGasto.get(Number(c.id)), c, empresaActiva)
                                  : abrirModalIslr({ gasto: c })}
                                disabled={c.isAnulada || !c.proveedor?.rif}
                                title={!c.proveedor?.rif
                                  ? 'El gasto debe tener proveedor con RIF para emitir retención de ISLR'
                                  : retencionIslrPorGasto.has(Number(c.id))
                                    ? 'Imprimir comprobante de retención de ISLR (Decreto 1.808)'
                                    : 'Emitir comprobante de retención de ISLR (Decreto 1.808)'}
                                style={{
                                  background: retencionIslrPorGasto.has(Number(c.id)) ? '#16a34a' : '#2563eb',
                                  color: '#fff', border: 'none', borderRadius: '5px', padding: '5px 9px',
                                  cursor: c.isAnulada || !c.proveedor?.rif ? 'not-allowed' : 'pointer',
                                  marginLeft: '6px',
                                  opacity: c.isAnulada || !c.proveedor?.rif ? 0.5 : 1
                                }}
                              >
                                {retencionIslrPorGasto.has(Number(c.id)) ? '🖨️ ISLR' : '📑 ISLR'}
                              </button>
                            </>
                          ) : editando ? (
                            <>
                              <button onClick={() => guardarFiscal(c)} title="Guardar" style={{ background: '#16a34a', color: '#fff', border: 'none', borderRadius: '5px', padding: '5px 9px', cursor: 'pointer', fontWeight: 'bold', marginRight: '6px' }}>💾</button>
                              <button onClick={() => setEditandoId(null)} title="Cancelar" style={{ background: '#475569', color: '#fff', border: 'none', borderRadius: '5px', padding: '5px 9px', cursor: 'pointer' }}>✕</button>
                            </>
                          ) : (
                            <>
                              <button
                                onClick={() => abrirEdicion(c)}
                                disabled={c.isAnulada}
                                title="Editar datos fiscales (tipo de transacción y N° Control)"
                                style={{ background: '#3b82f6', color: '#fff', border: 'none', borderRadius: '5px', padding: '5px 9px', cursor: c.isAnulada ? 'not-allowed' : 'pointer', marginRight: '6px', opacity: c.isAnulada ? 0.4 : 1 }}
                              >
                                ✏️
                              </button>
                              <button
                                onClick={() => contabilizar(c)}
                                disabled={c.isAnulada || procesandoId !== null}
                                title={c.asientoContableId ? 'Ya tiene comprobante (no se duplica)' : 'Generar el comprobante contable de esta compra'}
                                style={{
                                  background: c.asientoContableId ? '#064e3b' : '#7c3aed', color: '#fff', border: 'none',
                                  borderRadius: '5px', padding: '5px 9px',
                                  cursor: c.isAnulada || procesandoId !== null ? 'not-allowed' : 'pointer',
                                  opacity: c.isAnulada ? 0.4 : 1
                                }}
                              >
                                {procesandoId === c.id ? '⏳' : '🧾'}
                              </button>
                              <button
                                onClick={() => emitirRetencion(c)}
                                disabled={c.isAnulada || retencionPorCompra.has(Number(c.id))}
                                title={retencionPorCompra.has(Number(c.id))
                                  ? 'La factura ya tiene comprobante de retención de IVA'
                                  : 'Emitir comprobante de retención de IVA (75% o 100%) con correlativo SENIAT'}
                                style={{
                                  background: retencionPorCompra.has(Number(c.id)) ? '#4c1d95' : '#b45309',
                                  color: '#fff', border: 'none', borderRadius: '5px', padding: '5px 9px',
                                  cursor: (c.isAnulada || retencionPorCompra.has(Number(c.id))) ? 'not-allowed' : 'pointer',
                                  marginLeft: '6px',
                                  opacity: (c.isAnulada || retencionPorCompra.has(Number(c.id))) ? 0.6 : 1
                                }}
                              >
                                {retencionPorCompra.has(Number(c.id)) ? '🖨️' : '🧮'}
                              </button>
                              {/* Retención de ISLR (Decreto 1.808): emisión o impresión */}
                              <button
                                onClick={() => retencionIslrPorCompra.has(Number(c.id))
                                  ? generarComprobanteISLR(retencionIslrPorCompra.get(Number(c.id)), c, empresaActiva)
                                  : abrirModalIslr({ compra: c })}
                                disabled={c.isAnulada}
                                title={retencionIslrPorCompra.has(Number(c.id))
                                  ? 'Imprimir comprobante de retención de ISLR (Decreto 1.808)'
                                  : 'Emitir comprobante de retención de ISLR (Decreto 1.808)'}
                                style={{
                                  background: retencionIslrPorCompra.has(Number(c.id)) ? '#16a34a' : '#2563eb',
                                  color: '#fff', border: 'none', borderRadius: '5px', padding: '5px 9px',
                                  cursor: c.isAnulada ? 'not-allowed' : 'pointer',
                                  marginLeft: '6px',
                                  opacity: c.isAnulada ? 0.6 : 1
                                }}
                              >
                                {retencionIslrPorCompra.has(Number(c.id)) ? '🖨️ ISLR' : '📑 ISLR'}
                              </button>
                              {/* Si ya hay retención de IVA emitida, botón de impresión */}
                              {retencionPorCompra.has(Number(c.id)) && (
                                <button
                                  onClick={() => generarComprobanteIVA(retencionPorCompra.get(Number(c.id)), c, empresaActiva, periodoActivo)}
                                  title="Imprimir comprobante de retención de IVA"
                                  style={{
                                    background: '#16a34a', color: '#fff', border: 'none', borderRadius: '5px',
                                    padding: '5px 9px', cursor: 'pointer', marginLeft: '6px'
                                  }}
                                >
                                  🖨️
                                </button>
                              )}
                            </>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
            </>
          )}
        </>
      )}

      {/* --- MODAL DE EMISIÓN DE RETENCIÓN DE ISLR (Decreto 1.808) --- */}
      {modalIslr && (() => {
        const docIslr = modalIslr.compra || modalIslr.gasto;
        const proveedorIslr = docIslr?.proveedor || {};
        return (
        <div
          onClick={(e) => { if (e.target === e.currentTarget) setModalIslr(null); }}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 }}
        >
          <div role="dialog" aria-modal="true" style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '12px', padding: '24px', width: '560px', maxHeight: '90vh', overflowY: 'auto' }}>
            <h3 style={{ margin: '0 0 4px 0', color: '#60a5fa', fontSize: '1.1rem' }}>📑 Retención de ISLR (Decreto 1.808)</h3>
            <p style={{ color: '#94a3b8', fontSize: '0.82rem', margin: '0 0 16px 0' }}>
              {modalIslr.gasto ? 'Gasto' : 'Factura'} <b>{docIslr?.numeroFactura || '(s/n)'}</b>
              {modalIslr.gasto && <> · <b>{docIslr.concepto || ''}</b></>}
              {' · '}Proveedor <b>{proveedorIslr.razonsocial || '—'}</b>
              ({proveedorIslr.rif || 'S/RIF'})
            </p>

            <label style={{ fontSize: '0.78rem', color: '#93c5fd', fontWeight: 'bold' }}>Concepto de retención (catálogo Decreto 1.808):</label>
            <select
              value={modalIslr.conceptoId}
              onChange={(e) => setModalIslr({ ...modalIslr, conceptoId: e.target.value })}
              style={{ background: '#0f172a', color: '#fff', border: '1px solid #475569', borderRadius: '6px', padding: '9px 10px', width: '100%', marginTop: '6px' }}
            >
              <option value="">Seleccione el concepto…</option>
              {conceptosIslr.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.codigoSeniat} — {c.nombreConcepto} ({c.tipoPersona} {c.porcentajeRetencion}%)
                </option>
              ))}
            </select>

            {/* Vista previa del cálculo con el concepto elegido */}
            {modalIslr.conceptoId && (() => {
              const concepto = conceptosIslr.find((x) => Number(x.id) === Number(modalIslr.conceptoId));
              if (!concepto) return null;
              const baseBs = baseImponibleIslrBs(modalIslr.compra || modalIslr.gasto, Boolean(modalIslr.gasto));
              const pct = Number(concepto.porcentajeRetencion ?? 0);
              const sustraendo = concepto.aplicaSustraendo ? Number(concepto.montoSustraendoBs ?? 0) : 0;
              const neto = Math.max(0, baseBs * pct / 100 - sustraendo);
              return (
                <div style={{ background: '#0f172a', border: '1px solid #334155', borderRadius: '8px', padding: '14px', marginTop: '16px', fontSize: '0.85rem', lineHeight: '1.8' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: '#94a3b8' }}>Base imponible (Bs.)</span><b>{fmt(baseBs)}</b></div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: '#94a3b8' }}>Tarifa</span><b>{pct}%</b></div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: '#94a3b8' }}>Sustraendo (Bs.)</span><b style={{ color: sustraendo > 0 ? '#34d399' : '#64748b' }}>{fmt(sustraendo)}</b></div>
                  <div style={{ borderTop: '1px solid #334155', marginTop: '8px', paddingTop: '8px', display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: '#94a3b8', fontWeight: 'bold' }}>Monto a retener (Bs.)</span>
                    <b style={{ color: '#fbbf24', fontSize: '1rem' }}>{fmt(neto)}</b>
                  </div>
                </div>
              );
            })()}

            <div style={{ display: 'flex', gap: '10px', marginTop: '20px', justifyContent: 'flex-end' }}>
              <button onClick={() => setModalIslr(null)} style={{ background: '#475569', color: '#fff', border: 'none', borderRadius: '8px', padding: '9px 16px', cursor: 'pointer', fontWeight: 'bold' }}>Cancelar</button>
              <button
                onClick={emitirRetencionIslr}
                disabled={!modalIslr.conceptoId || emitiendoIslr}
                style={{
                  background: '#1d4ed8', color: '#fff', border: 'none', borderRadius: '8px', padding: '9px 18px',
                  cursor: !modalIslr.conceptoId || emitiendoIslr ? 'not-allowed' : 'pointer',
                  fontWeight: 'bold', opacity: !modalIslr.conceptoId || emitiendoIslr ? 0.6 : 1
                }}
              >
                {emitiendoIslr ? '⏳ Emitiendo…' : '📑 Emitir retención ISLR'}
              </button>
            </div>
          </div>
        </div>
        );
      })()}
    </div>
  );
}