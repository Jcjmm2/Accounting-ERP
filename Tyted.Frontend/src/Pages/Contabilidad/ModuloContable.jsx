import { useState, useContext } from 'react';
import NuevoAsiento from './NuevoAsiento';
import PlanCuentas from './PlanCuentas';
import PeriodosContables from './PeriodosContables';
import ReportesContables from './ReportesContables';
import LibroMayor from './LibroMayor';
import { ConfigContext } from '../../Context/ConfigContext';
import { contabilidadApi } from '../../Services/Contabilidad/ContabilidadApi';

export default function ModuloContable() {
  const [subVista, setSubVista] = useState('asientos');
  const { empresaActiva, periodoActivo, setPeriodoActivo, contextoCargado } = useContext(ConfigContext);

  // Estados para el Modal de Cambiar Contexto
  const [mostrarModal, setMostrarModal] = useState(false);
  const [listaPeriodos, setListaPeriodos] = useState([]);
  const [periodoSeleccionadoId, setPeriodoSeleccionadoId] = useState('');
  const [cargandoPeriodos, setCargandoPeriodos] = useState(false);

  const nombreEmpresa = empresaActiva?.nombre || 'Empresa principal';
  const nombrePeriodo = periodoActivo?.nombre || 'Periodo actual';
  
  const formatearFecha = (fechaStr) => {
    if (!fechaStr || fechaStr === '---') return '---';
    try {
      const d = new Date(fechaStr);
      return isNaN(d.getTime()) ? fechaStr : d.toLocaleDateString('es-ES');
    } catch {
      return fechaStr;
    }
  };

  const fechaInicioPeriodo = formatearFecha(periodoActivo?.fechaInicio);
  const fechaFinPeriodo = formatearFecha(periodoActivo?.fechaFin);

  // Cargar periodos para el selector del modal
  const abrirModalContexto = async () => {
    setMostrarModal(true);
    setCargandoPeriodos(true);
    try {
      const data = await contabilidadApi.getPeriodos();
      const lista = Array.isArray(data) ? data : (data?.$values || []);
      
      // Aplanar lista para mostrar Ejercicios Anuales y Subperiodos Mensuales
      let periodosAplanados = [];
      lista.forEach(p => {
        periodosAplanados.push(p); // Añadir el periodo Anual
        const subs = p.subPeriodos?.$values || p.subPeriodos || [];
        subs.forEach(sub => periodosAplanados.push(sub)); // Añadir subperiodos mensuales
      });

      setListaPeriodos(periodosAplanados);
      if (periodoActivo?.id) {
        setPeriodoSeleccionadoId(periodoActivo.id);
      }
    } catch (error) {
      console.error('Error al cargar periodos para el modal:', error);
    } finally {
      setCargandoPeriodos(false);
    }
  };

  const aplicarNuevoContexto = (e) => {
    e.preventDefault();
    const periodoEncontrado = listaPeriodos.find(p => p.id === Number(periodoSeleccionadoId));
    if (periodoEncontrado) {
      setPeriodoActivo({
        id: periodoEncontrado.id,
        nombre: periodoEncontrado.nombre || `Periodo ${periodoEncontrado.anio}`,
        tipoPeriodo: periodoEncontrado.tipoPeriodo || (periodoEncontrado.mes ? 'Mensual' : 'Anual'),
        mes: periodoEncontrado.mes,
        anio: periodoEncontrado.anio,
        fechaInicio: periodoEncontrado.fechaInicio,
        fechaFin: periodoEncontrado.fechaFin,
        estado: periodoEncontrado.estado,
        cerrado: Boolean(periodoEncontrado.cerrado)
      });
    }
    setMostrarModal(false);
  };

  if (!contextoCargado) {
    return (
      <div style={{ padding: '40px', color: '#e2e8f0', textAlign: 'center', minHeight: '400px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div>
          <div style={{ fontSize: '2rem', marginBottom: '16px' }}>⏳</div>
          <p style={{ fontSize: '1rem', color: '#94a3b8' }}>Cargando información contable...</p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: '24px', color: '#e2e8f0', width: '100%' }}>
      {/* Banner Superior de Contexto */}
      <div style={{ 
        display: 'flex', justifyContent: 'space-between', alignItems: 'center', 
        background: '#1e293b', padding: '12px 20px', borderRadius: '10px', 
        marginBottom: '24px', border: '1px solid #334155', flexWrap: 'wrap', gap: '10px'
      }}>
        <div style={{ display: 'flex', gap: '24px', alignItems: 'center', flexWrap: 'wrap' }}>
          <div>
            <small style={{ color: '#94a3b8', display: 'block', fontSize: '0.75rem' }}>ENTIDAD ECONÓMICA</small>
            <strong style={{ color: '#60a5fa' }}>🏢 {nombreEmpresa}</strong>
            {empresaActiva?.rif && (
              <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: '2px' }}>
                RIF: {empresaActiva.rif}
              </div>
            )}
          </div>
          <div style={{ borderLeft: '1px solid #334155', paddingLeft: '24px' }}>
            <small style={{ color: '#94a3b8', display: 'block', fontSize: '0.75rem' }}>PERIODO FISCAL ACTIVO</small>
            <strong style={{ color: '#fbbf24' }}>📅 {nombrePeriodo}</strong>
            <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: '2px' }}>
              {fechaInicioPeriodo} - {fechaFinPeriodo}
            </div>
          </div>
        </div>
        <button 
          onClick={abrirModalContexto}
          style={{ background: '#2563eb', color: '#fff', border: 'none', padding: '8px 16px', borderRadius: '6px', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 'bold' }}
        >
          ⚙️ Cambiar Contexto
        </button>
      </div>

      <h2 style={{ marginBottom: '20px' }}>📒 Módulo de Contabilidad</h2>

      {/* Pestañas de navegación interna */}
      <div style={{ 
        display: 'flex', gap: '10px', marginBottom: '24px', 
        borderBottom: '1px solid #334155', paddingBottom: '12px',
        overflowX: 'auto', flexWrap: 'wrap'
      }}>
        <button onClick={() => setSubVista('asientos')} style={estiloPestana(subVista === 'asientos')}>
          ✍️ Registrar Asiento
        </button>
        <button onClick={() => setSubVista('libro')} style={estiloPestana(subVista === 'libro')}>
          📖 Libro Mayor
        </button>
        <button onClick={() => setSubVista('plan')} style={estiloPestana(subVista === 'plan')}>
          📄 Plan de Cuentas
        </button>
        <button onClick={() => setSubVista('periodos')} style={estiloPestana(subVista === 'periodos')}>
          📅 Periodos Fiscales
        </button>
        <button onClick={() => setSubVista('reportes')} style={estiloPestana(subVista === 'reportes')}>
          📈 Resumen Contable
        </button>
      </div>

      {/* Vistas dinámicas */}
      <div style={{ background: '#0f172a', borderRadius: '12px', border: '1px solid #1e293b', minHeight: '450px' }}>
        {subVista === 'asientos' && <NuevoAsiento empresaActiva={empresaActiva} periodoActivo={periodoActivo} />}
        {subVista === 'libro' && <LibroMayor empresaActiva={empresaActiva} periodoActivo={periodoActivo} />}
        {subVista === 'plan' && <PlanCuentas />}
        {subVista === 'periodos' && <PeriodosContables />}
        {subVista === 'reportes' && <ReportesContables empresaActiva={empresaActiva} periodoActivo={periodoActivo} />}
      </div>

      {/* MODAL DE CAMBIAR CONTEXTO */}
      {mostrarModal && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0, 0, 0, 0.75)', 
          backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', 
          justifyContent: 'center', zIndex: 1000, padding: '16px'
        }}>
          <div style={{ background: '#1e293b', padding: '24px', borderRadius: '12px', width: '100%', maxWidth: '480px', border: '1px solid #334155', color: '#fff' }}>
            <h3 style={{ marginBottom: '16px', color: '#60a5fa' }}>⚙️ Selección de Contexto Contable</h3>
            
            <form onSubmit={aplicarNuevoContexto} style={{ display: 'grid', gap: '16px' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.85rem', color: '#94a3b8' }}>
                  Empresa / Entidad
                </label>
                <input 
                  type="text" 
                  value={nombreEmpresa} 
                  disabled 
                  style={{ width: '100%', padding: '10px', borderRadius: '6px', background: '#0f172a', border: '1px solid #334155', color: '#94a3b8' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.85rem', color: '#94a3b8' }}>
                  Ejercicio Fiscal / Subperiodo
                </label>
                {cargandoPeriodos ? (
                  <p style={{ color: '#fbbf24', fontSize: '0.85rem' }}>Cargando ejercicios disponbles...</p>
                ) : (
                  <select 
                    value={periodoSeleccionadoId} 
                    onChange={(e) => setPeriodoSeleccionadoId(e.target.value)}
                    style={{ width: '100%', padding: '10px', borderRadius: '6px', background: '#0f172a', border: '1px solid #334155', color: '#fff' }}
                  >
                    {listaPeriodos.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.tipoPeriodo === 'Anual' ? `📁 [AÑO COMPLETO] ${p.nombre}` : `  └ 📄 ${p.nombre}`} ({p.estado})
                      </option>
                    ))}
                  </select>
                )}
              </div>

              <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '12px' }}>
                <button 
                  type="button" 
                  onClick={() => setMostrarModal(false)}
                  style={{ background: '#475569', color: '#fff', border: 'none', padding: '8px 16px', borderRadius: '6px', cursor: 'pointer' }}
                >
                  Cancelar
                </button>
                <button 
                  type="submit" 
                  style={{ background: '#2563eb', color: '#fff', border: 'none', padding: '8px 16px', borderRadius: '6px', cursor: 'pointer' }}
                >
                  Aplicar Cambio
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function estiloPestana(activa) {
  return {
    background: activa ? '#2563eb' : '#1e293b',
    color: activa ? '#ffffff' : '#94a3b8',
    border: 'none',
    borderRadius: '8px',
    padding: '10px 16px',
    cursor: 'pointer',
    fontWeight: activa ? 'bold' : 'normal',
    transition: 'all 0.2s',
    whiteSpace: 'nowrap'
  };
}