import { fmt, TIPOS_TRANSACCION, inputChico } from './libroComprasHelpers';

// ---------------------------------------------------------------------------
// FORMULARIO DE ALTA DE GASTO FISCAL: concepto contable + alícuota en Bs.,
// datos fiscales del documento soporte (Libro de Compras SENIAT) y bloque de
// sujeción ISLR (modo híbrido; la emisión siempre es explícita por documento).
// Presentacional: el estado viven en useAltaGasto (prop `alta`).
// ---------------------------------------------------------------------------
export default function FormularioGastoFiscal({ alta, proveedores, onCancelar }) {
  const {
    formGasto, setFormGasto, conceptosGasto,
    islrEnGasto, setIslrEnGasto,
    alicuotaGasto, baseGastoBs, ivaGastoBs,
    contabilizarGastoAuto, setContabilizarGastoAuto,
    guardandoGasto, guardarGasto
  } = alta;

  return (
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
              // a ISLR» se premarca la casilla (siempre desmarcable: la
              // emisión es explícita por documento).
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
        <button onClick={onCancelar} style={{ background: '#475569', color: '#fff', border: 'none', borderRadius: '8px', padding: '9px 16px', cursor: 'pointer', fontWeight: 'bold' }}>Cancelar</button>
        <button onClick={guardarGasto} disabled={guardandoGasto} style={{ background: '#16a34a', color: '#fff', border: 'none', borderRadius: '8px', padding: '9px 18px', cursor: guardandoGasto ? 'wait' : 'pointer', fontWeight: 'bold', opacity: guardandoGasto ? 0.6 : 1 }}>
          {guardandoGasto ? '⏳ Guardando…' : '💾 Guardar gasto'}
        </button>
      </div>
    </>
  );
}
