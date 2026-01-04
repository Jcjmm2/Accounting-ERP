import React, { useState, useEffect, useContext } from 'react';
import { ConfigContext } from '../Context/ConfigContext';

const Productos = () => {
    const { API_URL, tasa } = useContext(ConfigContext);
    const [productos, setProductos] = useState([]);
    const [loading, setLoading] = useState(true);
    const [busqueda, setBusqueda] = useState("");

    // Estado para el modal de detalles/precios
    const [productoDetalle, setProductoDetalle] = useState(null);

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
                            <th>Existencia Total</th>
                            <th>Acciones</th>
                        </tr>
                    </thead>
                    <tbody>
                        {productosFiltrados.length === 0 ? (
                            <tr><td colSpan="5" style={{ textAlign: 'center' }}>No se encontraron productos</td></tr>
                        ) : productosFiltrados.map(p => (
                            <tr key={p.codigoProd}>
                                <td><strong>{p.codigoProd}</strong></td>
                                <td>{p.descripcion}</td>
                                <td><span className="badge-categoria">{p.categoria?.nombre || 'S/C'}</span></td>
                                <td style={{ fontWeight: 'bold', color: p.stockActual <= p.stockMinimo ? '#ef4444' : '#1e293b' }}>
                                    {p.stockActual}
                                </td>
                                <td>
                                    <button 
                                        onClick={() => setProductoDetalle(p)}
                                        className="btn-primary"
                                        style={{ padding: '5px 10px', fontSize: '0.8rem' }}
                                    >
                                        💰 Ver Precios
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            )}

            {/* Modal de Presentaciones y Precios */}
            {productoDetalle && (
                <div className="modal-overlay">
                    <div className="modulo-container" style={{ width: '600px', maxHeight: '80vh', overflowY: 'auto' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <h3>Presentaciones: {productoDetalle.descripcion}</h3>
                            <button onClick={() => setProductoDetalle(null)} className="btn-close">✕</button>
                        </div>
                        
                        <p><small>Tasa del día aplicada: <strong>{tasa} Bs/$</strong></small></p>

                        <table style={{ marginTop: '10px', fontSize: '0.9rem' }}>
                            <thead>
                                <tr style={{ background: '#f1f5f9' }}>
                                    <th>Unidad</th>
                                    <th>Código Barras</th>
                                    <th>Precio ($)</th>
                                    <th>Precio (Bs)</th>
                                </tr>
                            </thead>
                            <tbody>
                                {productoDetalle.unidadesDeVenta?.map(u => (
                                    <tr key={u.idProductoUnidad}>
                                        <td>{u.nombreUnidad}</td>
                                        <td>{u.codigoBarras || 'N/A'}</td>
                                        <td style={{ fontWeight: 'bold' }}>${u.precioMonedaBase?.toFixed(2)}</td>
                                        <td style={{ color: '#2563eb' }}>
                                            {(u.precioMonedaBase * tasa).toLocaleString('es-VE')} Bs
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>

                        <button 
                            onClick={() => setProductoDetalle(null)} 
                            className="btn-primary" 
                            style={{ width: '100%', marginTop: '20px', background: '#cbd5e1', color: '#1e293b' }}
                        >
                            Cerrar
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Productos;