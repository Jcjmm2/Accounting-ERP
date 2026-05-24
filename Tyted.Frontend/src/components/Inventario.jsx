import React, { useState, useEffect, useContext } from 'react';
import { ConfigContext } from '../Context/ConfigContext';

const Inventario = () => {
    const { API_URL } = useContext(ConfigContext);
    const getAuthHeaders = () => {
        const token = localStorage.getItem("token");
        return {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        };
    };
    const [productos, setProductos] = useState([]);
    const [movimientos, setMovimientos] = useState([]);
    const [productoSeleccionado, setProductoSeleccionado] = useState(null);
    const [loading, setLoading] = useState(true);
    const [busqueda, setBusqueda] = useState("");
    const [mostrarModalAjuste, setMostrarModalAjuste] = useState(false);
    const [unidadesProducto, setUnidadesProducto] = useState([]); // Lista de unidades (Caja, Unidad, etc)
    const [formAjuste, setFormAjuste] = useState({
        cantidad: 0,
        idUnidad: '',
        tipo: 'Entrada', // o Salida
        concepto: ''
    });
    const [modoMasivo, setModoMasivo] = useState(false);
    const [inventarioMasivo, setInventarioMasivo] = useState({});

    useEffect(() => {
        cargarInventario();
    }, []);

const cargarInventario = async () => {
        try {
            setLoading(true);
            const res = await fetch(`${API_URL}/Productos`, { 
                method: 'GET', // Opcional pero recomendado
                headers: getAuthHeaders() 
            });

            if (res.status === 401) {
                alert("Sesión expirada. Por favor inicie sesión nuevamente.");
                return;
            }

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
            const res = await fetch(`${API_URL}/Inventario/movimientos/${producto.codigoProd}`, { headers: getAuthHeaders() });
            if (res.ok) {
                const data = await res.json();
                setMovimientos(data);
            }
        } catch (error) {
            console.error("Error al cargar movimientos:", error);
        }
    };
    const abrirAjuste = (producto) => {
        // 1. Ahora sabemos que el nombre exacto es 'unidadesDeVenta'
        const unidades = producto.unidadesDeVenta || [];

        setProductoSeleccionado(producto);
        setFormAjuste({ 
            cantidad: "", 
            idUnidad: unidades.length > 0 ? unidades[0].idProductoUnidad : '', 
            tipo: 'Entrada', 
            concepto: "" 
        });

        if (unidades.length > 0) {
            setUnidadesProducto(unidades);
            setMostrarModalAjuste(true);
        } else {
            alert("Este producto no tiene 'unidadesDeVenta' configuradas.");
        }
    };

    const enviarAjuste = async () => {
        if (!formAjuste.cantidad || !formAjuste.idUnidad) {
            alert("Por favor ingrese una cantidad y seleccione una unidad.");
            return;
        }

        const payload = {
            codigoProd: productoSeleccionado.codigoProd,
            idUnidadMedida: parseInt(formAjuste.idUnidad),
            cantidad: parseFloat(formAjuste.cantidad),
            tipoMovimiento: formAjuste.tipo,
            concepto: formAjuste.concepto || "Ajuste Manual"
        };

        try {
            const res = await fetch(`${API_URL}/Inventario/ajuste`, {
                method: 'POST',
                headers: getAuthHeaders(), // Simplificado: ya trae el Content-Type
                body: JSON.stringify(payload)
            });

            if (res.ok) {
                alert("✅ Ajuste realizado con éxito");
                setMostrarModalAjuste(false);
                cargarInventario();
            } else {
                const err = await res.text();
                alert("❌ Error: " + err);
            }
        } catch (error) {
            console.error("Error de red:", error);
        }
    };

    const productosFiltrados = productos.filter(p => 
        p.descripcion.toLowerCase().includes(busqueda.toLowerCase()) || 
        p.codigoProd.includes(busqueda)
    );

    // --- LÓGICA DE AJUSTE MASIVO ---
    const enviarAjusteMasivo = async () => {
        // 1. Validar que haya datos
        const codigosConCambios = Object.keys(inventarioMasivo);
        if (codigosConCambios.length === 0) {
            alert("No has ingresado ningún conteo físico.");
            return;
        }

        if (!window.confirm(`¿Estás seguro de procesar ajustes para ${codigosConCambios.length} productos?`)) {
            return;
        }

        const payload = [];

        // 2. Recorremos el inventario físico ingresado
        for (const codigo of codigosConCambios) {
            const conteoFisico = inventarioMasivo[codigo];
            const producto = productos.find(p => p.codigoProd === codigo);

            if (!producto) continue;

            // Calculamos la diferencia (Físico - Sistema)
            const stockSistema = producto.stockActual;
            const diferencia = conteoFisico - stockSistema;

            // Solo generamos ajuste si hay diferencia real
            if (Math.abs(diferencia) > 0.0001) {
                
                // CRÍTICO: Necesitamos el ID de la "Unidad Base" (la que vale 1)
                // para que el ajuste coincida con el stock base.
                const unidades = producto.unidadesDeVenta || [];
                
                // Buscamos la unidad con equivalencia 1 (ej: Unidad, Botella, Gramo)
                let unidadBase = unidades.find(u => u.cantidadEquivalente === 1);
                
                // Fallback: Si no encuentra una de valor 1, usa la primera disponible
                if (!unidadBase && unidades.length > 0) unidadBase = unidades[0];

                if (unidadBase) {
                    payload.push({
                        codigoProd: codigo,
                        idUnidadMedida: unidadBase.idProductoUnidad,
                        cantidad: Math.abs(diferencia), // Enviamos positivo
                        tipoMovimiento: diferencia > 0 ? "Entrada" : "Salida", // El signo define el tipo
                        concepto: "Toma de Inventario Masiva"
                    });
                } else {
                    console.warn(`Producto ${codigo} omitido: No tiene unidades configuradas.`);
                }
            }
        }

        // 3. Enviar al Backend
        if (payload.length === 0) {
            alert("Los conteos ingresados coinciden con el sistema. No hay ajustes que realizar.");
            return;
        }

        try {
            const res = await fetch(`${API_URL}/Inventario/ajuste-masivo`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
                body: JSON.stringify(payload)
            });

            if (res.ok) {
                alert("✅ Inventario actualizado correctamente.");
                setInventarioMasivo({}); // Limpiar los inputs
                setModoMasivo(false);    // Salir del modo masivo
                cargarInventario();      // Recargar la tabla para ver los nuevos stocks
            } else {
                const errorText = await res.text();
                alert("❌ Error al guardar: " + errorText);
            }
        } catch (error) {
            console.error("Error de conexión:", error);
            alert("Error de conexión con el servidor.");
        }
    };
    
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
                {/* Switch para Modo Masivo */}
                <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer', gap: '5px' }}>
                        <input 
                            type="checkbox" 
                            checked={modoMasivo} 
                            onChange={(e) => setModoMasivo(e.target.checked)} 
                        />
                        <span style={{ fontWeight: 'bold' }}>Modo Toma de Inventario</span>
                    </label>
                </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: (!modoMasivo && productoSeleccionado) ? '1fr 1fr' : '1fr', gap: '20px' }}>
                
                {/* TABLA PRINCIPAL DE PRODUCTOS */}
                <div className="modulo-container" style={{ margin: 0 }}>
                    <h3>{modoMasivo ? "📝 Toma Física de Inventario" : "📊 Stock Actual"}</h3>
                    
                    {loading ? <p>Cargando datos...</p> : (
                        <div style={{ overflowX: 'auto' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                <thead>
                                    <tr style={{ background: '#f1f5f9' }}>
                                        <th style={{ padding: '10px' }}>Código</th>
                                        <th style={{ padding: '10px' }}>Descripción</th>
                                        <th style={{ padding: '10px', textAlign: 'right' }}>Stock Sistema</th>
                                        {modoMasivo && <th style={{ padding: '10px', background: '#fff7ed' }}>Conteo Físico (Base)</th>}
                                        {modoMasivo && <th style={{ padding: '10px' }}>Diferencia</th>}
                                        {!modoMasivo && <th style={{ padding: '10px' }}>Acciones</th>}
                                    </tr>
                                </thead>
                                <tbody>
                                    {productosFiltrados.map(p => {
                                        // Lógica para modo masivo (cálculo visual de diferencia)
                                        const conteo = inventarioMasivo[p.codigoProd];
                                        const diferencia = conteo !== undefined ? (conteo - p.stockActual).toFixed(2) : '-';
                                        
                                        return (
                                            <tr key={p.codigoProd} style={{ borderBottom: '1px solid #e2e8f0' }}>
                                                <td style={{ padding: '8px' }}>{p.codigoProd}</td>
                                                <td style={{ padding: '8px' }}>{p.descripcion}</td>
                                                
                                                <td style={{ padding: '8px', textAlign: 'right', fontWeight: 'bold' }}>
                                                    {p.stockActual}
                                                </td>

                                                {/* CELDAS MODO MASIVO */}
                                                {modoMasivo && (
                                                    <>
                                                        <td style={{ padding: '5px', background: '#fff7ed' }}>
                                                            <input 
                                                                type="number"
                                                                placeholder="0.00"
                                                                style={{ width: '80px', padding: '5px' }}
                                                                onChange={(e) => setInventarioMasivo({
                                                                    ...inventarioMasivo,
                                                                    [p.codigoProd]: parseFloat(e.target.value)
                                                                })}
                                                            />
                                                        </td>
                                                        <td style={{ 
                                                            padding: '8px', 
                                                            color: diferencia < 0 ? 'red' : diferencia > 0 ? 'green' : 'black',
                                                            fontWeight: 'bold'
                                                        }}>
                                                            {conteo !== undefined ? diferencia : ''}
                                                        </td>
                                                    </>
                                                )}

                                                {/* CELDAS MODO NORMAL */}
                                                {!modoMasivo && (
                                                    <td style={{ padding: '8px', display: 'flex', gap: '5px' }}>
                                                        <button 
                                                            onClick={() => verKardex(p)} 
                                                            className="btn-secondary"
                                                            title="Ver Movimientos"
                                                            style={{ padding: '5px 10px' }}
                                                        >
                                                            📋
                                                        </button>
                                                        <button 
                                                            onClick={() => abrirAjuste(p)} 
                                                            className="btn-primary"
                                                            title="Realizar Ajuste"
                                                            style={{ padding: '5px 10px', background: '#f59e0b' }}
                                                        >
                                                            ⚙️
                                                        </button>
                                                    </td>
                                                )}
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                            {modoMasivo && (
                                <div style={{ marginTop: '20px', textAlign: 'right' }}>
                                    <p style={{ fontSize: '0.9rem', color: '#666' }}>* El ajuste masivo aplicará las diferencias detectadas.</p>
                                    <button className="btn-confirm" onClick={enviarAjusteMasivo}>
                                        💾 Guardar Inventario Físico
                                    </button>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* MODAL DE AJUSTE INDIVIDUAL */}
                {mostrarModalAjuste && (
                    <div className="modal-overlay" style={{
                        position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                        backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000
                    }}>
                        <div className="modal-content" style={{ background: 'white', padding: '20px', borderRadius: '8px', width: '400px' }}>
                            <h3 style={{ marginTop: 0 }}>Ajustar: {productoSeleccionado?.descripcion}</h3>
                            
                            <div style={{ marginBottom: '10px' }}>
                                <label style={{ display: 'block', marginBottom: '5px' }}>Tipo de Movimiento:</label>
                                <select 
                                    style={{ width: '100%', padding: '8px' }}
                                    value={formAjuste.tipo} 
                                    onChange={e => setFormAjuste({...formAjuste, tipo: e.target.value})}
                                >
                                    <option value="Entrada">📥 Entrada (Suma al stock)</option>
                                    <option value="Salida">📤 Salida (Resta del stock)</option>
                                </select>
                            </div>

                            <div style={{ marginBottom: '10px' }}>
                                <label style={{ display: 'block', marginBottom: '5px' }}>Unidad de Medida:</label>
                                <select 
                                    style={{ width: '100%', padding: '8px' }}
                                    value={formAjuste.idUnidad} 
                                    onChange={e => setFormAjuste({...formAjuste, idUnidad: e.target.value})}
                                >
                                    {unidadesProducto.map(u => (
                                        <option key={u.idProductoUnidad} value={u.idProductoUnidad}>
                                            {u.nombreUnidad} (Equivalencia: {u.cantidadEquivalente})
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div style={{ marginBottom: '10px' }}>
                                <label style={{ display: 'block', marginBottom: '5px' }}>Cantidad:</label>
                                <input 
                                    type="number" 
                                    style={{ width: '100%', padding: '8px', boxSizing: 'border-box' }}
                                    value={formAjuste.cantidad}
                                    onChange={e => setFormAjuste({...formAjuste, cantidad: e.target.value})}
                                />
                            </div>

                            <div style={{ marginBottom: '20px' }}>
                                <label style={{ display: 'block', marginBottom: '5px' }}>Concepto:</label>
                                <input 
                                    type="text" 
                                    placeholder="Ej: Rotura, Regalo, Ajuste"
                                    style={{ width: '100%', padding: '8px', boxSizing: 'border-box' }}
                                    value={formAjuste.concepto}
                                    onChange={e => setFormAjuste({...formAjuste, concepto: e.target.value})}
                                />
                            </div>

                            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                                <button onClick={() => setMostrarModalAjuste(false)} className="btn-cancel" style={{ padding: '8px 15px', background: '#ccc', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>Cancelar</button>
                                <button onClick={enviarAjuste} className="btn-confirm" style={{ padding: '8px 15px', background: '#2563eb', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>Guardar</button>
                            </div>
                        </div>
                    </div>
                )}

                {/* VISTA DEL KARDEX (Lado Derecho) */}
                {!modoMasivo && productoSeleccionado && (
                    <div className="modulo-container" style={{ margin: 0, border: '1px solid #e2e8f0', height: 'fit-content' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                            <h3 style={{ margin: 0 }}>Historial: {productoSeleccionado.codigoProd}</h3>
                            <button onClick={() => setProductoSeleccionado(null)} style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: '1.2rem' }}>✕</button>
                        </div>
                        
                        <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
                            <table style={{ fontSize: '0.85rem', width: '100%' }}>
                                <thead style={{ position: 'sticky', top: 0, background: 'white' }}>
                                    <tr style={{ background: '#f8fafc' }}>
                                        <th style={{ padding: '5px' }}>Fecha</th>
                                        <th style={{ padding: '5px' }}>Tipo</th>
                                        <th style={{ padding: '5px' }}>Cant.</th>
                                        <th style={{ padding: '5px' }}>Concepto</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {movimientos.length > 0 ? movimientos.map((m, idx) => (
                                        <tr key={idx} style={{ borderBottom: '1px solid #eee' }}>
                                            <td style={{ padding: '5px' }}>{new Date(m.fecha).toLocaleDateString()}</td>
                                            <td style={{ padding: '5px', color: m.tipo === 'Entrada' ? '#16a34a' : '#dc2626', fontWeight: 'bold' }}>
                                                {m.tipo === 'Entrada' ? '➕' : '➖'} {m.tipo}
                                            </td>
                                            <td style={{ padding: '5px' }}>{m.cantidad} {m.unidad}</td>
                                            <td style={{ padding: '5px' }}>{m.concepto}</td>
                                        </tr>
                                    )) : (
                                        <tr><td colSpan="4" style={{ textAlign: 'center', padding: '10px' }}>No hay movimientos registrados.</td></tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default Inventario;