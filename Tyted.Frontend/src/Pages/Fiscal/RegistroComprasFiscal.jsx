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
  const { empresaActiva, periodoActivo } = useContext(ConfigContext);

  const [compras, setCompras] = useState([]);
  const [retenciones, setRetenciones] = useState([]);
  const [cargando, setCargando] = useState(false);
  const [editandoId, setEditandoId] = useState(null);
  const [formFiscal, setFormFiscal] = useState({ tipoTransaccion: '01', numeroControl: '' });
  const [procesandoId, setProcesandoId] = useState(null);

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

      {!hayContexto ? (
        <div style={{ background: '#1e293b', border: '1px solid #f59e0b', color: '#fcd34d', padding: '16px', borderRadius: '10px' }}>
          ⚠️ Seleccione una empresa y un periodo contable en el menú lateral para cargar el Libro de Compras.
        </div>
      ) : (
        <>
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
      )}
    </div>
  );
}