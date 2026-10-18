import { useState } from 'react';
import { exportarLibroPdf, exportarLibroXls, fmtMoneda, formatearFechaLibro } from './reportesLibrosFiscal';

// ---------------------------------------------------------------------------
// MODAL DE RELACIÓN DE RETENCIÓN DE ISLR (Ley de Impuesto Sobre la Renta —
// Decreto 1.808): reporte del periodo SEPARADO del Libro de Compras, que es
// una obligación de la LEY DEL IVA y no debe mezclar impuestos de otras
// leyes. INMUTABILIDAD FISCAL: los montos se leen DIRECTO de los campos *Bs.
// congelados por el backend; aquí sólo se presentan y se exportan con los
// genéricos de los libros (PDF/Excel) sobre una estructura simple.
// ---------------------------------------------------------------------------

const FILTROS_ESTADO = [
  { valor: 'Emitida', etiqueta: '✅ Emitidas' },
  { valor: 'Anulada', etiqueta: '🚫 Anuladas' },
  { valor: 'TODAS', etiqueta: '📄 Todas' }
];

const thStyle = { padding: '8px 6px', textAlign: 'left', fontWeight: 'bold', whiteSpace: 'nowrap', borderBottom: '1.5px solid #000' };
const tdStyle = { padding: '6px', borderTop: '1px solid #e5e7eb', whiteSpace: 'nowrap', verticalAlign: 'middle' };

