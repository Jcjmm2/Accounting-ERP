import React, { useState } from 'react'; 
import axios from 'axios';

// El componente recibe onEdit y onNew del App.jsx
const ProductoList = ({ API_URL, onEdit, onNew }) => {
    
    // --- ESTADOS ---
    const [productos, setProductos] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [message, setMessage] = useState(''); // Estado para mensajes de éxito
    const [searchExecuted, setSearchExecuted] = useState(false);
    
    // Estados para los campos de filtro
    const [filtro, setFiltro] = useState({
        descripcion: '',
        codigo: ''
    });

    // Función para cargar los productos (GET)
    const fetchProductos = async (currentFiltros) => {
        setLoading(true);
        setError(null);
        setMessage(''); 
        
        // 1. IMPLEMENTACIÓN DE FILTROS EN LA URL
        const params = new URLSearchParams();
        if (currentFiltros.descripcion) {
            params.append('descripcion', currentFiltros.descripcion);
        }
        if (currentFiltros.codigo) {
            params.append('codigo', currentFiltros.codigo);
        }
        
        const endpoint = `${API_URL}/Productos?${params.toString()}`;

        try {
            const response = await axios.get(endpoint);
            setProductos(response.data);
            setSearchExecuted(true);
        } catch (err) {
            console.error("Error en la petición de búsqueda:", err);
            setError('Error al cargar los artículos. Verifique la conexión con el servidor.');
            setProductos([]);
            setSearchExecuted(true);
        } finally {
            setLoading(false);
        }
    };
    
    // --- FUNCIÓN: ELIMINACIÓN DE PRODUCTO (CON MANEJO DE ERRORES DE FK) ---
    const handleDelete = async (codigoProd) => {
        const confirmDelete = window.confirm(`¿Está seguro de que desea eliminar el Artículo con Código ${codigoProd}?`);
        
        if (confirmDelete) {
            setLoading(true);
            setError(null);
            setMessage('');
            
            try {
                // Llama al endpoint DELETE de la API
                await axios.delete(`${API_URL}/Productos/${codigoProd}`);
                
                // Si la eliminación es exitosa (código 200 o 204), actualiza el estado local
                setProductos(prevProductos => 
                    prevProductos.filter(p => p.codigoProd !== codigoProd)
                );
                
                setMessage(`✅ Artículo #${codigoProd} eliminado con éxito.`);
                
            } catch (err) {
                console.error('Error al eliminar artículo:', err);
                
                let errorMessage = 'Error al eliminar el artículo. Por favor, verifique el servidor.';

                // Manejo detallado de errores de la API
                if (err.response) {
                    const status = err.response.status;
                    const serverMessage = err.response.data?.title || err.response.data?.detail || err.response.data;
                    
                    if (status === 409 || status === 400) {
                        // Error de Integridad (Foreign Key Restriction)
                        if (typeof serverMessage === 'string' && serverMessage.includes('integridad referencial')) {
                            errorMessage = `🚫 El Artículo #${codigoProd} no puede ser eliminado. Tiene movimientos de inventario o registros asociados (Restricción de Clave Foránea).`;
                        } else {
                            // Mensaje genérico para 400/409
                            errorMessage = `🚫 El Artículo #${codigoProd} no puede ser eliminado. Es probable que tenga movimientos de inventario asociados.`;
                        }
                    } else if (status === 404) {
                        errorMessage = `Error: El artículo #${codigoProd} no fue encontrado en el servidor.`;
                    } else if (serverMessage) {
                        errorMessage = `Error ${status}: ${serverMessage}`;
                    } else {
                        errorMessage = `Error ${status}: Fallo de comunicación con la API.`;
                    }
                }
                
                setError(errorMessage);
                
            } finally {
                setLoading(false);
            }
        }
    };
    
    // Maneja el cambio de los campos de filtro
    const handleFiltroChange = (e) => {
        const { name, value } = e.target;
        setFiltro({
            ...filtro,
            [name]: value
        });
    };

    // Maneja el clic en "Ejecutar Búsqueda"
    const handleSearchClick = (e) => {
        e.preventDefault();
        setSearchExecuted(false);
        fetchProductos(filtro);
    };
    
    // Maneja el clic en "Mostrar Todos"
    const handleShowAll = () => {
        const newFiltro = { descripcion: '', codigo: '' };
        setFiltro(newFiltro);
        setSearchExecuted(false);
        fetchProductos(newFiltro);
    };


    // --- RENDERIZADO DEL COMPONENTE ---
    
    return (
        <div style={{ padding: '20px' }}>
            <h2>Gestión de Artículos (Inventario)</h2>
            
            {/* --- Botones de Acción --- */}
            <div style={{ marginBottom: '20px', display: 'flex', gap: '10px' }}>
                <button onClick={handleShowAll} className="btn btn-secondary" disabled={loading}>
                    Mostrar Todos los Artículos
                </button>
                <button onClick={onNew} className="btn btn-success" disabled={loading}>
                    Crear Nuevo Artículo
                </button>
            </div>
            
            {/* --- Formulario de Filtro --- */}
            <form onSubmit={handleSearchClick} style={{ marginBottom: '20px', border: '1px solid #ddd', padding: '15px', borderRadius: '5px' }}>
                <h3>Panel de Consulta de Artículos</h3>
                <div style={{ display: 'flex', gap: '20px', alignItems: 'flex-end' }}>
                    <div style={{ flex: 1 }}>
                        <label>Descripción:</label>
                        <input type="text" name="descripcion" value={filtro.descripcion} onChange={handleFiltroChange} style={{ width: '100%' }} />
                    </div>
                    <div style={{ flex: 1 }}>
                        <label>Código:</label>
                        <input type="text" name="codigo" value={filtro.codigo} onChange={handleFiltroChange} style={{ width: '100%' }} />
                    </div>
                    <div>
                        <button type="submit" className="btn btn-primary" disabled={loading}>
                            {loading ? 'Buscando...' : 'Ejecutar Búsqueda'}
                        </button>
                    </div>
                </div>
            </form>

            {/* --- MENSAJES DE ESTADO --- */}
            {loading && <p className="alert alert-info">Cargando resultados...</p>}
            {message && <div className="alert alert-success">{message}</div>} {/* Mostrar mensaje de éxito */}
            {error && <div className="alert alert-danger">{error}</div>}
            
            {searchExecuted && !loading && (
                <>
                    <h3>Resultados de la Consulta ({productos.length})</h3>
                    
                    {productos.length > 0 ? (
                        <div style={{ overflowX: 'auto' }}>
                            <table className="table table-striped" style={{ marginTop: '10px', fontSize: '0.9em' }}>
                                <thead>
                                    <tr>
                                        <th>Código</th>
                                        <th>Descripción</th>
                                        <th>Stock Base</th>
                                        <th>Unidad Base</th>
                                        <th>Proveedor</th>
                                        <th>Vencimiento</th>
                                        <th>Acciones</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {productos.map(prod => (
                                        <tr key={prod.codigoProd}>
                                            <td>{prod.codigoProd}</td>
                                            <td>{prod.descripcion}</td>
                                            <td>{prod.stockActual}</td>
                                            {/* NOTA: Estos campos son temporales hasta implementar las FK */}
                                            <td>N/A</td> 
                                            <td>N/A</td> 
                                            <td>{prod.fechaVencimiento ? new Date(prod.fechaVencimiento).toLocaleDateString() : 'N/A'}</td>
                                            <td>
                                                <button 
                                                    className="btn btn-sm btn-warning" 
                                                    onClick={() => onEdit(prod)} 
                                                    style={{ marginRight: '5px' }}
                                                    disabled={loading}
                                                >
                                                    Editar
                                                </button>
                                                
                                                {/* --- BOTÓN DE ELIMINAR --- */}
                                                <button 
                                                    className="btn btn-sm btn-danger" 
                                                    onClick={() => handleDelete(prod.codigoProd)}
                                                    disabled={loading}
                                                >
                                                    Eliminar
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    ) : (
                        <p>No se encontraron artículos con los criterios de búsqueda.</p>
                    )}
                </>
            )}

            {searchExecuted && !loading && productos.length === 0 && (
                <p>No se encontraron artículos con los criterios de búsqueda.</p>
            )}

            {!searchExecuted && !loading && (
                <p>Haga clic en "Ejecutar Búsqueda" o "Mostrar Todos los Artículos" para ver los resultados.</p>
            )}

        </div>
    );
};

export default ProductoList;