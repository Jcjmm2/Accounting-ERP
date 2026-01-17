import React, { useState, useEffect, useContext } from 'react';
import { ConfigContext } from '../Context/ConfigContext';

const Productos = () => {
    const { API_URL, tasa } = useContext(ConfigContext);
    const [productos, setProductos] = useState([]);
    const [loading, setLoading] = useState(true);
    const [busqueda, setBusqueda] = useState("");
    const [stockMinimoEdit, setStockMinimoEdit] = useState(0);

    // Estado para el modal y edición
    const [productoDetalle, setProductoDetalle] = useState(null);
    const [editandoPrecios, setEditandoPrecios] = useState({}); // Guarda cambios temporales {idUnidad: {p1, p2, p3}}
    const [guardando, setGuardando] = useState(false);

    useEffect(() => {
        cargarProductos();
        cargarTasasIva();
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
        
    // Corregido: Ahora acepta exactamente los parámetros que envías desde el onChange
    const handlePrecioChange = (idUnidad, campo, valor) => {
        setEditandoPrecios(prev => ({
            ...prev,
            [idUnidad]: {
                ...(prev[idUnidad] || {}),
                // Usamos el nombre del campo ('precio1', 'precio2', etc.) como llave dinámica
                [campo]: valor 
            }
        }));
    };

    const guardarCambios = async () => {
        try {
            setGuardando(true);

            // 1. Preparamos el objeto con los datos generales y las unidades
            const payload = {
                codigoProd: productoDetalle.codigoProd,
                tipoArt: productoDetalle.tipoArt,
                idTasaIVA: productoDetalle.idTasaIVA,
                stockMinimo: parseFloat(stockMinimoEdit),
                // Mapeamos las unidades con sus nuevos precios
                unidades: productoDetalle.unidadesDeVenta.map(u => {
                    const edicion = editandoPrecios[u.idProductoUnidad] || {};
                    return {
                        idProductoUnidad: parseInt(u.idProductoUnidad),
                        precio1: parseFloat(edicion.precio1 ?? u.precioMonedaBase ?? 0),
                        precio2: parseFloat(edicion.precio2 ?? u.precio2MonedaBase ?? 0),
                        precio3: parseFloat(edicion.precio3 ?? u.precio3MonedaBase ?? 0)
                    };
                })
            };

            // 2. Cambiamos el endpoint a uno que reciba el objeto completo (si lo tienes)
            // O asegúrate de que tu backend procese estos campos adicionales.
            const res = await fetch(`${API_URL}/Productos/ActualizarProductoCompleto`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (res.ok) {
                alert("✅ Cambios guardados correctamente");
                setProductoDetalle(null);
                await cargarProductos();
            } else {
                const errorData = await res.json();
                alert("❌ Error: " + errorData.message);
            }
        } catch (error) {
            console.error("Error al guardar:", error);
        } finally {
            setGuardando(false);
        }
    };

    const productosFiltrados = productos.filter(p =>
         p.descripcion.toLowerCase().includes(busqueda.toLowerCase()) ||
         p.codigoProd.includes(busqueda)
     );
    
    const [tasasIva, setTasasIva] = useState([]); // Nuevo estado

    // En cargarDatosIniciales o un useEffect nuevo:
    const cargarTasasIva = async () => {
        try {
                const res = await fetch(`${API_URL}/Productos/TasasIVA`);
                if (res.ok) {
                    const data = await res.json();
                    setTasasIva(data);
                }
            } catch (error) {
                console.error("Error al cargar tasas de IVA:", error);
            }
        };

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
                                <td style={{ 
                                    fontWeight: 'bold', 
                                    color: p.tipoArt === 'Servicio' ? '#64748b' : (p.stockActual <= p.stockMinimo ? '#ef4444' : '#1e293b') 
                                }}>
                                    {p.tipoArt === 'Servicio' ? 'N/A' : p.stockActual}
                                </td>
                            <td>    
                                    <button 
                                        onClick={() => {
                                            setProductoDetalle(p);
                                            setStockMinimoEdit(p.stockMinimo);
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
                                        ✏️ Gestionar
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            )}

            {/* MODAL DE EDICIÓN */}
            {productoDetalle && (
                <div className="modal-overlay">
                    <div className="modulo-container" style={{ width: '850px', maxHeight: '90vh', overflowY: 'auto', position: 'relative' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
                            <h3>Gestión de Producto: {productoDetalle.descripcion}</h3>
                            <button onClick={() => setProductoDetalle(null)} className="btn-close">✕</button>
                        </div>
                    
                        {/* 1. SECCIÓN DE CONFIGURACIÓN FISCAL Y TIPO (CORREGIDA) */}
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px', padding: '15px', backgroundColor: '#f1f5f9', borderRadius: '8px', marginBottom: '20px', border: '1px solid #cbd5e1' }}>
                            <div>
                                <label style={{ fontSize: '0.8rem', fontWeight: 'bold', display: 'block', marginBottom: '5px' }}>Tipo de Artículo</label>
                                <select 
                                    value={productoDetalle.tipoArt || "Bien"} 
                                    onChange={(e) => setProductoDetalle({...productoDetalle, tipoArt: e.target.value})}
                                    style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #94a3b8' }}
                                >
                                    <option value="Bien">Bien (Maneja Inventario)</option>
                                    <option value="Servicio">Servicio (Sin Inventario)</option>
                                </select>
                            </div>

                            <div>
                                <label style={{ fontSize: '0.8rem', fontWeight: 'bold', display: 'block', marginBottom: '5px' }}>Alícuota de IVA</label>
                                <select 
                                    className="form-input"
                                    // Forzamos que si es null/undefined sea una cadena vacía o el ID por defecto
                                    value={productoDetalle?.idTasaIVA || ""} 
                                    onChange={(e) => setProductoDetalle({
                                        ...productoDetalle, 
                                        idTasaIVA: parseInt(e.target.value) || 0
                                    })}
                                >
                                    <option value="">Seleccione IVA...</option>
                                    {tasasIva.map(t => (
                                        <option key={t.idTasaIVA} value={t.idTasaIVA}>
                                            {t.nombre} ({t.porcentaje}%)
                                        </option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        {/* 2. TABLA DE NIVELES DE PRECIOS */}
                        <p style={{ color: '#64748b', marginBottom: '10px', fontSize: '0.9rem' }}>
                            Precios en <strong>Dólares (Moneda Base)</strong>. Referencia actual: <strong>{tasa} VES</strong>.
                        </p>

                        <table className="tabla-edicion-precios" style={{ marginBottom: '20px' }}>
                            <thead>
                                <tr style={{ background: '#f8fafc' }}>
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
                                                value={editandoPrecios[u.idProductoUnidad]?.precio1 || 0}
                                                onChange={(e) => handlePrecioChange(u.idProductoUnidad, 'precio1', e.target.value)}
                                            />
                                        </td>
                                        <td>
                                            <input 
                                                type="number"
                                                className="input-precio-editable"
                                                value={editandoPrecios[u.idProductoUnidad]?.precio2 || 0}
                                                onChange={(e) => handlePrecioChange(u.idProductoUnidad, 'precio2', e.target.value)}
                                            />
                                        </td>
                                        <td>
                                            <input 
                                                type="number"
                                                className="input-precio-editable"
                                                value={editandoPrecios[u.idProductoUnidad]?.precio3 || 0}
                                                onChange={(e) => handlePrecioChange(u.idProductoUnidad, 'precio3', e.target.value)}
                                            />
                                        </td>
                                        <td style={{ color: '#2563eb', fontSize: '0.85rem', fontWeight: 'bold' }}>
                                            {((editandoPrecios[u.idProductoUnidad]?.precio1 || 0) * tasa).toLocaleString('es-VE', {minimumFractionDigits: 2})} Bs
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>

                        {/* 3. STOCK MÍNIMO (Solo visible para Bienes) */}
                        {productoDetalle.tipoArt !== 'Servicio' && (
                            <div style={{ background: '#fff1f2', padding: '15px', borderRadius: '8px', marginBottom: '20px', border: '1px solid #fecaca', display: 'flex', alignItems: 'center', gap: '20px' }}>
                                <div>
                                    <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '5px', color: '#991b1b' }}>📦 Stock Mínimo:</label>
                                    <input 
                                        type="number" 
                                        className="input-precio-editable" 
                                        style={{ width: '120px', textAlign: 'center' }}
                                        value={stockMinimoEdit}
                                        onChange={(e) => setStockMinimoEdit(e.target.value)}
                                    />
                                </div>
                                <p style={{ fontSize: '0.8rem', color: '#991b1b', margin: 0 }}>
                                    El sistema alertará en rojo cuando la existencia baje de este nivel.
                                </p>
                            </div>
                        )}

                        {/* BOTONES DE ACCIÓN */}
                        <div style={{ display: 'flex', gap: '10px' }}>
                            <button onClick={() => setProductoDetalle(null)} className="btn-secondary" style={{ flex: 1 }}>
                                Cancelar
                            </button>
                            <button 
                                onClick={guardarCambios} 
                                className="btn-primary" 
                                disabled={guardando}
                                style={{ flex: 2, background: '#10b981' }}
                            >
                                {guardando ? "⏳ Guardando..." : "💾 Guardar Cambios"}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Productos;