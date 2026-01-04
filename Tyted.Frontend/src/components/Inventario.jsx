import React, { useState, useEffect, useContext } from 'react';
import { ConfigContext } from '../Context/ConfigContext';

const Inventario = () => {
    const { API_URL } = useContext(ConfigContext);
    const [productos, setProductos] = useState([]);
    const [movimientos, setMovimientos] = useState([]);
    const [productoSeleccionado, setProductoSeleccionado] = useState(null);
    const [loading, setLoading] = useState(true);
    const [busqueda, setBusqueda] = useState("");

    useEffect(() => {
        cargarInventario();
    }, []);

    const cargarInventario = async () => {
        try {
            setLoading(true);
            // Usamos el endpoint de productos para ver el stock actual
            const res = await fetch(`${API_URL}/Productos`);
            if (res.ok) {
                const data = await res.json();
                setProductos(data);
            }
        } catch (error) {
            console.error("Error al cargar inventario:", error);
        } finally {
            setLoading(false);
        }
    };

    const verKardex = async (producto) => {
        setProductoSeleccionado(producto);
        setMovimientos([]);
        try {
            // INTEGRACIÓN CON InventarioController.cs
            const res = await fetch(`${API_URL}/Inventario/movimientos/${producto.codigoProd}`);
            if (res.ok) {
                const data = await res.json();
                setMovimientos(data);
            }
        } catch (error) {
            console.error("Error al cargar movimientos:", error);
        }
    };

    const productosFiltrados = productos.filter(p => 
        p.descripcion.toLowerCase().includes(busqueda.toLowerCase()) || 
        p.codigoProd.includes(busqueda)
    );

    return (
        <div className="modulo-container">
            <h2>📦 Inventario y Kardex de Movimientos</h2>
            
            <div style={{ marginBottom: '20px', display: 'flex', gap: '10px' }}>
                <input 
                    type="text" 
                    placeholder="Buscar por nombre o código..." 
                    value={busqueda}
                    onChange={(e) => setBusqueda(e.target.value)}
                />
                <button onClick={cargarInventario} className="btn-primary" style={{whiteSpace: 'nowrap'}}>
                    🔄 Refrescar
                </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: productoSeleccionado ? '1fr 1fr' : '1fr', gap: '20px' }}>
                
                {/* Tabla de Stock Actual */}
                <div className="modulo-container" style={{ margin: 0 }}>
                    <h3>Stock Actual</h3>
                    {loading ? <p>Cargando...</p> : (
                        <table>
                            <thead>
                                <tr>
                                    <th>Código</th>
                                    <th>Descripción</th>
                                    <th>Stock</th>
                                    <th>Mín.</th>
                                    <th>Acción</th>
                                </tr>
                            </thead>
                            <tbody>
                                {productosFiltrados.map(p => (
                                    <tr key={p.codigoProd} style={{ background: p.stockActual <= p.stockMinimo ? '#fff1f2' : 'transparent' }}>
                                        <td>{p.codigoProd}</td>
                                        <td>{p.descripcion}</td>
                                        <td style={{ fontWeight: 'bold', color: p.stockActual <= p.stockMinimo ? '#e11d48' : 'inherit' }}>
                                            {p.stockActual}
                                        </td>
                                        <td>{p.stockMinimo}</td>
                                        <td>
                                            <button onClick={() => verKardex(p)} className="btn-primary" style={{ padding: '4px 8px', fontSize: '0.75rem' }}>
                                                🔍 Ver Movimientos
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>

                {/* Vista del Kardex (Movimientos) */}
                {productoSeleccionado && (
                    <div className="modulo-container" style={{ margin: 0, border: '1px solid #e2e8f0' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <h3>Kardex: {productoSeleccionado.descripcion}</h3>
                            <button onClick={() => setProductoSeleccionado(null)} style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: '1.2rem' }}>✕</button>
                        </div>
                        <p><small>Historial de entradas y salidas (Código: {productoSeleccionado.codigoProd})</small></p>
                        
                        <table style={{ fontSize: '0.85rem' }}>
                            <thead>
                                <tr style={{ background: '#f8fafc' }}>
                                    <th>Fecha</th>
                                    <th>Tipo</th>
                                    <th>Cant.</th>
                                    <th>Concepto</th>
                                </tr>
                            </thead>
                            <tbody>
                                {movimientos.length > 0 ? movimientos.map((m, idx) => (
                                    <tr key={idx}>
                                        <td>{new Date(m.fecha).toLocaleDateString()}</td>
                                        <td style={{ color: m.tipo === 'Entrada' ? '#10b981' : '#ef4444', fontWeight: 'bold' }}>
                                            {m.tipo === 'Entrada' ? '➕' : '➖'} {m.tipo}
                                        </td>
                                        <td>{m.cantidad}</td>
                                        <td>{m.concepto || 'Venta/Compra'}</td>
                                    </tr>
                                )) : (
                                    <tr><td colSpan="4" style={{ textAlign: 'center' }}>No hay movimientos registrados.</td></tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
};

export default Inventario;