import React, { useState, useEffect, useContext } from 'react';
import { ConfigContext } from '../Context/ConfigContext';

const Reportes = () => {
    const { API_URL, tasa } = useContext(ConfigContext);
    const [cierre, setCierre] = useState(null);
    const [alertas, setAlertas] = useState(null);
    const [loading, setLoading] = useState(true);
    const [tab, setTab] = useState('cierre'); // 'cierre' o 'stock'

    useEffect(() => {
        cargarDatos();
    }, []);

    const cargarDatos = async () => {
        setLoading(true);
        try {
            // 1. Cargar Cierre de Caja
            const resCierre = await fetch(`${API_URL}/Reportes/cierre-caja-hoy`);
            const dataCierre = await resCierre.json();
            setCierre(dataCierre);

            // 2. Cargar Alertas de Stock
            const resAlertas = await fetch(`${API_URL}/Reportes/alertas-stock`);
            const dataAlertas = await resAlertas.json();
            setAlertas(dataAlertas);
        } catch (error) {
            console.error("Error al cargar reportes:", error);
        } finally {
            setLoading(false);
        }
    };

    const descargarExcel = async () => {
        try {
            window.open(`${API_URL}/Reportes/descargar-inventario-valorado`, '_blank');
        } catch (error) {
            alert("Error al descargar el archivo");
        }
    };

    if (loading) return <div className="modulo-container"><p>Generando reportes de hoy...</p></div>;

    return (
        <div className="modulo-container">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                <h2>📊 Panel de Reportes y Control</h2>
                <div style={{ display: 'flex', gap: '10px' }}>
                    <button onClick={descargarExcel} className="btn-secondary" style={{ background: '#16a34a', color: 'white' }}>
                        📥 Exportar Inventario (Excel)
                    </button>
                    <button onClick={cargarDatos} className="btn-primary">🔄 Actualizar</button>
                </div>
            </div>

            {/* Selector de Pestañas */}
            <div className="tabs-container" style={{ display: 'flex', gap: '5px', marginBottom: '20px' }}>
                <button 
                    className={`nav-button ${tab === 'cierre' ? 'active' : ''}`} 
                    onClick={() => setTab('cierre')}
                    style={{ flex: 1, textAlign: 'center' }}
                >
                    💰 Cierre de Caja
                </button>
                <button 
                    className={`nav-button ${tab === 'stock' ? 'active' : ''}`} 
                    onClick={() => setTab('stock')}
                    style={{ flex: 1, textAlign: 'center' }}
                >
                    ⚠️ Alertas de Stock ({alertas?.totalAlertas || 0})
                </button>
            </div>

            {tab === 'cierre' && cierre && (
                <div className="cierre-container">
                    <div className="resumen-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '15px', marginBottom: '25px' }}>
                        <div className="card-stat">
                            <label>Total Ventas (Bruto)</label>
                            <p className="valor-usd">${cierre.totalVentasUSD.toFixed(2)}</p>
                            <small>{(cierre.totalVentasUSD * tasa).toLocaleString()} Bs</small>
                        </div>
                        <div className="card-stat">
                            <label>Impuestos (IVA)</label>
                            <p style={{ color: '#64748b' }}>${cierre.totalIvaUSD.toFixed(2)}</p>
                        </div>
                        <div className="card-stat" style={{ borderLeft: '4px solid #2563eb' }}>
                            <label>Ventas Netas</label>
                            <p className="valor-usd" style={{ color: '#2563eb' }}>${cierre.totalNetoUSD.toFixed(2)}</p>
                        </div>
                    </div>

                    <h3>Distribución por Método de Pago</h3>
                    <table>
                        <thead>
                            <tr>
                                <th>Método</th>
                                <th>Monto ($)</th>
                                <th>Monto (Bs)</th>
                            </tr>
                        </thead>
                        <tbody>
                            {Object.entries(cierre.desglosePagosUSD).map(([metodo, monto]) => (
                                <tr key={metodo}>
                                    <td><strong>{metodo}</strong></td>
                                    <td>${monto.toFixed(2)}</td>
                                    <td>{(monto * tasa).toLocaleString()} Bs</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>

                    <h3 style={{ marginTop: '25px' }}>Top 5 Productos Más Vendidos</h3>
                    <div className="top-productos">
                        {cierre.topProductos.map((item, index) => (
                            <div key={index} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px', borderBottom: '1px solid #e2e8f0' }}>
                                <span>{item.producto}</span>
                                <strong>{item.cantidad} unidades</strong>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {tab === 'stock' && (
                <div className="alertas-container">
                    <h3>Alertas de Inventario ({alertas?.fechaConsulta})</h3>
                    {alertas?.items ? (
                        <table>
                            <thead>
                                <tr>
                                    <th>Código</th>
                                    <th>Producto</th>
                                    <th>Stock Actual</th>
                                    <th>Mínimo</th>
                                    <th>Estado</th>
                                </tr>
                            </thead>
                            <tbody>
                                {alertas.items.map((item, idx) => (
                                    <tr key={idx} style={{ background: item.estado === 'AGOTADO' ? '#fef2f2' : '#fff7ed' }}>
                                        <td>{item.codigoProd}</td>
                                        <td>{item.descripcion}</td>
                                        <td style={{ fontWeight: 'bold' }}>{item.stockActual}</td>
                                        <td>{item.minimoRequerido}</td>
                                        <td>
                                            <span className={`badge ${item.estado === 'AGOTADO' ? 'badge-danger' : 'badge-warning'}`}>
                                                {item.estado}
                                            </span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    ) : (
                        <p style={{ textAlign: 'center', padding: '40px', color: '#16a34a' }}>
                            ✅ {alertas?.message || "Todo el stock está en niveles óptimos."}
                        </p>
                    )}
                </div>
            )}
        </div>
    );
};

export default Reportes;