import { useEffect, useState } from 'react';
import { contabilidadApi } from '../../Services/Contabilidad/ContabilidadApi';

export default function ReportesContables() {
  const [resumen, setResumen] = useState(null);

  useEffect(() => {
    const cargar = async () => {
      try {
        const data = await contabilidadApi.getResumen();
        setResumen(data);
      } catch (error) {
        console.error('Error cargando resumen contable:', error);
      }
    };

    cargar();
  }, []);

  return (
    <div style={{ padding: '24px', color: '#e2e8f0' }}>
      <h2>Resumen contable</h2>
      {resumen ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '16px' }}>
          <div style={{ background: '#111827', borderRadius: '10px', padding: '18px' }}>
            <div style={{ color: '#93c5fd' }}>Cuentas</div>
            <strong style={{ fontSize: '1.8rem' }}>{resumen.cuentas}</strong>
          </div>
          <div style={{ background: '#111827', borderRadius: '10px', padding: '18px' }}>
            <div style={{ color: '#93c5fd' }}>Asientos</div>
            <strong style={{ fontSize: '1.8rem' }}>{resumen.asientos}</strong>
          </div>
          <div style={{ background: '#111827', borderRadius: '10px', padding: '18px' }}>
            <div style={{ color: '#93c5fd' }}>Debe</div>
            <strong style={{ fontSize: '1.8rem' }}>{Number(resumen.totalDebe ?? 0).toFixed(2)}</strong>
          </div>
          <div style={{ background: '#111827', borderRadius: '10px', padding: '18px' }}>
            <div style={{ color: '#93c5fd' }}>Haber</div>
            <strong style={{ fontSize: '1.8rem' }}>{Number(resumen.totalHaber ?? 0).toFixed(2)}</strong>
          </div>
        </div>
      ) : (
        <p style={{ color: '#94a3b8' }}>Cargando resumen...</p>
      )}
    </div>
  );
}