export default function ModalRelacionRetencionesIslr({ abierto, retenciones, cargando, empresa, periodo, fechaInicio, fechaFin, onCerrar }) {
  const [filtroEstado, setFiltroEstado] = useState('Emitida');
  if (!abierto) return null;

  const esAnulada = (r) => (r.estado || 'Emitida') === 'Anulada';
  // Retenciones del periodo ordenadas cronológicamente (relación oficial).
  const filtradas = (retenciones || [])
    .filter((r) => filtroEstado === 'TODAS' || (r.estado || 'Emitida') === filtroEstado)
    .sort((a, b) => new Date(a.fechaRetencion) - new Date(b.fechaRetencion));

  // INMUTABILIDAD: montos en Bs. congelados por el backend al emitir.
  const totales = filtradas.reduce((acc, r) => {
    acc.base += Number(r.baseImponibleBs ?? 0);
    acc.sustraendo += Number(r.sustraendoBs ?? 0);
    acc.retenido += Number(r.montoRetenidoBs ?? 0);
    return acc;
  }, { base: 0, sustraendo: 0, retenido: 0 });

  const columnas = [
    'N° Op', 'Fecha', 'N° Comprobante', 'Proveedor (RIF)', 'Origen', 'N° Factura', 'N° Control',
    'Cód. Concepto', 'Base Imponible (Bs.)', '% Ret.', 'Sustraendo (Bs.)', 'ISLR Retenido (Bs.)',
    'Estado', 'Comprobante Contable'
  ];
  const indicesMonto = [8, 9, 10, 11];

  // Estructura SIMPLE para los exportadores genéricos (sin fusiones Excel).
  const estructuraRelacion = () => ({
    titulo: 'Relación de Retenciones de ISLR (Ley ISLR)',
    empresa,
    periodo: { nombre: periodo?.nombre, fechaInicio, fechaFin },
    columnas,
    indicesMonto,
    filas: filtradas.map((r, i) => [
      i + 1,
      formatearFechaLibro(r.fechaRetencion),
      r.numeroComprobante || 'S/N',
      `${r.proveedorNombre || '—'} (${r.proveedorRif || 'S/RIF'})`,
      r.compraId ? 'Factura' : (r.gastoId ? 'Gasto' : '—'),
      r.numeroFactura || '—',
      r.numeroControl || '—',
      r.codigoConcepto || '—',
      fmtMoneda(r.baseImponibleBs),
      `${Number(r.porcentajeRetencion ?? 0)}%`,
      fmtMoneda(r.sustraendoBs),
      fmtMoneda(r.montoRetenidoBs),
      r.estado || 'Emitida',
      r.asientoContableId ? `Asiento #${r.asientoContableId}` : '— sin comprobante'
    ]),
    totales: [
      '',
      `TOTALES (${filtradas.length} comprobante${filtradas.length === 1 ? '' : 's'})`,
      '', '', '', '', '', '',
      fmtMoneda(totales.base), '', fmtMoneda(totales.sustraendo), fmtMoneda(totales.retenido),
      filtroEstado === 'TODAS' ? 'Todos' : filtroEstado, ''
    ]
  });

  return (
    <div
      onClick={(e) => { if (e.target === e.currentTarget) onCerrar(); }}
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000, padding: '20px' }}
    >
      <div role="dialog" aria-modal="true" style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '12px', padding: '24px', width: 'min(1280px, 96vw)', maxHeight: '92vh', overflowY: 'auto' }}>
        {/* Cabecera del modal */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '10px', marginBottom: '4px' }}>
          <h3 style={{ margin: 0, color: '#60a5fa', fontSize: '1.1rem' }}>📑 Relación de Retenciones de ISLR</h3>
          <button onClick={onCerrar} title="Cerrar" style={{ background: '#475569', color: '#fff', border: 'none', borderRadius: '6px', padding: '6px 12px', cursor: 'pointer', fontWeight: 'bold' }}>✕</button>
        </div>
        <p style={{ color: '#94a3b8', fontSize: '0.8rem', margin: '0 0 14px 0' }}>
          Ley de Impuesto Sobre la Renta (Decreto 1.808) · <b>{(empresa?.razonSocial || empresa?.nombre || 'EMPRESA').toUpperCase()}</b> RIF {empresa?.rif || '—'} ·
          {' '}{formatearFechaLibro(fechaInicio)} al {formatearFechaLibro(fechaFin)} · <b style={{ color: '#fbbf24' }}>{periodo?.nombre || 'Sin periodo'}</b>
          <br />
          Reporte INDEPENDIENTE del Libro de Compras (Ley del IVA): los impuestos de leyes distintas no se mezclan. Montos en Bs. (moneda fiscal).
        </p>

        {/* Filtro por estado + exportación */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px', marginBottom: '14px' }}>
          <div style={{ display: 'flex', gap: '6px' }}>
            {FILTROS_ESTADO.map((f) => (
              <button
                key={f.valor}
                onClick={() => setFiltroEstado(f.valor)}
                style={{
                  background: filtroEstado === f.valor ? '#2563eb' : '#0f172a',
                  color: filtroEstado === f.valor ? '#fff' : '#94a3b8',
                  border: '1px solid #334155', borderRadius: '8px',
                  padding: '7px 14px', cursor: 'pointer', fontWeight: 'bold', fontSize: '0.82rem'
                }}
              >
                {f.etiqueta}
              </button>
            ))}
          </div>
          <div style={{ display: 'flex', gap: '10px' }}>
            <button
              onClick={() => exportarLibroXls(estructuraRelacion())}
              style={{ display: 'flex', alignItems: 'center', gap: '8px', background: '#16a34a', color: '#fff', border: 'none', borderRadius: '8px', padding: '9px 14px', cursor: 'pointer', fontWeight: 'bold' }}
            >
              📊 Descargar Excel
            </button>
            <button
              onClick={() => exportarLibroPdf(estructuraRelacion())}
              style={{ display: 'flex', alignItems: 'center', gap: '8px', background: '#dc2626', color: '#fff', border: 'none', borderRadius: '8px', padding: '9px 14px', cursor: 'pointer', fontWeight: 'bold' }}
            >
              📄 Descargar PDF
            </button>
          </div>
        </div>

        {cargando ? (
          <div style={{ textAlign: 'center', padding: '40px', color: '#94a3b8' }}>⏳ Cargando la relación de retenciones de ISLR…</div>
        ) : filtradas.length === 0 ? (
          <div style={{ background: '#0f172a', border: '1px dashed #475569', padding: '30px', textAlign: 'center', borderRadius: '12px', color: '#94a3b8' }}>
            No hay retenciones de ISLR {filtroEstado === 'TODAS' ? '' : `${filtroEstado}s`} registradas en el periodo seleccionado.
          </div>
        ) : (
          <div style={{ background: '#ffffff', color: '#000000', padding: '16px', borderRadius: '8px', overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem' }}>
              <thead>
                <tr style={{ borderBottom: '1.5px solid #000' }}>
                  {columnas.map((col, idx) => (
                    <th key={`col-${idx}`} style={{ ...thStyle, textAlign: indicesMonto.includes(idx) ? 'right' : 'left' }}>{col}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtradas.map((r, i) => (
                  <tr key={`isl-${r.id}`} style={{ borderBottom: '1px solid #e5e7eb', background: esAnulada(r) ? '#fef2f2' : 'transparent', opacity: esAnulada(r) ? 0.8 : 1 }}>
                    <td style={tdStyle}>{i + 1}</td>
                    <td style={tdStyle}>{formatearFechaLibro(r.fechaRetencion)}</td>
                    <td style={{ ...tdStyle, fontFamily: 'monospace' }}>{r.numeroComprobante || 'S/N'}</td>
                    <td style={tdStyle}>
                      <b>{r.proveedorNombre || '—'}</b>
                      <span style={{ display: 'block', color: '#64748b', fontSize: '0.72rem' }}>{r.proveedorRif || 'S/RIF'}</span>
                    </td>
                    <td style={tdStyle}>{r.compraId ? 'Factura' : (r.gastoId ? 'Gasto' : '—')}</td>
                    <td style={{ ...tdStyle, fontFamily: 'monospace' }}>{r.numeroFactura || '—'}</td>
                    <td style={{ ...tdStyle, fontFamily: 'monospace' }}>{r.numeroControl || '—'}</td>
                    <td style={{ ...tdStyle, fontFamily: 'monospace' }}>{r.codigoConcepto || '—'}</td>
                    <td style={{ ...tdStyle, textAlign: 'right' }}>{fmtMoneda(r.baseImponibleBs)}</td>
                    <td style={{ ...tdStyle, textAlign: 'right' }}>{Number(r.porcentajeRetencion ?? 0)}%</td>
                    <td style={{ ...tdStyle, textAlign: 'right' }}>{fmtMoneda(r.sustraendoBs)}</td>
                    <td style={{ ...tdStyle, textAlign: 'right', fontWeight: 'bold' }}>{fmtMoneda(r.montoRetenidoBs)}</td>
                    <td style={tdStyle}>
                      {esAnulada(r) ? (
                        <span title={r.motivoAnulacion || 'Retención anulada'} style={{ background: '#fee2e2', color: '#991b1b', padding: '2px 8px', borderRadius: '10px', fontSize: '0.72rem', fontWeight: 'bold' }}>
                          🚫 Anulada
                        </span>
                      ) : (
                        <span style={{ background: '#dcfce7', color: '#166534', padding: '2px 8px', borderRadius: '10px', fontSize: '0.72rem', fontWeight: 'bold' }}>
                          ✅ Emitida
                        </span>
                      )}
                    </td>
                    <td style={tdStyle}>
                      {r.asientoContableId
                        ? <b style={{ color: '#166534' }}>✅ Asiento #{r.asientoContableId}</b>
                        : (esAnulada(r) && r.asientoReversoId
                          ? <span style={{ color: '#6d28d9' }}>↩ Reverso #{r.asientoReversoId}</span>
                          : <span style={{ color: '#64748b' }}>— sin comprobante</span>)}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr style={{ borderTop: '1.5px solid #000', fontWeight: 'bold' }}>
                  <td colSpan={8} style={{ padding: '10px 6px' }}>
                    TOTALES ({filtradas.length} comprobante{filtradas.length === 1 ? '' : 's'} · {filtroEstado === 'TODAS' ? 'todos los estados' : `${filtroEstado}s`})
                  </td>
                  <td style={{ padding: '10px 6px', textAlign: 'right' }}>{fmtMoneda(totales.base)}</td>
                  <td style={{ padding: '10px 6px', textAlign: 'right' }}>—</td>
                  <td style={{ padding: '10px 6px', textAlign: 'right' }}>{fmtMoneda(totales.sustraendo)}</td>
                  <td style={{ padding: '10px 6px', textAlign: 'right' }}>{fmtMoneda(totales.retenido)}</td>
                  <td colSpan={2}></td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
