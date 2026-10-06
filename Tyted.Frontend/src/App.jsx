import React, { useState, useContext, useEffect } from 'react';
import Login from './Components/Login';
import POS from './Components/POS';
import TasaDeCambio from './Components/TasaDeCambio';
import { ConfigContext } from './Context/ConfigContext';
import './App.css';

// Importación de componentes del sistema ERP
import Dashboard from './Components/Dashboard';
import Categorias from './Components/Categorias';
import Productos from './Components/Productos';
import Inventario from './Components/Inventario';
import Compras from './Components/Compras';
import Proveedores from './Components/Proveedores';
import Reportes from './Components/Reportes';
import CuentasPorCobrar from './Components/CuentasPorCobrar';
import Usuarios from './Components/Usuarios';
import ConfiguracionEmpresa from './Components/ConfiguracionEmpresa';
import Clientes from './Components/Clientes';
import Pedidos from './Components/Pedidos';
import ModuloContable from './Pages/Contabilidad/ModuloContable';

function App() {
  const [vista, setVista] = useState('pos');
  const [sidebarVisible, setSidebarVisible] = useState(window.innerWidth > 768);
  
  // Obtener datos del contexto global de configuración
  const { tasa, user, logout, empresaActiva, periodoActivo, empresas, periodos, seleccionarEmpresa, seleccionarPeriodo } = useContext(ConfigContext);

  // Función para cambiar de vista con comportamiento responsive
  const cambiarVista = (nuevaVista) => {
    setVista(nuevaVista);
    if (window.innerWidth <= 768) {
      setSidebarVisible(false);
    }
  };

  // Escuchar cambios de tamaño de pantalla para ajustar el sidebar automáticamente
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth > 768) {
        setSidebarVisible(true);
      }
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Protección de rutas: Si no hay usuario, mostrar solo el Login
  if (!user) {
    return <Login />;
  }

  // Renderizado condicional de vistas según el estado
  const renderVista = () => {
    switch (vista) {
      case 'dashboard': return <Dashboard />;
      case 'pos': return <POS />;
      case 'pedidos': return <Pedidos />;
      case 'productos': return <Productos />;
      case 'categorias': return <Categorias />;
      case 'inventario': return <Inventario />;
      case 'compras': return <Compras />;
      case 'proveedores': return <Proveedores />;
      case 'cxc': return <CuentasPorCobrar />;
      case 'reportes': return <Reportes />;
      case 'tasa': return <TasaDeCambio />;
      case 'usuarios': return <Usuarios />;
      case 'config': return <ConfiguracionEmpresa />;
      case 'clientes': return <Clientes />;
      case 'contabilidad': return <ModuloContable />;
      default: return <POS />;
    }
  };

  return (
    <div className={`app-container ${sidebarVisible ? 'sidebar-abierta' : 'sidebar-oculta'}`}>
      
      {/* Estilos CSS inyectados para el layout responsive */}
      <style>{`
        .app-container {
          display: flex;
          position: relative;
          min-height: 100vh;
          width: 100%;
        }
        .sidebar {
          width: 260px;
          transition: all 0.3s ease-in-out;
          flex-shrink: 0;
          z-index: 999;
        }
        .main-content {
          flex: 1;
          width: 100%;
          transition: all 0.3s ease-in-out;
          padding-top: 60px !important;
        }
        .sidebar-oculta .sidebar {
          margin-left: -260px;
          opacity: 0;
          pointer-events: none;
        }
        @media (max-width: 768px) {
          .sidebar {
            position: fixed;
            top: 0;
            bottom: 0;
            left: 0;
            box-shadow: 5px 0 15px rgba(0,0,0,0.3);
          }
          .sidebar-overlay {
            position: fixed;
            inset: 0;
            background: rgba(0, 0, 0, 0.4);
            backdrop-filter: blur(2px);
            z-index: 998;
          }
        }
      `}</style>
      
      {/* Botón flotante para toggle del sidebar (Hamburguesa/Flecha) */}
      <button 
        onClick={() => setSidebarVisible(!sidebarVisible)}
        style={{
          position: 'fixed',
          top: '12px',
          left: sidebarVisible && window.innerWidth > 768 ? '272px' : '12px',
          zIndex: 1000,
          background: '#2563eb',
          color: 'white',
          border: 'none',
          borderRadius: '8px',
          width: '40px',
          height: '40px',
          cursor: 'pointer',
          boxShadow: '0 4px 10px rgba(0,0,0,0.2)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '1.2rem',
          transition: 'left 0.3s ease-in-out, background 0.2s'
        }}
        title={sidebarVisible ? "Ocultar menú" : "Mostrar menú"}
      >
        {sidebarVisible ? '◀' : '☰'}
      </button>
      
      {/* Overlay oscuro para cerrar el sidebar en móviles al tocar fuera */}
      {sidebarVisible && (
        <div className="sidebar-overlay" onClick={() => setSidebarVisible(false)} />
      )}
      
      {/* Barra Lateral de Navegación */}
      <aside className="sidebar">
        <h1 style={{ fontSize: '1.2rem', marginBottom: '1.5rem', color: '#60a5fa', paddingRight: '20px' }}>
          TYTED System
        </h1>
        
        {/* Información del usuario logueado */}
        <div style={{ 
          marginBottom: '1rem', 
          paddingBottom: '1rem', 
          borderBottom: '1px solid #334155', 
          fontSize: '0.8rem', 
          color: '#cbd5e1' 
        }}>
          Hola, <b>{user.username}</b> <br/>
          <span style={{ fontSize: '0.7rem', opacity: 0.7 }}>{user.rol}</span>
        </div>

        <div style={{ marginBottom: '1.5rem', display: 'grid', gap: '10px' }}>
          <div>
            <label style={{ display: 'block', fontSize: '0.7rem', color: '#94a3b8', marginBottom: '6px' }}>Empresa</label>
            <select
              value={empresaActiva?.id ?? 1}
              onChange={(e) => seleccionarEmpresa(e.target.value)}
              style={{ width: '100%', background: '#0f172a', color: '#e2e8f0', border: '1px solid #334155', borderRadius: '6px', padding: '8px 10px' }}
            >
              {empresas.length ? empresas.map((empresa) => (
                <option key={empresa.id} value={empresa.id}>{empresa.razonSocial || empresa.nombre || `Empresa ${empresa.id}`}</option>
              )) : (
                <option value={empresaActiva?.id ?? 1}>{empresaActiva?.razonSocial || empresaActiva?.nombre || 'Empresa principal'}</option>
              )}
            </select>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.7rem', color: '#94a3b8', marginBottom: '6px' }}>Periodo</label>
            <select
              value={periodoActivo?.id ?? 1}
              onChange={(e) => seleccionarPeriodo(e.target.value)}
              style={{ width: '100%', background: '#0f172a', color: '#e2e8f0', border: '1px solid #334155', borderRadius: '6px', padding: '8px 10px' }}
            >
              {periodos.length ? periodos.map((periodo) => (
                <option key={periodo.id} value={periodo.id}>{periodo.nombre || `${periodo.mes ? `${periodo.mes}/` : ''}${periodo.anio}`}</option>
              )) : (
                <option value={periodoActivo?.id ?? 1}>{periodoActivo?.nombre || 'Periodo actual'}</option>
              )}
            </select>
          </div>
        </div>

        {/* Menú de navegación principal */}
        <nav className="nav-menu">
          <small className="nav-label">VENTAS</small>
          <button className={`nav-button ${vista === 'dashboard' ? 'active' : ''}`} onClick={() => cambiarVista('dashboard')}>
             Dashboard
          </button>
          <button className={`nav-button ${vista === 'pos' ? 'active' : ''}`} onClick={() => cambiarVista('pos')}>
            🛒 Punto de Venta
          </button>
          <button className={`nav-button ${vista === 'cxc' ? 'active' : ''}`} onClick={() => cambiarVista('cxc')}>
            📋 Cuentas por Cobrar
          </button>
          <button className={`nav-button ${vista === 'clientes' ? 'active' : ''}`} onClick={() => cambiarVista('clientes')}>
            👩‍💼 Clientes
          </button>
          <button className={`nav-button ${vista === 'pedidos' ? 'active' : ''}`} onClick={() => cambiarVista('pedidos')}>
            🥫 Pedidos
          </button>

          <small className="nav-label">ALMACÉN</small>
          <button className={`nav-button ${vista === 'productos' ? 'active' : ''}`} onClick={() => cambiarVista('productos')}>
            🍎 Productos
          </button>
          <button className={`nav-button ${vista === 'categorias' ? 'active' : ''}`} onClick={() => cambiarVista('categorias')}>
            📁 Categorías
          </button>
          <button className={`nav-button ${vista === 'inventario' ? 'active' : ''}`} onClick={() => cambiarVista('inventario')}>
            📦 Inventario/Kardex
          </button>

          <small className="nav-label">COMPRAS</small>
          <button className={`nav-button ${vista === 'compras' ? 'active' : ''}`} onClick={() => cambiarVista('compras')}>
            🧾 Compras / Notas
          </button>
          <button className={`nav-button ${vista === 'proveedores' ? 'active' : ''}`} onClick={() => cambiarVista('proveedores')}>
            🤝 Proveedores
          </button>

          <small className="nav-label">CONTABILIDAD</small>
          <button className={`nav-button ${vista === 'contabilidad' ? 'active' : ''}`} onClick={() => cambiarVista('contabilidad')}>
            📒 Contabilidad
          </button>

          <small className="nav-label">SISTEMA</small>
          <button className={`nav-button ${vista === 'reportes' ? 'active' : ''}`} onClick={() => cambiarVista('reportes')}>
            📈 Reportes
          </button>
          <button className={`nav-button ${vista === 'tasa' ? 'active' : ''}`} onClick={() => cambiarVista('tasa')}>
            💵 Tasa: {tasa}
          </button>
          <button className={`nav-button ${vista === 'usuarios' ? 'active' : ''}`} onClick={() => cambiarVista('usuarios')}>
            👤 Usuarios
          </button>
          <button className={`nav-button ${vista === 'config' ? 'active' : ''}`} onClick={() => cambiarVista('config')}>
            ⚙️ Configuración
          </button>
        </nav>

        {/* Footer del sidebar con botón de logout e información de tasa */}
        <div className="sidebar-footer">
          <button 
            onClick={logout}
            style={{ 
              width: '100%', 
              padding: '8px', 
              background: '#dc2626', 
              color: 'white', 
              border: 'none', 
              borderRadius: '6px', 
              cursor: 'pointer', 
              marginBottom: '10px' 
            }}
          >
            🔒 Cerrar Sesión
          </button>
          <p style={{ fontSize: '0.75rem' }}>Tasa: <b>{tasa} Bs/$</b></p>
        </div>
        <div className="sidebar-footer">
          <p>Moneda Base: <b>USD</b></p>
          <p>Tasa: <b>{tasa} Bs/$</b></p>
        </div>
      </aside>
      
      {/* Área principal donde se renderizan las vistas dinámicas */}
      <main className="main-content">
        {renderVista()}
      </main>
    </div>
  );
}

export default App;