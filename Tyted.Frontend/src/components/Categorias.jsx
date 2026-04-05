import React, { useState, useEffect, useContext } from 'react';
import { ConfigContext } from '../Context/ConfigContext';

const Categorias = () => {
    const { API_URL } = useContext(ConfigContext);
    const [categorias, setCategorias] = useState([]);
    const [nombre, setNombre] = useState('');
    const [editando, setEditando] = useState(null); // Guarda el ID de la categoría a editar
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [porcentaje, setPorcentaje] = useState(0);

// Función auxiliar para obtener headers con el token
    const getAuthHeaders = () => {
        const token = localStorage.getItem('token');
        return {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        };
    };    

    // 1. Cargar categorías al iniciar (GET)
    const obtenerCategorias = async () => {
        try {
            setLoading(true);
            const res = await fetch(`${API_URL}/Categorias`, {
                headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
                });
            if (res.ok) {
                const data = await res.json();
                setCategorias(data);
            } else if (res.status === 401) {
            setError("Sesión expirada o no autorizada");
            }
            } catch (err) {
            setError("Error al conectar con el servidor");
        } finally {
            setLoading(false);
    }
};

    useEffect(() => {
        obtenerCategorias();
    }, []);

    // 2. Crear o Actualizar (POST / PUT)
    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!nombre.trim()) return;

        const url = editando 
            ? `${API_URL}/Categorias/${editando}` 
            : `${API_URL}/Categorias`;
        
        const method = editando ? 'PUT' : 'POST';

        const categoriaObj = {
            idCategoria: editando || 0,
            nombre: nombre.toUpperCase(), // Mantenemos consistencia en mayúsculas
            porcentajeMargen: parseFloat(porcentaje) || 0
        };

        try {
            const res = await fetch(url, {
                method: method,
                headers: getAuthHeaders(),
                body: JSON.stringify(categoriaObj)
            });

            if (res.ok) {
                setNombre('');
                setPorcentaje(0);
                setEditando(null);
                obtenerCategorias();
            } else {
                const errorData = await res.json();
                alert("Error: " + JSON.stringify(errorData));
            }
        } catch (err) {
            alert("Error en la operación");
        }
    };

    // 3. Eliminar (DELETE) con manejo de restricción del backend
    const eliminarCategoria = async (id) => {
        if (!window.confirm("¿Está seguro de eliminar esta categoría?")) return;

        try {
            const res = await fetch(`${API_URL}/Categorias/${id}`, { method: 'DELETE',
                headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
            });
            
            if (res.ok) {
                obtenerCategorias();
            } else {
                // Captura el mensaje "No se puede eliminar la categoría porque tiene productos asociados"
                const msg = await res.text();
                alert(msg || "No se pudo eliminar la categoría");
            }
        } catch (err) {
            alert("Error de conexión");
        }
    };

    const prepararEdicion = (cat) => {
        setEditando(cat.idCategoria);
        setNombre(cat.nombre);
        setPorcentaje(cat.porcentajeMargen);
    };

    return (
        <div style={{ padding: '20px', maxWidth: '800px' }}>
            <h2>Gestión de Categorías</h2>

            {/* Formulario */}
            <form onSubmit={handleSubmit} style={{ marginBottom: '30px', display: 'flex', gap: '10px' }}>
                <input
                    type="text"
                    placeholder="Nombre de la categoría"
                    value={nombre}
                    onChange={(e) => setNombre(e.target.value)}
                    style={{ padding: '10px', flex: 1, borderRadius: '5px', border: '1px solid #ccc' }}
                />
                <input
                        type="number"
                        step="0.01"
                        placeholder="% Margen"
                        value={porcentaje}
                        onChange={(e) => setPorcentaje(e.target.value)}
                        style={{ padding: '10px', flex: 1, borderRadius: '5px', border: '1px solid #ccc' }}
                    />
                <button 
                    type="submit" 
                    style={{ padding: '10px 20px', background: editando ? '#f59e0b' : '#2563eb', color: 'white', border: 'none', borderRadius: '5px', cursor: 'pointer' }}
                >
                    {editando ? 'Actualizar' : 'Agregar'}
                </button>
                {editando && (
                    <button onClick={() => { setEditando(null); setNombre(''); }} style={{ background: '#64748b', color: 'white', border: 'none', borderRadius: '5px', padding: '10px' }}>
                        Cancelar
                    </button>
                )}
            </form>

            {/* Tabla de Resultados */}
            {loading ? <p>Cargando...</p> : (
                <table style={{ width: '100%', borderCollapse: 'collapse', background: 'white', borderRadius: '8px', overflow: 'hidden', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}>
                    <thead style={{ background: '#f1f5f9' }}>
                        <tr>
                            <th style={{ padding: '12px', textAlign: 'left' }}>ID</th>
                            <th style={{ padding: '12px', textAlign: 'left' }}>Nombre</th>
                            <th style={{ padding: '12px', textAlign: 'center' }}>Acciones</th>
                        </tr>
                    </thead>
                    <tbody>
                        {categorias.map(cat => (
                            <tr key={cat.idCategoria} style={{ borderBottom: '1px solid #e2e8f0' }}>
                                <td style={{ padding: '12px' }}>{cat.idCategoria}</td>
                                <td style={{ padding: '12px' }}>{cat.nombre}</td>
                                <td style={{ padding: '12px', textAlign: 'center', display: 'flex', gap: '5px', justifyContent: 'center' }}>
                                    <button onClick={() => prepararEdicion(cat)} style={{ padding: '5px 10px', background: '#3b82f6', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>
                                        ✏️
                                    </button>
                                    <button onClick={() => eliminarCategoria(cat.idCategoria)} style={{ padding: '5px 10px', background: '#ef4444', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>
                                        🗑️
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            )}
            {error && <p style={{ color: 'red' }}>{error}</p>}
        </div>
    );
};

export default Categorias;