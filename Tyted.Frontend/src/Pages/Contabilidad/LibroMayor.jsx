import { useEffect, useState } from 'react';
import { contabilidadApi } from '../../Services/Contabilidad/ContabilidadApi';

export default function LibroMayor({ empresaActiva, periodoActivo }) {
  const [cuentaId, setCuentaId] = useState('');
  const [cuentas, setCuentas] = useState([]);
  const [movimientos, setMovimientos] = useState([]);
  const [cargando, setCargando] = useState(false);
  
  // Inicializar fechas con el periodo activo si está disponible
  const [fechaInicio, setFechaInicio] = useState(periodoActivo?.fechaInicio || '');
  const [fechaFin, setFechaFin] = useState(periodoActivo?.fechaFin || '');

  useEffect(() => {
    const cargarCuentas = async () => {
      try {
        const data = await contabilidadApi.getCuentas();
        setCuentas(data);
      } catch (error) {
        console.error('Error cargando cuentas para libro mayor', error);
      }
    };
    cargarCuentas();
  }, []);

  const buscarLibroMayor = async () => {
    if (!cuentaId) {
      alert('️ Seleccione una cuenta para consultar el libro mayor.');
      return;
    }
    setCargando(true);
    try {
      // Si tu API soporta filtrar por empresa/periodo, puedes agregarlos aquí
      const data = await contabilidadApi.getLibroMayor(
        Number(cuentaId), 
        fechaInicio || undefined, 
        fechaFin || undefined
      );
      setMovimientos(data);
    } catch (error) {
      console.error('Error consultando libro mayor:', error);
      alert('❌ No se pudo consultar el libro mayor.');
    } finally {
      setCargando(false);
    }
  };

  const inputStyle = {
    padding: '10px 12px', borderRadius: '8px', border: '1px solid #334155',
    background: '#0f172a', color: '#fff', width: '100%', boxSizing: 'border-box'
  };

  return (
    <div style={{ padding: '24px', color: '#e2e8f0' }}>
      {/* Encabezado con contexto */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '10px' }}>
        <h2 style={{ margin: 0 }}>📖 Libro Mayor</h2>
        <div style={{ fontSize: '0.85rem', color: '#94a3b8', textAlign: 'right' }}>
          <div>🏢 {empresaActiva?.nombre || 'Sin empresa'}</div>
          <div>📅 {periodoActivo?.nombre || 'Sin periodo'}</div>
        </div>
      </div>

      {/* Filtros de Búsqueda */}
      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', 
        gap: '16px', marginBottom: '24px', alignItems: 'end',
        background: '#1e293b', padding: '20px', borderRadius: '12px', border: '1px solid #334155'
      }}>
        <div>
          <label style={{ display: 'block', color: '#94a3b8', marginBottom: '6px', fontSize: '0.85rem' }}>Cuenta Contable</label>
          <select value={cuentaId} onChange={(e) => setCuentaId(e.target.value)} style={inputStyle}>
            <option value="">-- Seleccione una cuenta --</option>
            {cuentas.map((cuenta) => (
              <option key={cuenta.id} value={cuenta.id}>
                {cuenta.codigoCuenta || cuenta.codigo} - {cuenta.nombreCuenta || cuenta.nombre}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label style={{ display: 'block', color: '#94a3b8', marginBottom: '6px', fontSize: '0.85rem' }}>Fecha Desde</label>
          <input type="date" value={fechaInicio} onChange={(e) => setFechaInicio(e.target.value)} style={inputStyle} />
        </div>
        <div>
          <label style={{ display: 'block', color: '#94a3b8', marginBottom: '6px', fontSize: '0.85rem' }}>Fecha Hasta</label>
          <input type="date" value={fechaFin} onChange={(e) => setFechaFin(e.target.value)} style={inputStyle} />
        </div>
        <button 
          onClick={buscarLibroMayor} 
          disabled={cargando}
          style={{ 
            background: '#2563eb', color: '#fff', border: 'none', borderRadius: '8px', 
            padding: '10px 16px', cursor: cargando ? 'not-allowed' : 'pointer', fontWeight: 'bold' 
          }}
        >
          {cargando ? 'Consultando...' : '🔍 Consultar'}
        </button>
      </div>

      {/* Tabla de Resultados */}
      <div style={{ background: '#111827', borderRadius: '12px', overflow: 'hidden', border: '1px solid #334155' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: '#1e293b', color: '#93c5fd', textAlign: 'left' }}>
              <th style={{ padding: '12px' }}>Fecha</th>
              <th style={{ padding: '12px' }}>Comprobante</th>
              <th style={{ padding: '12px' }}>Concepto</th>
              <th style={{ padding: '12px', textAlign: 'right' }}>Debe</th>
              <th style={{ padding: '12px', textAlign: 'right' }}>Haber</th>
              <th style={{ padding: '12px', textAlign: 'right' }}>Saldo acumulado</th>
            </tr>
          </thead>
          <tbody>
            {movimientos.length === 0 ? (
              <tr>
                <td colSpan="6" style={{ padding: '30px', textAlign: 'center', color: '#94a3b8' }}>
                  {cargando ? 'Buscando movimientos...' : 'No hay movimientos para esta cuenta en el rango seleccionado.'}
                </td>
              </tr>
            ) : (
              movimientos.map((item, index) => {
                const saldoAcumulado = Number(item.saldoAcumulado ?? 0);
                return (
                  <tr key={`${item.asientoId}-${index}`} style={{ borderTop: '1px solid #1f2937' }}>
                    <td style={{ padding: '12px' }}>{new Date(item.fechaComprobante).toLocaleDateString()}</td>
                    <td style={{ padding: '12px', fontFamily: 'monospace', color: '#60a5fa' }}>{item.numeroComprobante}</td>
                    <td style={{ padding: '12px' }}>{item.concepto}</td>
                    <td style={{ padding: '12px', textAlign: 'right', color: '#60a5fa' }}>{Number(item.debe || 0).toFixed(2)}</td>
                    <td style={{ padding: '12px', textAlign: 'right', color: '#f87171' }}>{Number(item.haber || 0).toFixed(2)}</td>
                    <td style={{ padding: '12px', textAlign: 'right', fontWeight: 'bold', color: saldoAcumulado >= 0 ? '#34d399' : '#f87171' }}>
                      {saldoAcumulado.toFixed(2)}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
