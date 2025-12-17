import React, { useState, useEffect } from 'react';
import axios from 'axios';

// Importa los componentes
import BusquedaProductos from './BusquedaProductos';
import ProductoForm from './ProductoForm'; 
import ProductoList from './ProductoList'; // Importar ProductoList para completar la vista LISTAR

// Nota: Recibimos API_URL y VIEW_MODES como props desde App.jsx
function PanelGestionProductos({ API_URL, VIEW_MODES }) {

    // ======================================
    // 1. ESTADOS
    // ======================================
    const [viewMode, setViewMode] = useState(VIEW_MODES.LISTAR); 
    const [productos, setProductos] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [productoToEdit, setProductoToEdit] = useState(null);
    const [isSearched, setIsSearched] = useState(false); 

    // ✅ ESTADOS: Listas de opciones maestras
    const [categorias, setCategorias] = useState([]);
    const [tasasIVA, setTasasIVA] = useState([]);


    // ======================================
    // 2. FUNCIÓN DE CARGA DE DATOS (Fetch)
    // Se utiliza para la búsqueda con filtros y para recargar la lista completa.
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
            // Llama al controlador de productos en el Backend
            const response = await axios.get(`${API_URL}/Productos${queryString}`); 
            setProductos(response.data);
            setLoading(false);
            setIsSearched(true);
        } catch (err) {
            setError('Error al cargar la lista de artículos. Verifique la conexión del Backend.');
            setLoading(false);
            setProductos([]);
            console.error('Error fetching productos:', err);
        }
    };

    // ======================================
    // 3. EFFECT: CARGA DE LISTAS MAESTRAS
    // ======================================
    useEffect(() => {
        const fetchMasters = async () => {
            try {
                // Endpoints para Categorías y TasasIVA
                const [catResponse, ivaResponse] = await Promise.all([
                    axios.get(`${API_URL}/Categorias`),
                    axios.get(`${API_URL}/TasasIVA`),
                ]);
                setCategorias(catResponse.data);
                setTasasIVA(ivaResponse.data);
            } catch (err) {
                console.error("Error al cargar Categorías o Tasas IVA:", err);
                setError('Error al cargar opciones de Categorías/IVA. Verifique que los endpoints /Categorias y /TasasIVA estén funcionando.');
            }
        };
        fetchMasters();
    }, [API_URL]); // Se ejecuta una sola vez al montar el componente

    // ======================================
    // 4. HANDLERS (Funciones de Acción)
    // ======================================
    
    const handleSave = () => {
        // Recargar lista después de guardar/editar
        fetchProductos({}); 
        setViewMode(VIEW_MODES.LISTAR); 
        setProductoToEdit(null);
    };

    const handleCancel = () => {
        setViewMode(VIEW_MODES.LISTAR); 
        setProductoToEdit(null);
    };

    const handleEdit = (producto) => {
        setProductoToEdit(producto);
        setViewMode(VIEW_MODES.EDITAR); 
    };
    
    const handleNew = () => {
        setProductoToEdit(null); 
        setViewMode(VIEW_MODES.CREAR); 
    };

    const handleSearch = (filters) => {
        // Función llamada desde BusquedaProductos
        fetchProductos(filters); 
    };

    // Eliminamos la función handleDelete local, ya que la nueva versión de
    // ProductoList se encarga de la lógica de DELETE y de llamar a fetchProductos() para refrescar.

    // ======================================
    // 5. FUNCIÓN DE RENDERIZADO DE CONTENIDO DINÁMICO
    // ======================================
    const renderContent = () => {
        
        // Mostrar error general de carga de maestras
        if (error && viewMode === VIEW_MODES.LISTAR) return <div className="alert alert-danger">{error}</div>;

        // Renderiza el Formulario (CREAR/EDITAR)
        if (viewMode === VIEW_MODES.CREAR || viewMode === VIEW_MODES.EDITAR) {
            return (
                <ProductoForm 
                    API_URL={API_URL} 
                    productoToEdit={productoToEdit} 
                    onSave={handleSave} 
                    onCancel={handleCancel}
                    // ✅ PASAR LAS NUEVAS PROPS DE LISTAS MAESTRAS
                    categorias={categorias}
                    tasasIVA={tasasIVA}
                />
            );
        }

        // Renderiza el Panel de Búsqueda y la Lista de Resultados (LISTAR)
        if (viewMode === VIEW_MODES.LISTAR) {
            return (
                <>
                    {/* Componente de Búsqueda de Artículos */}
                    <BusquedaProductos 
                        onSearch={handleSearch} 
                        onNew={handleNew} 
                    />

                    <div style={{ padding: '0px', marginTop: '20px' }}>
                        
                        {/* ✅ CORRECCIÓN CRÍTICA: Integración del ProductoList con las props centralizadas */}
                        {/* ProductoList ahora manejará los estados de loading, error y los mensajes de lista vacía/inicial */}
                        <ProductoList 
                            productos={productos}
                            API_URL={API_URL}
                            onEdit={handleEdit}
                            onNew={handleNew}
                            loading={loading}
                            error={error} 
                            fetchProductos={fetchProductos} // Permite a ProductoList recargar la lista
                            isSearched={isSearched} // Permite a ProductoList manejar los mensajes condicionales
                        />
                        
                    </div>
                </>
            );
        }

        return <p>Seleccione una opción de gestión de artículos.</p>;
    };

    // 6. RENDERIZADO DEL COMPONENTE PRINCIPAL
    // Nota: ya no cargamos la lista de productos al montar. Solo se mostrará el
    // panel de filtros (BusquedaProductos). La tabla se renderiza únicamente
    // después de ejecutar una búsqueda (isSearched === true) o al usar "Mostrar Todos".
    return (
        <div style={{ padding: '20px' }}>
            <h2>Gestión de Artículos (Inventario)</h2>
            <div style={{ marginBottom: '20px', display: 'flex', gap: '10px' }}>
                {/* Botón "Mostrar Todos" que llama a la función de fetch con filtros vacíos */}
                <button className="btn btn-secondary" onClick={() => fetchProductos({})} disabled={loading}>
                    Mostrar Todos los Artículos
                </button>
            </div>
            
            {renderContent()}
        </div>
    );
}

export default PanelGestionProductos;