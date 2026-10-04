import { useState } from 'react';
import NuevoAsiento from './NuevoAsiento';
import PlanCuentas from './PlanCuentas';
import PeriodosContables from './PeriodosContables';
import ReportesContables from './ReportesContables';

export default function ModuloContable() {
  // 'asientos' queda como valor predeterminado para que cargue de primero
  const [subVista, setSubVista] = useState('asientos');

  return (
    <div style={{ padding: '24px', color: '#e2e8f0', width: '100%' }}>
      <h2 style={{ marginBottom: '20px' }}>📒 Módulo de Contabilidad</h2>

      {/* Pestañas de navegación interna */}
      <div style={{ 
        display: 'flex', 
        gap: '10px', 
        marginBottom: '24px', 
        borderBottom: '1px solid #334155', 
        paddingBottom: '12px',
        overflowX: 'auto'
      }}>
        <button 
          onClick={() => setSubVista('asientos')} 
          style={estiloPestana(subVista === 'asientos')}
        >
          ✍️ Registrar Asiento
        </button>
        <button 
          onClick={() => setSubVista('plan')} 
          style={estiloPestana(subVista === 'plan')}
        >
          📄 Plan de Cuentas
        </button>
        <button 
          onClick={() => setSubVista('periodos')} 
          style={estiloPestana(subVista === 'periodos')}
        >
          📅 Periodos Fiscales
        </button>
        <button 
          onClick={() => setSubVista('reportes')} 
          style={estiloPestana(subVista === 'reportes')}
        >
          📈 Resumen Contable
        </button>
      </div>

      {/* Renderizado dinámico del sub-componente */}
      <div style={{ background: '#0f172a', borderRadius: '12px', border: '1px solid #1e293b', minHeight: '450px' }}>
        {subVista === 'asientos' && <NuevoAsiento />}
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