import { formatearFecha } from './libroComprasHelpers';

// ---------------------------------------------------------------------------
// CABECERA DEL LIBRO DE COMPRAS: contexto global (empresa/periodo) + botonera
// con EXCLUSIVIDAD de paneles (nuevo documento, consultas, reportes, recarga).
// Presentacional: todos los manejadores vienen de la página.
// ---------------------------------------------------------------------------
export default function CabeceraLibroCompras({
  empresaActiva, periodoActivo, fechaInicio, fechaFin,
  mostrarConsultas, mostrarReporte, mostrarRelacionIslr, cargando, hayContexto,
  onNuevoDocumento, onAlternarConsultas, onAlternarReporte, onAlternarRelacionIslr, onRecargar
}) {
  return (
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
      <div style={{ display: 'flex', gap: '10px' }}>
        <button
          onClick={onNuevoDocumento}
          disabled={!hayContexto || cargando}
          style={{
            background: '#059669', color: '#fff', border: 'none', borderRadius: '8px',
            padding: '10px 16px', cursor: hayContexto && !cargando ? 'pointer' : 'not-allowed',
            fontWeight: 'bold', opacity: hayContexto ? 1 : 0.5
          }}
          title="Registrar una factura de compra o un gasto fiscal (un solo formulario, sin inventario)"
        >
          ➕ Nuevo documento fiscal
        </button>
        <button
          onClick={onAlternarConsultas}
          disabled={!hayContexto}
          style={{
            background: mostrarConsultas ? '#0ea5e9' : '#2563eb', color: '#fff', border: 'none', borderRadius: '8px',
            padding: '10px 16px', cursor: hayContexto ? 'pointer' : 'not-allowed', fontWeight: 'bold',
            opacity: hayContexto ? 1 : 0.5
          }}
          title="Consultar y editar los documentos del libro del periodo (carga bajo demanda)"
        >
          {mostrarConsultas ? '📋 Cerrar consultas' : '🔍 Consultas y edición'}
        </button>
        <button
          onClick={onAlternarReporte}
          disabled={!hayContexto}
          style={{
            background: mostrarReporte ? '#f59e0b' : '#d97706', color: '#fff', border: 'none', borderRadius: '8px',
            padding: '10px 16px', cursor: hayContexto ? 'pointer' : 'not-allowed', fontWeight: 'bold',
            opacity: hayContexto ? 1 : 0.5
          }}
          title="Vista previa del libro combinado (facturas + gastos) con exportación a PDF y Excel"
        >
          {mostrarReporte ? '📄 Cerrar reportes' : '📊 Reportes'}
        </button>
        <button
          onClick={onAlternarRelacionIslr}
          disabled={!hayContexto}
          style={{
            background: mostrarRelacionIslr ? '#0ea5e9' : '#334155', color: '#fff', border: 'none', borderRadius: '8px',
            padding: '10px 16px', cursor: hayContexto ? 'pointer' : 'not-allowed', fontWeight: 'bold',
            opacity: hayContexto ? 1 : 0.5
          }}
          title="Relación de retenciones de ISLR del periodo (Ley del Impuesto Sobre la Renta, Decreto 1.808) — independiente del Libro de Compras (Ley del IVA)"
        >
          {mostrarRelacionIslr ? '📑 Cerrar relación ISLR' : '📑 Retenciones ISLR'}
        </button>
        {mostrarConsultas && (
          <button
            onClick={onRecargar}
            disabled={cargando}
            style={{
              background: '#475569', color: '#fff', border: 'none', borderRadius: '8px',
              padding: '10px 16px', cursor: cargando ? 'wait' : 'pointer', fontWeight: 'bold'
            }}
          >
            {cargando ? '⏳ Cargando…' : '🔄 Recargar'}
          </button>
        )}
      </div>
    </div>
  );
}
