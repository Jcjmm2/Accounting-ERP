import { useState, useContext, useEffect, useCallback } from 'react';
import { ConfigContext } from '../../Context/ConfigContext';
import { fiscalApi, mensajeErrorApi } from '../../Services/Fiscal/FiscalApi';

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
// base general 16% y crédito fiscal total.
const desgloseCompra = (compra) => {
  const lineas = compra?.detalles?.$values || compra?.detalles || [];
  const base = Number(compra?.subtotalMonedaBase ?? 0)
    || lineas.reduce((s, l) => s + Number(l.subtotalLineaMonedaBase ?? 0), 0);
  const iva = Number(compra?.ivaMonedaBase ?? 0);
  const total = Number(compra?.totalMonedaBase ?? 0) || base + iva;
  const porTasa = (tasa) => lineas
    .filter((l) => Number(l.tasaIVA ?? 0) === tasa)
    .reduce((s, l) => s + Number(l.subtotalLineaMonedaBase ?? 0), 0);
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

// ---------------------------------------------------------------------------
// REGISTRO DE COMPRAS (LIBRO DE COMPRAS IVA): alimenta la parte fiscal con
// sus comprobantes contables (BE-F4). El selector global empresa/periodo rige
// el rango de fechas consultado.
// ---------------------------------------------------------------------------
export default function RegistroComprasFiscal() {
  const { empresaActiva, periodoActivo, tasa } = useContext(ConfigContext);

  const [compras, setCompras] = useState([]);
  const [retenciones, setRetenciones] = useState([]);
  const [cargando, setCargando] = useState(false);
  const [editandoId, setEditandoId] = useState(null);
  const [formFiscal, setFormFiscal] = useState({ tipoTransaccion: '01', numeroControl: '' });
  const [procesandoId, setProcesandoId] = useState(null);

  // --- PESTAÑAS: COMPRAS FISCALES | GASTOS FISCALES ---
  const [pestana, setPestana] = useState('compras');

  // --- ALTA DE COMPRA FISCAL (sin stock ni kardex) ---
  const [mostrarFormCompra, setMostrarFormCompra] = useState(false);
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

  // --- ALTA DE GASTOS FISCALES (entidad propia, sin inventario) ---
  const [gastos, setGastos] = useState([]);
  const [mostrarFormGasto, setMostrarFormGasto] = useState(false);
  const [guardandoGasto, setGuardandoGasto] = useState(false);
  const [contabilizarGastoAuto, setContabilizarGastoAuto] = useState(true);
  const [formGasto, setFormGasto] = useState({
    fecha: new Date().toISOString().slice(0, 10),
    concepto: '',
    categoria: 'SERVICIO',
    codigoProv: '',
    monto: ''
  });

  const empresaId = Number(empresaActiva?.id ?? 0);
  const fechaInicio = periodoActivo?.fechaInicio;
  const fechaFin = periodoActivo?.fechaFin;

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

  // Retención vigente por factura (una sola por compra) y total retenido
  const retencionPorCompra = new Map(retenciones.map((r) => [Number(r.compraId), r]));
  const totalRetenido = retenciones.reduce((s, r) => s + Number(r.montoRetenido ?? 0), 0);

  // Recarga automática al cambiar el contexto global (empresa/periodo)
  useEffect(() => { cargarCompras(); }, [cargarCompras]);

  // Resumen del período (líneas 30/33/34 del formato SENIAT)
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

  const abrirEdicion = (c) => {
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
        alert(`⚠️ ${r.mensaje || 'No se generó el comprobante.'}\n${r.advertencia || ''}`);
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
        `IVA: ${fmt(r.ivaCalculado)} · Retenido (${r.porcentajeRetencion}%): ${fmt(r.montoRetenido)}`
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
  const totalesFormCompra = lineasCompra.reduce((acc, l) => {
    const base = Number(l.costo) * Number(l.cantidad);
    acc.subtotal += base;
    acc.iva += base * (Number(l.tasaIVA) / 100);
    return acc;
  }, { subtotal: 0, iva: 0 });
  totalesFormCompra.total = totalesFormCompra.subtotal + totalesFormCompra.iva;

  const totalGastos = gastos.reduce((s, g) => s + Number(g.monto ?? 0), 0);

  const abrirFormCompraFiscal = async () => {
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
    setMostrarFormCompra(true);
    if (proveedores.length === 0) {
      try {
        const data = await fiscalApi.getProveedores();
        setProveedores(Array.isArray(data) ? data : (data?.$values || []));
      } catch (error) {
        console.warn('Error cargando proveedores:', error);
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
    setLineasCompra(prev => [...prev, {
      idProductoUnidad: prod.idProductoUnidad,
      codigoProd: prod.codigoProd,
      descripcion: prod.descripcion || 'PRODUCTO',
      unidad: prod.unidad || 'UND',
      costo: Number(prod.costoUSD || prod.costoUnitarioMonedaBase || prod.precioUSD || 0),
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
    if (!formCompra.codigoProv) { alert('⚠️ Seleccione el proveedor.'); return; }
    if (!formCompra.numeroFactura?.trim()) { alert('⚠️ Indique el N° de factura.'); return; }

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
        tipoMoneda: 'USD',
        tasaDeCambio: Number(tasa) || 1,
        aplicaLibroCompras: true,
        esGastoServicio: false,
        detalles: lineasCompra.map(l => ({
          codigoProd: l.codigoProd,
          idProductoUnidad: Number(l.idProductoUnidad),
          unidadCompra: l.unidad,
          cantidad: Number(l.cantidad),
          costoUnitarioMonedaBase: Number(l.costo),
          tasaIVA: Number(l.tasaIVA)
        }))
      });

      if (contabilizarAuto && creada?.id) {
        try {
          const r = await fiscalApi.contabilizarCompra(creada.id);
          if (!r.generada) alert(`⚠️ Compra registrada, pero el comprobante no se generó:\n${r.advertencia || r.mensaje || ''}`);
        } catch (errorC) {
          alert(`⚠️ Compra registrada; el comprobante contable falló:\n${mensajeErrorApi(errorC)}`);
        }
      }

      alert('✅ Compra fiscal registrada (sin efectos en inventario).');
      setMostrarFormCompra(false);
      await cargarCompras();
    } catch (error) {
      console.error('Error creando compra fiscal:', error);
      alert(`❌ No se pudo registrar la compra fiscal:\n${mensajeErrorApi(error)}`);
    } finally {
      setGuardandoCompra(false);
    }
  };

  const abrirFormGasto = () => {
    setFormGasto({
      fecha: new Date().toISOString().slice(0, 10),
      concepto: '',
      categoria: 'SERVICIO',
      codigoProv: '',
      monto: ''
    });
    setMostrarFormGasto(true);
    if (proveedores.length === 0) {
      fiscalApi.getProveedores()
        .then((data) => setProveedores(Array.isArray(data) ? data : (data?.$values || [])))
        .catch((error) => console.warn('Error cargando proveedores:', error));
    }
  };

  const guardarGasto = async () => {
    if (!formGasto.concepto.trim()) { alert('⚠️ Indique el concepto del gasto.'); return; }
    if (!(Number(formGasto.monto) > 0)) { alert('⚠️ El monto debe ser mayor a cero.'); return; }

    const confirmado = window.confirm(
      `Registrar el gasto «${formGasto.concepto}» por ${fmt(formGasto.monto)}?\n\n` +
      'El gasto es un documento fiscal propio: NO toca inventario ni compras.' +
      (contabilizarGastoAuto ? ' Se generará su comprobante contable (Debe Gastos / Haber Caja o Proveedores).' : '')
    );
    if (!confirmado) return;

    setGuardandoGasto(true);
    try {
      const creado = await fiscalApi.crearGasto({
        empresaId,
        fecha: `${formGasto.fecha}T12:00:00`,
        concepto: formGasto.concepto.trim(),
        categoria: formGasto.categoria,
        codigoProv: formGasto.codigoProv ? Number(formGasto.codigoProv) : null,
        monto: Number(formGasto.monto),
        tipoTransaccion: '01'
      });

      if (contabilizarGastoAuto && creado?.id) {
        try {
          const r = await fiscalApi.contabilizarGasto(creado.id);
          if (!r.generada) alert(`⚠️ Gasto registrado, pero el comprobante no se generó:\n${r.advertencia || r.mensaje || ''}`);
        } catch (errorC) {
          alert(`⚠️ Gasto registrado; el comprobante contable falló:\n${mensajeErrorApi(errorC)}`);
        }
      }

      alert('✅ Gasto fiscal registrado.');
      setMostrarFormGasto(false);
      await cargarCompras();
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
      else alert(`⚠️ ${r.mensaje || 'No se generó el comprobante.'}\n${r.advertencia || ''}`);
      await cargarCompras();
    } catch (error) {
      console.error('Error contabilizando el gasto:', error);
      alert(`❌ No se pudo contabilizar:\n${mensajeErrorApi(error)}`);
    }
  };

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
            onClick={pestana === 'compras' ? abrirFormCompraFiscal : abrirFormGasto}
            disabled={!hayContexto || cargando}
            style={{
              background: '#059669', color: '#fff', border: 'none', borderRadius: '8px',
              padding: '10px 16px', cursor: hayContexto && !cargando ? 'pointer' : 'not-allowed',
              fontWeight: 'bold', opacity: hayContexto ? 1 : 0.5
            }}
            title={pestana === 'compras'
              ? 'Registrar una compra fiscal declarativa (sin inventario)'
              : 'Registrar un gasto fiscal declarativo (sin inventario)'}
          >
            {pestana === 'compras' ? '➕ Nueva compra fiscal' : '➕ Nuevo gasto'}
          </button>
          <button
            onClick={cargarCompras}
            disabled={cargando || !hayContexto}
            style={{
              background: '#2563eb', color: '#fff', border: 'none', borderRadius: '8px',
              padding: '10px 16px', cursor: cargando ? 'wait' : 'pointer', fontWeight: 'bold',
              opacity: hayContexto ? 1 : 0.5
            }}
          >
            {cargando ? '⏳ Cargando…' : '🔍 Recargar'}
          </button>
        </div>
      </div>

      {/* Pestañas: Libro de Compras | Gastos (ambos sin inventario) */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '18px' }}>
        {[
          { id: 'compras', etiqueta: '🧾 Libro de Compras (IVA)' },
          { id: 'gastos', etiqueta: '💸 Compras y Gastos' }
        ].map((p) => (
          <button
            key={p.id}
            onClick={() => setPestana(p.id)}
            style={{
              background: pestana === p.id ? '#34d399' : '#1e293b',
              color: pestana === p.id ? '#052e16' : '#94a3b8',
              border: '1px solid #334155', borderRadius: '8px',
              padding: '9px 18px', cursor: 'pointer', fontWeight: 'bold', fontSize: '0.85rem'
            }}
          >
            {p.etiqueta}
          </button>
        ))}
      </div>

      {!hayContexto ? (
        <div style={{ background: '#1e293b', border: '1px solid #f59e0b', color: '#fcd34d', padding: '16px', borderRadius: '10px' }}>
          ⚠️ Seleccione una empresa y un periodo contable en el menú lateral para cargar el Libro de Compras.
        </div>
      ) : (
        <>
          {pestana === 'compras' ? (
            <>
              {mostrarFormCompra && (
                <div style={{ background: '#1e293b', border: '1px solid #16a34a', borderRadius: '12px', padding: '20px', marginBottom: '20px' }}>
                  <h3 style={{ margin: '0 0 4px 0', color: '#34d399', fontSize: '1.05rem' }}>➕ Nueva compra fiscal</h3>
                  <p style={{ margin: '0 0 14px 0', color: '#94a3b8', fontSize: '0.8rem' }}>
                    Documento declarativo: NO afecta el inventario (sin aumento de stock, sin costos, sin kardex).
                  </p>
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
                      <label style={{ fontSize: '0.75rem', color: '#94a3b8' }}>N° Factura</label>
                      <input type="text" value={formCompra.numeroFactura} onChange={(e) => setFormCompra({ ...formCompra, numeroFactura: e.target.value })} placeholder="F-0001" style={inputChico} />
                    </div>
                    <div>
                      <label style={{ fontSize: '0.75rem', color: '#94a3b8' }}>N° Control</label>
                      <input type="text" value={formCompra.numeroControl} onChange={(e) => setFormCompra({ ...formCompra, numeroControl: e.target.value })} placeholder="00-000000" style={inputChico} />
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
                            <b style={{ color: '#34d399' }}>${Number(p.costoUSD || p.costoUnitarioMonedaBase || p.precioUSD || 0).toFixed(2)} · IVA {p.porcentajeIva || 0}%</b>
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
                          <th style={{ padding: '6px' }}>Costo $</th>
                          <th style={{ padding: '6px' }}>IVA %</th>
                          <th style={{ padding: '6px', textAlign: 'right' }}>Subtotal</th>
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
                            <td style={{ padding: '6px', textAlign: 'right' }}>${(Number(l.costo) * Number(l.cantidad)).toFixed(2)}</td>
                            <td style={{ padding: '6px', textAlign: 'center' }}>
                              <button onClick={() => quitarLineaCompra(idx)} title="Quitar línea" style={{ background: '#7f1d1d', color: '#fff', border: 'none', borderRadius: '5px', padding: '3px 8px', cursor: 'pointer' }}>🗑️</button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
                    <div style={{ fontSize: '0.9rem' }}>
                      <b>Base:</b> ${totalesFormCompra.subtotal.toFixed(2)} · <b>IVA:</b> ${totalesFormCompra.iva.toFixed(2)} ·{' '}
                      <b style={{ color: '#34d399', fontSize: '1.05rem' }}>${totalesFormCompra.total.toFixed(2)}</b>
                    </div>
                    <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                      <label style={{ fontSize: '0.8rem', color: '#cbd5e1', display: 'flex', gap: '6px', alignItems: 'center' }}>
                        <input type="checkbox" checked={contabilizarAuto} onChange={(e) => setContabilizarAuto(e.target.checked)} />
                        🧾 Contabilizar automáticamente
                      </label>
                      <button onClick={() => setMostrarFormCompra(false)} style={{ background: '#475569', color: '#fff', border: 'none', borderRadius: '8px', padding: '9px 16px', cursor: 'pointer', fontWeight: 'bold' }}>Cancelar</button>
                      <button onClick={guardarCompraFiscal} disabled={guardandoCompra} style={{ background: '#16a34a', color: '#fff', border: 'none', borderRadius: '8px', padding: '9px 18px', cursor: guardandoCompra ? 'wait' : 'pointer', fontWeight: 'bold', opacity: guardandoCompra ? 0.6 : 1 }}>
                        {guardandoCompra ? '⏳ Guardando…' : '💾 Guardar compra fiscal'}
                      </button>
                    </div>
                  </div>
                </div>
              )}

          {/* Resumen del período (exentas, base 8/16, crédito fiscal) */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '12px', marginBottom: '20px' }}>
            {[
              { etiqueta: 'Documentos', valor: totales.documentos, entero: true, color: '#60a5fa' },
              { etiqueta: 'Compras Exentas', valor: totales.exento, color: '#94a3b8' },
              { etiqueta: 'Base 8%', valor: totales.base8, color: '#a78bfa' },
              { etiqueta: 'Base 16%', valor: totales.base16, color: '#34d399' },
              { etiqueta: 'IVA Crédito Fiscal', valor: totales.iva, color: '#fbbf24' },
              { etiqueta: 'IVA Retenido (75/100)', valor: totalRetenido, color: '#f472b6' },
              { etiqueta: 'Total Compras', valor: totales.total, color: '#fff' }
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
            <div style={{ textAlign: 'center', padding: '40px', color: '#94a3b8' }}>⏳ Cargando Libro de Compras…</div>
          ) : compras.length === 0 ? (
            <div style={{ background: '#0f172a', border: '1px dashed #475569', padding: '30px', textAlign: 'center', borderRadius: '12px', color: '#94a3b8' }}>
              No hay compras registradas en el periodo seleccionado.
            </div>
          ) : (
            <div style={{ background: '#111827', borderRadius: '12px', overflowX: 'auto', border: '1px solid #334155' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                <thead>
                  <tr style={{ background: '#1e293b', color: '#86efac' }}>
                    <th style={thStyle}>Fecha</th>
                    <th style={thStyle}>Tipo</th>
                    <th style={thStyle}>N° Factura</th>
                    <th style={thStyle}>N° Control</th>
                    <th style={thStyle}>Proveedor (RIF)</th>
                    <th style={{ ...thStyle, textAlign: 'right' }}>Exento</th>
                    <th style={{ ...thStyle, textAlign: 'right' }}>Base 8%</th>
                    <th style={{ ...thStyle, textAlign: 'right' }}>Base 16%</th>
                    <th style={{ ...thStyle, textAlign: 'right' }}>IVA Crédito</th>
                    <th style={{ ...thStyle, textAlign: 'right' }}>Total</th>
                    <th style={thStyle}>Comprobante</th>
                    <th style={{ ...thStyle, textAlign: 'center' }}>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {compras.map((c) => {
                    const d = desgloseCompra(c);
                    const editando = editandoId === c.id;
                    const proveedor = c.proveedor || {};
                    return (
                      <tr key={c.id} style={{ background: c.isAnulada ? '#2d1215' : 'transparent', opacity: c.isAnulada ? 0.7 : 1 }}>
                        <td style={tdStyle}>{formatearFecha(c.fechaCompra)}</td>
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
                            <span style={{ background: '#064e3b', color: '#6ee7b7', padding: '2px 8px', borderRadius: '10px', fontSize: '0.75rem', fontWeight: 'bold' }}>
                              {c.tipoTransaccion || '01'}
                            </span>
                          )}
                        </td>
                        <td style={{ ...tdStyle, fontFamily: 'monospace' }}>
                          {c.numeroFactura || '—'}{c.isAnulada && <span style={{ color: '#f87171', marginLeft: '6px', fontSize: '0.7rem' }}>ANULADA</span>}
                        </td>
                        <td style={{ ...tdStyle, fontFamily: 'monospace' }}>
                          {editando ? (
                            <input
                              type="text"
                              value={formFiscal.numeroControl}
                              onChange={(e) => setFormFiscal({ ...formFiscal, numeroControl: e.target.value })}
                              placeholder="00-000000"
                              style={{ ...inputChico, width: '110px' }}
                            />
                          ) : (c.numeroControl || '—')}
                        </td>
                        <td style={tdStyle}>
                          <b>{proveedor.razonsocial || '—'}</b>
                          <span style={{ display: 'block', color: '#94a3b8', fontSize: '0.75rem' }}>{proveedor.rif || 'S/RIF'}</span>
                        </td>
                        <td style={{ ...tdStyle, textAlign: 'right' }}>{fmt(d.exento)}</td>
                        <td style={{ ...tdStyle, textAlign: 'right' }}>{fmt(d.base8)}</td>
                        <td style={{ ...tdStyle, textAlign: 'right' }}>{fmt(d.base16)}</td>
                        <td style={{ ...tdStyle, textAlign: 'right', color: '#fbbf24' }}>{fmt(d.iva)}</td>
                        <td style={{ ...tdStyle, textAlign: 'right', fontWeight: 'bold' }}>{fmt(d.total)}</td>
                        <td style={tdStyle}>
                          {c.asientoContableId
                            ? <span style={{ color: '#34d399', fontWeight: 'bold' }}>✅ Asiento #{c.asientoContableId}</span>
                            : <span style={{ color: '#64748b' }}>— sin comprobante</span>}
                          {retencionPorCompra.has(Number(c.id)) && (
                            <span style={{ display: 'block', color: '#f472b6', fontSize: '0.75rem', fontWeight: 'bold' }}>
                              🧮 {retencionPorCompra.get(Number(c.id)).numeroComprobante} ({retencionPorCompra.get(Number(c.id)).porcentajeRetencion}%)
                            </span>
                          )}
                        </td>
                        <td style={{ ...tdStyle, textAlign: 'center', whiteSpace: 'nowrap' }}>
                          {editando ? (
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
                                {retencionPorCompra.has(Number(c.id)) ? '✅' : '🧮'}
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
          ) : (
            <>
              {mostrarFormGasto && (
                <div style={{ background: '#1e293b', border: '1px solid #f59e0b', borderRadius: '12px', padding: '20px', marginBottom: '20px' }}>
                  <h3 style={{ margin: '0 0 4px 0', color: '#fbbf24', fontSize: '1.05rem' }}>➕ Nuevo gasto fiscal</h3>
                  <p style={{ margin: '0 0 14px 0', color: '#94a3b8', fontSize: '0.8rem' }}>
                    Documento propio del módulo fiscal: NO toca inventario ni compras. Requiere periodo contable ABIERTO.
                  </p>
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
                      <label style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Categoría</label>
                      <select value={formGasto.categoria} onChange={(e) => setFormGasto({ ...formGasto, categoria: e.target.value })} style={inputChico}>
                        {['SERVICIO', 'PERSONAL', 'ALQUILER', 'MANTENIMIENTO', 'OTROS'].map((c) => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </div>
                    <div>
                      <label style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Proveedor (opcional)</label>
                      <select value={formGasto.codigoProv} onChange={(e) => setFormGasto({ ...formGasto, codigoProv: e.target.value })} style={inputChico}>
                        <option value="">— Caja —</option>
                        {proveedores.map((p) => (
                          <option key={p.codigoProv} value={p.codigoProv}>{p.razonsocial}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Monto (USD)</label>
                      <input type="number" min="0.01" step="0.01" value={formGasto.monto} onChange={(e) => setFormGasto({ ...formGasto, monto: e.target.value })} placeholder="0.00" style={inputChico} />
                    </div>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', alignItems: 'center' }}>
                    <label style={{ fontSize: '0.8rem', color: '#cbd5e1', display: 'flex', gap: '6px', alignItems: 'center' }}>
                      <input type="checkbox" checked={contabilizarGastoAuto} onChange={(e) => setContabilizarGastoAuto(e.target.checked)} />
                      🧾 Contabilizar automáticamente
                    </label>
                    <button onClick={() => setMostrarFormGasto(false)} style={{ background: '#475569', color: '#fff', border: 'none', borderRadius: '8px', padding: '9px 16px', cursor: 'pointer', fontWeight: 'bold' }}>Cancelar</button>
                    <button onClick={guardarGasto} disabled={guardandoGasto} style={{ background: '#16a34a', color: '#fff', border: 'none', borderRadius: '8px', padding: '9px 18px', cursor: guardandoGasto ? 'wait' : 'pointer', fontWeight: 'bold', opacity: guardandoGasto ? 0.6 : 1 }}>
                      {guardandoGasto ? '⏳ Guardando…' : '💾 Guardar gasto'}
                    </button>
                  </div>
                </div>
              )}

              {/* Resumen de gastos del período */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '14px', marginBottom: '20px' }}>
                {[
                  { valor: gastos.length, subtitulo: 'GASTOS REGISTRADOS', color: '#38bdf8', bg: '#1e3a8a' },
                  { valor: fmt(totalGastos), subtitulo: 'TOTAL GASTOS (USD)', color: '#fbbf24', bg: '#78350f' }
                ].map((tarjeta, i) => (
                  <div key={i} style={{ background: tarjeta.bg, borderRadius: '12px', padding: '18px 22px', border: '1px solid #334155' }}>
                    <div style={{ fontSize: '1.7rem', fontWeight: 'bold', color: tarjeta.color }}>{tarjeta.valor}</div>
                    <div style={{ fontSize: '0.78rem', color: '#94a3b8', marginTop: '4px' }}>{tarjeta.subtitulo}</div>
                  </div>
                ))}
              </div>

              {gastos.length === 0 ? (
                <div style={{ background: '#1e293b', border: '1px dashed #475569', borderRadius: '12px', padding: '28px', textAlign: 'center', color: '#94a3b8' }}>
                  No hay gastos registrados en este período. Use «➕ Nuevo gasto» para registrar uno.
                </div>
              ) : (
                <div style={{ background: '#1e293b', borderRadius: '12px', overflowX: 'auto', border: '1px solid #334155' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem', minWidth: '720px' }}>
                    <thead style={{ background: '#0f172a' }}>
                      <tr style={{ color: '#93c5fd', textAlign: 'left' }}>
                        <th style={{ padding: '14px 16px' }}>Fecha</th>
                        <th style={{ padding: '14px 16px' }}>Concepto</th>
                        <th style={{ padding: '14px 16px' }}>Categoría</th>
                        <th style={{ padding: '14px 16px' }}>Proveedor</th>
                        <th style={{ padding: '14px 16px', textAlign: 'right' }}>Monto</th>
                        <th style={{ padding: '14px 16px', textAlign: 'center' }}>Comprobante</th>
                        <th style={{ padding: '14px 16px', textAlign: 'center' }}>Acción</th>
                      </tr>
                    </thead>
                    <tbody>
                      {gastos.map((g) => (
                        <tr key={g.id} style={{ borderTop: '1px solid #334155' }}>
                          <td style={{ padding: '12px 16px', whiteSpace: 'nowrap' }}>{new Date(g.fecha).toLocaleDateString('es-VE')}</td>
                          <td style={{ padding: '12px 16px' }}>{g.concepto}</td>
                          <td style={{ padding: '12px 16px' }}>{g.categoria || '—'}</td>
                          <td style={{ padding: '12px 16px' }}>{g.proveedor?.razonsocial || '—'}</td>
                          <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 'bold', color: '#fbbf24' }}>{fmt(g.monto)}</td>
                          <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                            {g.asientoContableId
                              ? <span style={{ color: '#34d399', fontWeight: 'bold' }} title={`Asiento #${g.asientoContableId}`}>✅</span>
                              : <span style={{ color: '#94a3b8' }}>⏳</span>}
                          </td>
                          <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                            {!g.asientoContableId && (
                              <button
                                onClick={() => contabilizarGastoAccion(g)}
                                title="Generar comprobante contable"
                                style={{ background: '#1d4ed8', color: '#fff', border: 'none', borderRadius: '5px', padding: '5px 9px', cursor: 'pointer' }}
                              >
                                🧾
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
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