import React, { useState, useEffect, useContext } from 'react';
import { ConfigContext } from '../Context/ConfigContext';

const getAuthHeaders = () => ({
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${localStorage.getItem("token")}`
});
    
const Reportes = () => {
    const { API_URL, tasa } = useContext(ConfigContext);
    const [loading, setLoading] = useState(false);
    const [tab, setTab] = useState('cierre'); // 'cierre', 'stock', 'estadisticas', 'precios'
    const [cierre, setCierre] = useState(null);
    const [utilidad, setUtilidad] = useState(null);
    const [stockCritico, setStockCritico] = useState([]);
    const [listaPrecios, setListaPrecios] = useState([]);
    const [estadisticas, setEstadisticas] = useState([]);
    const [rangoFechas, setRangoFechas] = useState({
        inicio: new Date().toISOString().split('T')[0],
        fin: new Date().toISOString().split('T')[0]
    });
    // --- EFECTOS ---
    useEffect(() => {
        if (tab === 'cierre') cargarCierreDiario();
        if (tab === 'stock') cargarStockCritico();
        if (tab === 'precios') cargarListaPrecios();
        // Estadísticas se carga manual al dar click en buscar
    }, [tab]);

    // --- CARGA DE DATOS (Consumiendo todos los endpoints del Controller) ---

    const cargarCierreDiario = async () => {
        setLoading(true);
        try {
            // Hacemos ambas peticiones en paralelo para velocidad
            const [resCierre, resUtilidad] = await Promise.all([
                fetch(`${API_URL}/Reportes/cierre-caja-hoy`, { headers: getAuthHeaders() }),
                fetch(`${API_URL}/Reportes/utilidad-hoy`, { headers: getAuthHeaders() })
            ]);

            if (resCierre.ok) setCierre(await resCierre.json());
            if (resUtilidad.ok) setUtilidad(await resUtilidad.json());

        } catch (error) {
            console.error("Error cargando cierre:", error);
        } finally {
            setLoading(false);
        }
    };

    const cargarStockCritico = async () => {
        setLoading(true);
        try {
            const res = await fetch(`${API_URL}/Reportes/stock-critico`, { headers: getAuthHeaders() });
            const data = await res.json();
            // El endpoint devuelve { items: [...] } o un mensaje
            setStockCritico(data.items || []); 
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    const cargarListaPrecios = async () => {
        setLoading(true);
        try {
            const res = await fetch(`${API_URL}/Reportes/productos-costos-precios`
                , { headers: getAuthHeaders() });
            if(res.ok) setListaPrecios(await res.json());
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    const buscarEstadisticas = async () => {
        setLoading(true);
        try {
            const res = await fetch(`${API_URL}/Reportes/estadisticas-ventas?inicio=${rangoFechas.inicio}&fin=${rangoFechas.fin}`,{ 
                headers: getAuthHeaders() }
            );
            if(res.ok) setEstadisticas(await res.json());
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    // --- DESCARGAS ---
    const descargarArchivo = (endpoint) => {
        window.open(`${API_URL}/Reportes/${endpoint}`, '_blank');
    };

    // --- FORMATO DE MONEDA ---
    const fmtUSD = (n) => `$${Number(n).toLocaleString('en-US', { minimumFractionDigits: 2 })}`;
    const fmtVES = (n) => `Bs ${Number(n * tasa).toLocaleString('es-VE', { minimumFractionDigits: 2 })}`;


    return (
        <div className="modulo-container">
            {/* ENCABEZADO Y ACCIONES GLOBALES */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '10px' }}>
                <h2>📊 Centro de Control</h2>
                <div style={{ display: 'flex', gap: '10px' }}>
                    <button onClick={() => descargarArchivo('descargar-inventario-valorado')} className="btn-secondary" title="Valor del Inventario Actual">
                        📦 Excel Inventario
                    </button>
                    <button onClick={() => descargarArchivo('descargar-margenes-excel')} className="btn-secondary" title="Análisis de Costos y Precios">
                        📈 Excel Márgenes
                    </button>
                </div>
            </div>

            {/* NAVEGACIÓN (TABS) */}
            <div className="tabs-container" style={{ display: 'flex', gap: '5px', marginBottom: '20px', overflowX: 'auto' }}>
                {[
                    { id: 'cierre', icon: '💰', label: 'Cierre de Hoy' },
                    { id: 'stock', icon: '⚠️', label: 'Stock Crítico' },
                    { id: 'estadisticas', icon: '📅', label: 'Histórico Ventas' },
                    { id: 'precios', icon: '🏷️', label: 'Lista de Precios' }
                ].map(t => (
                    <button 
                        key={t.id}
                        className={`nav-button ${tab === t.id ? 'active' : ''}`} 
                        onClick={() => setTab(t.id)}
                        style={{ flex: 1, minWidth: '120px', textAlign: 'center', padding: '10px' }}
                    >
                        {t.icon} {t.label}
                    </button>
                ))}
            </div>

            {loading && <p style={{textAlign: 'center', color: '#666'}}>Cargando datos...</p>}

            {/* --- TAB 1: CIERRE DE CAJA Y UTILIDAD --- */}
            {tab === 'cierre' && cierre && (
                <div className="fade-in">
                    <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '10px' }}>
                        <button onClick={() => descargarArchivo('descargar-cierre-pdf')} className="btn-primary" style={{ background: '#dc2626' }}>
                            📄 Descargar PDF Cierre
                        </button>
                    </div>

                    {/* KPI CARDS */}
                    <div className="resumen-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '15px', marginBottom: '25px' }}>
                        <div className="card-stat">
                            <label>Ventas Brutas</label>
                            <p className="valor-usd">{fmtUSD(cierre.totalUSD)}</p>
                            <small>{fmtVES(cierre.totalUSD)}</small>
                        </div>
                        <div className="card-stat" style={{ borderLeft: '4px solid #16a34a' }}>
                            <label>Ganancia Neta (Utilidad)</label>
                            <p className="valor-usd" style={{ color: '#16a34a' }}>
                                {utilidad ? fmtUSD(utilidad.utilidadBrutaUSD) : '...'}
                            </p>
                            <small>Margen: {utilidad?.porcentajeMargen || '0%'}</small>
                        </div>
                        <div className="card-stat">
                            <label>Costos de Venta</label>
                            <p className="valor-usd" style={{ color: '#dc2626' }}>
                                {utilidad ? fmtUSD(utilidad.costosVentaUSD) : '...'}
                            </p>
                        </div>
                        <div className="card-stat">
                            <label>Transacciones</label>
                            <p className="valor-usd" style={{ color: '#64748b' }}>{cierre.cantidadOperaciones}</p>
                        </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                        {/* Tabla Pagos */}
                        <div>
                            <h3>💳 Desglose por Pagos</h3>
                            <table className="tabla-compacta">
                                <thead>
                                    <tr>
                                        <th>Método</th>
                                        <th style={{textAlign: 'right'}}>USD</th>
                                        <th style={{textAlign: 'right'}}>Bs</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {cierre.desglosePagos?.map((p, i) => (
                                        <tr key={i}>
                                            <td>{p.metodo}</td>
                                            <td style={{textAlign: 'right'}}>{fmtUSD(p.montoUSD)}</td>
                                            <td style={{textAlign: 'right'}}>{p.montoVES.toLocaleString()}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        {/* Top Productos */}
                        <div>
                            <h3>🏆 Top 5 Productos</h3>
                            <div className="lista-top">
                                {cierre.productosMasVendidos?.map((p, i) => (
                                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px', borderBottom: '1px solid #eee' }}>
                                        <span>{p.producto}</span>
                                        <span><b>{p.cantidad}</b> un. ({fmtUSD(p.totalUSD)})</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* --- TAB 2: STOCK CRÍTICO --- */}
            {tab === 'stock' && (
                <div className="fade-in">
                    <h3 style={{color: '#ea580c'}}>⚠️ Productos con Existencia Baja o Agotada</h3>
                    {stockCritico.length > 0 ? (
                        <table>
                            <thead>
                                <tr>
                                    <th>Código</th>
                                    <th>Producto</th>
                                    <th>Categoría</th>
                                    <th>Stock</th>
                                    <th>Mínimo</th>
                                    <th>Faltante</th>
                                    <th>Estado</th>
                                </tr>
                            </thead>
                            <tbody>
                                {stockCritico.map((item, idx) => (
                                    <tr key={idx} style={{ background: item.estado === 'AGOTADO' ? '#fee2e2' : '#ffedd5' }}>
                                        <td>{item.codigo}</td>
                                        <td>{item.descripcion}</td>
                                        <td>{item.categoria}</td>
                                        <td style={{ fontWeight: 'bold', fontSize: '1.1em' }}>{item.stockActual}</td>
                                        <td>{item.minimoRequerido}</td>
                                        <td>{item.necesidadReposicion}</td>
                                        <td>
                                            <span style={{ 
                                                padding: '4px 8px', borderRadius: '4px', fontSize: '0.8em', fontWeight: 'bold',
                                                background: item.estado === 'AGOTADO' ? '#ef4444' : '#f97316', color: 'white'
                                            }}>
                                                {item.estado}
                                            </span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    ) : (
                        <div style={{ textAlign: 'center', padding: '50px', color: '#16a34a' }}>
                            <h3>✅ Todo en orden</h3>
                            <p>No hay productos por debajo del stock mínimo.</p>
                        </div>
                    )}
                </div>
            )}

            {/* --- TAB 3: ESTADÍSTICAS --- */}
            {tab === 'estadisticas' && (
                <div className="fade-in">
                    <div style={{ display: 'flex', gap: '10px', alignItems: 'end', marginBottom: '20px', background: '#f8fafc', padding: '15px', borderRadius: '8px' }}>
                        <div>
                            <label style={{display: 'block', fontSize: '0.8em'}}>Desde:</label>
                            <input 
                                type="date" 
                                value={rangoFechas.inicio}
                                onChange={e => setRangoFechas({...rangoFechas, inicio: e.target.value})}
                                style={{padding: '5px'}}
                            />
                        </div>
                        <div>
                            <label style={{display: 'block', fontSize: '0.8em'}}>Hasta:</label>
                            <input 
                                type="date" 
                                value={rangoFechas.fin}
                                onChange={e => setRangoFechas({...rangoFechas, fin: e.target.value})}
                                style={{padding: '5px'}}
                            />
                        </div>
                        <button onClick={buscarEstadisticas} className="btn-primary">🔍 Consultar</button>
                    </div>

                    {estadisticas.length > 0 ? (
                        <div>
                            <h3>Historial de Ventas</h3>
                            <table>
                                <thead>
                                    <tr>
                                        <th>Fecha</th>
                                        <th>Cant. Ventas</th>
                                        <th>Total Vendido (USD)</th>
                                        <th>Total Vendido (Estimado Bs)</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {estadisticas.map((dia, idx) => (
                                        <tr key={idx}>
                                            <td>{new Date(dia.fecha).toLocaleDateString()}</td>
                                            <td>{dia.cantidad}</td>
                                            <td style={{fontWeight: 'bold', color: '#16a34a'}}>{fmtUSD(dia.totalUSD)}</td>
                                            <td>{fmtVES(dia.totalUSD)}</td>
                                        </tr>
                                    ))}
                                    {/* Fila de Totales */}
                                    <tr style={{background: '#e2e8f0', fontWeight: 'bold'}}>
                                        <td>TOTAL PERIODO</td>
                                        <td>{estadisticas.reduce((acc, curr) => acc + curr.cantidad, 0)}</td>
                                        <td>{fmtUSD(estadisticas.reduce((acc, curr) => acc + curr.totalUSD, 0))}</td>
                                        <td>-</td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    ) : (
                        <p style={{textAlign: 'center', color: '#999'}}>Selecciona un rango de fechas para ver el análisis.</p>
                    )}
                </div>
            )}

            {/* --- TAB 4: LISTA DE PRECIOS --- */}
            {tab === 'precios' && (
                <div className="fade-in">
                     <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <h3>🏷️ Listado General de Precios</h3>
                        <input type="text" placeholder="Filtrar..." style={{padding: '5px'}} onChange={() => {
                            // Implementación simple de filtro visual si se desea
                        }}/>
                     </div>
                     <div style={{maxHeight: '500px', overflowY: 'auto'}}>
                        <table>
                            <thead style={{position: 'sticky', top: 0, background: 'white'}}>
                                <tr>
                                    <th>Categoría</th>
                                    <th>Código</th>
                                    <th>Producto</th>
                                    <th>Costo Base</th>
                                    <th>Unidad</th>
                                    <th>Precio Venta ($)</th>
                                </tr>
                            </thead>
                            <tbody>
                                {listaPrecios.map((p, idx) => (
                                    p.unidades.map((u, uIdx) => (
                                        <tr key={`${idx}-${uIdx}`}>
                                            {uIdx === 0 && (
                                                <>
                                                    <td rowSpan={p.unidades.length} style={{verticalAlign: 'middle'}}>{p.categoria}</td>
                                                    <td rowSpan={p.unidades.length} style={{verticalAlign: 'middle'}}>{p.codigo}</td>
                                                    <td rowSpan={p.unidades.length} style={{verticalAlign: 'middle'}}>{p.descripcion}</td>
                                                    <td rowSpan={p.unidades.length} style={{verticalAlign: 'middle'}}>{fmtUSD(p.costoBase)}</td>
                                                </>
                                            )}
                                            <td>{u.nombreUnidad}</td>
                                            <td style={{fontWeight: 'bold'}}>{fmtUSD(u.precioMonedaBase)}</td>
                                        </tr>
                                    ))
                                ))}
                            </tbody>
                        </table>
                     </div>
                </div>
            )}
            
            {/* Estilos locales para limpieza */}
            <style jsx>{`
                .tabla-compacta th, .tabla-compacta td { padding: 8px; font-size: 0.9em; }
                .card-stat { background: white; padding: 15px; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
                .card-stat label { display: block; font-size: 0.85em; color: #64748b; margin-bottom: 5px; }
                .valor-usd { font-size: 1.5em; font-weight: bold; margin: 0; color: #0f172a; }
                .nav-button { background: white; border: 1px solid #e2e8f0; cursor: pointer; transition: all 0.2s; }
                .nav-button.active { background: #eff6ff; border-color: #2563eb; color: #2563eb; font-weight: bold; }
                .fade-in { animation: fadeIn 0.3s ease-in; }
                @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
            `}</style>
        </div>
    );
};

export default Reportes;