import { useState, useContext, useEffect, useCallback } from 'react';
import { ConfigContext } from '../../Context/ConfigContext';
import { fiscalApi, mensajeErrorApi } from '../../Services/Fiscal/FiscalApi';

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

// ---------------------------------------------------------------------------
// REGISTRO DE VENTAS (LIBRO DE VENTAS IVA): alimenta la parte fiscal con sus
// comprobantes contables (integración BE-F4). El selector global de
// empresa/periodo rige el rango de fechas consultado.
// ---------------------------------------------------------------------------
export default function RegistroVentasFiscal() {
  const { empresaActiva, periodoActivo } = useContext(ConfigContext);

  const [ventas, setVentas] = useState([]);
  const [cargando, setCargando] = useState(false);
  const [editandoId, setEditandoId] = useState(null);
  const [formFiscal, setFormFiscal] = useState({ tipoTransaccion: '01', numeroControl: '' });
  const [procesandoId, setProcesandoId] = useState(null);

  const empresaId = Number(empresaActiva?.id ?? 0);
  const fechaInicio = periodoActivo?.fechaInicio;
  const fechaFin = periodoActivo?.fechaFin;

  const cargarVentas = useCallback(async () => {
    if (!empresaId || !fechaInicio || !fechaFin) {
      setVentas([]);
      return;
    }
    setCargando(true);
    try {
      const data = await fiscalApi.getVentas({ fechaInicio, fechaFin, empresaId });
      setVentas(Array.isArray(data) ? data : (data?.$values || []));
    } catch (error) {
      console.error('Error cargando el Libro de Ventas:', error);
      alert(`❌ No se pudo cargar el Libro de Ventas:\n${mensajeErrorApi(error)}`);
    } finally {
      setCargando(false);
    }
  }, [empresaId, fechaInicio, fechaFin]);

  // Recarga automática al cambiar el contexto global (empresa/periodo)
  useEffect(() => { cargarVentas(); }, [cargarVentas]);

  // Resumen del período (formato SENIAT)
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
        alert(`⚠️ ${r.mensaje || 'No se generó el comprobante.'}\n${r.advertencia || ''}`);
      }
      await cargarVentas();
    } catch (error) {
      console.error('Error contabilizando la venta:', error);
      alert(`❌ No se pudo contabilizar:\n${mensajeErrorApi(error)}`);
    } finally {
      setProcesandoId(null);
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
          <h2 style={{ margin: '0 0 4px 0', color: '#f87171', fontSize: '1.2rem' }}>📕 Libro de Ventas · IVA (SENIAT)</h2>
          <span style={{ color: '#94a3b8', fontSize: '0.85rem' }}>
            🏢 <b style={{ color: '#60a5fa' }}>{empresaActiva?.razonSocial || empresaActiva?.nombre || '—'}</b>
            {' · '}📅 {formatearFecha(fechaInicio)} al {formatearFecha(fechaFin)}
            {' · '}<b style={{ color: '#fbbf24' }}>{periodoActivo?.nombre || 'Sin periodo'}</b>
          </span>
        </div>
        <button
          onClick={cargarVentas}
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

      {!hayContexto ? (
        <div style={{ background: '#1e293b', border: '1px solid #f59e0b', color: '#fcd34d', padding: '16px', borderRadius: '10px' }}>
          ⚠️ Seleccione una empresa y un periodo contable en el menú lateral para cargar el Libro de Ventas.
        </div>
      ) : (
        <>
          {/* Resumen del período (exentas, base gravada, débito fiscal) */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '12px', marginBottom: '20px' }}>
            {[
              { etiqueta: 'Documentos', valor: totales.documentos, color: '#60a5fa' },
              { etiqueta: 'Ventas Exentas', valor: totales.exento, color: '#94a3b8' },
              { etiqueta: 'Base Gravada', valor: totales.baseGravada, color: '#34d399' },
              { etiqueta: 'IVA Débito Fiscal', valor: totales.iva, color: '#fbbf24' },
              { etiqueta: 'Total Ventas', valor: totales.total, color: '#fff' },
              { etiqueta: 'Anuladas', valor: totales.anuladas, color: '#f87171' }
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
          ) : ventas.length === 0 ? (
            <div style={{ background: '#0f172a', border: '1px dashed #475569', padding: '30px', textAlign: 'center', borderRadius: '12px', color: '#94a3b8' }}>
              No hay ventas registradas en el periodo seleccionado.
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
                    <th style={{ ...thStyle, textAlign: 'right' }}>Exento</th>
                    <th style={{ ...thStyle, textAlign: 'right' }}>Base Gravada</th>
                    <th style={{ ...thStyle, textAlign: 'right' }}>IVA</th>
                    <th style={{ ...thStyle, textAlign: 'right' }}>Total</th>
                    <th style={thStyle}>Comprobante</th>
                    <th style={{ ...thStyle, textAlign: 'center' }}>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {ventas.map((v) => {
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
    </div>
  );
}