import { fmt, formatearFecha, desgloseCompra, TIPOS_TRANSACCION, thStyle, tdStyle, inputChico } from './libroComprasHelpers';
import { desgloseGasto } from './reportesLibrosFiscal';
import { generarComprobanteIVA, generarComprobanteISLR } from './reportesRetenciones';

// ---------------------------------------------------------------------------
// TABLA COMBINADA DEL LIBRO (facturas + gastos) PARA CONSULTA Y EDICIÓN:
// alícuotas, retenciones IVA/ISLR (emitir/imprimir/contabilizar/anular),
// comprobante contable y edición en fila de los datos fiscales SENIAT.
// Presentacional: todo el estado y las acciones llegan por props.
// ---------------------------------------------------------------------------
export default function TablaDocumentosCombinados({
  documentosCombinados, retencionPorCompra, retencionIslrPorCompra, retencionIslrPorGasto,
  editandoId, setEditandoId, formFiscal, setFormFiscal, procesandoId,
  abrirEdicion, guardarFiscal, contabilizar, contabilizarGastoAccion, emitirRetencion,
  abrirModalIslr, contabilizarRetencionIslrAccion, anularRetencionIslrAccion,
  empresaActiva, periodoActivo
}) {
  return (
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
                      {/* Acciones sobre la retención ISLR del gasto: contabilizar y anular */}
                      {retencionIslrPorGasto.has(Number(c.id)) && (() => {
                        const retG = retencionIslrPorGasto.get(Number(c.id));
                        return (
                          <>
                            <button
                              onClick={() => contabilizarRetencionIslrAccion(retG)}
                              disabled={Boolean(retG.asientoContableId)}
                              title={retG.asientoContableId
                                ? `Ya tiene comprobante contable (asiento #${retG.asientoContableId})`
                                : 'Generar el comprobante contable de la retención (Debe Proveedores / Haber ISLR retenido)'}
                              style={{
                                background: retG.asientoContableId ? '#064e3b' : '#7c3aed',
                                color: '#fff', border: 'none', borderRadius: '5px', padding: '5px 9px',
                                cursor: retG.asientoContableId ? 'not-allowed' : 'pointer',
                                marginLeft: '6px', opacity: retG.asientoContableId ? 0.6 : 1
                              }}
                            >🧾</button>
                            <button
                              onClick={() => anularRetencionIslrAccion(retG)}
                              title="Anular la retención de ISLR (motivo auditado; genera reverso contable si ya estaba contabilizada)"
                              style={{
                                background: '#7f1d1d', color: '#fff', border: 'none', borderRadius: '5px',
                                padding: '5px 9px', cursor: 'pointer', marginLeft: '6px'
                              }}
                            >🗑️</button>
                          </>
                        );
                      })()}
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
                        disabled={c.isAnulada || !c.proveedor?.rif}
                        title={!c.proveedor?.rif
                          ? 'La factura debe tener proveedor con RIF para emitir retención de ISLR'
                          : retencionIslrPorCompra.has(Number(c.id))
                            ? 'Imprimir comprobante de retención de ISLR (Decreto 1.808)'
                            : 'Emitir comprobante de retención de ISLR (Decreto 1.808)'}
                        style={{
                          background: retencionIslrPorCompra.has(Number(c.id)) ? '#16a34a' : '#2563eb',
                          color: '#fff', border: 'none', borderRadius: '5px', padding: '5px 9px',
                          cursor: c.isAnulada || !c.proveedor?.rif ? 'not-allowed' : 'pointer',
                          marginLeft: '6px',
                          opacity: c.isAnulada || !c.proveedor?.rif ? 0.6 : 1
                        }}
                      >
                        {retencionIslrPorCompra.has(Number(c.id)) ? '🖨️ ISLR' : '📑 ISLR'}
                      </button>
                      {/* Acciones sobre la retención ISLR de la factura: contabilizar y anular */}
                      {retencionIslrPorCompra.has(Number(c.id)) && (() => {
                        const retF = retencionIslrPorCompra.get(Number(c.id));
                        return (
                          <>
                            <button
                              onClick={() => contabilizarRetencionIslrAccion(retF)}
                              disabled={Boolean(retF.asientoContableId)}
                              title={retF.asientoContableId
                                ? `Ya tiene comprobante contable (asiento #${retF.asientoContableId})`
                                : 'Generar el comprobante contable de la retención (Debe Proveedores / Haber ISLR retenido)'}
                              style={{
                                background: retF.asientoContableId ? '#064e3b' : '#7c3aed',
                                color: '#fff', border: 'none', borderRadius: '5px', padding: '5px 9px',
                                cursor: retF.asientoContableId ? 'not-allowed' : 'pointer',
                                marginLeft: '6px', opacity: retF.asientoContableId ? 0.6 : 1
                              }}
                            >🧾</button>
                            <button
                              onClick={() => anularRetencionIslrAccion(retF)}
                              title="Anular la retención de ISLR (motivo auditado; genera reverso contable si ya estaba contabilizada)"
                              style={{
                                background: '#7f1d1d', color: '#fff', border: 'none', borderRadius: '5px',
                                padding: '5px 9px', cursor: 'pointer', marginLeft: '6px'
                              }}
                            >🗑️</button>
                          </>
                        );
                      })()}
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
  );
}
