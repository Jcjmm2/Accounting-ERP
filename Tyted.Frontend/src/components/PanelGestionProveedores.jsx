import React, { useState, useEffect } from 'react';
import axios from 'axios';
import ProveedorForm from './ProveedorForm';
import ListaProveedores from './ListaProveedores'; 
import BusquedaProveedores from './BusquedaProveedores';

// Nota: Recibimos API_URL y VIEW_MODES como props desde App.jsx
function PanelGestionProveedores({ API_URL, VIEW_MODES }) {

    // ======================================
    // 1. ESTADOS
    // ======================================
    const [viewMode, setViewMode] = useState(VIEW_MODES.LISTAR); 
    const [proveedores, setProveedores] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [proveedorToEdit, setProveedorToEdit] = useState(null);
    const [isSearched, setIsSearched] = useState(false); 

    // ======================================
    // 2. FUNCIÓN DE CARGA DE DATOS (Fetch)
    // ======================================
    const fetchProveedores = async (filters = {}) => {
        setLoading(true);
        setError(null);
        
        // Construcción de la Query String dinámica
        let queryString = '';
        const params = [];
        // NOTA: Usamos encodeURIComponent para asegurar que los caracteres especiales se manejen bien.
        if (filters.rif) params.push(`rif=${encodeURIComponent(filters.rif)}`);
        if (filters.razonsocial) params.push(`razonsocial=${encodeURIComponent(filters.razonsocial)}`);

        if (params.length > 0) {
            queryString = '?' + params.join('&');
        }

        try {
            const response = await axios.get(`${API_URL}/Proveedores${queryString}`); 
            setProveedores(response.data);
            setLoading(false);
            setIsSearched(true);
        } catch (err) {
            setError('Error al cargar la lista de proveedores. Verifique la conexión del Backend.');
            setLoading(false);
            console.error('Error fetching data:', err);
        }
    };

    // ======================================
    // 3. HANDLERS (Funciones de Acción)
    // ======================================
    
    // Recarga la lista después de guardar/editar
    const handleSave = () => {
        // Ejecuta una búsqueda sin filtros para mostrar toda la lista después de una operación
        fetchProveedores({}); 
        setViewMode(VIEW_MODES.LISTAR); 
        setProveedorToEdit(null);
    };

    const handleCancel = () => {
        setViewMode(VIEW_MODES.LISTAR); 
        setProveedorToEdit(null);
    };

    const handleEdit = (proveedor) => {
        setProveedorToEdit(proveedor);
        setViewMode(VIEW_MODES.EDITAR); 
    };
    
    const handleNew = () => {
        setProveedorToEdit(null); 
        setViewMode(VIEW_MODES.CREAR); 
    };

    const handleSearch = (filters) => {
        fetchProveedores(filters); 
    };

    const handleDelete = async (id) => {
        if (!window.confirm(`¿Está seguro de que desea eliminar el proveedor con Código #${id}?`)) {
            return;
        }

        try {
            await axios.delete(`${API_URL}/Proveedores/${id}`);
            alert(`Proveedor #${id} eliminado con éxito.`);
            // Recargar la lista
            fetchProveedores({}); 
        } catch (err) {
            alert('Error al eliminar el proveedor.');
            console.error('Error deleting data:', err);
        }
    };

    // ======================================
    // 4. FUNCIÓN DE RENDERIZADO DE CONTENIDO DINÁMICO
    // ======================================
    const renderContent = () => {
        
        if (error) return <div style={{ color: 'red' }}>{error}</div>;

        // Renderiza el Formulario (Crear/Editar)
        if (viewMode === VIEW_MODES.CREAR || viewMode === VIEW_MODES.EDITAR) {
            return (
                <ProveedorForm 
                    proveedorToEdit={proveedorToEdit} 
                    onSave={handleSave} 
                    onCancel={handleCancel}
                />
            );
        }

        // Renderiza el Panel de Búsqueda y la Tabla de Resultados (Solo en modo LISTAR)
        if (viewMode === VIEW_MODES.LISTAR) {
            return (
                <>
                    <BusquedaProveedores 
                        onSearch={handleSearch} 
                        onNew={handleNew} 
                    />

                    {/* Tabla de Resultados y Mensaje de Conteo */}
                    {isSearched && proveedores.length > 0 && (
                        <>
                            <h3 style={{marginTop: '30px'}}>Resultados de la Consulta ({proveedores.length})</h3>
                            <ListaProveedores 
                                proveedores={proveedores}
                                onEdit={handleEdit}
                                onDelete={handleDelete}
                            />
                        </>
                    )}

                    {loading && isSearched && <div>Cargando resultados...</div>}

                    {!isSearched && (
                        <div style={{ padding: '20px', border: '1px solid #007bff', backgroundColor: '#e9f7fe', borderRadius: '4px', marginTop: '20px'}}>
                            Utilice el panel superior para ingresar criterios y ejecutar la consulta.
                        </div>
                    )}
                    
                    {isSearched && !loading && proveedores.length === 0 && (
                        <div style={{ padding: '20px', border: '1px solid #dc3545', backgroundColor: '#f8d7da', color: '#721c24', borderRadius: '4px', marginTop: '20px'}}>
                            La consulta no arrojó resultados. Intente con otros criterios.
                        </div>
                    )}
                </>
            );
        }

        return <p>Seleccione una opción.</p>;
    };

    // 5. RENDERIZADO DEL COMPONENTE PRINCIPAL
    return (
        <>
            <h2>Gestión de Proveedores</h2>
            <div style={{ marginBottom: '20px' }}>
                <button className="btn btn-secondary" onClick={() => fetchProveedores({})} style={{ marginRight: '5px' }}>
                    Mostrar Todos los Proveedores
                </button>
            </div>
            
            {renderContent()}
        </>
    );
}

export default PanelGestionProveedores;