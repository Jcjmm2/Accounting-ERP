import { useEffect, useState } from 'react';
import { contabilidadApi } from '../../Services/Contabilidad/ContabilidadApi';

export default function LibroMayor() {
  const [cuentaId, setCuentaId] = useState('');
  const [cuentas, setCuentas] = useState([]);
  const [movimientos, setMovimientos] = useState([]);
  const [fechaInicio, setFechaInicio] = useState('');
  const [fechaFin, setFechaFin] = useState('');

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
      alert('Seleccione una cuenta para consultar el libro mayor.');
      return;
    }

    try {
      const data = await contabilidadApi.getLibroMayor(Number(cuentaId), fechaInicio || undefined, fechaFin || undefined);
      setMovimientos(data);
    } catch (error) {
      console.error('Error consultando libro mayor:', error);
      alert('No se pudo consultar el libro mayor.');
    }
  };

  return (
    <div style={{ padding: '24px', color: '#e2e8f0' }}>
      <h2>Libro Mayor</h2>

      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr auto', gap: '12px', marginBottom: '20px', alignItems: 'end' }}>
        <div>
          <label style={{ display: 'block', color: '#94a3b8', marginBottom: '6px' }}>Cuenta</label>
          <select value={cuentaId} onChange={(e) => setCuentaId(e.target.value)} style={inputStyle}>
            <option value="">Seleccione una cuenta</option>
            {cuentas.map((cuenta) => (
              <option key={cuenta.id} value={cuenta.id}>
                {cuenta.codigoCuenta} - {cuenta.nombreCuenta}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label style={{ display: 'block', color: '#94a3b8', marginBottom: '6px' }}>Desde</label>
          <input type="date" value={fechaInicio} onChange={(e) => setFechaInicio(e.target.value)} style={inputStyle} />
        </div>

        <div>
          <label style={{ display: 'block', color: '#94a3b8', marginBottom: '6px' }}>Hasta</label>
          <input type="date" value={fechaFin} onChange={(e) => setFechaFin(e.target.value)} style={inputStyle} />
        </div>

        <button onClick={buscarLibroMayor} style={{ background: '#2563eb', color: '#fff', border: 'none', borderRadius: '8px', padding: '10px 16px', cursor: 'pointer' }}>
          Consultar
        </button>
      </div>

      <div style={{ background: '#111827', borderRadius: '12px', overflow: 'hidden', border: '1px solid #334155' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: '#1e293b', color: '#93c5fd', textAlign: 'left' }}>
              <th style={{ padding: '12px' }}>Fecha</th>
              <th style={{ padding: '12px' }}>Comprobante</th>
              <th style={{ padding: '12px' }}>Concepto</th>
              <th style={{ padding: '12px', textAlign: 'right' }}>Debe</th>
              <th style={{ padding: '12px', textAlign: 'right' }}>Haber</th>
            </tr>
          </thead>
          <tbody>
            {movimientos.length === 0 ? (
              <tr>
                <td colSpan="5" style={{ padding: '24px', textAlign: 'center', color: '#94a3b8' }}>
                  No hay movimientos para esta cuenta.
                </td>
              </tr>
            ) : (
              movimientos.map((item, index) => (
                <tr key={`${item.asientoId}-${index}`} style={{ borderTop: '1px solid #1f2937' }}>
                  <td style={{ padding: '12px' }}>{new Date(item.fechaComprobante).toLocaleDateString()}</td>
                  <td style={{ padding: '12px' }}>{item.numeroComprobante}</td>
                  <td style={{ padding: '12px' }}>{item.concepto}</td>
                  <td style={{ padding: '12px', textAlign: 'right' }}>{Number(item.debe || 0).toFixed(2)}</td>
                  <td style={{ padding: '12px', textAlign: 'right' }}>{Number(item.haber || 0).toFixed(2)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

const inputStyle = {
  padding: '10px 12px',
  borderRadius: '8px',
  border: '1px solid #334155',
  background: '#0f172a',
  color: '#fff',
  width: '100%',
  boxSizing: 'border-box'
};
