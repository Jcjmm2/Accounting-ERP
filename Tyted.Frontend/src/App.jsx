import React, { useState, useContext, useEffect } from 'react';
import Login from './components/Login';
import POS from './components/POS';
import TasaDeCambio from './components/TasaDeCambio';
import { ConfigContext } from './Context/ConfigContext';
import './App.css';

// Importación de componentes del sistema ERP
import Dashboard from './components/Dashboard';
import Categorias from './components/Categorias';
import Productos from './components/Productos';
import Inventario from './components/Inventario';
import Compras from './components/Compras';
import Proveedores from './components/Proveedores';
import Reportes from './components/Reportes';
import CuentasPorCobrar from './components/CuentasPorCobrar';
import Usuarios from './components/Usuarios';
import ConfiguracionEmpresa from './components/ConfiguracionEmpresa';
import Clientes from './components/Clientes';
import Pedidos from './components/Pedidos';
import ModuloContable from './Pages/Contabilidad/ModuloContable';
import RegistroVentasFiscal from './Pages/Fiscal/RegistroVentasFiscal';
import RegistroComprasFiscal from './Pages/Fiscal/RegistroComprasFiscal';
import ConceptosOperacionales from './Pages/Fiscal/ConceptosOperacionales';
import ReporteForma30 from './Pages/Fiscal/ReporteForma30';
import DeclaracionesSeniat from './Pages/Fiscal/DeclaracionesSeniat';

const GRUPOS_MENU = [
  {
    id: 'ventas',
    titulo: 'VENTAS',
    items: [
      { id: 'dashboard', icono: '📊', label: 'Dashboard' },
      { id: 'pos', icono: '🛒', label: 'Punto de Venta' },
      { id: 'cxc', icono: '📋', label: 'Cuentas por Cobrar' },
      { id: 'clientes', icono: '👩‍💼', label: 'Clientes' },
      { id: 'pedidos', icono: '🥫', label: 'Pedidos' },
    ],
  },
  {
    id: 'almacen',
    titulo: 'ALMACÉN',
    items: [
      { id: 'productos', icono: '🍎', label: 'Productos' },
      { id: 'categorias', icono: '📁', label: 'Categorías' },
      { id: 'inventario', icono: '📦', label: 'Inventario / Kardex' },
    ],
  },
  {
    id: 'compras',
    titulo: 'COMPRAS',
    items: [
      { id: 'compras', icono: '🧾', label: 'Compras / Notas' },
      { id: 'proveedores', icono: '🤝', label: 'Proveedores' },
    ],
  },
  {
    id: 'contabilidad',
    titulo: 'CONTABILIDAD',
    items: [
      { id: 'contabilidad', icono: '📒', label: 'Contabilidad' },
    ],
  },
  {
    id: 'fiscal',
    titulo: 'FISCAL (IVA SENIAT)',
    items: [
      { id: 'ventas-fiscal', icono: '📕', label: 'Registro de Ventas' },
      { id: 'compras-fiscal', icono: '📗', label: 'Registro de Compras' },
      { id: 'forma30', icono: '🧮', label: 'Forma 30 (IVA)' },
      { id: 'conceptos-fiscal', icono: '🏷️', label: 'Conceptos Ingresos/Gastos' },
      { id: 'declaraciones-seniat', icono: '📄', label: 'Declaraciones SENIAT' },
    ],
  },
  {
    id: 'sistema',
    titulo: 'SISTEMA',
    items: [
      { id: 'reportes', icono: '📈', label: 'Reportes' },
      { id: 'tasa', icono: '💵', label: 'Tasa de Cambio', mostrarTasa: true },
      { id: 'usuarios', icono: '👤', label: 'Usuarios' },
      { id: 'config', icono: '⚙️', label: 'Configuración' },
    ],
  },
];

