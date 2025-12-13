import React, { useState } from 'react';
import axios from 'axios';

// Este componente recibe las props API_URL, onEdit, onNew
const ProveedorList = ({ API_URL, onEdit, onNew }) => { 
    
    // --- ESTADOS DE CONTROL DE DATOS Y CARGA ---
    const [proveedores, setProveedores] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [message, setMessage] = useState(''); // Nuevo estado para mensajes de éxito (ej. Eliminación)
    
    // --- ESTADO DE CONTROL DE VISUALIZACIÓN ---
    const [searchExecuted, setSearchExecuted] = useState(false); 

    // --- ESTADOS DE FILTRO ---
    const [filtro, setFiltro] = useState({
        razonsocial: '',
        rif: ''
    });

    // --- FUNCIONES ASÍNCRONAS ---

    // Función para cargar proveedores, utilizando el estado de filtro local
    const fetchProveedores = async () => {
        setLoading(true);
        setError(null);
        setMessage(''); // Limpiar mensajes de éxito al buscar
        
        const params = new URLSearchParams(); 
        
        const cleanedRazonSocial = filtro.razonsocial ? filtro.razonsocial.trim() : '';
        if (cleanedRazonSocial) { 
            params.append('razonsocial', cleanedRazonSocial); 
        }

        const cleanedRif = filtro.rif ? filtro.rif.trim() : '';
        if (cleanedRif) { 
            params.append('rif', cleanedRif); 
        }
        
        const url = `${API_URL}/Proveedores?${params.toString()}`;
        
        console.log("URL de búsqueda enviada:", url);

        try {
            const response = await axios.get(url); 
            setProveedores(response.data);
            setSearchExecuted(true); 
        } catch (err) {
            setError('Error al cargar la lista de proveedores. Verifique la conexión con el servidor.');
            setProveedores([]);
            setSearchExecuted(true);
        } finally {
            setLoading(false);
        }
    };

    // Función para eliminar un proveedor (NUEVA FUNCIÓN)
    const handleDelete = async (codigoProv) => {
        // 1. CONFIRMACIÓN DE USUARIO
        const confirmDelete = window.confirm(`¿Está seguro de que desea eliminar el proveedor con Código ${codigoProv}? Esta acción es irreversible.`);
        
        if (confirmDelete) {
            setLoading(true);
            setError(null);
            setMessage(''); 

            try {
                // Llama al endpoint DELETE de la API
                await axios.delete(`${API_URL}/Proveedores/${codigoProv}`);
                
                // 2. ACTUALIZAR EL ESTADO LOCAL
                setProveedores(prevProveedores => 
                    prevProveedores.filter(p => p.codigoProv !== codigoProv)
                );
                
                setMessage(`Proveedor #${codigoProv} eliminado con éxito.`);
                
            } catch (err) {
                console.error('Error al eliminar proveedor:', err);
                // Mensaje de error más específico para problemas de integridad referencial
                setError('Error al eliminar el proveedor. Verifique que no esté asociado a otros registros (ej. Productos o Compras).');
            } finally {
                setLoading(false);
            }
        }
    };
    
    // Maneja el clic en "Ejecutar Búsqueda"
    const handleSearchClick = (e) => {
        e.preventDefault();
        setSearchExecuted(false); 
        fetchProveedores();
    };

    // --- RENDERIZADO ---

    return (
        <div style={{ padding: '20px' }}>
            <h2>Gestión de Proveedores</h2>
            
            {/* --- Formulario de Filtro (Se mantiene igual) --- */}
            <form onSubmit={handleSearchClick} style={{ marginBottom: '20px', border: '1px solid #ddd', padding: '15px', borderRadius: '5px' }}>
                <div style={{ display: 'flex', gap: '20px', alignItems: 'flex-end' }}>
                    <div style={{ flex: 1 }}>
                        <label>Razón Social:</label>
                        <input type="text" name="razonsocial" value={filtro.razonsocial} onChange={(e) => setFiltro({...filtro, razonsocial: e.target.value})} style={{ width: '100%' }} />
                    </div>
                    <div style={{ flex: 1 }}>
                        <label>RIF:</label>
                        <input type="text" name="rif" value={filtro.rif} onChange={(e) => setFiltro({...filtro, rif: e.target.value})} style={{ width: '100%' }} />
                    </div>
                    <div>
                        <button type="submit" className="btn btn-primary" disabled={loading}>
                            {loading ? 'Buscando...' : 'Ejecutar Búsqueda'}
                        </button>
                    </div>
                </div>
            </form>

            {/* --- Botón de Creación --- */}
            <button 
                className="btn btn-success" 
                onClick={onNew} 
                style={{ marginBottom: '20px' }}
            >
                Crear Nuevo Proveedor
            </button>
            
            {/* --- RESULTADOS CONDICIONALES Y MENSAJES --- */}
            {message && <div className="alert alert-success">{message}</div>} {/* Mostrar mensaje de éxito */}
            {error && <div className="alert alert-danger">Error: {error}</div>}
            
            {searchExecuted && !loading && (
                <>
                    <h3>Lista de Proveedores ({proveedores.length})</h3>
                    <div style={{ overflowX: 'auto' }}>
                        <table className="table table-striped" style={{ marginTop: '10px', fontSize: '0.9em' }}>
                            <thead>
                                <tr>
                                    <th>Código</th>
                                    <th>Razón Social</th>
                                    <th>RIF</th>
                                    <th>Teléfono</th>
                                    <th>Email</th>
                                    <th>Retención</th>
                                    <th>Acciones</th>
                                </tr>
                            </thead>
                            <tbody>
                                {proveedores.map(prov => (
                                    <tr key={prov.codigoProv}>
                                        <td>{prov.codigoProv}</td>
                                        <td>{prov.razonsocial}</td>
                                        <td>{prov.rif}</td>
                                        <td>{prov.telefono}</td>
                                        <td>{prov.email}</td>
                                        <td>{prov.personaISLR ? 'Sí' : 'No'}</td>
                                        <td>
                                            <button 
                                                className="btn btn-sm btn-warning"
                                                onClick={() => onEdit(prov)} 
                                                style={{ marginRight: '5px' }}
                                                disabled={loading} // Deshabilita mientras se elimina
                                            >
                                                Editar
                                            </button>
                                            
                                            {/* BOTÓN DE ELIMINAR AÑADIDO */}
                                            <button 
                                                className="btn btn-sm btn-danger" 
                                                onClick={() => handleDelete(prov.codigoProv)} 
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
                </>
            )}

            {searchExecuted && !loading && proveedores.length === 0 && (
                <p>No se encontraron proveedores con los criterios de búsqueda.</p>
            )}
            
            {!searchExecuted && !loading && (
                <p>Ingrese los criterios de búsqueda y haga clic en "Ejecutar Búsqueda" para ver los proveedores.</p>
            )}
        </div>
    );
};

export default ProveedorList;