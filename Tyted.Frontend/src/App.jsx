import React, { useState } from 'react';
import TasaDeCambio from './components/TasaDeCambio';
import ProveedorList from './components/ProveedorList';
import ProveedorForm from './components/ProveedorForm'; 
import ProductoList from './components/ProductoList';
import ProductoForm from './components/ProductoForm';
import ComprasForm from './components/Compras/ComprasForm'; // <--- 1. NUEVA IMPORTACIÓN DE COMPRAS

// Definición de la URL base del API
const API_URL = 'http://localhost:5077/api'; 

const App = () => {
    // Estado principal para la navegación: 'Inventario' es la vista inicial
    const [activeModule, setActiveModule] = useState('Inventario');
    
    // --- ESTADOS DE EDICIÓN ---
    const [productoAEditar, setProductoAEditar] = useState(null); 
    const [proveedorAEditar, setProveedorAEditar] = useState(null); 

    // ... (FUNCIONES handleEditProduct, handleProductSave, handleCancelEdit, 
    //        handleEditProveedor, handleProveedorSave, handleCancelProveedor se mantienen) ...

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

    const handleEditProveedor = (proveedor) => { 
        setProveedorAEditar(proveedor); 
        setActiveModule('CrearEditarProveedor'); 
    };

    const handleProveedorSave = () => { 
        setProveedorAEditar(null); 
        setActiveModule('Proveedores'); 
    };

    const handleCancelProveedor = () => { 
        setProveedorAEditar(null); 
        setActiveModule('Proveedores'); 
    };
    
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
                    <ProductoList 
                        API_URL={API_URL}
                        onEdit={handleEditProduct} 
                        onNew={() => setActiveModule('CrearEditarArticulo')} 
                    />
                );
            case 'TasaDeCambio':
                return <TasaDeCambio API_URL={API_URL} />;
                
            case 'Proveedores': 
                return (
                    <ProveedorList 
                        API_URL={API_URL}
                        onEdit={handleEditProveedor} 
                        onNew={() => setActiveModule('CrearEditarProveedor')} 
                    />
                );
            case 'Compras': // <--- 2. NUEVA INTEGRACIÓN DEL MÓDULO DE COMPRAS
                return <ComprasForm />; // <-- Renderiza el formulario de compras
                
            default:
                return <h2>Seleccione un módulo</h2>;
        }
    };

    return (
        // ... (El JSX de la estructura y botones de navegación se mantiene igual) ...
        <div className="App" style={{ padding: '20px' }}>
            <h1>Sistema Tyted (Módulos)</h1>
            
            {/* --- Barra de Navegación --- */}
            <div style={{ marginBottom: '20px', borderBottom: '1px solid #ccc', paddingBottom: '10px' }}>
                <button 
                    onClick={() => setActiveModule('TasaDeCambio')}
                    style={{ marginRight: '10px', fontWeight: activeModule === 'TasaDeCambio' ? 'bold' : 'normal' }}
                >
                    Tasa de Cambio
                </button>
                <button 
                    onClick={() => setActiveModule('Proveedores')}
                    style={{ marginRight: '10px', fontWeight: activeModule === 'Proveedores' ? 'bold' : 'normal' }}
                >
                    Gestión de Proveedores
                </button>
                <button 
                    onClick={() => setActiveModule('Inventario')}
                    style={{ marginRight: '10px', fontWeight: activeModule === 'Inventario' ? 'bold' : 'normal' }}
                >
                    Gestión de Artículos
                </button>
                <button 
                    onClick={() => setActiveModule('Compras')}
                    style={{ marginRight: '10px', fontWeight: activeModule === 'Compras' ? 'bold' : 'normal' }}
                >
                    Registro de Compras
                </button>
            </div>

            {/* Contenido del Módulo Activo */}
            {renderModule()}
            
        </div>
    );
};

export default App;


