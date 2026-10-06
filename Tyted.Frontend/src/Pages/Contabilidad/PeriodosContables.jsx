import { useEffect, useState } from 'react';
import { contabilidadApi } from '../../Services/Contabilidad/ContabilidadApi';

export default function PeriodosContables() {
  const [periodosAnuales, setPeriodosAnuales] = useState([]);
  const [anioNuevo, setAnioNuevo] = useState(new Date().getFullYear());
  const [expandidos, setExpandidos] = useState({});

  const cargarPeriodos = async () => {
    try {
      const data = await contabilidadApi.getPeriodos();
      const lista = Array.isArray(data) ? data : (data?.$values || []);
      setPeriodosAnuales(lista);
      
      // Expandir el primer año por defecto
      if (lista.length > 0) {
        setExpandidos({ [lista[0].id]: true });
      }
    } catch (error) {
      console.error('Error cargando ejercicios fiscales:', error);
    }
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- Patrón de carga al montar usado en todo el proyecto
    cargarPeriodos();
  }, []);

  const toggleExpandir = (id) => {
    setExpandidos(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const crearEjercicioCompleto = async (e) => {
    e.preventDefault();
    try {
      await contabilidadApi.crearPeriodo({
        empresaId: 1,
        anio: Number(anioNuevo),
        tipoPeriodo: 'Anual'
      });
      alert(`Ejercicio Fiscal ${anioNuevo} y sus 12 subperiodos se generaron con éxito.`);
      cargarPeriodos();
    } catch (error) {
      console.error('Error creando el ejercicio fiscal:', error);
      alert('Error al crear el ejercicio fiscal.');
    }
  };

  return (
    <div style={{ padding: '24px', color: '#e2e8f0' }}>
      <h2 style={{ marginBottom: '20px' }}>Gestión de Ejercicios Fiscales y Subperiodos</h2>

      {/* Formulario de apertura de año completo */}
      <form onSubmit={crearEjercicioCompleto} style={{ display: 'flex', gap: '12px', marginBottom: '28px', alignItems: 'center' }}>
        <input
          type="number"
          value={anioNuevo}
          onChange={(e) => setAnioNuevo(e.target.value)}
          placeholder="Año Fiscal"
          style={{ padding: '10px 12px', borderRadius: '8px', border: '1px solid #334155', background: '#0f172a', color: '#fff', width: '140px' }}
        />
        <button type="submit" style={{ background: '#2563eb', color: '#fff', border: 'none', borderRadius: '8px', padding: '10px 18px', cursor: 'pointer' }}>
          ➕ Aperturar Año Calendario
        </button>
      </form>

      {/* Estructura Jerárquica */}
      <div style={{ display: 'grid', gap: '16px' }}>
        {periodosAnuales.length === 0 ? (
          <p style={{ color: '#94a3b8' }}>No hay ejercicios fiscales registrados.</p>
        ) : (
          periodosAnuales.map((padre) => {
            const subperiodos = padre.subPeriodos?.$values || padre.subPeriodos || [];
            const estaExpandido = expandidos[padre.id];

            return (
              <div key={padre.id} style={{ background: '#111827', borderRadius: '12px', border: '1px solid #1f2937', overflow: 'hidden' }}>
                {/* Cabecera del Ejercicio Anual */}
                <div 
                  onClick={() => toggleExpandir(padre.id)}
                  style={{ padding: '16px 20px', background: '#1e293b', display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <span style={{ fontSize: '1.2rem' }}>{estaExpandido ? '📂' : '📁'}</span>
                    <div>
                      <strong style={{ fontSize: '1.1rem', color: '#60a5fa' }}>{padre.nombre || `Ejercicio Fiscal ${padre.anio}`}</strong>
                      <span style={{ display: 'block', fontSize: '0.8rem', color: '#94a3b8' }}>Enero a Diciembre ({padre.anio})</span>
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <span style={{ padding: '4px 12px', borderRadius: '20px', fontSize: '0.8rem', background: padre.estado === 'Abierto' ? '#065f46' : '#991b1b', color: '#fff' }}>
                      {padre.estado}
                    </span>
                    <span>{estaExpandido ? '▲' : '▼'}</span>
                  </div>
                </div>

                {/* Subperiodos Mensuales */}
                {estaExpandido && (
                  <div style={{ padding: '16px', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '12px', background: '#0f172a' }}>
                    {subperiodos.length === 0 ? (
                      <p style={{ color: '#64748b', fontSize: '0.9rem' }}>No hay subperiodos mensuales vinculados.</p>
                    ) : (
                      subperiodos.map((sub) => (
                        <div key={sub.id} style={{ background: '#1e293b', padding: '12px', borderRadius: '8px', border: '1px solid #334155' }}>
                          <strong style={{ color: '#fbbf24', display: 'block', marginBottom: '4px' }}>{sub.nombre}</strong>
                          <span style={{ fontSize: '0.75rem', color: '#94a3b8', display: 'block', marginBottom: '8px' }}>
                            {new Date(sub.fechaInicio).toLocaleDateString()} - {new Date(sub.fechaFin).toLocaleDateString()}
                          </span>
                          <span style={{ padding: '2px 8px', borderRadius: '4px', fontSize: '0.7rem', background: sub.estado === 'Abierto' ? '#065f46' : '#7f1d1d', color: '#fff' }}>
                            {sub.estado}
                          </span>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
