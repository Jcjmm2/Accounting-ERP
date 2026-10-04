import { useEffect, useState } from 'react';
import { contabilidadApi } from '../../Services/Contabilidad/ContabilidadApi';

export default function PeriodosContables() {
  const [periodos, setPeriodos] = useState([]);

  useEffect(() => {
    const cargar = async () => {
      try {
        const data = await contabilidadApi.getPeriodos();
        setPeriodos(data);
      } catch (error) {
        console.error('Error cargando periodos:', error);
      }
    };

    cargar();
  }, []);

  return (
    <div style={{ padding: '24px', color: '#e2e8f0' }}>
      <h2>Periodos contables</h2>
      <ul style={{ listStyle: 'none', padding: 0, display: 'grid', gap: '12px' }}>
        {periodos.length === 0 ? (
          <li style={{ color: '#94a3b8' }}>No hay periodos cargados.</li>
        ) : (
          periodos.map((periodo) => (
            <li key={periodo.id} style={{ background: '#111827', borderRadius: '10px', padding: '12px' }}>
              {periodo.anio} / {periodo.mes} — {periodo.estado}
            </li>
          ))
        )}
      </ul>
    </div>
  );
}