function App() {
  const [vista, setVista] = useState(() => localStorage.getItem('tyted_vista') || 'contabilidad');
  const [sidebarVisible, setSidebarVisible] = useState(window.innerWidth > 768);
  const [contextoExpandido, setContextoExpandido] = useState(true);

  // Abre por defecto el acordeón donde se encuentra la vista actual
  const [gruposAbiertos, setGruposAbiertos] = useState(() => {
    const vistaInicial = localStorage.getItem('tyted_vista') || 'contabilidad';
    const grupoActivo = GRUPOS_MENU.find(g => g.items.some(i => i.id === vistaInicial))?.id || 'contabilidad';
    return { [grupoActivo]: true, contabilidad: true, fiscal: true };
  });

  const {
    tasa,
    user,
    logout,
    empresaActiva,
    periodoActivo,
    empresas,
    periodos,
    seleccionarEmpresa,
    seleccionarPeriodo
  } = useContext(ConfigContext);

  const toggleGrupo = (grupoId) => {
    setGruposAbiertos(prev => ({ ...prev, [grupoId]: !prev[grupoId] }));
  };

  const cambiarVista = (nuevaVista) => {
    setVista(nuevaVista);
    localStorage.setItem('tyted_vista', nuevaVista);
    const grupo = GRUPOS_MENU.find(g => g.items.some(i => i.id === nuevaVista));
    if (grupo) {
      setGruposAbiertos(prev => ({ ...prev, [grupo.id]: true }));
    }
    if (window.innerWidth <= 768) {
      setSidebarVisible(false);
    }
  };

  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth > 768) {
        setSidebarVisible(true);
      }
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  if (!user) {
    return <Login />;
  }

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
      case 'ventas-fiscal': return <RegistroVentasFiscal />;
      case 'compras-fiscal': return <RegistroComprasFiscal />;
      case 'forma30': return <ReporteForma30 />;
      case 'conceptos-fiscal': return <ConceptosOperacionales />;
      case 'declaraciones-seniat': return <DeclaracionesSeniat />;
      case 'contabilidad': return <ModuloContable />;
      default: return <ModuloContable />;
    }
  };

  // Construye la lista ordenada de Periodo Padre + Subperiodos mensuales
  const construirOpcionesPeriodos = () => {
    const listaBase = Array.isArray(periodos) ? periodos : (periodos?.$values || []);
    if (!listaBase.length) return [];

    const formatearNombre = (p) =>
      p.nombre || `${p.mes ? `${String(p.mes).padStart(2, '0')}/` : ''}${p.anio || ''}`;

    const extraerHijosAnidados = (p) =>
      p.subPeriodos?.$values || p.subPeriodos ||
      p.periodosHijos?.$values || p.periodosHijos ||
      p.hijos?.$values || p.hijos ||
      p.children?.$values || p.children ||
      [];

    // Detectar si vienen en lista plana con periodoPadreId / padreId
    const tienePadreId = listaBase.some(
      (p) => (p.periodoPadreId ?? p.padreId ?? p.parentId) != null
    );

    const opciones = [];
    const idsAgregados = new Set();

    const padres = tienePadreId
      ? listaBase.filter((p) => (p.periodoPadreId ?? p.padreId ?? p.parentId) == null)
      : listaBase;

    padres.forEach((padre) => {
      if (!idsAgregados.has(padre.id)) {
        opciones.push({ id: padre.id, etiqueta: `📅 ${formatearNombre(padre)}` });
        idsAgregados.add(padre.id);
      }

      const hijos = tienePadreId
        ? listaBase.filter((p) => (p.periodoPadreId ?? p.padreId ?? p.parentId) === padre.id)
        : extraerHijosAnidados(padre);

      hijos.forEach((sub) => {
        if (!idsAgregados.has(sub.id)) {
          opciones.push({ id: sub.id, etiqueta: `   ↳ ${formatearNombre(sub)}` });
          idsAgregados.add(sub.id);
        }
      });
    });

    // Respaldo: incluir cualquier periodo restante que no haya coincidido
    listaBase.forEach((p) => {
      if (!idsAgregados.has(p.id)) {
        opciones.push({ id: p.id, etiqueta: `📅 ${formatearNombre(p)}` });
        idsAgregados.add(p.id);
      }
    });

    return opciones;
  };

  const opcionesPeriodos = construirOpcionesPeriodos();
  const nombreEmpresaActual = empresaActiva?.razonSocial || empresaActiva?.nombre || 'Empresa principal';
  const nombrePeriodoActual = periodoActivo?.nombre || 'Periodo actual';

  return (
    <div className={`app-container ${sidebarVisible ? 'sidebar-abierta' : 'sidebar-oculta'}`}>
      <style>{`
        .app-container {
          display: flex;
          position: relative;
          min-height: 100vh;
          width: 100%;
        }
        .sidebar {
          width: 260px;
          height: 100vh;
          position: sticky;
          top: 0;
          display: flex;
          flex-direction: column;
          padding: 12px !important;
          box-sizing: border-box;
          transition: margin-left 0.25s ease-in-out, opacity 0.2s ease-in-out;
          flex-shrink: 0;
          z-index: 999;
          overflow: hidden !important;
        }
        .main-content {
          flex: 1;
          min-width: 0;
          transition: all 0.25s ease-in-out;
          padding-top: ${sidebarVisible ? '16px' : '56px'} !important;
        }
        .sidebar-oculta .sidebar {
          margin-left: -260px;
          opacity: 0;
          pointer-events: none;
        }

        /* Cabecera y selectores compactos */
        .sb-header {
          flex-shrink: 0;
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding-bottom: 8px;
          margin-bottom: 8px;
          border-bottom: 1px solid #334155;
        }
        .sb-user-bar {
          flex-shrink: 0;
          display: flex;
          align-items: center;
          justify-content: space-between;
          font-size: 0.75rem;
          color: #cbd5e1;
          margin-bottom: 8px;
        }
        .sb-context-box {
          flex-shrink: 0;
          background: #0f172a;
          border: 1px solid #334155;
          border-radius: 8px;
          padding: 6px 8px;
          margin-bottom: 10px;
        }
        .sb-context-toggle {
          width: 100%;
          background: transparent;
          border: none;
          color: #94a3b8;
          font-size: 0.7rem;
          font-weight: 600;
          display: flex;
          align-items: center;
          justify-content: space-between;
          cursor: pointer;
          padding: 2px 0;
        }
        .sb-select {
          width: 100%;
          background: #1e293b;
          color: #f1f5f9;
          border: 1px solid #334155;
          border-radius: 6px;
          padding: 5px 8px;
          font-size: 0.78rem;
          outline: none;
          cursor: pointer;
        }
        .sb-select:focus {
          border-color: #3b82f6;
        }

        /* Área de navegación con scroll propio */
        .sb-nav {
          flex: 1;
          overflow-y: auto;
          padding-right: 4px;
          display: flex;
          flex-direction: column;
          gap: 4px;
        }
        .sb-nav::-webkit-scrollbar {
          width: 5px;
        }
        .sb-nav::-webkit-scrollbar-thumb {
          background: #334155;
          border-radius: 4px;
        }
        .sb-group-btn {
          width: 100%;
          display: flex;
          align-items: center;
          justify-content: space-between;
          background: transparent;
          border: none;
          color: #94a3b8;
          font-size: 0.68rem;
          font-weight: 700;
          letter-spacing: 0.05em;
          padding: 6px 6px 4px 6px;
          margin-top: 4px;
          cursor: pointer;
          border-radius: 4px;
        }
        .sb-group-btn:hover {
          color: #e2e8f0;
          background: rgba(255, 255, 255, 0.04);
        }
        .sb-nav .nav-button {
          padding: 7px 10px !important;
          margin: 1px 0 !important;
          font-size: 0.82rem !important;
          border-radius: 6px !important;
          display: flex;
          align-items: center;
          gap: 8px;
          text-align: left;
        }

        /* Footer único compacto */
        .sb-footer {
          flex-shrink: 0;
          margin-top: 8px;
          padding-top: 8px;
          border-top: 1px solid #334155;
          display: flex;
          align-items: center;
          justify-content: space-between;
          font-size: 0.72rem;
          color: #94a3b8;
        }

        @media (max-width: 768px) {
          .sidebar {
            position: fixed;
            top: 0;
            bottom: 0;
            left: 0;
            box-shadow: 5px 0 15px rgba(0,0,0,0.4);
          }
          .sidebar-overlay {
            position: fixed;
            inset: 0;
            background: rgba(0, 0, 0, 0.45);
            backdrop-filter: blur(2px);
            z-index: 998;
          }
          .main-content {
            padding-top: 56px !important;
          }
        }
      `}</style>

      {/* Botón flotante para abrir el sidebar solo cuando está oculto */}
      {!sidebarVisible && (
        <button
          onClick={() => setSidebarVisible(true)}
          style={{
            position: 'fixed',
            top: '12px',
            left: '12px',
            zIndex: 1000,
            background: '#2563eb',
            color: 'white',
            border: 'none',
            borderRadius: '8px',
            width: '38px',
            height: '38px',
            cursor: 'pointer',
            boxShadow: '0 4px 10px rgba(0,0,0,0.25)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '1.15rem'
          }}
          title="Mostrar menú"
        >
          ☰
        </button>
      )}

      {/* Overlay oscuro para cerrar el sidebar en móviles */}
      {sidebarVisible && window.innerWidth <= 768 && (
        <div className="sidebar-overlay" onClick={() => setSidebarVisible(false)} />
      )}

      {/* Barra Lateral de Navegación Optimizada */}
      <aside className="sidebar">
        {/* 1. Cabecera compacta con botón de ocultar integrado */}
        <div className="sb-header">
          <span style={{ fontSize: '1.05rem', fontWeight: '800', color: '#60a5fa', letterSpacing: '0.02em' }}>
            TYTED System
          </span>
          <button
            onClick={() => setSidebarVisible(false)}
            style={{
              background: '#1e293b',
              color: '#94a3b8',
              border: '1px solid #334155',
              borderRadius: '6px',
              width: '28px',
              height: '28px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '0.8rem'
            }}
            title="Ocultar menú"
          >
            ◀
          </button>
        </div>

        {/* 2. Usuario y botón rápido de cierre de sesión */}
        <div className="sb-user-bar">
          <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            👤 <b>{user.username}</b> <span style={{ opacity: 0.65 }}>({user.rol})</span>
          </div>
          <button
            onClick={logout}
            style={{
              background: 'rgba(220, 38, 38, 0.15)',
              color: '#f87171',
              border: '1px solid rgba(220, 38, 38, 0.4)',
              borderRadius: '5px',
              padding: '2px 7px',
              fontSize: '0.7rem',
              cursor: 'pointer',
              fontWeight: '600',
              flexShrink: 0
            }}
            title="Cerrar Sesión"
          >
            Salir
          </button>
        </div>

        {/* 3. Selectores de Empresa y Periodo compactos y colapsables */}
        <div className="sb-context-box">
          <button
            type="button"
            className="sb-context-toggle"
            onClick={() => setContextoExpandido(!contextoExpandido)}
            title="Mostrar u ocultar selectores de Empresa y Periodo"
          >
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '205px' }}>
              {contextoExpandido
                ? 'CONTEXTO CONTABLE'
                : `🏢 ${nombreEmpresaActual}`}
            </span>
            <span>{contextoExpandido ? '▴' : '▾'}</span>
          </button>

          {contextoExpandido ? (
            <div style={{ display: 'grid', gap: '6px', marginTop: '6px' }}>
              <select
                value={empresaActiva?.id ?? 1}
                onChange={(e) => seleccionarEmpresa(e.target.value)}
                className="sb-select"
                title={`Empresa activa: ${nombreEmpresaActual}`}
              >
                {empresas.length ? empresas.map((empresa) => (
                  <option key={empresa.id} value={empresa.id}>
                    🏢 {empresa.razonSocial || empresa.nombre || `Empresa ${empresa.id}`}
                  </option>
                )) : (
                  <option value={empresaActiva?.id ?? 1}>🏢 {nombreEmpresaActual}</option>
                )}
              </select>

              <select
                value={periodoActivo?.id ?? ''}
                onChange={(e) => seleccionarPeriodo(e.target.value)}
                className="sb-select"
                title={`Periodo activo: ${nombrePeriodoActual}`}
              >
                {opcionesPeriodos.length ? opcionesPeriodos.map((op) => (
                  <option key={op.id} value={op.id}>
                    {op.etiqueta}
                  </option>
                )) : (
                  <option value={periodoActivo?.id ?? 1}>📅 {nombrePeriodoActual}</option>
                )}
              </select>
            </div>
          ) : (
            <div style={{ fontSize: '0.72rem', color: '#fbbf24', marginTop: '2px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              📅 {nombrePeriodoActual}
            </div>
          )}
        </div>

        {/* 4. Menú de navegación con acordeones y scroll independiente */}
        <nav className="sb-nav">
          {GRUPOS_MENU.map((grupo) => {
            const abierto = Boolean(gruposAbiertos[grupo.id]);
            const tieneVistaActiva = grupo.items.some(item => item.id === vista);

            return (
              <div key={grupo.id}>
                <button
                  type="button"
                  className="sb-group-btn"
                  onClick={() => toggleGrupo(grupo.id)}
                  style={{ color: tieneVistaActiva && !abierto ? '#60a5fa' : undefined }}
                >
                  <span>{grupo.titulo}</span>
                  <span>{abierto ? '▾' : '▸'}</span>
                </button>

                {abierto && (
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    {grupo.items.map((item) => (
                      <button
                        key={item.id}
                        className={`nav-button ${vista === item.id ? 'active' : ''}`}
                        onClick={() => cambiarVista(item.id)}
                      >
                        <span>{item.icono}</span>
                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {item.mostrarTasa ? `Tasa: ${tasa}` : item.label}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </nav>

        {/* 5. Footer único y compacto */}
        <div className="sb-footer">
          <span>Base: <b style={{ color: '#e2e8f0' }}>USD</b></span>
          <span>Tasa: <b style={{ color: '#34d399' }}>{tasa} Bs/$</b></span>
        </div>
      </aside>

      {/* Área principal */}
      <main
        className="main-content"
        key={`ctx-${empresaActiva?.id ?? 'x'}-${periodoActivo?.id ?? 'x'}`}
      >
        {renderVista()}
      </main>
    </div>
  );
}

export default App;