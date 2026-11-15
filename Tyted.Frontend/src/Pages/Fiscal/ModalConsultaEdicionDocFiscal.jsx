import { useState, useEffect } from 'react';
import { fmt } from './libroComprasHelpers';

const inputModal = {
  background: '#0f172a',
  color: '#fff',
  border: '1px solid #475569',
  borderRadius: '6px',
  padding: '7px 9px',
  fontSize: '0.82rem',
  width: '100%',
  boxSizing: 'border-box'
};

const TIPOS_SENIAT = [
  { valor: '01', etiqueta: '01 Registro' },
  { valor: '02', etiqueta: '02 Complemento' },
  { valor: '03', etiqueta: '03 Anulación' }
];

export default function ModalConsultaEdicionDocFiscal({
  docWrapper,
  proveedores = [],
  conceptosGasto = [],
  retencionIva = null,
  retencionIslr = null,
  onCerrar,
  onGuardarCambios
}) {
  const [modoEdicion, setModoEdicion] = useState(false);
  const [guardando, setGuardando] = useState(false);

  const esGasto = Boolean(docWrapper?.esGasto);
  const doc = docWrapper?.dato || docWrapper || {};

  // Si ya tiene asiento contable o retenciones vigentes, se protegen montos/proveedor
  const tieneAsiento = Boolean(doc.asientoContableId);
  const tieneRetencion = Boolean(retencionIva || retencionIslr);
  const bloqueadoContable = tieneAsiento || tieneRetencion;

  const [form, setForm] = useState({
    fecha: '',
    proveedorId: '',
    numeroFactura: '',
    numeroControl: '',
    tipoTransaccion: '01',
    conceptoOperacionalId: '',
    conceptoTexto: '',
    esCredito: false,
    exento: 0,
    baseGravada: 0,
    tasaIVA: 16,
    iva: 0
  });

  useEffect(() => {
    if (!docWrapper) return;
    const fechaRaw = doc.fecha || doc.fechaCompra || doc.fechaGasto || '';
    const fechaIso = fechaRaw ? String(fechaRaw).slice(0, 10) : '';

    const exentoIni = Number(doc.exento ?? doc.montoExento ?? 0);
    const baseIni = Number(doc.baseGravada ?? doc.subtotalMonedaExt ?? doc.baseImponible ?? 0);
    const ivaIni = Number(doc.iva ?? doc.ivaMonedaExt ?? doc.montoIva ?? 0);
    const tasaDetectada = baseIni > 0 && ivaIni > 0
      ? Math.round((ivaIni / baseIni) * 100)
      : Number(doc.tasaIVA ?? 16);

    setForm({
      fecha: fechaIso,
      proveedorId: String(doc.proveedorId ?? doc.codigoProv ?? doc.proveedor?.id ?? doc.proveedor?.codigoProv ?? ''),
      numeroFactura: doc.numeroFactura || doc.numeroDocumento || '',
      numeroControl: doc.numeroControl || '',
      tipoTransaccion: doc.tipoTransaccion || '01',
      conceptoOperacionalId: String(doc.conceptoOperacionalId || ''),
      conceptoTexto: doc.concepto || doc.descripcion || '',
      esCredito: Boolean(doc.esCredito),
      exento: exentoIni,
      baseGravada: baseIni,
      tasaIVA: [8, 16, 31].includes(tasaDetectada) ? tasaDetectada : 16,
      iva: ivaIni
    });
    setModoEdicion(false);
  }, [docWrapper]);

  if (!docWrapper) return null;

  const recalcularIva = (nuevaBase, nuevaTasa) => {
    const b = Number(nuevaBase) || 0;
    const t = Number(nuevaTasa) || 0;
    return Math.round(b * (t / 100) * 100) / 100;
  };

  const totalCalculado = (Number(form.exento) || 0) + (Number(form.baseGravada) || 0) + (Number(form.iva) || 0);
  const lineasDetalle = doc.detalles?.$values || doc.detalles || [];
  const manejarGuardar = async (e) => {
    e.preventDefault();
    if (!form.fecha) {
      alert('⚠️ La fecha del documento es obligatoria.');
      return;
    }
    setGuardando(true);
    try {
      await onGuardarCambios({
        esGasto,
        id: doc.id,
        bloqueadoContable,
        payload: {
          fecha: `${form.fecha}T12:00:00`,
          proveedorId: form.proveedorId ? Number(form.proveedorId) : null,
          numeroFactura: form.numeroFactura.trim() || null,
          numeroControl: form.numeroControl.trim() || null,
          tipoTransaccion: form.tipoTransaccion,
          conceptoOperacionalId: form.conceptoOperacionalId ? Number(form.conceptoOperacionalId) : null,
          concepto: form.conceptoTexto.trim(),
          esCredito: form.esCredito,
          exento: Number(form.exento) || 0,
          baseGravada: Number(form.baseGravada) || 0,
          tasaIVA: Number(form.tasaIVA) || 16,
          iva: Number(form.iva) || 0,
          total: totalCalculado
        }
      });
      setModoEdicion(false);
    } finally {
      setGuardando(false);
    }
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(2, 6, 23, 0.80)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1300, padding: '16px'
    }}>
      <div style={{
        background: '#1e293b', border: `1px solid ${esGasto ? '#f59e0b' : '#10b981'}`,
        borderRadius: '12px', width: '100%', maxWidth: '760px', maxHeight: '92vh',
        overflowY: 'auto', padding: '22px', color: '#e2e8f0', boxShadow: '0 20px 40px rgba(0,0,0,0.5)'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', marginBottom: '14px', borderBottom: '1px solid #334155', paddingBottom: '12px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{
                background: esGasto ? '#78350f' : '#064e3b',
                color: esGasto ? '#fcd34d' : '#6ee7b7',
                padding: '2px 9px', borderRadius: '8px', fontSize: '0.72rem', fontWeight: 'bold'
              }}>
                {esGasto ? '💸 GASTO FISCAL' : '🧾 FACTURA DE COMPRA'}
              </span>
              <h3 style={{ margin: 0, fontSize: '1.05rem', color: '#fff' }}>
                {modoEdicion ? '✏️ Editando registro fiscal' : '🔍 Consulta de registro fiscal'} #{doc.id}
              </h3>
            </div>
            <span style={{ fontSize: '0.76rem', color: '#94a3b8' }}>
              {tieneAsiento
                ? `✅ Contabilizado (Asiento #${doc.asientoContableId})`
                : '⏳ Pendiente por contabilizar'}
              {retencionIva ? ` · Ret. IVA: ${retencionIva.numeroComprobante}` : ''}
              {retencionIslr ? ` · Ret. ISLR: ${retencionIslr.numeroComprobante}` : ''}
            </span>
          </div>

          <div style={{ display: 'flex', gap: '8px' }}>
            {!modoEdicion && !doc.isAnulada && (
              <button
                type="button"
                onClick={() => setModoEdicion(true)}
                style={{
                  background: '#2563eb', color: '#fff', border: 'none', borderRadius: '7px',
                  padding: '7px 14px', cursor: 'pointer', fontWeight: 'bold', fontSize: '0.82rem'
                }}
              >
                ✏️ Editar registro
              </button>
            )}
            <button
              type="button"
              onClick={onCerrar}
              style={{
                background: '#334155', color: '#fff', border: 'none', borderRadius: '7px',
                padding: '7px 12px', cursor: 'pointer', fontWeight: 'bold'
              }}
            >
              ✕
            </button>
          </div>
        </div>

        {modoEdicion && bloqueadoContable && (
          <div style={{
            background: '#3a2f05', border: '1px solid #f59e0b', color: '#fcd34d',
            padding: '9px 12px', borderRadius: '8px', fontSize: '0.78rem', marginBottom: '14px'
          }}>
            ⚠️ <b>Protección contable activa:</b> Este documento ya posee comprobante contable o retención emitida. Puedes corregir <b>N° Factura, N° Control, Tipo SENIAT y Descripción</b>; para modificar montos o proveedor debes anular primero el asiento/retención.
          </div>
        )}

        <form onSubmit={manejarGuardar}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(175px, 1fr))', gap: '12px', marginBottom: '14px' }}>
            <div>
              <label style={{ fontSize: '0.74rem', color: '#94a3b8' }}>Fecha del documento</label>
              <input
                type="date"
                value={form.fecha}
                disabled={!modoEdicion || bloqueadoContable}
                onChange={(e) => setForm({ ...form, fecha: e.target.value })}
                style={inputModal}
              />
            </div>

            <div>
              <label style={{ fontSize: '0.74rem', color: '#94a3b8' }}>Tipo (SENIAT)</label>
              <select
                value={form.tipoTransaccion}
                disabled={!modoEdicion}
                onChange={(e) => setForm({ ...form, tipoTransaccion: e.target.value })}
                style={inputModal}
              >
                {TIPOS_SENIAT.map((t) => (
                  <option key={t.valor} value={t.valor}>{t.etiqueta}</option>
                ))}
              </select>
            </div>

            <div>
              <label style={{ fontSize: '0.74rem', color: '#94a3b8' }}>N° Factura / Documento</label>
              <input
                type="text"
                value={form.numeroFactura}
                disabled={!modoEdicion}
                onChange={(e) => setForm({ ...form, numeroFactura: e.target.value })}
                placeholder="000148"
                style={inputModal}
              />
            </div>

            <div>
              <label style={{ fontSize: '0.74rem', color: '#94a3b8' }}>N° Control</label>
              <input
                type="text"
                value={form.numeroControl}
                disabled={!modoEdicion}
                onChange={(e) => setForm({ ...form, numeroControl: e.target.value })}
                placeholder="00-000145"
                style={inputModal}
              />
            </div>

            <div style={{ gridColumn: 'span 2' }}>
              <label style={{ fontSize: '0.74rem', color: '#94a3b8' }}>Proveedor</label>
              <select
                value={form.proveedorId}
                disabled={!modoEdicion || bloqueadoContable}
                onChange={(e) => setForm({ ...form, proveedorId: e.target.value })}
                style={inputModal}
              >
                <option value="">— SIN PROVEEDOR / CAJA —</option>
                {proveedores.map((p) => {
                  const provId = p.codigoProv ?? p.id;
                  const provNombre = p.razonsocial || p.razonSocial || p.nombre || '';
                  const provRif = p.rif || p.RIF || 'S/RIF';
                  return (
                    <option key={provId} value={provId}>
                      {provNombre} ({provRif})
                    </option>
                  );
                })}
              </select>
            </div>

            {esGasto && (
              <>
                <div style={{ gridColumn: 'span 2' }}>
                  <label style={{ fontSize: '0.74rem', color: '#94a3b8' }}>Concepto Contable (Cuenta de Gasto)</label>
                  <select
                    value={form.conceptoOperacionalId}
                    disabled={!modoEdicion || bloqueadoContable}
                    onChange={(e) => setForm({ ...form, conceptoOperacionalId: e.target.value })}
                    style={inputModal}
                  >
                    <option value="">Seleccione concepto contable…</option>
                    {conceptosGasto.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.nombreConcepto} (Cta: {c.cuentaContable})
                      </option>
                    ))}
                  </select>
                </div>

                <div style={{ gridColumn: '1 / -1' }}>
                  <label style={{ fontSize: '0.74rem', color: '#94a3b8' }}>Descripción / Concepto del gasto</label>
                  <input
                    type="text"
                    value={form.conceptoTexto}
                    disabled={!modoEdicion}
                    onChange={(e) => setForm({ ...form, conceptoTexto: e.target.value })}
                    placeholder="Detalle del gasto registrado"
                    style={inputModal}
                  />
                </div>
              </>
            )}
          </div>
          {/* Sección de montos fiscales en Bs. */}
          <div style={{ background: '#0f172a', border: '1px solid #334155', borderRadius: '8px', padding: '14px', marginBottom: '14px' }}>
            <div style={{ fontSize: '0.78rem', fontWeight: 'bold', color: '#93c5fd', marginBottom: '10px' }}>
              💰 Desglose Fiscal en Bolívares (Bs.)
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '10px' }}>
              <div>
                <label style={{ fontSize: '0.72rem', color: '#94a3b8' }}>Monto Exento (Bs.)</label>
                <input type="number" step="0.01" min="0" value={form.exento}
                  disabled={!modoEdicion || bloqueadoContable || !esGasto}
                  onChange={(e) => setForm({ ...form, exento: e.target.value })}
                  style={inputModal} />
              </div>

              <div>
                <label style={{ fontSize: '0.72rem', color: '#94a3b8' }}>Base Gravada (Bs.)</label>
                <input type="number" step="0.01" min="0" value={form.baseGravada}
                  disabled={!modoEdicion || bloqueadoContable || !esGasto}
                  onChange={(e) => {
                    const nuevaBase = e.target.value;
                    setForm({ ...form, baseGravada: nuevaBase, iva: recalcularIva(nuevaBase, form.tasaIVA) });
                  }}
                  style={inputModal} />
              </div>

              <div>
                <label style={{ fontSize: '0.72rem', color: '#94a3b8' }}>Alícuota IVA</label>
                <select value={form.tasaIVA}
                  disabled={!modoEdicion || bloqueadoContable || !esGasto}
                  onChange={(e) => {
                    const nuevaTasa = Number(e.target.value);
                    setForm({ ...form, tasaIVA: nuevaTasa, iva: recalcularIva(form.baseGravada, nuevaTasa) });
                  }}
                  style={inputModal}>
                  <option value={8}>8%</option>
                  <option value={16}>16%</option>
                  <option value={31}>31%</option>
                </select>
              </div>

              <div>
                <label style={{ fontSize: '0.72rem', color: '#94a3b8' }}>IVA Crédito Fiscal (Bs.)</label>
                <input type="number" step="0.01" min="0" value={form.iva}
                  disabled={!modoEdicion || bloqueadoContable || !esGasto}
                  onChange={(e) => setForm({ ...form, iva: e.target.value })}
                  style={inputModal} />
              </div>
            </div>

            <div style={{ marginTop: '12px', paddingTop: '10px', borderTop: '1px solid #1e293b', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>Total Documento Fiscal:</span>
              <span style={{ fontSize: '1.15rem', fontWeight: 'bold', color: '#34d399' }}>
                Bs. {fmt(totalCalculado)}
              </span>
            </div>
          </div>
          {/* Detalle de líneas si es una Factura de Compra con ítems */}
          {!esGasto && lineasDetalle.length > 0 && (
            <div style={{ background: '#0f172a', border: '1px solid #334155', borderRadius: '8px', padding: '12px', marginBottom: '14px' }}>
              <div style={{ fontSize: '0.78rem', fontWeight: 'bold', color: '#93c5fd', marginBottom: '8px' }}>
                📦 Líneas registradas en la factura ({lineasDetalle.length})
              </div>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem' }}>
                <thead>
                  <tr style={{ color: '#94a3b8', borderBottom: '1px solid #334155', textAlign: 'left' }}>
                    <th style={{ padding: '5px' }}>Descripción</th>
                    <th style={{ padding: '5px', textAlign: 'right' }}>Cant.</th>
                    <th style={{ padding: '5px', textAlign: 'right' }}>IVA %</th>
                    <th style={{ padding: '5px', textAlign: 'right' }}>Subtotal Bs.</th>
                  </tr>
                </thead>
                <tbody>
                  {lineasDetalle.map((l, i) => (
                    <tr key={i} style={{ borderBottom: '1px solid #1e293b' }}>
                      <td style={{ padding: '5px' }}>{l.descripcion || l.producto?.nombre || 'Ítem'}</td>
                      <td style={{ padding: '5px', textAlign: 'right' }}>{l.cantidad}</td>
                      <td style={{ padding: '5px', textAlign: 'right' }}>{l.tasaIVA ?? 0}%</td>
                      <td style={{ padding: '5px', textAlign: 'right' }}>{fmt(l.subtotalLineaMonedaExt ?? l.subtotal)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Botonera inferior */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '14px' }}>
            {modoEdicion ? (
              <>
                <button type="button" onClick={() => setModoEdicion(false)}
                  style={{ background: '#475569', color: '#fff', border: 'none', borderRadius: '8px', padding: '8px 16px', cursor: 'pointer', fontWeight: 'bold' }}>
                  Cancelar edición
                </button>
                <button type="submit" disabled={guardando}
                  style={{ background: '#16a34a', color: '#fff', border: 'none', borderRadius: '8px', padding: '8px 18px', cursor: 'pointer', fontWeight: 'bold' }}>
                  {guardando ? '⏳ Guardando…' : '💾 Guardar cambios'}
                </button>
              </>
            ) : (
              <button type="button" onClick={onCerrar}
                style={{ background: '#475569', color: '#fff', border: 'none', borderRadius: '8px', padding: '8px 18px', cursor: 'pointer', fontWeight: 'bold' }}>
                Cerrar
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}