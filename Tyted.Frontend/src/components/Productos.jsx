import React, { useState, useEffect, useContext } from 'react';
import { ConfigContext } from '../Context/ConfigContext';

const Productos = () => {
    const { API_URL, tasa } = useContext(ConfigContext);
    const [productos, setProductos] = useState([]);
    const [loading, setLoading] = useState(true);
    const [busqueda, setBusqueda] = useState("");

    // Estado para el modal y edición
    const [productoDetalle, setProductoDetalle] = useState(null);
    const [editandoPrecios, setEditandoPrecios] = useState({}); // Guarda cambios temporales {idUnidad: {p1, p2, p3}}
    const [guardando, setGuardando] = useState(false);

    useEffect(() => {
        cargarProductos();
    }, []);

    const cargarProductos = async () => {
        try {
            setLoading(true);
            const res = await fetch(`${API_URL}/Productos`);
            if (res.ok) {
                const data = await res.json();
                setProductos(data);
            }
        } catch (error) {
            console.error("Error al cargar productos:", error);
        } finally {
            setLoading(false);
        }
    };

    // Maneja el cambio de inputs en la tabla
    const handlePrecioChange = (idUnidad, nivel, valor) => {
        setEditandoPrecios(prev => ({
            ...prev,
            [idUnidad]: {
                ...prev[idUnidad],
                [nivel]: parseFloat(valor) || 0
            }
        }));
    };

    const guardarCambios = async () => {
        setGuardando(true);
        try {
            // Transformamos el objeto de cambios en una lista para el backend
            const cambios = Object.keys(editandoPrecios).map(id => ({
                idProductoUnidad: id,
                precio1: editandoPrecios[id].precio1,
                precio2: editandoPrecios[id].precio2,
                precio3: editandoPrecios[id].precio3
            }));

            // Nota: Debes asegurar que este endpoint exista en tu ProductosUnidadController
            const res = await fetch(`${API_URL}/Productos/ActualizarPreciosMasivo`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(cambios)
            });

            if (res.ok) {
                alert("Precios actualizados correctamente");
                setProductoDetalle(null);
                setEditandoPrecios({});
                cargarProductos();
            }
        } catch (error) {
            alert("Error al guardar cambios");
        } finally {
            setGuardando(false);
        }
    };

    const productosFiltrados = productos.filter(p =>
        p.descripcion.toLowerCase().includes(busqueda.toLowerCase()) ||
        p.codigoProd.includes(busqueda)
    );

    return (
        <div className="modulo-container">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                <h2>🍎 Catálogo de Productos</h2>
                <button onClick={cargarProductos} className="btn-primary" style={{ background: '#64748b' }}>🔄 Actualizar</button>
            </div>

            <div style={{ marginBottom: '20px' }}>
                <input 
                    type="text" 
                    placeholder="Buscar por nombre o código..." 
                    value={busqueda}
                    onChange={(e) => setBusqueda(e.target.value)}
                    className="search-input"
                />
            </div>

            {loading ? <p>Cargando catálogo...</p> : (
                <table>
                    <thead>
                        <tr>
                            <th>Código</th>
                            <th>Descripción</th>
                            <th>Categoría</th>
                            <th>Existencia</th>
                            <th>Acciones</th>
                        </tr>
                    </thead>
                    <tbody>
                        {productosFiltrados.map(p => (
                            <tr key={p.codigoProd}>
                                <td><strong>{p.codigoProd}</strong></td>
                                <td>{p.descripcion}</td>
                                <td><span className="badge-categoria">{p.categoria?.nombre || 'S/C'}</span></td>
                                <td style={{ fontWeight: 'bold', color: p.stockActual <= p.stockMinimo ? '#ef4444' : '#1e293b' }}>
                                    {p.stockActual}
                                </td>
                                <td>
                                    <button 
                                        onClick={() => {
                                            setProductoDetalle(p);
                                            // Inicializamos los valores de edición con los actuales
                                            const inicial = {};
                                            p.unidadesDeVenta.forEach(u => {
                                                inicial[u.idProductoUnidad] = {
                                                    precio1: u.precioMonedaBase,
                                                    precio2: u.precio2MonedaBase || 0,
                                                    precio3: u.precio3MonedaBase || 0
                                                };
                                            });
                                            setEditandoPrecios(inicial);
                                        }}
                                        className="btn-primary"
                                        style={{ padding: '5px 10px', fontSize: '0.8rem' }}
                                    >
                                        ✏️ Editar Precios
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            )}

            {/* Modal de Edición de Niveles de Precios */}
            {productoDetalle && (
                <div className="modal-overlay">
                    <div className="modulo-container" style={{ width: '850px', maxHeight: '90vh', overflowY: 'auto' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <h3>Gestión de Precios: {productoDetalle.descripcion}</h3>
                            <button onClick={() => setProductoDetalle(null)} className="btn-close">✕</button>
                        </div>
                        
                        <p style={{ color: '#64748b', marginBottom: '15px' }}>
                            Valores en <strong>USD</strong>. Se calculan automáticamente a <strong>{tasa} Bs</strong>.
                        </p>

                        <table className="tabla-edicion-precios">
                            <thead>
                                <tr style={{ background: '#f1f5f9' }}>
                                    <th>Unidad</th>
                                    <th>Precio 1 ($)</th>
                                    <th>Precio 2 ($)</th>
                                    <th>Precio 3 ($)</th>
                                    <th>Ref. Bs (P1)</th>
                                </tr>
                            </thead>
                            <tbody>
                                {productoDetalle.unidadesDeVenta?.map(u => (
                                    <tr key={u.idProductoUnidad}>
                                        <td style={{ fontWeight: '600' }}>{u.nombreUnidad}</td>
                                        <td>
                                            <input 
                                                type="number"
                                                className="input-precio-editable"
                                                value={editandoPrecios[u.idProductoUnidad]?.precio1}
                                                onChange={(e) => handlePrecioChange(u.idProductoUnidad, 'precio1', e.target.value)}
                                                onFocus={(e) => e.target.select()}
                                            />
                                        </td>
                                        <td>
                                            <input 
                                                type="number"
                                                className="input-precio-editable"
                                                value={editandoPrecios[u.idProductoUnidad]?.precio2}
                                                onChange={(e) => handlePrecioChange(u.idProductoUnidad, 'precio2', e.target.value)}
                                                onFocus={(e) => e.target.select()}
                                            />
                                        </td>
                                        <td>
                                            <input 
                                                type="number"
                                                className="input-precio-editable"
                                                value={editandoPrecios[u.idProductoUnidad]?.precio3}
                                                onChange={(e) => handlePrecioChange(u.idProductoUnidad, 'precio3', e.target.value)}
                                                onFocus={(e) => e.target.select()}
                                            />
                                        </td>
                                        <td style={{ color: '#2563eb', fontSize: '0.85rem' }}>
                                            {((editandoPrecios[u.idProductoUnidad]?.precio1 || 0) * tasa).toFixed(2)} Bs
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>

                        <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
                            <button 
                                onClick={() => setProductoDetalle(null)} 
                                className="btn-secondary"
                                style={{ flex: 1 }}
                            >
                                Cancelar
                            </button>
                            <button 
                                onClick={guardarCambios} 
                                className="btn-primary" 
                                disabled={guardando}
                                style={{ flex: 2, background: '#10b981' }}
                            >
                                {guardando ? "Guardando..." : "💾 Guardar Todos los Precios"}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Productos;