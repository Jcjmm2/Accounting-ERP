import { exportarLibroPdf, exportarLibroXls, esColumnaMonto } from './reportesLibrosFiscal';
import { formatearFecha } from './libroComprasHelpers';

// ---------------------------------------------------------------------------
// PANEL DE REPORTES: vista previa del libro COMBINADO (facturas + gastos) con
// sus retenciones y exportación a PDF/Excel. Presentacional: recibe la
// estructura ya construida por estructuraLibroCompras().
// ---------------------------------------------------------------------------
export default function PanelReportesLibro({ reporteLibro, cargando, empresaActiva, fechaInicio, fechaFin }) {
  return (
    <div style={{ background: '#0f172a', padding: '24px', borderRadius: '12px', border: '1px solid #f59e0b', marginBottom: '20px' }}>
      {/* Botonera de exportación */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px', marginBottom: '20px' }}>
        <h3 style={{ margin: 0, color: '#fbbf24', fontSize: '1.05rem' }}>📊 Vista previa: {reporteLibro.titulo}</h3>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button
            onClick={() => exportarLibroXls(reporteLibro)}
            style={{ display: 'flex', alignItems: 'center', gap: '8px', background: '#16a34a', color: '#fff', border: 'none', borderRadius: '8px', padding: '10px 16px', cursor: 'pointer', fontWeight: 'bold' }}
          >
            📊 Descargar Excel
          </button>
          <button
            onClick={() => exportarLibroPdf(reporteLibro)}
            style={{ display: 'flex', alignItems: 'center', gap: '8px', background: '#dc2626', color: '#fff', border: 'none', borderRadius: '8px', padding: '10px 16px', cursor: 'pointer', fontWeight: 'bold' }}
          >
            📄 Descargar PDF
          </button>
        </div>
      </div>

      {cargando ? (
        <div style={{ textAlign: 'center', padding: '40px', color: '#94a3b8' }}>⏳ Cargando el libro para el reporte…</div>
      ) : (
        <div style={{ background: '#ffffff', color: '#000000', padding: '20px', borderRadius: '8px', overflowX: 'auto' }}>
          {/* Membrete del documento */}
          <div style={{ marginBottom: '14px', fontSize: '0.85rem' }}>
            <div style={{ fontWeight: 'bold' }}>{(empresaActiva?.razonSocial || empresaActiva?.nombre || 'EMPRESA').toUpperCase()}</div>
            <div>RIF {empresaActiva?.rif || '—'}</div>
            <div>{reporteLibro.titulo} del {formatearFecha(fechaInicio)} al {formatearFecha(fechaFin)}</div>
            <div>Expresado en Bs. (moneda fiscal)</div>
          </div>

          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
            <thead>
              <tr style={{ borderBottom: '1.5px solid #000' }}>
                {reporteLibro.columnas.map((col, idx) => (
                  <th key={`col-${idx}`} style={{ textAlign: esColumnaMonto(reporteLibro, idx) ? 'right' : 'left', padding: '8px 4px', fontWeight: 'bold' }}>{col}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {reporteLibro.filas.length === 0 ? (
                <tr>
                  <td colSpan={reporteLibro.columnas.length} style={{ textAlign: 'center', padding: '20px', color: '#64748b' }}>
                    No hay documentos en el periodo para generar el libro.
                  </td>
                </tr>
              ) : reporteLibro.filas.map((fila, idxFila) => (
                <tr key={`rep-${idxFila}`} style={{ borderBottom: '1px solid #e5e7eb' }}>
                  {fila.map((celda, idxCelda) => (
                    <td key={idxCelda} style={{ textAlign: esColumnaMonto(reporteLibro, idxCelda) ? 'right' : 'left', padding: '5px 4px' }}>
                      {celda}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr style={{ borderTop: '1.5px solid #000', fontWeight: 'bold' }}>
                {reporteLibro.totales.map((total, idx) => (
                  <td key={idx} style={{ textAlign: esColumnaMonto(reporteLibro, idx) ? 'right' : 'left', padding: '10px 4px' }}>{total}</td>
                ))}
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  );
}
