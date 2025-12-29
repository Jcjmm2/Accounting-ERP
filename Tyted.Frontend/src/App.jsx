import React, { useState, useContext } from 'react';
import POS from './Components/POS'; // Agregamos /Components/
import TasaDeCambio from './Components/TasaDeCambio'; // Agregamos /Components/
import ModalCliente from './Components/ModalCliente';
import { ConfigContext } from './Context/ConfigContext';
import './App.css';

function App() {
  const [vista, setVista] = useState('pos'); // 'pos' o 'tasa'
  const { tasa } = useContext(ConfigContext);

  return (
    <div className="app-container">
      {/* Barra Lateral de Navegación */}
      <aside className="sidebar">
        <h1 style={{ fontSize: '1.5rem', marginBottom: '2rem' }}>Tyted POS</h1>
        
        <button 
          className={`nav-button ${vista === 'pos' ? 'active' : ''}`}
          onClick={() => setVista('pos')}
        >
          🛒 Punto de Venta
        </button>
        
        <button 
          className={`nav-button ${vista === 'tasa' ? 'active' : ''}`}
          onClick={() => setVista('tasa')}
        >
          💵 Tasa de Cambio
        </button>

        <div style={{ marginTop: 'auto', padding: '1rem', background: '#334155', borderRadius: '8px' }}>
          <p style={{ margin: 0, fontSize: '0.8rem', color: '#cbd5e1' }}>Tasa Actual:</p>
          <p style={{ margin: 0, fontSize: '1.2rem', fontWeight: 'bold' }}>{tasa} Bs/$</p>
        </div>
      </aside>

      {/* Área Principal */}
      <main className="main-content">
        {vista === 'pos' ? <POS /> : <TasaDeCambio />}
      </main>
    </div>
  );
}

export default App;