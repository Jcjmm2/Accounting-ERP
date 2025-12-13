import React, { useState, useEffect } from 'react';
import axios from 'axios';

// Importa el componente de búsqueda que acabamos de crear
import BusquedaProductos from './BusquedaProductos';
import ProductoForm from './ProductoForm'; 
// Importaremos los formularios y la lista después, por ahora solo el esqueleto.

// Nota: Recibimos API_URL y VIEW_MODES como props desde App.jsx
function PanelGestionProductos({ API_URL, VIEW_MODES }) {

    // ======================================
    // 1. ESTADOS
    // ======================================
    // Inicialmente, en modo de listado
    const [viewMode, setViewMode] = useState(VIEW_MODES.LISTAR); 
    const [productos, setProductos] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [productoToEdit, setProductoToEdit] = useState(null);
    const [isSearched, setIsSearched] = useState(false); 

    // ======================================
    // 2. FUNCIÓN DE CARGA DE DATOS (Fetch)
    // ======================================
    const fetchProductos = async (filters = {}) => {
        setLoading(true);
        setError(null);
        
        // Construcción de la Query String dinámica
        let queryString = '';
        const params = [];

        // Filtros (código y descripción, coinciden con ProductosController.cs)
        if (filters.codigo) params.push(`codigo=${encodeURIComponent(filters.codigo)}`);
        if (filters.descripcion) params.push(`descripcion=${encodeURIComponent(filters.descripcion)}`);

        if (params.length > 0) {
            queryString = '?' + params.join('&');
        }

        try {
            // Llama al nuevo controlador de productos en el Backend
            const response = await axios.get(`${API_URL}/Productos${queryString}`); 
            setProductos(response.data);
            setLoading(false);
            setIsSearched(true);
        } catch (err) {
            setError('Error al cargar la lista de artículos. Verifique la conexión del Backend.');
            setLoading(false);
            console.error('Error fetching productos:', err);
        }
    };

    // ======================================
    // 3. HANDLERS (Funciones de Acción)
    // ======================================
    
    const handleSave = () => {
        fetchProductos({}); // Recargar lista después de guardar/editar
        setViewMode(VIEW_MODES.LISTAR); 
        setProductoToEdit(null);
    };

    const handleCancel = () => {
        setViewMode(VIEW_MODES.LISTAR); 
        setProductoToEdit(null);
    };

    // Placeholder para la edición (Se completará cuando tengamos el formulario)
    const handleEdit = (producto) => {
        setProductoToEdit(producto);
        setViewMode(VIEW_MODES.EDITAR); 
    };
    
    const handleNew = () => {
        setProductoToEdit(null); 
        setViewMode(VIEW_MODES.CREAR); 
    };

    const handleSearch = (filters) => {
        fetchProductos(filters); 
    };

    // Placeholder para la eliminación (Se completará cuando tengamos el endpoint DELETE)
    const handleDelete = async (id) => {
        if (!window.confirm(`¿Está seguro de que desea eliminar el artículo con Código #${id}?`)) {
            return;
        }

        try {
            // await axios.delete(`${API_URL}/Productos/${id}`); // Descomentar al crear el método DELETE en C#
            alert(`Artículo #${id} eliminado (temporalmente simulado).`);
            fetchProductos({}); 
        } catch (err) {
            alert('Error al eliminar el artículo.');
            console.error('Error deleting data:', err);
        }
    };

    // ======================================
    // 4. FUNCIÓN DE RENDERIZADO DE CONTENIDO DINÁMICO
    // ======================================
    const renderContent = () => {
        
        if (error) return <div style={{ color: 'red' }}>{error}</div>;

        // Renderiza el Formulario (CREAR/EDITAR)
if (viewMode === VIEW_MODES.CREAR || viewMode === VIEW_MODES.EDITAR) {
             return (
                 <ProductoForm 
                     API_URL={API_URL} // Pasamos la URL al formulario
                     productoToEdit={productoToEdit} // Pasamos el producto si estamos editando
                     onSave={handleSave} 
                     onCancel={handleCancel}
                 />
             );
        }

        // Renderiza el Panel de Búsqueda y la Tabla (LISTAR)
        if (viewMode === VIEW_MODES.LISTAR) {
            return (
                <>
                    {/* Componente de Búsqueda de Artículos */}
                    <BusquedaProductos 
                        onSearch={handleSearch} 
                        onNew={handleNew} 
                    />

                    <div style={{ padding: '20px', border: '1px solid #007bff', backgroundColor: '#e9f7fe', borderRadius: '4px', marginTop: '20px'}}>
                         {loading && <div>Cargando resultados...</div>}
                         
                         {/* Mostrará el conteo y la tabla de resultados (ListaProductos.jsx) */}
                         {!loading && isSearched && productos.length > 0 && (
                            <>
                                <h3 style={{marginTop: '30px'}}>Resultados de la Consulta ({productos.length})</h3>
                                {/* Aquí irá el componente ListaProductos */}
                                <p>Tabla de Artículos se mostrará aquí.</p>
                            </>
                         )}
                         
                         {!isSearched && !loading && (
                            <p>Utilice el panel superior para ingresar criterios y ejecutar la consulta de artículos.</p>
                         )}
                         
                         {isSearched && !loading && productos.length === 0 && (
                            <div style={{ color: '#721c24', backgroundColor: '#f8d7da', padding: '10px', borderRadius: '4px' }}>
                                La consulta no arrojó resultados para artículos.
                            </div>
                         )}
                    </div>
                </>
            );
        }

        return <p>Seleccione una opción de gestión de artículos.</p>;
    };

    // 5. RENDERIZADO DEL COMPONENTE PRINCIPAL
    return (
        <>
            <h2>Gestión de Artículos (Inventario)</h2>
            <div style={{ marginBottom: '20px' }}>
                <button className="btn btn-secondary" onClick={() => fetchProductos({})} style={{ marginRight: '5px' }}>
                    Mostrar Todos los Artículos
                </button>
            </div>
            
            {renderContent()}
        </>
    );
}

export default PanelGestionProductos;