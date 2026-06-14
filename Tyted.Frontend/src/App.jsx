import React, { useState, useContext, useEffect } from 'react';
import Login from './Components/Login';
import POS from './Components/POS';
import TasaDeCambio from './Components/TasaDeCambio';
import { ConfigContext } from './Context/ConfigContext';
import './App.css';

// Importación de nuevos componentes (basados en tus controladores .cs)
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
import Clientes from './Components/Clientes'; // ClientesController
import Pedidos from './Components/Pedidos'; // PedidosController

function App() {
  const [vista, setVista] = useState('pos');
  const { tasa, user, logout } = useContext(ConfigContext); 

  // --- NUEVO: Estado para ocultar/mostrar la barra lateral ---
  // Se inicializa Abierto en PC (pantalla > 768px) y Oculto en teléfonos
  const [sidebarVisible, setSidebarVisible] = useState(window.innerWidth > 768);

  // --- NUEVO: Función auxiliar para navegación móvil fluida ---
  const cambiarVista = (nuevaVista) => {
    setVista(nuevaVista);
    // Si es pantalla de teléfono, oculta la barra automáticamente al elegir una opción
    if (window.innerWidth <= 768) {
      setSidebarVisible(false);
    }
  };

  // Escuchar si el usuario cambia el tamaño de la pantalla en PC para ajustar el menú
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth > 768) {
        setSidebarVisible(true);
      }
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // --- LÓGICA DE PROTECCIÓN ---
  // Si no hay usuario logueado, mostramos SOLAMENTE el Login
  if (!user) {
    return <Login />;
  }

  // Función para renderizar el componente según la vista seleccionada
  const renderVista = () => {
    switch (vista) {
      case 'dashboard': return <Dashboard />;
      case 'pos':       return <POS />;
      case 'pedidos':   return <Pedidos />;
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
      case 'clientes':    return <Clientes />;
      default:          return <POS />;
    }
  };

  return (
    <div className={`app-container ${sidebarVisible ? 'sidebar-abierta' : 'sidebar-oculta'}`}>
      
      {/* INYECCIÓN DE ESTILOS RESPONSIVOS AVANZADOS (No altera tu App.css externo) */}
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
          padding-top: 60px !important; /* Espacio superior para que el botón no tape títulos */
        }
        
        /* Efecto de ocultación para PC y Móviles */
        .sidebar-oculta .sidebar {
          margin-left: -260px;
          opacity: 0;
          pointer-events: none;
        }

        /* Estilos específicos para pantallas de Teléfonos (Móviles) */
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

      {/* BOTÓN FLOTANTE DINÁMICO (Hamburguesa / Flecha de cierre) */}
      <button 
        onClick={() => setSidebarVisible(!sidebarVisible)}
        style={{
          position: 'fixed',
          top: '12px',
          // El botón se mueve junto al menú si está abierto en PC, o se queda estático en la esquina
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

      {/* OVERLAY: Fondo oscuro que aparece en el teléfono para poder cerrar el menú tocando afuera */}
      {sidebarVisible && (
        <div className="sidebar-overlay" onClick={() => setSidebarVisible(false)} />
      )}

      {/* Barra Lateral de Navegación */}
      <aside className="sidebar">
        <h1 style={{ fontSize: '1.2rem', marginBottom: '1.5rem', color: '#60a5fa', paddingRight: '20px' }}>TYTED System</h1>
        
        <div style={{ marginBottom: '1.5rem', paddingBottom: '1rem', borderBottom: '1px solid #334155', fontSize: '0.8rem', color: '#cbd5e1' }}>
           Hola, <b>{user.username}</b> <br/>
           <span style={{ fontSize: '0.7rem', opacity: 0.7 }}>{user.rol}</span>
        </div>
        <nav className="nav-menu">
          <small className="nav-label">VENTAS</small>
          <button className={`nav-button ${vista === 'dashboard' ? 'active' : ''}`} onClick={() => cambiarVista('dashboard')}>📊 Dashboard</button>
          <button className={`nav-button ${vista === 'pos' ? 'active' : ''}`} onClick={() => cambiarVista('pos')}>🛒 Punto de Venta</button>
          <button className={`nav-button ${vista === 'cxc' ? 'active' : ''}`} onClick={() => cambiarVista('cxc')}>  📋 Cuentas por Cobrar </button>
          <button className={`nav-button ${vista === 'clientes' ? 'active' : ''}`} onClick={() => cambiarVista('clientes')}>  👩‍💼 Clientes </button>
          <button className={`nav-button ${vista === 'pedidos' ? 'active' : ''}`} onClick={() => cambiarVista('pedidos')}>  🥫 Pedidos </button>

          <small className="nav-label">ALMACÉN</small>
          <button className={`nav-button ${vista === 'productos' ? 'active' : ''}`} onClick={() => cambiarVista('productos')}>🍎 Productos</button>
          <button className={`nav-button ${vista === 'categorias' ? 'active' : ''}`} onClick={() => cambiarVista('categorias')}>📁 Categorías</button>
          <button className={`nav-button ${vista === 'inventario' ? 'active' : ''}`} onClick={() => cambiarVista('inventario')}>📦 Inventario/Kardex</button>

          <small className="nav-label">COMPRAS</small>
          <button className={`nav-button ${vista === 'compras' ? 'active' : ''}`} onClick={() => cambiarVista('compras')}>🧾 Compras / Notas</button>
          <button className={`nav-button ${vista === 'proveedores' ? 'active' : ''}`} onClick={() => cambiarVista('proveedores')}>🤝 Proveedores</button>

          <small className="nav-label">SISTEMA</small>
          <button className={`nav-button ${vista === 'reportes' ? 'active' : ''}`} onClick={() => cambiarVista('reportes')}>📈 Reportes</button>
          <button className={`nav-button ${vista === 'tasa' ? 'active' : ''}`} onClick={() => cambiarVista('tasa')}>💵 Tasa: {tasa}</button>
          <button className={`nav-button ${vista === 'usuarios' ? 'active' : ''}`} onClick={() => cambiarVista('usuarios')}>👤 Usuarios</button>
          <button className={`nav-button ${vista === 'config' ? 'active' : ''}`} onClick={() => cambiarVista('config')}>⚙️ Configuración</button>
        </nav>
        <div className="sidebar-footer">
          {/* Botón de Cerrar Sesión */}
          <button 
            onClick={logout}
            style={{ 
                width: '100%', padding: '8px', background: '#dc2626', color: 'white', 
                border: 'none', borderRadius: '6px', cursor: 'pointer', marginBottom: '10px' 
            }}
          >
            🔒 Cerrar Sesión
          </button>
          <p style={{ fontSize: '0.75rem' }}>Tasa: <b>{tasa} Bs/$</b></p>
        </div>

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