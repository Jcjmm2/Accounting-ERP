import React, { useState, useCallback } from 'react';
import ComprasForm from "./ComprasForm"; // Asumimos que este archivo existe
import ListaCompras from "./ListaCompras"; // Asumimos que este archivo existe
import ReporteCompras from "./ReporteCompras"; // <-- ¡IMPORTACIÓN CORREGIDA!

// Definición de las vistas internas del panel
const VIEW_MODES = {
    LISTAR: 'LISTAR',
    REGISTRAR: 'REGISTRAR',
    REPORTE: 'REPORTE' 
};

const PanelGestionCompras = ({ API_URL }) => {
    // Vista activa dentro del panel (Lista por defecto)
    const [activeView, setActiveView] = useState(VIEW_MODES.LISTAR);
    
    // Bandera que se alterna para forzar la recarga de ListaCompras.jsx
    const [refreshFlag, setRefreshFlag] = useState(false);

    // =========================================================================
    // CALLBACK DE ÉXITO (Registro o Anulación)
    // =========================================================================
    // Esta función se llama desde ComprasForm (al guardar) y ListaCompras (al anular)
    const handleActionSuccess = useCallback(() => {
        // 1. Alterna la bandera, ListaCompras lo detecta y se recarga
        setRefreshFlag(prev => !prev);
        // 2. Vuelve a la vista de lista
        setActiveView(VIEW_MODES.LISTAR);
    }, []);

    // =========================================================================
    // RENDERIZADO CONDICIONAL DE VISTAS
    // =========================================================================
    const renderContent = () => {
        switch (activeView) {
            case VIEW_MODES.REGISTRAR:
                // ComprasForm DEBE aceptar las props API_URL, onSaveSuccess y onCancel
                return (
                    <ComprasForm 
                        API_URL={API_URL} 
                        onSaveSuccess={handleActionSuccess} // Pasa el callback de recarga
                        onCancel={() => setActiveView(VIEW_MODES.LISTAR)} // Pasa el callback de cancelación
                    />
                );
            case VIEW_MODES.LISTAR:
                // ListaCompras recibe la bandera y el callback de anulación
                return (
                    <ListaCompras 
                        API_URL={API_URL} 
                        refreshFlag={refreshFlag} 
                        onAnnulmentSuccess={handleActionSuccess} 
                    />
                );
            case VIEW_MODES.REPORTE:
                // Componente ReporteCompras (AHORA SÍ EXISTE Y SE RENDERIZA)
                return <ReporteCompras API_URL={API_URL} />; 
            default:
                // Por defecto, muestra la lista
                return (
                    <ListaCompras 
                        API_URL={API_URL} 
                        refreshFlag={refreshFlag} 
                        onAnnulmentSuccess={handleActionSuccess} 
                    />
                );
        }
    };

    // =========================================================================
    // RENDERIZADO DEL PANEL PRINCIPAL
    // =========================================================================
    return (
        <div className="container mt-4">
            <h2 className="mb-4">Gestión Centralizada de Compras</h2>

            {/* Navegación (Pestañas) */}
            <div className="btn-group mb-4" role="group" aria-label="Navegación de Compras">
                <button
                    type="button"
                    className={`btn ${activeView === VIEW_MODES.LISTAR ? 'btn-primary' : 'btn-outline-primary'}`}
                    onClick={() => setActiveView(VIEW_MODES.LISTAR)}
                >
                    📋 Listar y Anular Compras
                </button>
                <button
                    type="button"
                    className={`btn ${activeView === VIEW_MODES.REGISTRAR ? 'btn-primary' : 'btn-outline-primary'}`}
                    onClick={() => setActiveView(VIEW_MODES.REGISTRAR)}
                >
                    ➕ Registrar Nueva Compra
                </button>
                <button
                    type="button"
                    className={`btn ${activeView === VIEW_MODES.REPORTE ? 'btn-primary' : 'btn-outline-primary'}`}
                    onClick={() => setActiveView(VIEW_MODES.REPORTE)}
                >
                    📊 Reportes
                </button>
            </div>

            {/* Contenido de la vista activa */}
            {renderContent()}
        </div>
    );
};

export default PanelGestionCompras;