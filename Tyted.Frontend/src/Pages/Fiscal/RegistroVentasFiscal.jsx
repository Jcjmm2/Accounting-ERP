import { useState, useContext, useEffect, useCallback } from 'react';
import { ConfigContext } from '../../Context/ConfigContext';
import { fiscalApi, mensajeErrorApi } from '../../Services/Fiscal/FiscalApi';
import {
  estructuraLibroVentas,
  exportarLibroPdf,
  exportarLibroXls,
  esColumnaMonto
} from './reportesLibrosFiscal';

// ---------------------------------------------------------------------------
// HELPERS FISCALES (Libro de Ventas SENIAT)
// ---------------------------------------------------------------------------

const fmt = (v) => Number(v ?? 0).toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const formatearFecha = (fecha) => {
  if (!fecha) return '—';
  const partes = String(fecha).split(/[-T]/);
  if (partes.length >= 3) return `${partes[2].slice(0, 2)}/${partes[1]}/${partes[0]}`;
  const d = new Date(fecha);
  return isNaN(d.getTime()) ? fecha : d.toLocaleDateString('es-VE');
};

// Tipo de transacción SENIAT (Providencia SNAT/2015/0049)
const TIPOS_TRANSACCION = [
  { valor: '01', etiqueta: '01 Registro' },
  { valor: '02', etiqueta: '02 Complemento' },
  { valor: '03', etiqueta: '03 Anulación' }
];

// Desglose fiscal: exentas (líneas con IVA 0), base gravada e IVA débito.
const desgloseVenta = (venta) => {
  const lineas = venta?.detalles?.$values || venta?.detalles || [];
  const base = Number(venta?.subtotalMonedaBase ?? 0)
    || lineas.reduce((s, l) => s + Number(l.subtotalLineaMonedaBase ?? 0), 0);
  const iva = Number(venta?.ivaMonedaBase ?? 0);
  const total = Number(venta?.totalMonedaBase ?? 0) || base + iva;
  const exento = lineas
    .filter((l) => Number(l.tasaIVA ?? 0) === 0)
    .reduce((s, l) => s + Number(l.subtotalLineaMonedaBase ?? 0), 0);
  return { base, exento, baseGravada: Math.max(base - exento, 0), iva, total };
};

const thStyle = { padding: '10px 8px', textAlign: 'left', fontWeight: 'bold', whiteSpace: 'nowrap' };
const tdStyle = { padding: '8px', borderTop: '1px solid #1f2937', verticalAlign: 'middle' };
const inputChico = {
  background: '#0f172a', color: '#fff', border: '1px solid #475569',
  borderRadius: '6px', padding: '6px 8px', fontSize: '0.8rem'
};

// Cuando el motor aborta por cuentas base ausentes (caja/CxC, IVA o ingresos),
// amplía el aviso con el paso a paso para corregirlo desde la UI (plan de
// cuentas o panel de conceptos SISTEMA), en vez de dejar sólo el código.
const guiaCuentasBase = (texto) => {
  if (!texto || !String(texto).includes('No se encontraron activas')) return '';
  return '\n\n🔧 Cómo corregirlo:\n' +
    '1) Contabilidad → Plan de Cuentas: cree/reactive la(s) cuenta(s) indicada(s) y verifique que estén ACTIVAS y sean de MOVIMIENTO.\n' +
    '2) O bien 🧮 Conceptos → pestaña ⚙️ SISTEMA: reasigne la cuenta base (CAJA_PRINCIPAL, CXC_CLIENTES, IVA_DEBITO…).\n' +
    '3) Vuelva a pulsar 🧾 (el proceso es idempotente: no duplica el asiento).';
};

