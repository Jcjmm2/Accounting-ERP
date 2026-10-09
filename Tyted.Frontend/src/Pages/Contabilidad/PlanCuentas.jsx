import { useState, useContext, useEffect } from 'react';
import { ConfigContext } from '../../Context/ConfigContext';
import { contabilidadApi, mensajeErrorApi } from '../../Services/Contabilidad/ContabilidadApi';

export default function PlanCuentas() {
  const { empresaActiva } = useContext(ConfigContext);
  const empresaId = Number(empresaActiva?.id ?? 1);

  // Estados de control de vista: 'menu' | 'crear' | 'editar' | 'listar'
  const [vista, setVista] = useState('menu');
  
  // Estados de datos
  const [cuentas, setCuentas] = useState([]);
  const [cargando, setCargando] = useState(false);
  const [busqueda, setBusqueda] = useState('');
  
  // Estado del formulario (sirve tanto para crear como para editar)
  const [formData, setFormData] = useState({
    id: null,
    codigo: '',
    nombre: '',
    naturaleza: 'Deudora',
    // Copia de la cuenta original: en modo edición se conservan los campos
    // que el formulario no muestra (nivel, tipo, padre, etc.)
    original: null
  });

  // --- EFECTO MULTIEMPRESA ---
  // Reacciona al cambio de empresa seleccionada en el contexto global
  useEffect(() => {
    if (vista === 'listar') {
      cargarTodasLasCuentas();
    } else {
      setCuentas([]); // Limpia la lista al cambiar de empresa para evitar cruce de datos
    }
  }, [empresaId]);

  // --- FUNCIONES DE CARGA ---
  const cargarTodasLasCuentas = async () => {
    if (!empresaId) return;
    setCargando(true);
    try {
      // Se pasa empresaId a la API para solicitar únicamente las cuentas de la empresa activa
      const data = await contabilidadApi.getCuentas(empresaId);
      setCuentas(Array.isArray(data) ? data : []);
      setVista('listar');
    } catch (error) {
      console.error('Error cargando cuentas:', error);
      alert('❌ Error al cargar el plan de cuentas');
    } finally {
      setCargando(false);
    }
  };

  // --- FUNCIONES DEL FORMULARIO ---
  const manejarCambioInput = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const guardarCuenta = async (e) => {
    e.preventDefault();
    setCargando(true);
    try {
      if (formData.id) {
        // MODO EDICIÓN: PUT /cuentas/{id}. NUNCA se reutiliza crearCuenta con
        // el Id: el INSERT con Id explícito viola la columna de identidad de
        // SQL Server y el backend responde HTTP 400.
        const original = formData.original ?? {};
        const datosCuenta = {
          codigoCuenta: formData.codigo,
          nombreCuenta: formData.nombre,
          naturaleza: formData.naturaleza,
          // Campos que el formulario no muestra: se conservan tal como venían
          // para no alterar la estructura de la cuenta (nivel, tipo, padre,
          // movimiento, flags) ni su pertenencia a la empresa.
          empresaId: original.empresaId ?? original.EmpresaId ?? empresaId,
          tipoCuenta: original.tipoCuenta ?? original.TipoCuenta ?? 'Activo',
          esMovimiento: original.esMovimiento ?? original.EsMovimiento ?? true,
          nivel: original.nivel ?? original.Nivel ?? 5,
          padreCuentaId: original.padreCuentaId ?? original.PadreCuentaId ?? null,
          aceptaTerceros: original.aceptaTerceros ?? original.AceptaTerceros ?? false,
          aceptaCentroCosto: original.aceptaCentroCosto ?? original.AceptaCentroCosto ?? false,
          activa: original.activa ?? original.Activa ?? true
        };
        await contabilidadApi.actualizarCuenta(formData.id, datosCuenta);
        alert('✅ Cuenta actualizada correctamente');
      } else {
        // MODO CREACIÓN: sin Id, la columna de identidad lo genera en el INSERT
        const datosCuenta = {
          codigoCuenta: formData.codigo,
          nombreCuenta: formData.nombre,
          naturaleza: formData.naturaleza,
          tipoCuenta: 'Activo',
          activa: true,
          empresaId, // Asignación de empresaId al objeto enviado
          esMovimiento: true,
          nivel: 5,
          aceptaTerceros: false,
          aceptaCentroCosto: false
        };
        await contabilidadApi.crearCuenta(datosCuenta);
        alert('✅ Cuenta creada correctamente');
      }

      // Limpiar formulario y volver al menú principal
      setFormData({ id: null, codigo: '', nombre: '', naturaleza: 'Deudora', original: null });
      setVista('menu');
      
      // Si la lista de cuentas estaba cargada en pantalla, recargarla
      if (cuentas.length > 0) {
        await cargarTodasLasCuentas();
      }
    } catch (error) {
      console.error('Error guardando cuenta:', error);
      // Muestra el mensaje real devuelto por la API (p. ej. código duplicado)
      alert(`❌ ${mensajeErrorApi(error)}`);
    } finally {
      setCargando(false);
    }
  };

  const prepararEdicion = (cuenta) => {
    setFormData({
      id: cuenta.id ?? cuenta.cuentaId,
      codigo: cuenta.codigoCuenta ?? cuenta.codigo ?? '',
      nombre: cuenta.nombreCuenta ?? cuenta.nombre ?? '',
      naturaleza: cuenta.naturaleza ?? 'Deudora',
      // Se conserva la cuenta original para no perder en la edición los
      // campos que el formulario no muestra (nivel, tipo, padre, flags, etc.)
      original: cuenta
    });
    setVista('editar');
  };

  const cancelarFormulario = () => {
    setFormData({ id: null, codigo: '', nombre: '', naturaleza: 'Deudora', original: null });
    setVista('menu');
  };

  // --- FILTRADO EN TIEMPO REAL ---
  const cuentasFiltradas = cuentas.filter(c => {
    const codigo = (c.codigoCuenta ?? c.codigo ?? '').toLowerCase();
    const nombre = (c.nombreCuenta ?? c.nombre ?? '').toLowerCase();
    const termino = busqueda.toLowerCase().trim();
    return codigo.includes(termino) || nombre.includes(termino);
  });

  // --- ESTILOS REUTILIZABLES ---
  const inputStyle = {
    padding: '10px 12px', borderRadius: '8px', border: '1px solid #334155',
    background: '#0f172a', color: '#fff', width: '100%', boxSizing: 'border-box'
  };

  const cardStyle = {
    background: '#1e293b', border: '1px solid #334155', borderRadius: '12px',
    padding: '24px', textAlign: 'center', cursor: 'pointer', transition: 'all 0.2s',
    color: '#e2e8f0'
  };

  // ==========================================
  // RENDERIZADO CONDICIONAL DE VISTAS
  // ==========================================

  return (
    <div style={{ padding: '24px', color: '#e2e8f0' }}>
      <h2 style={{ marginBottom: '24px' }}>📄 Plan de Cuentas</h2>

      {/* VISTA 1: MENÚ PRINCIPAL (Lo que se ve al abrir) */}
      {vista === 'menu' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '20px', maxWidth: '900px' }}>
          <div style={cardStyle} onClick={() => setVista('crear')} className="hover-card">
            <div style={{ fontSize: '2.5rem', marginBottom: '12px' }}>➕</div>
            <h3 style={{ margin: '0 0 8px 0', color: '#60a5fa' }}>Agregar Nueva Cuenta</h3>
            <p style={{ margin: 0, fontSize: '0.9rem', color: '#94a3b8' }}>Registra una cuenta contable nueva en el sistema.</p>
          </div>

          <div style={cardStyle} onClick={cargarTodasLasCuentas} className="hover-card">
            <div style={{ fontSize: '2.5rem', marginBottom: '12px' }}>🔍</div>
            <h3 style={{ margin: '0 0 8px 0', color: '#fbbf24' }}>Buscar y Modificar</h3>
            <p style={{ margin: 0, fontSize: '0.9rem', color: '#94a3b8' }}>Encuentra una cuenta específica para editar sus datos.</p>
          </div>

          <div style={cardStyle} onClick={cargarTodasLasCuentas} className="hover-card">
            <div style={{ fontSize: '2.5rem', marginBottom: '12px' }}>📄</div>
            <h3 style={{ margin: '0 0 8px 0', color: '#34d399' }}>Ver Listado Completo</h3>
            <p style={{ margin: 0, fontSize: '0.9rem', color: '#94a3b8' }}>Muestra toda la tabla del plan de cuentas.</p>
          </div>
        </div>
      )}

      {/* VISTA 2 y 3: FORMULARIO (Crear o Editar) */}
      {(vista === 'crear' || vista === 'editar') && (
        <div style={{ maxWidth: '600px', background: '#1e293b', padding: '24px', borderRadius: '12px', border: '1px solid #334155' }}>
          <h3 style={{ marginTop: 0, color: vista === 'crear' ? '#60a5fa' : '#fbbf24' }}>
            {vista === 'crear' ? '➕ Agregar Nueva Cuenta' : '✏️ Modificar Cuenta'}
          </h3>
          
          <form onSubmit={guardarCuenta} style={{ display: 'grid', gap: '16px' }}>
            <div>
              <label style={{ fontSize: '0.85rem', color: '#94a3b8', marginBottom: '4px', display: 'block' }}>Código de la Cuenta</label>
              <input
                type="text"
                name="codigo"
                value={formData.codigo}
                onChange={manejarCambioInput}
                placeholder="Ej: 1.1.01.001"
                style={inputStyle}
                required
              />
            </div>
            
            <div>
              <label style={{ fontSize: '0.85rem', color: '#94a3b8', marginBottom: '4px', display: 'block' }}>Nombre de la Cuenta</label>
              <input
                type="text"
                name="nombre"
                value={formData.nombre}
                onChange={manejarCambioInput}
                placeholder="Ej: Caja Chica"
                style={inputStyle}
                required
              />
            </div>

            <div>
              <label style={{ fontSize: '0.85rem', color: '#94a3b8', marginBottom: '4px', display: 'block' }}>Naturaleza</label>
              <select
                name="naturaleza"
                value={formData.naturaleza}
                onChange={manejarCambioInput}
                style={inputStyle}
              >
                <option value="Deudora">Deudora</option>
                <option value="Acreedora">Acreedora</option>
              </select>
            </div>

            <div style={{ display: 'flex', gap: '12px', marginTop: '8px' }}>
              <button 
                type="button" 
                onClick={cancelarFormulario}
                style={{ ...inputStyle, background: '#334155', cursor: 'pointer', fontWeight: 'bold' }}
              >
                Cancelar
              </button>
              <button 
                type="submit" 
                disabled={cargando}
                style={{ ...inputStyle, background: vista === 'crear' ? '#2563eb' : '#f59e0b', color: '#fff', cursor: cargando ? 'not-allowed' : 'pointer', fontWeight: 'bold', border: 'none' }}
              >
                {cargando ? 'Guardando...' : (vista === 'crear' ? '💾 Guardar Cuenta' : '💾 Actualizar Cuenta')}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* VISTA 4: LISTADO CON BÚSQUEDA */}
      {vista === 'listar' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
            <button 
              onClick={() => setVista('menu')}
              style={{ background: '#334155', color: '#fff', border: 'none', borderRadius: '8px', padding: '8px 16px', cursor: 'pointer' }}
            >
              ← Volver al Menú
            </button>
            
            <input
              type="text"
              placeholder="🔍 Buscar por código o nombre..."
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              style={{ ...inputStyle, maxWidth: '400px', flex: 1 }}
            />
          </div>

          {cargando ? (
            <div style={{ textAlign: 'center', padding: '40px', color: '#94a3b8' }}>Cargando cuentas...</div>
          ) : (
            <div style={{ background: '#111827', borderRadius: '12px', overflow: 'hidden', border: '1px solid #334155' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: '#1e293b', color: '#93c5fd', textAlign: 'left' }}>
                    <th style={{ padding: '12px' }}>Código</th>
                    <th style={{ padding: '12px' }}>Nombre</th>
                    <th style={{ padding: '12px' }}>Naturaleza</th>
                    <th style={{ padding: '12px', textAlign: 'center' }}>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {cuentasFiltradas.length === 0 ? (
                    <tr>
                      <td colSpan="4" style={{ padding: '24px', textAlign: 'center', color: '#94a3b8' }}>
                        No se encontraron cuentas que coincidan con la búsqueda.
                      </td>
                    </tr>
                  ) : (
                    cuentasFiltradas.map((cuenta) => (
                      <tr key={cuenta.id ?? cuenta.cuentaId} style={{ borderTop: '1px solid #1f2937', transition: 'background 0.2s' }}
                          onMouseEnter={(e) => e.currentTarget.style.background = '#1e293b'}
                          onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                      >
                        <td style={{ padding: '12px', fontFamily: 'monospace', color: '#60a5fa' }}>
                          {cuenta.codigoCuenta ?? cuenta.codigo}
                        </td>
                        <td style={{ padding: '12px' }}>
                          {cuenta.nombreCuenta ?? cuenta.nombre}
                        </td>
                        <td style={{ padding: '12px' }}>
                          <span style={{ 
                            background: (cuenta.naturaleza === 'Deudora') ? '#064e3b' : '#450a0a', 
                            color: (cuenta.naturaleza === 'Deudora') ? '#6ee7b7' : '#fca5a5',
                            padding: '4px 10px', borderRadius: '12px', fontSize: '0.8rem', fontWeight: 'bold'
                          }}>
                            {cuenta.naturaleza}
                          </span>
                        </td>
                        <td style={{ padding: '12px', textAlign: 'center' }}>
                          <button 
                            onClick={() => prepararEdicion(cuenta)}
                            style={{ background: '#f59e0b', color: '#000', border: 'none', borderRadius: '6px', padding: '6px 14px', cursor: 'pointer', fontWeight: 'bold', fontSize: '0.85rem' }}
                          >
                            ✏️ Editar
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Estilos CSS en línea para el efecto hover en las tarjetas del menú */}
      <style>{`
        .hover-card:hover {
          background: #334155 !important;
          transform: translateY(-2px);
          box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.3);
        }
      `}</style>
    </div>
  );
}