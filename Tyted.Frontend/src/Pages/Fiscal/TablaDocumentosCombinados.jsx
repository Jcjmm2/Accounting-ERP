import { fmt } from './libroComprasHelpers';

const thStyle = {
  padding: '9px 8px',
  textAlign: 'left',
  fontWeight: 'bold',
  fontSize: '0.74rem',
  letterSpacing: '0.02em',
  whiteSpace: 'nowrap'
};

const tdStyle = {
  padding: '8px',
  borderTop: '1px solid #1f2937',
  verticalAlign: 'middle',
  fontSize: '0.8rem'
};

const formatearFechaCorta = (fecha) => {
  if (!fecha) return '—';
  const partes = String(fecha).split(/[-T]/);
  if (partes.length >= 3) return `${partes[2].slice(0, 2)}/${partes[1]}/${partes[0]}`;
  return fecha;
};

export default function TablaDocumentosCombinados({
  documentosCombinados = [],
  retencionPorCompra,
  retencionIslrPorCompra,
  retencionIslrPorGasto,
  procesandoId,
  abrirConsultaEdicion,
  contabilizar,
  contabilizarGastoAccion,
  emitirRetencion,
  contabilizarRetencionIvaAccion,
  registrarPagoCompraAccion,
  abrirModalIslr,
  contabilizarRetencionIslrAccion
}) {
  return (
    <div style={{ background: '#111827', borderRadius: '12px', overflowX: 'auto', border: '1px solid #334155', position: 'relative' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ background: '#1e293b', color: '#93c5fd' }}>
            <th style={thStyle}>FECHA</th>
            <th style={thStyle}>TIPO</th>
            <th style={thStyle}>DOCUMENTO / CONCEPTO</th>
            <th style={thStyle}>PROVEEDOR (RIF)</th>
            <th style={{ ...thStyle, textAlign: 'right' }}>BASE / EXENTO (Bs.)</th>
            <th style={{ ...thStyle, textAlign: 'right' }}>IVA CRÉDITO</th>
            <th style={{ ...thStyle, textAlign: 'right' }}>TOTAL (Bs.)</th>
            <th style={thStyle}>ESTADO</th>
            <th style={{
              ...thStyle,
              textAlign: 'center',
              position: 'sticky',
              right: 0,
              background: '#1e293b',
              boxShadow: '-4px 0 8px rgba(0,0,0,0.35)',
              zIndex: 2
            }}>
              ACCIONES
            </th>
          </tr>
        </thead>
        <tbody>
          {documentosCombinados.map((item, idx) => {
            const esGasto = Boolean(item.esGasto);
            const doc = item.dato || item;
            const fecha = doc.fecha || doc.fechaCompra || doc.fechaGasto;
            const proveedorNombre = doc.proveedor?.nombre || doc.proveedor?.razonSocial || doc.proveedorNombre || '— CAJA —';
            const proveedorRif = doc.proveedor?.rif || doc.proveedorRif || 'S/RIF';
            const sinProveedor = proveedorNombre.includes('CAJA') || proveedorRif === 'S/RIF';

            const exento = Number(doc.exento ?? doc.montoExento ?? 0);
            const base8 = Number(doc.base8 ?? 0);
            const base16 = Number(doc.base16 ?? doc.baseGravada ?? doc.subtotalMonedaExt ?? 0);
            const baseTotal = base8 + base16;
            const iva = Number(doc.iva ?? doc.ivaMonedaExt ?? 0);
            const total = Number(doc.total ?? doc.totalMonedaExt ?? (exento + baseTotal + iva));

            const retIva = !esGasto ? retencionPorCompra?.get(Number(doc.id)) : null;
            const retIslr = esGasto
              ? retencionIslrPorGasto?.get(Number(doc.id))
              : retencionIslrPorCompra?.get(Number(doc.id));

            const rowBg = doc.isAnulada ? '#2d1215' : (idx % 2 === 0 ? '#111827' : '#0f172a');

            return (
              <tr key={`${esGasto ? 'G' : 'C'}-${doc.id}`} style={{ background: rowBg, opacity: doc.isAnulada ? 0.65 : 1 }}>
                <td style={{ ...tdStyle, whiteSpace: 'nowrap' }}>
                  {formatearFechaCorta(fecha)}
                </td>
                <td style={tdStyle}>
                  <span style={{
                    background: esGasto ? '#78350f' : '#064e3b',
                    color: esGasto ? '#fcd34d' : '#6ee7b7',
                    padding: '3px 7px', borderRadius: '6px', fontSize: '0.68rem', fontWeight: 'bold',
                    display: 'inline-block'
                  }}>
                    {esGasto ? 'GASTO' : 'FACTURA'}
                  </span>
                  <span style={{ display: 'block', fontSize: '0.68rem', color: '#94a3b8', marginTop: '2px' }}>
                    Tipo {doc.tipoTransaccion || '01'}
                  </span>
                </td>

                <td style={{ ...tdStyle, maxWidth: '240px' }}>
                  <div style={{ fontWeight: 'bold', color: '#f1f5f9', lineHeight: 1.25 }}>
                    {esGasto ? (doc.concepto || 'Gasto fiscal') : `Factura #${doc.numeroFactura || 'S/N'}`}
                  </div>
                  <div style={{ fontSize: '0.72rem', color: '#94a3b8', fontFamily: 'monospace', marginTop: '2px' }}>
                    {doc.numeroFactura || 'S/F'} · {doc.numeroControl || 'Sin control'}
                  </div>
                  {(doc.conceptoContableNombre || doc.nombreConcepto) && (
                    <span style={{
                      display: 'inline-block', marginTop: '3px', background: '#1e293b',
                      color: '#fbbf24', border: '1px solid #334155', padding: '1px 6px',
                      borderRadius: '5px', fontSize: '0.68rem'
                    }}>
                      {doc.conceptoContableNombre || doc.nombreConcepto}
                    </span>
                  )}
                </td>

                <td style={{ ...tdStyle, maxWidth: '200px' }}>
                  <div style={{ fontWeight: '600', color: sinProveedor ? '#fca5a5' : '#e2e8f0', lineHeight: 1.25 }}>
                    {proveedorNombre}
                  </div>
                  <div style={{ fontSize: '0.72rem', color: '#94a3b8', fontFamily: 'monospace' }}>
                    {proveedorRif}
                  </div>
                </td>

                <td style={{ ...tdStyle, textAlign: 'right', whiteSpace: 'nowrap' }}>
                  {baseTotal > 0 && (
                    <div style={{ color: '#34d399', fontWeight: '600' }}>
                      {fmt(baseTotal)}
                      <span style={{ display: 'block', fontSize: '0.67rem', color: '#94a3b8' }}>
                        {base8 > 0 ? 'Base 8%' : 'Base 16%'}
                      </span>
                    </div>
                  )}
                  {exento > 0 && (
                    <div style={{ color: '#cbd5e1' }}>
                      {fmt(exento)}
                      <span style={{ display: 'block', fontSize: '0.67rem', color: '#94a3b8' }}>
                        Exento
                      </span>
                    </div>
                  )}
                  {baseTotal === 0 && exento === 0 && '0,00'}
                </td>

                <td style={{ ...tdStyle, textAlign: 'right', whiteSpace: 'nowrap', color: iva > 0 ? '#fbbf24' : '#64748b', fontWeight: iva > 0 ? 'bold' : 'normal' }}>
                  {fmt(iva)}
                </td>

                <td style={{ ...tdStyle, textAlign: 'right', whiteSpace: 'nowrap', fontWeight: 'bold', fontSize: '0.88rem', color: '#fff' }}>
                  {fmt(total)}
                </td>

                <td style={{ ...tdStyle, whiteSpace: 'nowrap', fontSize: '0.72rem' }}>
                  {doc.asientoContableId ? (
                    <span style={{ color: '#34d399', fontWeight: 'bold', display: 'block' }}>
                      ✅ Asiento #{doc.asientoContableId}
                    </span>
                  ) : (
                    <span style={{ color: '#94a3b8', display: 'block' }}>⏳ Sin asiento</span>
                  )}
                  {retIva && (
                    <span style={{ color: '#f472b6', display: 'block' }}>
                      Ret. IVA {retIva.porcentajeRetencion}%
                    </span>
                  )}
                  {retIslr && (
                    <span style={{ color: '#60a5fa', display: 'block' }}>
                      Ret. ISLR {fmt(retIslr.montoRetenido)}
                    </span>
                  )}
                </td>
                {/* 9. ACCIONES FIJAS A LA DERECHA (Consultar / Editar + Contabilizar + Retener) */}
                <td style={{
                  ...tdStyle,
                  textAlign: 'center',
                  whiteSpace: 'nowrap',
                  position: 'sticky',
                  right: 0,
                  background: rowBg,
                  boxShadow: '-4px 0 8px rgba(0,0,0,0.35)',
                  zIndex: 1
                }}>
                  <div style={{ display: 'inline-flex', gap: '5px', alignItems: 'center' }}>
                    <button
                      type="button"
                      onClick={() => abrirConsultaEdicion({ esGasto, dato: doc })}
                      title="Consultar detalle y editar datos fiscales del registro"
                      style={{
                        background: '#2563eb', color: '#fff', border: 'none', borderRadius: '6px',
                        padding: '5px 9px', cursor: 'pointer', fontWeight: 'bold', fontSize: '0.74rem'
                      }}
                    >
                      🔍✏️ Editar
                    </button>

                    {!doc.asientoContableId && !doc.isAnulada && (
                      <button
                        type="button"
                        onClick={() => (esGasto ? contabilizarGastoAccion(doc) : contabilizar(doc))}
                        disabled={procesandoId === doc.id}
                        title="Generar comprobante contable"
                        style={{
                          background: '#7c3aed', color: '#fff', border: 'none', borderRadius: '6px',
                          padding: '5px 8px', cursor: 'pointer', fontSize: '0.75rem'
                        }}
                      >
                        🧾
                      </button>
                    )}

                    {!esGasto && !doc.isAnulada && iva > 0 && !retIva && (
                      <button
                        type="button"
                        onClick={() => emitirRetencion(doc)}
                        title="Emitir comprobante de retención de IVA (75% o 100%)"
                        style={{
                          background: '#be185d', color: '#fff', border: 'none', borderRadius: '6px',
                          padding: '5px 8px', cursor: 'pointer', fontSize: '0.72rem', fontWeight: 'bold'
                        }}
                      >
                        %IVA
                      </button>
                    )}

                    {!esGasto && retIva && !retIva.asientoContableId && !doc.esCredito && (
                      <button
                        type="button"
                        onClick={() => contabilizarRetencionIvaAccion(doc)}
                        title="Contabilizar retención de IVA"
                        style={{
                          background: '#9d174d', color: '#fff', border: 'none', borderRadius: '6px',
                          padding: '5px 8px', cursor: 'pointer', fontSize: '0.72rem'
                        }}
                      >
                        🧾IVA
                      </button>
                    )}

                    {!esGasto && doc.esCredito && !doc.pagada && !doc.isAnulada && (
                      <button
                        type="button"
                        onClick={() => registrarPagoCompraAccion(doc)}
                        title="Registrar pago de factura a crédito"
                        style={{
                          background: '#059669', color: '#fff', border: 'none', borderRadius: '6px',
                          padding: '5px 8px', cursor: 'pointer', fontSize: '0.75rem'
                        }}
                      >
                        💵
                      </button>
                    )}

                    {!doc.isAnulada && !retIslr && (
                      <button
                        type="button"
                        onClick={() => abrirModalIslr(doc, esGasto)}
                        title="Emitir retención de ISLR (Decreto 1.808)"
                        style={{
                          background: '#0369a1', color: '#fff', border: 'none', borderRadius: '6px',
                          padding: '5px 8px', cursor: 'pointer', fontSize: '0.72rem', fontWeight: 'bold'
                        }}
                      >
                        ISLR
                      </button>
                    )}

                    {retIslr && !retIslr.asientoContableId && (
                      <button
                        type="button"
                        onClick={() => contabilizarRetencionIslrAccion(retIslr)}
                        title="Contabilizar retención ISLR"
                        style={{
                          background: '#075985', color: '#fff', border: 'none', borderRadius: '6px',
                          padding: '5px 8px', cursor: 'pointer', fontSize: '0.72rem'
                        }}
                      >
                        🧾ISLR
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}