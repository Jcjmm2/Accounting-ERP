import React, { useState } from 'react';
import axios from 'axios';

// El componente recibe ahora 'productos', 'loading', 'error' y 'fetchProductos' del padre (PanelGestionProductos)
// Esto centraliza la lógica de estado y búsqueda.
const ProductoList = ({ API_URL, onEdit, onNew, productos, loading, error, fetchProductos, isSearched }) => {
    
    // --- ESTADOS ---
    // Eliminamos los estados de filtro y 'searchExecuted' ya que serán gestionados por el componente padre.
    const [message, setMessage] = useState(''); // Estado para mensajes de éxito
    
    // Nota: El componente padre (PanelGestionProductos) ahora maneja:
    // - El estado 'productos', 'loading', 'error', 'isSearched'
    // - La función 'fetchProductos' (que es la que usaremos para recargar la lista)

    // --- FUNCIÓN: ELIMINACIÓN DE PRODUCTO (CON MANEJO DE ERRORES DE FK) ---
    const handleDelete = async (codigoProd) => {
        const confirmDelete = window.confirm(`¿Está seguro de que desea eliminar el Artículo con Código ${codigoProd}?`);
        
        if (confirmDelete) {
            // El loading debe ser gestionado por el componente padre o solo localmente para el botón.
            // Para simplicidad en este ejemplo, usaremos un estado local de 'loading' de un listado real.
            // Aquí, asumimos que el padre tiene su propio loading general que lo cubre.
            
            setMessage(''); // Limpiar mensajes anteriores
            
            try {
                // Llama al endpoint DELETE de la API
                await axios.delete(`${API_URL}/Productos/${codigoProd}`);
                
                setMessage(`✅ Artículo #${codigoProd} eliminado con éxito. Recargando lista...`);
                
                // CRÍTICO: Recargar la lista después de la eliminación exitosa
                // Llamamos a la función de fetch que nos pasó el padre para refrescar la vista.
                // En una app real, podrías pasar los filtros actuales para mantener el contexto de búsqueda.
                // Aquí, asumimos que el padre maneja los filtros.
                fetchProductos({}); 
                
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
                            errorMessage = `🚫 El Artículo #${codigoProd} no puede ser eliminado. Tiene movimientos de inventario o registros asociados.`;
                        } else {
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
                
                // NOTA: Para no mostrar el mensaje de éxito del padre,
                // re-lanza el error al estado local 'error' (que en este componente ya no existe) 
                // o lo maneja el padre. Mantendremos la lógica de error en el padre para ser consistente.
                // Por ahora, solo mostraremos el mensaje de error local.
                setMessage(null); // Limpiar mensaje de éxito
                alert(errorMessage); // Mostrar el error directamente
                
            } 
        }
    };
    
    // Función para encontrar la unidad base (la que tiene CantidadEquivalente = 1)
    const getUnidadBase = (unidades) => {
        if (!unidades || unidades.length === 0) return 'Unidad No Definida';
        
        // Busca la unidad donde CantidadEquivalente es 1 (la base)
        const unidadBase = unidades.find(u => u.cantidadEquivalente === 1);
        
        return unidadBase ? unidadBase.nombreUnidad : 'Múltiples Unidades';
    }


    // --- RENDERIZADO DEL COMPONENTE ---
    // NOTA: Eliminamos el formulario de filtro/búsqueda, ya que lo gestiona BusquedaProductos.jsx
    
    return (
        <div style={{ padding: '0px', marginTop: '20px' }}>
            
            {/* --- MENSAJES DE ESTADO --- */}
            {loading && <p className="alert alert-info">Cargando resultados...</p>}
            {message && <div className="alert alert-success">{message}</div>} {/* Mostrar mensaje de éxito */}
            {error && <div className="alert alert-danger">{error}</div>} {/* El error ahora viene del padre */}
            
            {/* CRÍTICO: Usamos 'isSearched' del componente padre para decidir qué mostrar */}
            {isSearched && !loading && (
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
                                        {/* CORRECCIÓN: Mostrar la Unidad Base real */}
                                        <th>Unidad Base</th> 
                                        {/* CORRECCIÓN: Mostrar el Nombre de Proveedor */}
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
                                            {/* CORRECCIÓN: Usar la función auxiliar para la Unidad Base */}
                                            <td>{getUnidadBase(prod.unidadesDeVenta)}</td> 
                                            {/* CORRECCIÓN: Mostrar la Razón Social del Proveedor (si existe) */}
                                            <td>{prod.proveedor ? prod.proveedor.razonsocial : 'Sin Proveedor'}</td> 
                                            <td>{prod.fechaVencimiento ? new Date(prod.fechaVencimiento).toLocaleDateString() : 'N/A'}</td>
                                            <td>
                                                {/* --- BOTÓN DE EDITAR --- */}
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

            {/* Mensaje de estado inicial (ahora gestionado por el padre también) */}
            {!isSearched && !loading && (
                <p>Utilice el panel superior para ingresar criterios y ejecutar la consulta de artículos.</p>
            )}

        </div>
    );
};

export default ProductoList;