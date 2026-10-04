import { useState } from 'react';
import NuevoAsiento from './NuevoAsiento';
import PlanCuentas from './PlanCuentas';
import PeriodosContables from './PeriodosContables';
import ReportesContables from './ReportesContables';

export default function ModuloContable() {
  const [subVista, setSubVista] = useState('asientos');
  
  // 🏢 📅 ESTADO DE CONTEXTO (Puedes conectarlo luego a tu ConfigContext global o API)
  const [empresaActiva] = useState({ id: 1, nombre: 'TYTED C.A. (Principal)' });
  const [periodoActivo] = useState({ id: 1, nombre: 'Enero 2024' });

  return (
    <div style={{ padding: '24px', color: '#e2e8f0', width: '100%' }}>
      
      {/* 🌟 BARRA DE CONTEXTO CONTABLE */}
      <div style={{ 
        display: 'flex', justifyContent: 'space-between', alignItems: 'center', 
        background: '#1e293b', padding: '12px 20px', borderRadius: '10px', 
        marginBottom: '24px', border: '1px solid #334155', flexWrap: 'wrap', gap: '10px'
      }}>
        <div style={{ display: 'flex', gap: '24px', alignItems: 'center' }}>
          <div>
            <small style={{ color: '#94a3b8', display: 'block', fontSize: '0.75rem' }}>ENTIDAD ECONÓMICA</small>
            <strong style={{ color: '#60a5fa' }}>🏢 {empresaActiva.nombre}</strong>
          </div>
          <div style={{ borderLeft: '1px solid #334155', paddingLeft: '24px' }}>
            <small style={{ color: '#94a3b8', display: 'block', fontSize: '0.75rem' }}>PERIODO FISCAL ACTIVO</small>
            <strong style={{ color: '#fbbf24' }}>📅 {periodoActivo.nombre}</strong>
          </div>
        </div>
        <button style={{ background: '#334155', color: '#fff', border: 'none', padding: '8px 16px', borderRadius: '6px', cursor: 'pointer', fontSize: '0.85rem' }}>
          ⚙️ Cambiar Contexto
        </button>
      </div>

      <h2 style={{ marginBottom: '20px' }}>📒 Módulo de Contabilidad</h2>

      {/* Pestañas de navegación interna */}
      <div style={{ display: 'flex', gap: '10px', marginBottom: '24px', borderBottom: '1px solid #334155', paddingBottom: '12px', overflowX: 'auto' }}>
        <button onClick={() => setSubVista('asientos')} style={estiloPestana(subVista === 'asientos')}>✍️ Registrar Asiento</button>
        <button onClick={() => setSubVista('plan')} style={estiloPestana(subVista === 'plan')}>📄 Plan de Cuentas</button>
        <button onClick={() => setSubVista('periodos')} style={estiloPestana(subVista === 'periodos')}>📅 Periodos Fiscales</button>
        <button onClick={() => setSubVista('reportes')} style={estiloPestana(subVista === 'reportes')}>📈 Resumen Contable</button>
      </div>

      {/* Renderizado dinámico PASANDO LAS PROPS CORRECTAMENTE */}
      <div style={{ background: '#0f172a', borderRadius: '12px', border: '1px solid #1e293b', minHeight: '450px' }}>
        {subVista === 'asientos' && <NuevoAsiento empresaActiva={empresaActiva} periodoActivo={periodoActivo} />}
        {subVista === 'plan' && <PlanCuentas />}
        {subVista === 'periodos' && <PeriodosContables />}
        {subVista === 'reportes' && <ReportesContables />}
      </div>
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