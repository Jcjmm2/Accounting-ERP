import { useEffect, useState, useContext } from 'react';
import { contabilidadApi } from '../../Services/Contabilidad/ContabilidadApi';
import { ConfigContext } from '../../Context/ConfigContext';

export default function PeriodosContables() {
  // 1. Extraemos la empresa activa y la función de refresco del contexto global
  const { empresaActiva, refrescarContextoContable } = useContext(ConfigContext);

  const [periodosAnuales, setPeriodosAnuales] = useState([]);
  const [anioNuevo, setAnioNuevo] = useState(new Date().getFullYear());
  const [expandidos, setExpandidos] = useState({});
  const [cargando, setCargando] = useState(false);

  const cargarPeriodos = async () => {
    if (!empresaActiva?.id) return;
    setCargando(true);
    
    try {
      const data = await contabilidadApi.getPeriodos(empresaActiva.id);
      const lista = Array.isArray(data) ? data : (data?.$values || []);
      
      // 2. CORRECCIÓN: Filtramos estrictamente los periodos para que coincidan con la empresa seleccionada
      const periodosEmpresa = lista.filter(p => Number(p.empresaId) === Number(empresaActiva.id));
      
      setPeriodosAnuales(periodosEmpresa);
      
      // Expandir el primer año por defecto si hay datos
      if (periodosEmpresa.length > 0) {
        setExpandidos({ [periodosEmpresa[0].id]: true });
      } else {
        setExpandidos({});
      }
    } catch (error) {
      console.error('Error cargando ejercicios fiscales:', error);
    } finally {
      setCargando(false);
    }
  };

  // 3. CORRECCIÓN: Recargar la tabla automáticamente si el usuario cambia de empresa en el selector global
  useEffect(() => {
    cargarPeriodos();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [empresaActiva]);

  const toggleExpandir = (id) => {
    setExpandidos(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const crearEjercicioCompleto = async (e) => {
    e.preventDefault();
    
    // Validación de UI para no crear años duplicados en la misma empresa
    const anioExiste = periodosAnuales.some(p => Number(p.anio) === Number(anioNuevo));
    if (anioExiste) {
      alert(`⚠️ El Ejercicio Fiscal ${anioNuevo} ya existe para ${empresaActiva.nombre}.`);
      return;
    }

    try {
      await contabilidadApi.crearPeriodo({
        empresaId: empresaActiva.id, // 4. CORRECCIÓN: Usar el ID real en lugar del "1" fijo
        anio: Number(anioNuevo),
        tipoPeriodo: 'Anual'
      });
      alert(`✅ Ejercicio Fiscal ${anioNuevo} generado con éxito para ${empresaActiva.nombre}.`);
      
      await cargarPeriodos();
      if (refrescarContextoContable) await refrescarContextoContable(); // Actualiza el selector global
    } catch (error) {
      console.error('Error creando el ejercicio fiscal:', error);
      alert('❌ Error al crear el ejercicio fiscal.');
    }
  };

  return (
    <div style={{ padding: '24px', color: '#e2e8f0' }}>
      
      {/* Cabecera mejorada con indicación de la empresa */}
      <div style={{ marginBottom: '24px', borderBottom: '1px solid #334155', paddingBottom: '16px' }}>
        <h2 style={{ margin: '0 0 8px 0', color: '#fff' }}>Gestión de Ejercicios Fiscales</h2>
        <p style={{ margin: 0, color: '#94a3b8', fontSize: '0.9rem' }}>
          Administrando periodos para la entidad: <strong style={{ color: '#60a5fa' }}>{empresaActiva?.nombre}</strong>
        </p>
      </div>

      {/* Formulario de apertura de año completo */}
      <div style={{ background: '#1e293b', padding: '20px', borderRadius: '12px', border: '1px solid #334155', marginBottom: '28px' }}>
        <h3 style={{ margin: '0 0 12px 0', fontSize: '1rem', color: '#fbbf24' }}>🚀 Aperturar Nuevo Ejercicio</h3>
        <form onSubmit={crearEjercicioCompleto} style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <label style={{ fontSize: '0.75rem', color: '#94a3b8', marginBottom: '4px' }}>Año Fiscal</label>
            <input
              type="number"
              value={anioNuevo}
              onChange={(e) => setAnioNuevo(e.target.value)}
              style={{ padding: '10px 12px', borderRadius: '8px', border: '1px solid #475569', background: '#0f172a', color: '#fff', width: '140px', fontSize: '1rem' }}
            />
          </div>
          <button type="submit" style={{ background: '#2563eb', color: '#fff', border: 'none', borderRadius: '8px', padding: '10px 20px', cursor: 'pointer', fontWeight: 'bold', marginTop: '18px' }}>
            ➕ Crear Año Calendario
          </button>
        </form>
      </div>

      {/* Estructura Jerárquica */}
      <div style={{ display: 'grid', gap: '16px' }}>
        {cargando ? (
          <p style={{ color: '#94a3b8', textAlign: 'center', padding: '20px' }}>Cargando ejercicios fiscales...</p>
        ) : periodosAnuales.length === 0 ? (
          <div style={{ background: '#0f172a', border: '1px dashed #475569', padding: '30px', textAlign: 'center', borderRadius: '12px' }}>
            <p style={{ color: '#94a3b8', margin: 0 }}>No hay ejercicios fiscales registrados para esta empresa.</p>
          </div>
        ) : (
          periodosAnuales.map((padre) => {
            const subperiodos = padre.subPeriodos?.$values || padre.subPeriodos || [];
            const estaExpandido = expandidos[padre.id];

            return (
              <div key={padre.id} style={{ background: '#111827', borderRadius: '12px', border: '1px solid #1f2937', overflow: 'hidden', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }}>
                {/* Cabecera del Ejercicio Anual */}
                <div 
                  onClick={() => toggleExpandir(padre.id)}
                  style={{ padding: '16px 20px', background: '#1e293b', display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', transition: 'background 0.2s' }}
                  onMouseEnter={(e) => e.currentTarget.style.background = '#334155'}
                  onMouseLeave={(e) => e.currentTarget.style.background = '#1e293b'}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                    <span style={{ fontSize: '1.5rem' }}>{estaExpandido ? '📂' : '📁'}</span>
                    <div>
                      <strong style={{ fontSize: '1.15rem', color: '#60a5fa' }}>{padre.nombre || `Ejercicio Fiscal ${padre.anio}`}</strong>
                      <span style={{ display: 'block', fontSize: '0.8rem', color: '#94a3b8', marginTop: '2px' }}>
                        1 Enero al 31 Diciembre ({padre.anio})
                      </span>
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                    <span style={{ padding: '6px 14px', borderRadius: '20px', fontSize: '0.75rem', fontWeight: 'bold', background: padre.estado === 'Abierto' ? '#064e3b' : '#7f1d1d', color: padre.estado === 'Abierto' ? '#34d399' : '#fca5a5' }}>
                      {padre.estado}
                    </span>
                    <span style={{ color: '#94a3b8', fontSize: '1.2rem' }}>{estaExpandido ? '▲' : '▼'}</span>
                  </div>
                </div>

                {/* Subperiodos Mensuales */}
                {estaExpandido && (
                  <div style={{ padding: '20px', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '14px', background: '#0f172a' }}>
                    {subperiodos.length === 0 ? (
                      <p style={{ color: '#64748b', fontSize: '0.9rem', gridColumn: '1 / -1' }}>No hay subperiodos mensuales vinculados.</p>
                    ) : (
                      subperiodos.map((sub) => (
                        <div key={sub.id} style={{ background: '#1e293b', padding: '14px', borderRadius: '8px', border: '1px solid #334155', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                          <div>
                            <strong style={{ color: '#fbbf24', display: 'block', marginBottom: '6px', fontSize: '0.95rem' }}>{sub.nombre}</strong>
                            <span style={{ fontSize: '0.75rem', color: '#94a3b8', display: 'block', marginBottom: '12px' }}>
                              {new Date(sub.fechaInicio).toLocaleDateString()} - {new Date(sub.fechaFin).toLocaleDateString()}
                            </span>
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
                            <span style={{ padding: '4px 10px', borderRadius: '6px', fontSize: '0.7rem', fontWeight: 'bold', background: sub.estado === 'Abierto' ? '#064e3b' : '#7f1d1d', color: sub.estado === 'Abierto' ? '#34d399' : '#fca5a5' }}>
                              {sub.estado}
                            </span>
                          </div>
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
