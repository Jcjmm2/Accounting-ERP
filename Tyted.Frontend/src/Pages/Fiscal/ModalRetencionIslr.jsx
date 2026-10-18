import { fmt, calcularRetencionIslr } from './libroComprasHelpers';

// ---------------------------------------------------------------------------
// MODAL DE EMISIÓN DE RETENCIÓN DE ISLR (Decreto 1.808): selector de concepto
// del catálogo, base imponible EDITABLE con tope = base del documento origen
// y vista previa del cálculo (Base × % − Sustraendo) con el mismo redondeo
// que el backend. Presentacional: el estado y la emisión viven en el hook
// useRetencionIslr (la página los pasa como props).
// ---------------------------------------------------------------------------
export default function ModalRetencionIslr({ modal, conceptos, onCambio, onEmitir, onCerrar, emitiendo }) {
  if (!modal) return null;
  const docIslr = modal.compra || modal.gasto;
  const proveedorIslr = docIslr?.proveedor || {};

  return (
    <div
      onClick={(e) => { if (e.target === e.currentTarget) onCerrar(); }}
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 }}
    >
      <div role="dialog" aria-modal="true" style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '12px', padding: '24px', width: '560px', maxHeight: '90vh', overflowY: 'auto' }}>
        <h3 style={{ margin: '0 0 4px 0', color: '#60a5fa', fontSize: '1.1rem' }}>📑 Retención de ISLR (Decreto 1.808)</h3>
        <p style={{ color: '#94a3b8', fontSize: '0.82rem', margin: '0 0 16px 0' }}>
          {modal.gasto ? 'Gasto' : 'Factura'} <b>{docIslr?.numeroFactura || '(s/n)'}</b>
          {modal.gasto && <> · <b>{docIslr.concepto || ''}</b></>}
          {' · '}Proveedor <b>{proveedorIslr.razonsocial || '—'}</b>
          ({proveedorIslr.rif || 'S/RIF'})
        </p>

        <label style={{ fontSize: '0.78rem', color: '#93c5fd', fontWeight: 'bold' }}>Concepto de retención (catálogo Decreto 1.808):</label>
        <select
          value={modal.conceptoId}
          onChange={(e) => onCambio({ conceptoId: e.target.value })}
          style={{ background: '#0f172a', color: '#fff', border: '1px solid #475569', borderRadius: '6px', padding: '9px 10px', width: '100%', marginTop: '6px' }}
        >
          <option value="">Seleccione el concepto…</option>
          {conceptos.map((c) => (
            <option key={c.id} value={c.id}>
              {c.codigoSeniat} — {c.nombreConcepto} ({c.tipoPersona} {c.porcentajeRetencion}%)
            </option>
          ))}
        </select>

        {/* Base imponible EDITABLE (retención parcial): con tope = base del
            documento origen; el backend además valida el tope en el servidor. */}
        <div style={{ marginTop: '14px' }}>
          <label style={{ fontSize: '0.78rem', color: '#93c5fd', fontWeight: 'bold' }}>
            Base imponible a retener (Bs.) — sin IVA
          </label>
          <input
            type="number"
            min="0.01"
            step="0.01"
            max={Number(modal.baseMax) || undefined}
            value={modal.baseBs}
            onChange={(e) => onCambio({ baseBs: e.target.value })}
            style={{ background: '#0f172a', color: '#fff', border: '1px solid #475569', borderRadius: '6px', padding: '9px 10px', width: '100%', marginTop: '6px' }}
          />
          <span style={{ fontSize: '0.72rem', color: '#64748b' }}>
            Máx. Bs. {fmt(modal.baseMax)} (base sin IVA del documento origen).
            Puede reducirla para retener sólo una parte (p. ej. servicios en factura mixta).
          </span>
        </div>

        {/* Vista previa del cálculo con el concepto elegido */}
        {modal.conceptoId && (() => {
          const concepto = conceptos.find((x) => Number(x.id) === Number(modal.conceptoId));
          if (!concepto) return null;
          const { pct, sustraendo, neto } = calcularRetencionIslr(concepto, modal.baseBs);
          return (
            <div style={{ background: '#0f172a', border: '1px solid #334155', borderRadius: '8px', padding: '14px', marginTop: '16px', fontSize: '0.85rem', lineHeight: '1.8' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: '#94a3b8' }}>Base imponible (Bs.)</span><b>{fmt(modal.baseBs)}</b></div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: '#94a3b8' }}>Tarifa</span><b>{pct}%</b></div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: '#94a3b8' }}>Sustraendo (Bs.)</span><b style={{ color: sustraendo > 0 ? '#34d399' : '#64748b' }}>{fmt(sustraendo)}</b></div>
              <div style={{ borderTop: '1px solid #334155', marginTop: '8px', paddingTop: '8px', display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#94a3b8', fontWeight: 'bold' }}>Monto a retener (Bs.)</span>
                <b style={{ color: '#fbbf24', fontSize: '1rem' }}>{fmt(neto)}</b>
              </div>
              {sustraendo > 0 && (
                <div style={{ fontSize: '0.7rem', color: '#64748b', marginTop: '6px' }}>
                  Sustraendo calculado con la Unidad Tributaria VIGENTE (⚙️ Conceptos → 📑 ISLR);
                  el backend lo recalcula con la UT vigente al momento de emitir.
                </div>
              )}
            </div>
          );
        })()}

        <div style={{ display: 'flex', gap: '10px', marginTop: '20px', justifyContent: 'flex-end' }}>
          <button onClick={onCerrar} style={{ background: '#475569', color: '#fff', border: 'none', borderRadius: '8px', padding: '9px 16px', cursor: 'pointer', fontWeight: 'bold' }}>Cancelar</button>
          <button
            onClick={onEmitir}
            disabled={!modal.conceptoId || emitiendo}
            style={{
              background: '#1d4ed8', color: '#fff', border: 'none', borderRadius: '8px', padding: '9px 18px',
              cursor: !modal.conceptoId || emitiendo ? 'not-allowed' : 'pointer',
              fontWeight: 'bold', opacity: !modal.conceptoId || emitiendo ? 0.6 : 1
            }}
          >
            {emitiendo ? '⏳ Emitiendo…' : '📑 Emitir retención ISLR'}
          </button>
        </div>
      </div>
    </div>
  );
}
