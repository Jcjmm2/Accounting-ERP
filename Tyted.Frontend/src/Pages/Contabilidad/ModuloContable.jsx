import { useState, useContext } from 'react';
import NuevoAsiento from './NuevoAsiento';
import PlanCuentas from './PlanCuentas';
import PeriodosContables from './PeriodosContables';
import ReportesContables from './ReportesContables';
import LibroMayor from './LibroMayor';
import { ConfigContext } from '../../Context/ConfigContext';

export default function ModuloContable() {
  const [subVista, setSubVista] = useState('asientos');
  
  // Extraemos el estado global y las funciones de selección multi-entidad del contexto
  const { 
    empresas, 
    periodos, 
    empresaActiva, 
    periodoActivo, 
    seleccionarEmpresa, 
    seleccionarPeriodo, 
    contextoCargado 
  } = useContext(ConfigContext);

  const [mostrarModal, setMostrarModal] = useState(false);

  const nombreEmpresa = empresaActiva?.nombre || empresaActiva?.razonSocial || 'Empresa principal';
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
      {/* Banner Superior de Contexto Operativo */}
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
          onClick={() => setMostrarModal(true)}
          style={{ background: '#2563eb', color: '#fff', border: 'none', padding: '8px 16px', borderRadius: '6px', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 'bold' }}
        >
          ⚙️ Cambiar Contexto
        </button>
      </div>

      <h2 style={{ marginBottom: '20px' }}>📒 Módulo de Contabilidad</h2>

      {/* Pestañas de Navegación Interna */}
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
          📊 Reportes NIIF
        </button>
      </div>

      {/* Contenedor de Vistas Dinámicas */}
      <div style={{ background: '#0f172a', borderRadius: '12px', border: '1px solid #1e293b', minHeight: '450px' }}>
        {subVista === 'asientos' && (
          <NuevoAsiento empresaActiva={empresaActiva} periodoActivo={periodoActivo} />
        )}
        {subVista === 'libro' && (
          <LibroMayor empresaActiva={empresaActiva} periodoActivo={periodoActivo} />
        )}
        {subVista === 'plan' && <PlanCuentas />}
        {subVista === 'periodos' && <PeriodosContables />}
        {subVista === 'reportes' && (
          <ReportesContables empresaActiva={empresaActiva} periodoActivo={periodoActivo} />
        )}
      </div>

      {/* MODAL DE CAMBIO DE CONTEXTO MULTI-ENTIDAD */}
      {mostrarModal && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0, 0, 0, 0.75)', 
          backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', 
          justifyContent: 'center', zIndex: 1000, padding: '16px'
        }}>
          <div style={{ background: '#1e293b', padding: '24px', borderRadius: '12px', width: '100%', maxWidth: '480px', border: '1px solid #334155', color: '#fff' }}>
            <h3 style={{ marginBottom: '16px', color: '#60a5fa' }}>⚙️ Selección de Contexto Operativo</h3>
            
            <div style={{ display: 'grid', gap: '16px' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.85rem', color: '#94a3b8' }}>
                  Empresa / Entidad
                </label>
                <select 
                  value={empresaActiva?.id || ''} 
                  onChange={(e) => seleccionarEmpresa(e.target.value)}
                  style={{ width: '100%', padding: '10px', borderRadius: '6px', background: '#0f172a', border: '1px solid #334155', color: '#fff' }}
                >
                  {empresas.map((emp) => (
                    <option key={emp.id} value={emp.id}>
                      🏢 {emp.nombre || emp.razonSocial}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.85rem', color: '#94a3b8' }}>
                  Ejercicio Fiscal / Subperiodo
                </label>
                <select 
                  value={periodoActivo?.id || ''} 
                  onChange={(e) => seleccionarPeriodo(e.target.value)}
                  style={{ width: '100%', padding: '10px', borderRadius: '6px', background: '#0f172a', border: '1px solid #334155', color: '#fff' }}
                >
                  {periodos.length === 0 ? (
                    <option value="">No hay periodos registrados para esta empresa</option>
                  ) : null}
                  {periodos.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.tipoPeriodo === 'Anual' ? `📁 [AÑO COMPLETO] ${p.nombre}` : `  └ 📄 ${p.nombre}`} ({p.estado})
                    </option>
                  ))}
                </select>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '12px' }}>
                <button 
                  type="button" 
                  onClick={() => setMostrarModal(false)}
                  style={{ background: '#2563eb', color: '#fff', border: 'none', padding: '8px 24px', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}
                >
                  Aceptar
                </button>
              </div>
            </div>
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