import { useContext } from 'react';
import { ConfigContext } from '../../Context/ConfigContext';
import { fmt, TIPOS_TRANSACCION, inputChico } from './libroComprasHelpers';
import SelectorPeriodoDoc from './SelectorPeriodoDoc';
import { diaIso } from './periodoDocHelper';

// ---------------------------------------------------------------------------
// FORMULARIO DE ALTA DE FACTURA DE COMPRA FISCAL: documento declarativo con
// líneas de producto, captura en BOLÍVARES, SIN efectos en inventario.
// Presentacional: el estado y la guarda viven en useAltaCompraFiscal (prop
// `alta`); el catálogo de proveedores lo aporta la página. El PERIODO AL QUE
// AFECTA acota la fecha del documento (regla «fecha ∈ periodo»).
// ---------------------------------------------------------------------------
export default function FormularioCompraFiscal({ alta, proveedores, tasa, onCancelar }) {
  const { periodos } = useContext(ConfigContext);
  const {
    formCompra, setFormCompra, lineasCompra,
    buscadorProd, resultadosProd, buscarProdFiscal,
    agregarLineaCompra, modificarLineaCompra, quitarLineaCompra,
    totalesFormCompra, contabilizarAuto, setContabilizarAuto,
    guardandoCompra, guardarCompraFiscal,
    cambiarFechaCompra, cambiarPeriodoCompra, avisoPeriodo
  } = alta;

  return (
    <>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '12px', marginBottom: '14px' }}>
        <div>
          <label style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Fecha</label>
          <input
            type="date"
            value={formCompra.fecha}
            min={diaIso(alta.periodoDocCompra?.fechaInicio)}
            max={diaIso(alta.periodoDocCompra?.fechaFin)}
            onChange={(e) => cambiarFechaCompra(e.target.value)}
            style={inputChico}
          />
        </div>
        <div>
          <SelectorPeriodoDoc
            periodos={periodos}
            periodoId={formCompra.periodoId}
            onChange={cambiarPeriodoCompra}
          />
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

      {/* Aviso: el documento afecta a un periodo distinto del contexto */}
      {avisoPeriodo && (
        <div style={{ background: '#3a2f05', border: '1px solid #f59e0b', color: '#fcd34d', padding: '8px 12px', borderRadius: '8px', fontSize: '0.78rem', marginBottom: '14px' }}>
          ⚠️ {avisoPeriodo}
        </div>
      )}

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
          <button onClick={onCancelar} style={{ background: '#475569', color: '#fff', border: 'none', borderRadius: '8px', padding: '9px 16px', cursor: 'pointer', fontWeight: 'bold' }}>Cancelar</button>
          <button onClick={guardarCompraFiscal} disabled={guardandoCompra} style={{ background: '#16a34a', color: '#fff', border: 'none', borderRadius: '8px', padding: '9px 18px', cursor: guardandoCompra ? 'wait' : 'pointer', fontWeight: 'bold', opacity: guardandoCompra ? 0.6 : 1 }}>
            {guardandoCompra ? '⏳ Guardando…' : '💾 Guardar factura'}
          </button>
        </div>
      </div>
    </>
  );
}
