import React, { useState } from 'react';
import TasaDeCambio from './components/TasaDeCambio';
import ProveedorList from './components/ProveedorList';
import ProveedorForm from './components/ProveedorForm'; 
import ProductoForm from './components/ProductoForm';
import PanelGestionProductos from './components/PanelGestionProductos';
// Se eliminan los imports de ComprasForm y ListaCompras
// import ComprasForm from './components/Compras/ComprasForm';
// import ListaCompras from './components/Compras/ListaCompras'; 

// NUEVO IMPORT: Panel unificado para la gestión de Compras
import PanelGestionCompras from './components/Compras/PanelGestionCompras'; 


// Definición de la URL base del API
const API_URL = 'http://localhost:5077/api'; 

const App = () => {
    // Estado principal para la navegación: 'COMPRAS' es la vista inicial (MODIFICADO)
    const [activeModule, setActiveModule] = useState('COMPRAS');
    
    // --- ESTADOS DE EDICIÓN ---
    const [productoAEditar, setProductoAEditar] = useState(null); 
    const [proveedorAEditar, setProveedorAEditar] = useState(null); 

    // --- FUNCIONES DE GESTIÓN DE ARTÍCULOS ---

    const handleEditProduct = (producto) => {
        setProductoAEditar(producto);
        setActiveModule('CrearEditarArticulo');
    };

    const handleProductSave = () => {
        setProductoAEditar(null);
        setActiveModule('Inventario');
    };

    const handleCancelEdit = () => {
        setProductoAEditar(null);
        setActiveModule('Inventario');
    };

    // --- FUNCIONES DE GESTIÓN DE PROVEEDORES ---

    const handleEditProveedor = (proveedor) => { 
        setProveedorAEditar(proveedor); 
        setActiveModule('CrearEditarProveedor'); 
    };

    const handleProveedorSave = () => { 
        setProveedorAEditar(null); 
        setActiveModule('PROVEEDORES'); // Usamos el nombre del módulo unificado
    };

    const handleCancelProveedor = () => { 
        setProveedorAEditar(null); 
        setActiveModule('PROVEEDORES'); // Usamos el nombre del módulo unificado
    };
    
    
    // Constants for child panel modes
    const VIEW_MODES = { LISTAR: 'LISTAR', CREAR: 'CREAR', EDITAR: 'EDITAR' };

    // -----------------------------------------------------------
    // Renderizado condicional del módulo activo
    // -----------------------------------------------------------
    const renderModule = () => {
        
        // Módulo de creación/edición de artículos
        if (activeModule === 'CrearEditarArticulo') {
            return (
                <ProductoForm 
                    API_URL={API_URL}
                    productoToEdit={productoAEditar} 
                    onSave={handleProductSave}
                    onCancel={handleCancelEdit}
                />
            );
        }
        
        // Módulo de creación/edición de PROVEEDORES
        if (activeModule === 'CrearEditarProveedor') { 
            return (
                <ProveedorForm 
                    API_URL={API_URL}
                    proveedorToEdit={proveedorAEditar} 
                    onSave={handleProveedorSave} 
                    onCancel={handleCancelProveedor} 
                />
            );
            
        }

        // Renderizado de otros módulos (SWITCH)
        switch (activeModule) {
            case 'Inventario':
                return (
                    <PanelGestionProductos 
                        API_URL={API_URL}
                        VIEW_MODES={VIEW_MODES}
                    />
                );
            case 'TasaDeCambio':
                return <TasaDeCambio API_URL={API_URL} />;
                
            // CASO UNIFICADO PARA PROVEEDORES (Se usa mayúsculas para el nombre del módulo)
            case 'PROVEEDORES': 
                return (
                    <ProveedorList 
                        API_URL={API_URL}
                        onEdit={handleEditProveedor} 
                        onNew={() => setActiveModule('CrearEditarProveedor')} 
                    />
                );
                
            // CASO UNIFICADO PARA TODA LA GESTIÓN DE COMPRAS (NUEVO)
            case 'COMPRAS': 
                return <PanelGestionCompras API_URL={API_URL} />; 
                
            // Se eliminan los casos 'RegistrarCompra' y 'VerCompras'
            
            default:
                // Mensaje por defecto unificado
                return <div>Seleccione un módulo de gestión (Compras o Proveedores).</div>;
        }
    };

    return (
        <div className="container" style={{ padding: '20px' }}>
            <h1>Sistema Tyted (Módulos)</h1>
            
            {/* --- Barra de Navegación (Adaptada al nuevo estilo con clases de Bootstrap) --- */}
            <div className="d-flex mb-4" style={{ borderBottom: '1px solid #ccc', paddingBottom: '10px' }}>
                
                {/* Botones de Módulos Generales */}
                <button 
                    onClick={() => setActiveModule('TasaDeCambio')}
                    className={`btn ${activeModule === 'TasaDeCambio' ? 'btn-primary' : 'btn-secondary'} me-2`}
                >
                    Tasa de Cambio
                </button>
                <button 
                    onClick={() => setActiveModule('Inventario')}
                    className={`btn ${activeModule === 'Inventario' || activeModule === 'CrearEditarArticulo' ? 'btn-primary' : 'btn-secondary'} me-2`}
                >
                    Gestión de Artículos
                </button>

                {/* Botón de PROVEEDORES (Módulo Unificado) */}
                <button 
                    onClick={() => setActiveModule('PROVEEDORES')}
                    className={`btn ${activeModule === 'PROVEEDORES' || activeModule === 'CrearEditarProveedor' ? 'btn-primary' : 'btn-secondary'} me-2`}
                >
                    Gestión de Proveedores
                </button>
                
                {/* Botón de COMPRAS (Módulo Unificado) */}
                <button 
                    onClick={() => setActiveModule('COMPRAS')} 
                    className={`btn ${activeModule === 'COMPRAS' ? 'btn-primary' : 'btn-secondary'} me-2`}
                >
                    Gestión de Compras
                </button>
                
            </div>

            {/* Contenido del Módulo Activo */}
            {renderModule()}
            
        </div>
    );
};

export default App;