// ---------------------------------------------------------------------------
// REGISTRO DE VENTAS (LIBRO DE VENTAS IVA): alimenta la parte fiscal con sus
// comprobantes contables (integración BE-F4). El selector global de
// empresa/periodo rige el rango de fechas consultado.
// ---------------------------------------------------------------------------
export default function RegistroVentasFiscal() {
  const { empresaActiva, periodoActivo, tasa } = useContext(ConfigContext);

  const [ventas, setVentas] = useState([]);
  const [cargando, setCargando] = useState(false);
  const [editandoId, setEditandoId] = useState(null);
  const [formFiscal, setFormFiscal] = useState({ tipoTransaccion: '01', numeroControl: '' });
  const [procesandoId, setProcesandoId] = useState(null);

  // --- ALTA DE VENTA FISCAL (sin caja, sin stock, sin kardex) ---
  const [mostrarForm, setMostrarForm] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [contabilizarAuto, setContabilizarAuto] = useState(true);
  const [clientes, setClientes] = useState([]);
  const [formVenta, setFormVenta] = useState({
    fecha: new Date().toISOString().slice(0, 10),
    clienteId: '',
    tipoTransaccion: '01',
    numeroControl: ''
  });
  const [lineas, setLineas] = useState([]);
  // Conceptos de ingreso (catálogo por empresa, tipo VENTA): sustituyen al
  // buscador de productos en el módulo fiscal (ventas sin inventario). Su
  // CuentaContable genera el Haber del asiento contable por línea.
  const [conceptosIngreso, setConceptosIngreso] = useState([]);
  const [nuevaLinea, setNuevaLinea] = useState({
    conceptoId: '',
    descripcion: '',
    cantidad: 1,
    precio: '',
    tasaIVA: 16
  });

  // --- RESUMEN DE VENTAS DE LA MÁQUINA FISCAL (cierre Z, Libro SENIAT) ---
  const [resumenes, setResumenes] = useState([]);
  const [mostrarResumen, setMostrarResumen] = useState(false);
  const [guardandoResumen, setGuardandoResumen] = useState(false);
  const [contabilizarResumenAuto, setContabilizarResumenAuto] = useState(true);
  const [formResumen, setFormResumen] = useState({
    fecha: new Date().toISOString().slice(0, 10),
    numeroControlMaquina: '',
    numeroZ: '',
    facturaDesde: '',
    facturaHasta: '',
    tipoTransaccion: '01',
    exento: '',
    baseGravada: '',
    iva: ''
  });

  const empresaId = Number(empresaActiva?.id ?? 0);
  const fechaInicio = periodoActivo?.fechaInicio;
  const fechaFin = periodoActivo?.fechaFin;

  // --- CONSULTA Bajo DEMANDA Y PANEL DE REPORTES ---
  // El libro NO se lista al entrar a la página: el usuario lo carga con el
  // botón «🔍 Consultas y edición» o al generar un reporte.
  const [mostrarConsultas, setMostrarConsultas] = useState(false);
  const [mostrarReporte, setMostrarReporte] = useState(false);

  const cargarVentas = useCallback(async () => {
    if (!empresaId || !fechaInicio || !fechaFin) {
      setVentas([]);
      setResumenes([]);
      return;
    }
    setCargando(true);
    try {
      const data = await fiscalApi.getVentas({ fechaInicio, fechaFin, empresaId });
      setVentas(Array.isArray(data) ? data : (data?.$values || []));
      // Resúmenes de la máquina fiscal (cierre Z) del mismo periodo/empresa;
      // un fallo aquí no debe impedir ver las facturas del libro.
      try {
        const res = await fiscalApi.getResumenesVentas({ fechaInicio, fechaFin, empresaId });
        setResumenes(Array.isArray(res) ? res : (res?.$values || []));
      } catch (errorRes) {
        console.warn('Error cargando los resúmenes de ventas:', errorRes);
        setResumenes([]);
      }
    } catch (error) {
      console.error('Error cargando el Libro de Ventas:', error);
      alert(`❌ No se pudo cargar el Libro de Ventas:\n${mensajeErrorApi(error)}`);
    } finally {
      setCargando(false);
    }
  }, [empresaId, fechaInicio, fechaFin]);

  // NOTA: el libro ya NO se carga automáticamente al entrar ni al cambiar de
  // contexto; se consulta bajo demanda (botón «🔍 Consultas y edición» o
  // «📊 Reportes»). Si el contexto cambia con el libro abierto, se recarga.
  useEffect(() => {
    if (mostrarConsultas || mostrarReporte) cargarVentas();
  }, [cargarVentas, mostrarConsultas, mostrarReporte]);

  // Apertura/cierre del panel de consultas (la carga la dispara el useEffect)
  const alternarConsultas = () => setMostrarConsultas((v) => !v);

  // Resumen del período (formato SENIAT): facturas + resúmenes de la máquina
  const totales = ventas.reduce((acc, v) => {
    const d = desgloseVenta(v);
    acc.documentos += 1;
    acc.exento += d.exento;
    acc.baseGravada += d.baseGravada;
    acc.iva += d.iva;
    acc.total += d.total;
    if (v.isAnulada) acc.anuladas += 1;
    return acc;
  }, { documentos: 0, exento: 0, baseGravada: 0, iva: 0, total: 0, anuladas: 0 });

  const totalesResumen = resumenes.reduce((acc, r) => {
    acc.documentos += 1;
    acc.exento += Number(r.exento ?? 0);
    acc.baseGravada += Number(r.baseGravada ?? 0);
    acc.iva += Number(r.iva ?? 0);
    acc.total += Number(r.total ?? 0);
    if (r.isAnulada) acc.anuladas += 1;
    return acc;
  }, { documentos: 0, exento: 0, baseGravada: 0, iva: 0, total: 0, anuladas: 0 });

  const totalesLibro = {
    documentos: totales.documentos + totalesResumen.documentos,
    exento: totales.exento + totalesResumen.exento,
    baseGravada: totales.baseGravada + totalesResumen.baseGravada,
    iva: totales.iva + totalesResumen.iva,
    total: totales.total + totalesResumen.total,
    anuladas: totales.anuladas + totalesResumen.anuladas
  };

  // Documentos del libro fusionados y ordenados por fecha: facturas (Ventas) +
  // resúmenes de la máquina fiscal (cierre Z).
  const documentosLibro = [
    ...ventas.map((v) => ({ esResumen: false, dato: v })),
    ...resumenes.map((r) => ({ esResumen: true, dato: r }))
  ].sort((a, b) => {
    const fa = new Date(a.dato.fechaVenta || a.dato.fecha).getTime();
    const fb = new Date(b.dato.fechaVenta || b.dato.fecha).getTime();
    return fb - fa;
  });

  const abrirEdicion = (v) => {
    setEditandoId(v.ventaId);
    setFormFiscal({ tipoTransaccion: v.tipoTransaccion || '01', numeroControl: v.numeroControl || '' });
  };

  const guardarFiscal = async (v) => {
    if (!['01', '02', '03'].includes(formFiscal.tipoTransaccion)) {
      alert('⚠️ Tipo de transacción inválido: use 01, 02 o 03.');
      return;
    }
    try {
      await fiscalApi.actualizarFiscalVenta(v.ventaId, {
        tipoTransaccion: formFiscal.tipoTransaccion,
        numeroControl: formFiscal.numeroControl || null
      });
      setEditandoId(null);
      await cargarVentas();
    } catch (error) {
      console.error('Error guardando datos fiscales:', error);
      alert(`❌ No se pudo actualizar el documento:\n${mensajeErrorApi(error)}`);
    }
  };

  const contabilizar = async (v) => {
    const confirmado = window.confirm(
      `Generar el comprobante contable de la factura ${v.numeroFactura || '(s/n)'}?\n\n` +
      'El motor creará el asiento de diario (partida doble) y lo vinculará a la venta. Idempotente: no se duplicará.'
    );
    if (!confirmado) return;

    setProcesandoId(v.ventaId);
    try {
      const r = await fiscalApi.contabilizarVenta(v.ventaId);
      if (r.generada) {
        alert(`✅ Comprobante ${r.numeroComprobante} generado.\nDebe/Haber: ${fmt(r.totalDebe)}`);
      } else {
        alert(`⚠️ ${r.mensaje || 'No se generó el comprobante.'}\n${r.advertencia || ''}${guiaCuentasBase(r.advertencia)}`);
      }
      await cargarVentas();
    } catch (error) {
      console.error('Error contabilizando la venta:', error);
      alert(`❌ No se pudo contabilizar:\n${mensajeErrorApi(error)}`);
    } finally {
      setProcesandoId(null);
    }
  };

  // -------------------------------------------------------------------------
  // ALTA DE VENTA FISCAL
  // -------------------------------------------------------------------------
  const totalesForm = lineas.reduce((acc, l) => {
    const base = Number(l.precio) * Number(l.cantidad);
    acc.subtotal += base;
    acc.iva += base * (Number(l.tasaIVA) / 100);
    return acc;
  }, { subtotal: 0, iva: 0 });
  totalesForm.total = totalesForm.subtotal + totalesForm.iva;

  // Montos del formulario de resumen (total = exento + base gravada + IVA)
  const montosResumenForm = {
    exento: Number(formResumen.exento) || 0,
    baseGravada: Number(formResumen.baseGravada) || 0,
    iva: Number(formResumen.iva) || 0
  };
  montosResumenForm.total = montosResumenForm.exento + montosResumenForm.baseGravada + montosResumenForm.iva;

  const abrirFormVentaFiscal = async () => {
    setFormVenta({
      fecha: new Date().toISOString().slice(0, 10),
      clienteId: '',
      tipoTransaccion: '01',
      numeroControl: ''
    });
    setLineas([]);
    setNuevaLinea({ conceptoId: '', descripcion: '', cantidad: 1, precio: '', tasaIVA: 16 });
    setMostrarResumen(false);
    setMostrarForm(true);
    if (clientes.length === 0) {
      try {
        const data = await fiscalApi.getClientes();
        setClientes(Array.isArray(data) ? data : (data?.$values || []));
      } catch (error) {
        console.warn('Error cargando clientes:', error);
      }
    }
    // Categorías de ingreso (conceptos tipo VENTA) de la empresa activa:
    // sustituyen al buscador de productos en la venta fiscal declarativa.
    if (conceptosIngreso.length === 0) {
      try {
        const data = await fiscalApi.getConceptos({ empresaId, tipo: 'VENTA' });
        setConceptosIngreso(Array.isArray(data) ? data : (data?.$values || []));
      } catch (error) {
        console.warn('Error cargando conceptos de ingreso:', error);
      }
    }
  };

  // --- RESUMEN DE VENTAS DE LA MÁQUINA FISCAL (cierre Z) ---
  const abrirFormResumen = () => {
    setFormResumen({
      fecha: new Date().toISOString().slice(0, 10),
      numeroControlMaquina: '',
      numeroZ: '',
      facturaDesde: '',
      facturaHasta: '',
      tipoTransaccion: '01',
      exento: '',
      baseGravada: '',
      iva: ''
    });
    setMostrarForm(false);
    setMostrarResumen(true);
  };

  // Agrega una línea al formulario de factura única basada en un CONCEPTO de
  // ingreso (sin inventario, sin productos): descripción libre + precio + IVA.
  const agregarLineaNueva = () => {
    if (!nuevaLinea.conceptoId) { alert('⚠️ Seleccione la categoría de ingreso (concepto).'); return; }
    if (!(Number(nuevaLinea.cantidad) > 0)) { alert('⚠️ La cantidad debe ser mayor a cero.'); return; }
    if (!(Number(nuevaLinea.precio) > 0)) { alert('⚠️ Asigne un precio a la línea.'); return; }
    setLineas((prev) => [...prev, { ...nuevaLinea }]);
    setNuevaLinea({ conceptoId: '', descripcion: '', cantidad: 1, precio: '', tasaIVA: 16 });
  };

  const modificarLinea = (idx, campo, valor) => {
    setLineas(prev => prev.map((l, i) => (i === idx ? { ...l, [campo]: valor } : l)));
  };

  const quitarLinea = (idx) => {
    setLineas(prev => prev.filter((_, i) => i !== idx));
  };

  const guardarVentaFiscal = async () => {
    if (lineas.length === 0) { alert('⚠️ Agregue al menos una línea a la venta fiscal.'); return; }
    if (!formVenta.clienteId) { alert('⚠️ Seleccione el cliente.'); return; }
    if (lineas.some(l => Number(l.cantidad) <= 0 || Number(l.precio) < 0)) {
      alert('⚠️ Revise cantidades y precios de las líneas.'); return;
    }

    const confirmado = window.confirm(
      'Registrar la venta fiscal (documento declarativo).\n\n' +
      'NO afecta el Punto de Venta ni el inventario: sin caja, sin descuento de stock y sin kardex.' +
      (contabilizarAuto ? '\nSe generará además su comprobante contable.' : '')
    );
    if (!confirmado) return;

    setGuardando(true);
    try {
      const creada = await fiscalApi.crearVentaFiscal({
        empresaId,
        clienteId: Number(formVenta.clienteId),
        fechaVenta: `${formVenta.fecha}T12:00:00`,
        tipoTransaccion: formVenta.tipoTransaccion,
        numeroControl: formVenta.numeroControl || null,
        esCredito: false,
        usuario: 'FISCAL',
        tasaDeCambio: Number(tasa) || 1,
        tasaDia: Number(tasa) || 1,
        detalles: lineas.map(l => ({
          // Líneas por CONCEPTO DE INGRESO (sin inventario): el backend valida
          // el concepto (tipo VENTA, misma empresa) y su CuentaContable genera
          // el Haber del asiento contable.
          conceptoOperacionalId: Number(l.conceptoId),
          descripcionFiscal: l.descripcion || null,
          cantidad: Number(l.cantidad),
          precioUnitarioMonedaBase: Number(l.precio),
          tasaIVA: Number(l.tasaIVA)
        }))
      });

      if (contabilizarAuto && creada?.ventaId) {
        try {
          const r = await fiscalApi.contabilizarVenta(creada.ventaId);
          if (!r.generada) alert(`⚠️ Venta registrada, pero el comprobante no se generó:\n${r.advertencia || r.mensaje || ''}${guiaCuentasBase(r.advertencia)}`);
        } catch (errorC) {
          alert(`⚠️ Venta registrada; el comprobante contable falló:\n${mensajeErrorApi(errorC)}`);
        }
      }

      alert(`✅ Venta fiscal ${creada.numeroFactura || ''} registrada (sin efectos en caja ni inventario).`);
      setMostrarForm(false);
      await cargarVentas();
    } catch (error) {
      console.error('Error creando venta fiscal:', error);
      alert(`❌ No se pudo registrar la venta fiscal:\n${mensajeErrorApi(error)}`);
    } finally {
      setGuardando(false);
    }
  };

  // -------------------------------------------------------------------------
  // ALTA DE RESUMEN DE VENTAS DE LA MÁQUINA FISCAL (cierre Z)
  // -------------------------------------------------------------------------
  const guardarResumen = async () => {
    const { fecha, numeroControlMaquina, numeroZ, facturaDesde, facturaHasta, exento, baseGravada, iva } = formResumen;
    if (!fecha) { alert('⚠️ Indique la fecha del resumen (cierre Z).'); return; }
    if (!numeroControlMaquina.trim()) { alert('⚠️ Indique el N° de control de la máquina fiscal.'); return; }
    if (!numeroZ.trim()) { alert('⚠️ Indique el N° Z.'); return; }
    if (!facturaDesde.trim() || !facturaHasta.trim()) { alert('⚠️ Indique el rango de facturas del resumen (Desde/Hasta).'); return; }
    if (/^\d+$/.test(facturaDesde.trim()) && /^\d+$/.test(facturaHasta.trim())
      && Number(facturaDesde.trim()) > Number(facturaHasta.trim())) {
      alert('⚠️ La factura «Desde» no puede ser mayor que la «Hasta».');
      return;
    }

    const montoExento = Number(exento) || 0;
    const montoBase = Number(baseGravada) || 0;
    const montoIva = Number(iva) || 0;
    if (montoExento + montoBase + montoIva <= 0) {
      alert('⚠️ Registre los montos del resumen (exento, base gravada e IVA).');
      return;
    }

    const confirmado = window.confirm(
      `Registrar el resumen de ventas Z ${numeroZ} (${facturaDesde} – ${facturaHasta}) por ${fmt(montoExento + montoBase + montoIva)}?\n\n` +
      'Documento declarativo del Libro de Ventas SENIAT: NO afecta caja ni inventario.' +
      (contabilizarResumenAuto ? '\nSe generará además UN comprobante contable por resumen (Debe Caja | Haber Ingresos + IVA).' : '')
    );
    if (!confirmado) return;

    setGuardandoResumen(true);
    try {
      const creado = await fiscalApi.crearResumenVenta({
        empresaId,
        fecha: `${fecha}T12:00:00`,
        numeroControlMaquina: numeroControlMaquina.trim(),
        numeroZ: numeroZ.trim(),
        facturaDesde: facturaDesde.trim(),
        facturaHasta: facturaHasta.trim(),
        exento: montoExento,
        baseGravada: montoBase,
        iva: montoIva,
        total: montoExento + montoBase + montoIva,
        tipoTransaccion: formResumen.tipoTransaccion
      });

      if (contabilizarResumenAuto && creado?.id) {
        try {
          const resp = await fiscalApi.contabilizarResumenVenta(creado.id);
          if (!resp.generada) alert(`⚠️ Resumen registrado, pero el comprobante no se generó:\n${resp.advertencia || resp.mensaje || ''}${guiaCuentasBase(resp.advertencia)}`);
        } catch (errorC) {
          alert(`⚠️ Resumen registrado; el comprobante contable falló:\n${mensajeErrorApi(errorC)}`);
        }
      }

      alert('✅ Resumen de ventas de la máquina fiscal registrado.');
      setMostrarResumen(false);
      await cargarVentas();
    } catch (error) {
      console.error('Error creando el resumen de ventas:', error);
      alert(`❌ No se pudo registrar el resumen:\n${mensajeErrorApi(error)}`);
    } finally {
      setGuardandoResumen(false);
    }
  };

  const contabilizarResumen = async (r) => {
    const confirmado = window.confirm(
      `Generar el comprobante contable del resumen Z ${r.numeroZ} (${r.facturaDesde} – ${r.facturaHasta})?\n\n` +
      'Partida doble: Debe Caja | Haber Ingresos + IVA Débito Fiscal. Idempotente: no se duplicará.'
    );
    if (!confirmado) return;

    setProcesandoId(`R${r.id}`);
    try {
      const resp = await fiscalApi.contabilizarResumenVenta(r.id);
      if (resp.generada) {
        alert(`✅ Comprobante ${resp.numeroComprobante} generado.\nDebe/Haber: ${fmt(resp.totalDebe)}`);
      } else {
        alert(`⚠️ ${resp.mensaje || 'No se generó el comprobante.'}\n${resp.advertencia || ''}${guiaCuentasBase(resp.advertencia)}`);
      }
      await cargarVentas();
    } catch (error) {
      console.error('Error contabilizando el resumen de ventas:', error);
      alert(`❌ No se pudo contabilizar el resumen:\n${mensajeErrorApi(error)}`);
    } finally {
      setProcesandoId(null);
    }
  };

  // Estructura del reporte (Libro de Ventas) para la vista previa y la
  // exportación a PDF/Excel; se recalcula con los datos actualmente cargados.
  const reporteLibro = estructuraLibroVentas({
    empresa: empresaActiva,
    periodo: periodoActivo,
    totales: totalesLibro,
    documentos: documentosLibro
  });

  const hayContexto = Boolean(empresaId && fechaInicio && fechaFin);

  return (
    <div style={{ padding: '24px', color: '#e2e8f0', minHeight: '80vh' }}>
      {/* Cabecera con el contexto global (empresa/periodo) que rige el libro */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px',
        background: '#1e293b', padding: '16px 20px', borderRadius: '12px', border: '1px solid #334155', marginBottom: '20px'
      }}>
        <div>
          <h2 style={{ margin: '0 0 4px 0', color: '#f87171', fontSize: '1.2rem' }}>📕 Libro de Ventas · IVA (SENIAT)</h2>
          <span style={{ color: '#94a3b8', fontSize: '0.85rem' }}>
            🏢 <b style={{ color: '#60a5fa' }}>{empresaActiva?.razonSocial || empresaActiva?.nombre || '—'}</b>
            {' · '}📅 {formatearFecha(fechaInicio)} al {formatearFecha(fechaFin)}
            {' · '}<b style={{ color: '#fbbf24' }}>{periodoActivo?.nombre || 'Sin periodo'}</b>
          </span>
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button
            onClick={abrirFormVentaFiscal}
            disabled={!hayContexto || cargando}
            style={{
              background: '#059669', color: '#fff', border: 'none', borderRadius: '8px',
              padding: '10px 16px', cursor: hayContexto && !cargando ? 'pointer' : 'not-allowed',
              fontWeight: 'bold', opacity: hayContexto ? 1 : 0.5
            }}
            title="Registrar una factura fiscal única (declarativa, sin caja ni inventario)"
          >
            ➕ Factura única
          </button>
          <button
            onClick={abrirFormResumen}
            disabled={!hayContexto || cargando}
            style={{
              background: '#7c3aed', color: '#fff', border: 'none', borderRadius: '8px',
              padding: '10px 16px', cursor: hayContexto && !cargando ? 'pointer' : 'not-allowed',
              fontWeight: 'bold', opacity: hayContexto ? 1 : 0.5
            }}
            title="Registrar el resumen de ventas de la máquina fiscal (N° Z + rango de facturas)"
          >
            📋 Resumen de ventas
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
            onClick={() => setMostrarReporte(!mostrarReporte)}
            disabled={!hayContexto}
            style={{
              background: mostrarReporte ? '#f59e0b' : '#d97706', color: '#fff', border: 'none', borderRadius: '8px',
              padding: '10px 16px', cursor: hayContexto ? 'pointer' : 'not-allowed', fontWeight: 'bold',
              opacity: hayContexto ? 1 : 0.5
            }}
            title="Vista previa del Libro de Ventas con exportación a PDF y Excel"
          >
            {mostrarReporte ? '📄 Cerrar reportes' : '📊 Reportes'}
          </button>
          {mostrarConsultas && (
            <button
              onClick={cargarVentas}
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

      {!hayContexto ? (
        <div style={{ background: '#1e293b', border: '1px solid #f59e0b', color: '#fcd34d', padding: '16px', borderRadius: '10px' }}>
          ⚠️ Seleccione una empresa y un periodo contable en el menú lateral para cargar el Libro de Ventas.
        </div>
      ) : (
        <>
          {/* --- FORMULARIO DE ALTA DE VENTA FISCAL (sin caja/inventario) --- */}
          {mostrarForm && (
            <div style={{ background: '#1e293b', border: '1px solid #16a34a', borderRadius: '12px', padding: '20px', marginBottom: '20px' }}>
              <h3 style={{ margin: '0 0 4px 0', color: '#34d399', fontSize: '1.05rem' }}>➕ Factura única (venta fiscal)</h3>
              <p style={{ margin: '0 0 14px 0', color: '#94a3b8', fontSize: '0.8rem' }}>
                Documento declarativo por factura: NO afecta el Punto de Venta ni el inventario (sin caja, sin descuento de stock, sin kardex).
                Las líneas se registran por <b>categorías de ingreso</b> (conceptos contables de la empresa), no por productos.
              </p>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: '12px', marginBottom: '14px' }}>
                <div>
                  <label style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Fecha</label>
                  <input type="date" value={formVenta.fecha} onChange={(e) => setFormVenta({ ...formVenta, fecha: e.target.value })} style={inputChico} />
                </div>
                <div>
                  <label style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Cliente</label>
                  <select value={formVenta.clienteId} onChange={(e) => setFormVenta({ ...formVenta, clienteId: e.target.value })} style={inputChico}>
                    <option value="">Seleccione…</option>
                    {clientes.map((c) => (
                      <option key={c.id} value={c.id}>{c.nombre} ({c.rif || 'S/RIF'})</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Tipo (SENIAT)</label>
                  <select value={formVenta.tipoTransaccion} onChange={(e) => setFormVenta({ ...formVenta, tipoTransaccion: e.target.value })} style={inputChico}>
                    {TIPOS_TRANSACCION.map((t) => <option key={t.valor} value={t.valor}>{t.etiqueta}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: '0.75rem', color: '#94a3b8' }}>N° Control</label>
                  <input type="text" value={formVenta.numeroControl} onChange={(e) => setFormVenta({ ...formVenta, numeroControl: e.target.value })} placeholder="00-000000" style={inputChico} />
                </div>
              </div>

              {/* Mini-formulario de líneas por CONCEPTO DE INGRESO (sin inventario) */}
              <div style={{ background: '#0f172a', padding: '12px', borderRadius: '8px', border: '1px solid #334155', marginBottom: '14px', display: 'flex', gap: '10px', alignItems: 'flex-end', flexWrap: 'wrap' }}>
                <div style={{ flex: '1 1 200px' }}>
                  <label style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Categoría de Ingreso</label>
                  <select
                    value={nuevaLinea.conceptoId}
                    onChange={(e) => {
                      const concepto = conceptosIngreso.find((c) => String(c.id) === e.target.value);
                      setNuevaLinea({
                        ...nuevaLinea,
                        conceptoId: e.target.value,
                        descripcion: concepto ? concepto.nombreConcepto : '' // Autocompleta la descripción
                      });
                    }}
                    style={{ ...inputChico, width: '100%' }}
                  >
                    <option value="">Seleccione…</option>
                    {conceptosIngreso.map((c) => (
                      <option key={c.id} value={c.id}>{c.nombreConcepto} (Cta: {c.cuentaContable})</option>
                    ))}
                  </select>
                </div>

                <div style={{ flex: '2 1 250px' }}>
                  <label style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Descripción (Libre)</label>
                  <input
                    type="text"
                    value={nuevaLinea.descripcion}
                    onChange={(e) => setNuevaLinea({ ...nuevaLinea, descripcion: e.target.value })}
                    placeholder="Ej: Facturación mensual Internet"
                    style={{ ...inputChico, width: '100%' }}
                  />
                </div>

                <div style={{ width: '70px' }}>
                  <label style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Cant.</label>
                  <input
                    type="number"
                    min="0.01"
                    step="0.01"
                    value={nuevaLinea.cantidad}
                    onChange={(e) => setNuevaLinea({ ...nuevaLinea, cantidad: e.target.value })}
                    style={{ ...inputChico, width: '100%' }}
                  />
                </div>

                <div style={{ width: '90px' }}>
                  <label style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Precio $</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={nuevaLinea.precio}
                    onChange={(e) => setNuevaLinea({ ...nuevaLinea, precio: e.target.value })}
                    style={{ ...inputChico, width: '100%' }}
                  />
                </div>

                <div style={{ width: '70px' }}>
                  <label style={{ fontSize: '0.75rem', color: '#94a3b8' }}>IVA %</label>
                  <select
                    value={nuevaLinea.tasaIVA}
                    onChange={(e) => setNuevaLinea({ ...nuevaLinea, tasaIVA: Number(e.target.value) })}
                    style={{ ...inputChico, width: '100%' }}
                  >
                    <option value={0}>0%</option>
                    <option value={8}>8%</option>
                    <option value={16}>16%</option>
                  </select>
                </div>

                <button
                  type="button"
                  onClick={agregarLineaNueva}
                  style={{ background: '#2563eb', color: '#fff', border: 'none', borderRadius: '6px', padding: '6px 12px', height: '31px', cursor: 'pointer', fontWeight: 'bold' }}
                >
                  + Agregar
                </button>
              </div>

              {lineas.length > 0 && (
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem', marginBottom: '12px' }}>
                  <thead>
                    <tr style={{ color: '#93c5fd', textAlign: 'left' }}>
                      <th style={{ padding: '6px' }}>Concepto / Descripción</th>
                      <th style={{ padding: '6px' }}>Cant.</th>
                      <th style={{ padding: '6px' }}>Precio $</th>
                      <th style={{ padding: '6px' }}>IVA %</th>
                      <th style={{ padding: '6px', textAlign: 'right' }}>Subtotal</th>
                      <th style={{ padding: '6px' }}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {lineas.map((l, idx) => {
                      const conceptoLinea = conceptosIngreso.find((c) => String(c.id) === String(l.conceptoId));
                      return (
                      <tr key={`linea-${idx}`} style={{ borderTop: '1px solid #1f2937' }}>
                        <td style={{ padding: '6px' }}>
                          {l.descripcion || '—'}
                          {conceptoLinea && (
                            <span style={{ display: 'block', color: '#64748b', fontSize: '0.72rem' }}>
                              {conceptoLinea.nombreConcepto} · Cta {conceptoLinea.cuentaContable}
                            </span>
                          )}
                        </td>
                        <td style={{ padding: '6px' }}>
                          <input type="number" min="0.001" step="0.001" value={l.cantidad} onChange={(e) => modificarLinea(idx, 'cantidad', e.target.value)} style={{ ...inputChico, width: '80px' }} />
                        </td>
                        <td style={{ padding: '6px' }}>
                          <input type="number" min="0" step="0.01" value={l.precio} onChange={(e) => modificarLinea(idx, 'precio', e.target.value)} style={{ ...inputChico, width: '90px' }} />
                        </td>
                        <td style={{ padding: '6px' }}>
                          <select value={l.tasaIVA} onChange={(e) => modificarLinea(idx, 'tasaIVA', Number(e.target.value))} style={inputChico}>
                            <option value={0}>0%</option>
                            <option value={8}>8%</option>
                            <option value={16}>16%</option>
                          </select>
                        </td>
                        <td style={{ padding: '6px', textAlign: 'right' }}>${(Number(l.precio) * Number(l.cantidad)).toFixed(2)}</td>
                        <td style={{ padding: '6px', textAlign: 'center' }}>
                          <button onClick={() => quitarLinea(idx)} title="Quitar línea" style={{ background: '#7f1d1d', color: '#fff', border: 'none', borderRadius: '5px', padding: '3px 8px', cursor: 'pointer' }}>🗑️</button>
                        </td>
                      </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
                <div style={{ fontSize: '0.9rem' }}>
                  <b>Base:</b> ${totalesForm.subtotal.toFixed(2)} · <b>IVA:</b> ${totalesForm.iva.toFixed(2)} ·{' '}
                  <b style={{ color: '#34d399', fontSize: '1.05rem' }}>${totalesForm.total.toFixed(2)}</b>
                </div>
                <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                  <label style={{ fontSize: '0.8rem', color: '#cbd5e1', display: 'flex', gap: '6px', alignItems: 'center' }}>
                    <input type="checkbox" checked={contabilizarAuto} onChange={(e) => setContabilizarAuto(e.target.checked)} />
                    🧾 Contabilizar automáticamente
                  </label>
                  <button onClick={() => setMostrarForm(false)} style={{ background: '#475569', color: '#fff', border: 'none', borderRadius: '8px', padding: '9px 16px', cursor: 'pointer', fontWeight: 'bold' }}>Cancelar</button>
                  <button onClick={guardarVentaFiscal} disabled={guardando} style={{ background: '#16a34a', color: '#fff', border: 'none', borderRadius: '8px', padding: '9px 18px', cursor: guardando ? 'wait' : 'pointer', fontWeight: 'bold', opacity: guardando ? 0.6 : 1 }}>
                    {guardando ? '⏳ Guardando…' : '💾 Guardar venta fiscal'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* --- FORMULARIO DE RESUMEN DE VENTAS DE LA MÁQUINA FISCAL (cierre Z) --- */}
          {mostrarResumen && (
            <div style={{ background: '#1e293b', border: '1px solid #7c3aed', borderRadius: '12px', padding: '20px', marginBottom: '20px' }}>
              <h3 style={{ margin: '0 0 4px 0', color: '#a78bfa', fontSize: '1.05rem' }}>📋 Resumen de ventas · máquina fiscal (cierre Z)</h3>
              <p style={{ margin: '0 0 14px 0', color: '#94a3b8', fontSize: '0.8rem' }}>
                Documento declarativo del Libro de Ventas SENIAT: registra el N° de control de la máquina, el N° Z y el rango de
                facturas emitidas del día. NO afecta caja ni inventario. Cada resumen genera <b>UN</b> comprobante contable (Debe Caja | Haber Ingresos + IVA).
              </p>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '12px', marginBottom: '14px' }}>
                <div>
                  <label style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Fecha (cierre Z)</label>
                  <input type="date" value={formResumen.fecha} onChange={(e) => setFormResumen({ ...formResumen, fecha: e.target.value })} style={inputChico} />
                </div>
                <div>
                  <label style={{ fontSize: '0.75rem', color: '#94a3b8' }}>N° Control máquina</label>
                  <input type="text" value={formResumen.numeroControlMaquina} onChange={(e) => setFormResumen({ ...formResumen, numeroControlMaquina: e.target.value })} placeholder="Z1F0006326" style={inputChico} />
                </div>
                <div>
                  <label style={{ fontSize: '0.75rem', color: '#94a3b8' }}>N° Z</label>
                  <input type="text" value={formResumen.numeroZ} onChange={(e) => setFormResumen({ ...formResumen, numeroZ: e.target.value })} placeholder="0163" style={inputChico} />
                </div>
                <div>
                  <label style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Factura Desde</label>
                  <input type="text" value={formResumen.facturaDesde} onChange={(e) => setFormResumen({ ...formResumen, facturaDesde: e.target.value })} placeholder="00000940" style={inputChico} />
                </div>
                <div>
                  <label style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Factura Hasta</label>
                  <input type="text" value={formResumen.facturaHasta} onChange={(e) => setFormResumen({ ...formResumen, facturaHasta: e.target.value })} placeholder="00000952" style={inputChico} />
                </div>
                <div>
                  <label style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Tipo (SENIAT)</label>
                  <select value={formResumen.tipoTransaccion} onChange={(e) => setFormResumen({ ...formResumen, tipoTransaccion: e.target.value })} style={inputChico}>
                    {TIPOS_TRANSACCION.map((t) => <option key={t.valor} value={t.valor}>{t.etiqueta}</option>)}
                  </select>
                </div>

                <div>
                  <label style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Ventas Exentas $</label>
                  <input type="number" min="0" step="0.01" value={formResumen.exento} onChange={(e) => setFormResumen({ ...formResumen, exento: e.target.value })} placeholder="0.00" style={inputChico} />
                </div>
                <div>
                  <label style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Base Gravada $</label>
                  <input type="number" min="0" step="0.01" value={formResumen.baseGravada} onChange={(e) => setFormResumen({ ...formResumen, baseGravada: e.target.value })} placeholder="0.00" style={inputChico} />
                </div>
                <div>
                  <label style={{ fontSize: '0.75rem', color: '#94a3b8' }}>IVA $</label>
                  <input type="number" min="0" step="0.01" value={formResumen.iva} onChange={(e) => setFormResumen({ ...formResumen, iva: e.target.value })} placeholder="0.00" style={inputChico} />
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
                <div style={{ fontSize: '0.9rem' }}>
                  <b>Exento:</b> ${montosResumenForm.exento.toFixed(2)} · <b>Base:</b> ${montosResumenForm.baseGravada.toFixed(2)} ·{' '}
                  <b>IVA:</b> ${montosResumenForm.iva.toFixed(2)} ·{' '}
                  <b style={{ color: '#a78bfa', fontSize: '1.05rem' }}>${montosResumenForm.total.toFixed(2)}</b>
                </div>
                <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                  <label style={{ fontSize: '0.8rem', color: '#cbd5e1', display: 'flex', gap: '6px', alignItems: 'center' }}>
                    <input type="checkbox" checked={contabilizarResumenAuto} onChange={(e) => setContabilizarResumenAuto(e.target.checked)} />
                    🧾 Contabilizar automáticamente (1 asiento por resumen)
                  </label>
                  <button onClick={() => setMostrarResumen(false)} style={{ background: '#475569', color: '#fff', border: 'none', borderRadius: '8px', padding: '9px 16px', cursor: 'pointer', fontWeight: 'bold' }}>Cancelar</button>
                  <button onClick={guardarResumen} disabled={guardandoResumen} style={{ background: '#16a34a', color: '#fff', border: 'none', borderRadius: '8px', padding: '9px 18px', cursor: guardandoResumen ? 'wait' : 'pointer', fontWeight: 'bold', opacity: guardandoResumen ? 0.6 : 1 }}>
                    {guardandoResumen ? '⏳ Guardando…' : '💾 Guardar resumen'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* --- PANEL DE REPORTES: vista previa del libro + PDF/Excel --- */}
          {mostrarReporte && (
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
                    <div>Expresado en USD (moneda base)</div>
                  </div>

                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
                    <thead>
                      <tr style={{ borderBottom: '1.5px solid #000' }}>
                        {reporteLibro.columnas.map((col, idx) => (
                          <th key={col} style={{ textAlign: esColumnaMonto(reporteLibro, idx) ? 'right' : 'left', padding: '8px 4px', fontWeight: 'bold' }}>{col}</th>
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

          {/* --- CONSULTA Y EDICIÓN DEL LIBRO (bajo demanda) --- */}
          {mostrarConsultas && (
            <>
          {/* Resumen del período (exentas, base gravada, débito fiscal) */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '12px', marginBottom: '20px' }}>
            {[
              { etiqueta: 'Documentos', valor: totalesLibro.documentos, color: '#60a5fa' },
              { etiqueta: 'Ventas Exentas', valor: totalesLibro.exento, color: '#94a3b8' },
              { etiqueta: 'Base Gravada', valor: totalesLibro.baseGravada, color: '#34d399' },
              { etiqueta: 'IVA Débito Fiscal', valor: totalesLibro.iva, color: '#fbbf24' },
              { etiqueta: 'Total Ventas', valor: totalesLibro.total, color: '#fff' },
              { etiqueta: 'Anuladas', valor: totalesLibro.anuladas, color: '#f87171' }
            ].map((c) => (
              <div key={c.etiqueta} style={{ background: '#0f172a', border: '1px solid #334155', borderRadius: '10px', padding: '12px' }}>
                <div style={{ fontSize: '0.7rem', color: '#94a3b8', marginBottom: '4px' }}>{c.etiqueta}</div>
                <div style={{ fontSize: '1.05rem', fontWeight: 'bold', color: c.color }}>
                  {c.etiqueta === 'Documentos' || c.etiqueta === 'Anuladas' ? c.valor : fmt(c.valor)}
                </div>
              </div>
            ))}
          </div>

          {cargando ? (
            <div style={{ textAlign: 'center', padding: '40px', color: '#94a3b8' }}>⏳ Cargando Libro de Ventas…</div>
          ) : documentosLibro.length === 0 ? (
            <div style={{ background: '#0f172a', border: '1px dashed #475569', padding: '30px', textAlign: 'center', borderRadius: '12px', color: '#94a3b8' }}>
              No hay facturas ni resúmenes de ventas registrados en el periodo seleccionado.
            </div>
          ) : (
            <div style={{ background: '#111827', borderRadius: '12px', overflowX: 'auto', border: '1px solid #334155' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                <thead>
                  <tr style={{ background: '#1e293b', color: '#93c5fd' }}>
                    <th style={thStyle}>Fecha</th>
                    <th style={thStyle}>Tipo</th>
                    <th style={thStyle}>N° Factura</th>
                    <th style={thStyle}>Cliente (RIF)</th>
                    <th style={thStyle}>N° Control</th>
                    <th style={thStyle}>N° Z</th>
                    <th style={thStyle}>Rango (Desde – Hasta)</th>
                    <th style={{ ...thStyle, textAlign: 'right' }}>Exento</th>
                    <th style={{ ...thStyle, textAlign: 'right' }}>Base Gravada</th>
                    <th style={{ ...thStyle, textAlign: 'right' }}>IVA</th>
                    <th style={{ ...thStyle, textAlign: 'right' }}>Total</th>
                    <th style={thStyle}>Comprobante</th>
                    <th style={{ ...thStyle, textAlign: 'center' }}>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {documentosLibro.map(({ esResumen, dato: doc }) => {
                    // --- FILA: RESUMEN DE VENTAS DE LA MÁQUINA FISCAL (cierre Z) ---
                    if (esResumen) {
                      return (
                        <tr key={`resumen-${doc.id}`} style={{ background: '#1b1630' }}>
                          <td style={tdStyle}>{formatearFecha(doc.fecha)}</td>
                          <td style={tdStyle}>
                            <span style={{ background: '#2e1a47', color: '#c4b5fd', padding: '2px 8px', borderRadius: '10px', fontSize: '0.75rem', fontWeight: 'bold' }}>
                              {doc.tipoTransaccion || '01'}
                            </span>
                          </td>
                          <td style={{ ...tdStyle, fontFamily: 'monospace', color: '#a78bfa' }}>Resumen</td>
                          <td style={tdStyle}>
                            <b>Resumen Diario de Ventas</b>
                            <span style={{ display: 'block', color: '#94a3b8', fontSize: '0.75rem' }}>Máquina fiscal · SIN RIF</span>
                          </td>
                          <td style={{ ...tdStyle, fontFamily: 'monospace' }}>{doc.numeroControlMaquina}</td>
                          <td style={{ ...tdStyle, fontFamily: 'monospace', color: '#a78bfa', fontWeight: 'bold' }}>{doc.numeroZ}</td>
                          <td style={{ ...tdStyle, fontFamily: 'monospace' }}>{doc.facturaDesde} – {doc.facturaHasta}</td>
                          <td style={{ ...tdStyle, textAlign: 'right' }}>{fmt(doc.exento)}</td>
                          <td style={{ ...tdStyle, textAlign: 'right' }}>{fmt(doc.baseGravada)}</td>
                          <td style={{ ...tdStyle, textAlign: 'right', color: '#fbbf24' }}>{fmt(doc.iva)}</td>
                          <td style={{ ...tdStyle, textAlign: 'right', fontWeight: 'bold' }}>{fmt(doc.total)}</td>
                          <td style={tdStyle}>
                            {doc.asientoContableId
                              ? <span style={{ color: '#34d399', fontWeight: 'bold' }}>✅ Asiento #{doc.asientoContableId}</span>
                              : <span style={{ color: '#64748b' }}>— sin comprobante</span>}
                          </td>
                          <td style={{ ...tdStyle, textAlign: 'center' }}>
                            <button
                              onClick={() => contabilizarResumen(doc)}
                              disabled={Boolean(doc.asientoContableId) || procesandoId !== null}
                              title={doc.asientoContableId ? 'Ya tiene comprobante (no se duplica)' : 'Generar el comprobante contable del resumen (1 asiento)'}
                              style={{
                                background: doc.asientoContableId ? '#064e3b' : '#7c3aed', color: '#fff', border: 'none',
                                borderRadius: '5px', padding: '5px 9px',
                                cursor: doc.asientoContableId || procesandoId !== null ? 'not-allowed' : 'pointer',
                                opacity: doc.asientoContableId ? 0.6 : 1
                              }}
                            >
                              {procesandoId === `R${doc.id}` ? '⏳' : '🧾'}
                            </button>
                          </td>
                        </tr>
                      );
                    }

                    // --- FILA: FACTURA FISCAL (VENTA) ---
                    const v = doc;
                    const d = desgloseVenta(v);
                    const editando = editandoId === v.ventaId;
                    const cliente = v.cliente || {};
                    return (
                      <tr key={v.ventaId} style={{ background: v.isAnulada ? '#2d1215' : 'transparent', opacity: v.isAnulada ? 0.7 : 1 }}>
                        <td style={tdStyle}>{formatearFecha(v.fechaVenta)}</td>
                        <td style={tdStyle}>
                          {editando ? (
                            <select
                              value={formFiscal.tipoTransaccion}
                              onChange={(e) => setFormFiscal({ ...formFiscal, tipoTransaccion: e.target.value })}
                              style={inputChico}
                            >
                              {TIPOS_TRANSACCION.map((t) => <option key={t.valor} value={t.valor}>{t.etiqueta}</option>)}
                            </select>
                          ) : (
                            <span style={{ background: '#1e3a5f', color: '#93c5fd', padding: '2px 8px', borderRadius: '10px', fontSize: '0.75rem', fontWeight: 'bold' }}>
                              {v.tipoTransaccion || '01'}
                            </span>
                          )}
                        </td>
                        <td style={{ ...tdStyle, fontFamily: 'monospace' }}>
                          {v.numeroFactura || '—'}{v.isAnulada && <span style={{ color: '#f87171', marginLeft: '6px', fontSize: '0.7rem' }}>ANULADA</span>}
                        </td>
                        <td style={tdStyle}>
                          <b>{cliente.nombre || '—'}</b>
                          <span style={{ display: 'block', color: '#94a3b8', fontSize: '0.75rem' }}>{cliente.rif || 'S/RIF'}</span>
                        </td>
                        <td style={tdStyle}>
                          {editando ? (
                            <input
                              type="text"
                              value={formFiscal.numeroControl}
                              onChange={(e) => setFormFiscal({ ...formFiscal, numeroControl: e.target.value })}
                              placeholder="00-000000"
                              style={{ ...inputChico, width: '110px' }}
                            />
                          ) : (v.numeroControl || '—')}
                        </td>
                        {/* N° Z y rango de facturas: propios de los resúmenes de la máquina fiscal */}
                        <td style={{ ...tdStyle, fontFamily: 'monospace', color: '#64748b' }}>—</td>
                        <td style={{ ...tdStyle, fontFamily: 'monospace', color: '#64748b' }}>—</td>
                        <td style={{ ...tdStyle, textAlign: 'right' }}>{fmt(d.exento)}</td>
                        <td style={{ ...tdStyle, textAlign: 'right' }}>{fmt(d.baseGravada)}</td>
                        <td style={{ ...tdStyle, textAlign: 'right', color: '#fbbf24' }}>{fmt(d.iva)}</td>
                        <td style={{ ...tdStyle, textAlign: 'right', fontWeight: 'bold' }}>{fmt(d.total)}</td>
                        <td style={tdStyle}>
                          {v.asientoContableId
                            ? <span style={{ color: '#34d399', fontWeight: 'bold' }}>✅ Asiento #{v.asientoContableId}</span>
                            : <span style={{ color: '#64748b' }}>— sin comprobante</span>}
                        </td>
                        <td style={{ ...tdStyle, textAlign: 'center', whiteSpace: 'nowrap' }}>
                          {editando ? (
                            <>
                              <button onClick={() => guardarFiscal(v)} title="Guardar" style={{ background: '#16a34a', color: '#fff', border: 'none', borderRadius: '5px', padding: '5px 9px', cursor: 'pointer', fontWeight: 'bold', marginRight: '6px' }}>💾</button>
                              <button onClick={() => setEditandoId(null)} title="Cancelar" style={{ background: '#475569', color: '#fff', border: 'none', borderRadius: '5px', padding: '5px 9px', cursor: 'pointer' }}>✕</button>
                            </>
                          ) : (
                            <>
                              <button
                                onClick={() => abrirEdicion(v)}
                                disabled={v.isAnulada}
                                title="Editar datos fiscales (tipo de transacción y N° Control)"
                                style={{ background: '#3b82f6', color: '#fff', border: 'none', borderRadius: '5px', padding: '5px 9px', cursor: v.isAnulada ? 'not-allowed' : 'pointer', marginRight: '6px', opacity: v.isAnulada ? 0.4 : 1 }}
                              >
                                ✏️
                              </button>
                              <button
                                onClick={() => contabilizar(v)}
                                disabled={v.isAnulada || procesandoId !== null}
                                title={v.asientoContableId ? 'Ya tiene comprobante (no se duplica)' : 'Generar el comprobante contable de esta venta'}
                                style={{
                                  background: v.asientoContableId ? '#064e3b' : '#7c3aed', color: '#fff', border: 'none',
                                  borderRadius: '5px', padding: '5px 9px',
                                  cursor: v.isAnulada || procesandoId !== null ? 'not-allowed' : 'pointer',
                                  opacity: v.isAnulada ? 0.4 : 1
                                }}
                              >
                                {procesandoId === v.ventaId ? '⏳' : '🧾'}
                              </button>
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
    </div>
  );
}