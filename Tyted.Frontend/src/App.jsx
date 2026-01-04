import React, { useState, useContext } from 'react';
// Importación de componentes existentes
import POS from './Components/POS';
import TasaDeCambio from './Components/TasaDeCambio';
import { ConfigContext } from './Context/ConfigContext';
import './App.css';

// Importación de nuevos componentes (basados en tus controladores .cs)
// Nota: Asegúrate de crear estos archivos .jsx en tu carpeta Components
import Dashboard from './Components/Dashboard';           // DashboardController
import Categorias from './Components/Categorias';         // CategoriasController
import Productos from './Components/Productos';           // ProductosController
import Inventario from './Components/Inventario';         // InventarioController
import Compras from './Components/Compras';               // ComprasController y NotasEntrega
import Proveedores from './Components/Proveedores';       // ProveedoresController
import Reportes from './Components/Reportes';             // ReportesController
import CuentasPorCobrar from './Components/CuentasPorCobrar'; // PagosController (CxC)
import Usuarios from './Components/Usuarios';             // UsuariosController
import ConfiguracionEmpresa from './Components/ConfiguracionEmpresa'; // EmpresaController

function App() {
  const [vista, setVista] = useState('pos');
  const { tasa } = useContext(ConfigContext);

  // Función para renderizar el componente según la vista seleccionada
  const renderVista = () => {
    switch (vista) {
      case 'dashboard': return <Dashboard />;
      case 'pos':       return <POS />;
      case 'pedidos':   return <p>Módulo de Pedidos en desarrollo...</p>; // PedidosController
      case 'productos': return <Productos />;
      case 'categorias': return <Categorias />;
      case 'inventario': return <Inventario />;
      case 'compras':   return <Compras />;
      case 'proveedores': return <Proveedores />;
      case 'cxc':       return <CuentasPorCobrar />;
      case 'reportes':  return <Reportes />;
      case 'tasa':      return <TasaDeCambio />;
      case 'usuarios':  return <Usuarios />;
      case 'config':    return <ConfiguracionEmpresa />;
      default:          return <POS />;
    }
  };

  return (
    <div className="app-container">
      {/* Barra Lateral de Navegación */}
      <aside className="sidebar">
        <h1 style={{ fontSize: '1.2rem', marginBottom: '1.5rem', color: '#60a5fa' }}>Tyted POS Pro</h1>
        
        <nav className="nav-menu">
          <small className="nav-label">VENTAS</small>
          <button className={`nav-button ${vista === 'dashboard' ? 'active' : ''}`} onClick={() => setVista('dashboard')}>📊 Dashboard</button>
          <button className={`nav-button ${vista === 'pos' ? 'active' : ''}`} onClick={() => setVista('pos')}>🛒 Punto de Venta</button>
          <button className={`nav-button ${vista === 'cxc' ? 'active' : ''}`} onClick={() => setVista('cxc')}>  📋 Cuentas por Cobrar </button>

          <small className="nav-label">ALMACÉN</small>
          <button className={`nav-button ${vista === 'productos' ? 'active' : ''}`} onClick={() => setVista('productos')}>🍎 Productos</button>
          <button className={`nav-button ${vista === 'categorias' ? 'active' : ''}`} onClick={() => setVista('categorias')}>📁 Categorías</button>
          <button className={`nav-button ${vista === 'inventario' ? 'active' : ''}`} onClick={() => setVista('inventario')}>📦 Inventario/Kardex</button>

          <small className="nav-label">COMPRAS</small>
          <button className={`nav-button ${vista === 'compras' ? 'active' : ''}`} onClick={() => setVista('compras')}>🧾 Compras / Notas</button>
          <button className={`nav-button ${vista === 'proveedores' ? 'active' : ''}`} onClick={() => setVista('proveedores')}>🤝 Proveedores</button>

          <small className="nav-label">SISTEMA</small>
          <button className={`nav-button ${vista === 'reportes' ? 'active' : ''}`} onClick={() => setVista('reportes')}>📈 Reportes</button>
          <button className={`nav-button ${vista === 'tasa' ? 'active' : ''}`} onClick={() => setVista('tasa')}>💵 Tasa: {tasa}</button>
          <button className={`nav-button ${vista === 'usuarios' ? 'active' : ''}`} onClick={() => setVista('usuarios')}>👤 Usuarios</button>
          <button className={`nav-button ${vista === 'config' ? 'active' : ''}`} onClick={() => setVista('config')}>⚙️ Configuración</button>
        </nav>

        {/* Indicador de Tasa al final */}
        <div className="sidebar-footer">
          <p>Moneda Base: <b>USD</b></p>
          <p>Tasa: <b>{tasa} Bs/$</b></p>
        </div>
      </aside>

      {/* Área Principal Dinámica */}
      <main className="main-content">
        {renderVista()}
      </main>
    </div>
  );
}

export default App;