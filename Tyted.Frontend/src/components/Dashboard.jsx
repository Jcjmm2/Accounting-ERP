import React, { useState, useEffect, useContext } from 'react';
import { ConfigContext } from '../Context/ConfigContext';

const Dashboard = () => {
    const { API_URL, tasa } = useContext(ConfigContext);
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        const fetchDashboardData = async () => {
            try {
                setLoading(true);
                
                // 1. Recuperar el token del almacenamiento local
                const token = localStorage.getItem('token');
                
                if (!token) {
                    throw new Error("No se encontró un token de sesión. Inicie sesión nuevamente.");
                }

                // 2. Configurar la petición con los Headers de Autorización
                const response = await fetch(`${API_URL}/Dashboard/resumen-gerencial`, {
                    method: 'GET',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}` // <--- CLAVE PARA EL ERROR 401
                    }
                });
                
                if (response.status === 401) throw new Error("Sesión expirada o no autorizada.");
                if (response.status === 403) throw new Error("No tienes permisos de Administrador de Sistema.");
                if (!response.ok) throw new Error(`Error del servidor: ${response.status}`);
                
                const result = await response.json();
                setData(result);
                setError(null);
            } catch (err) {
                console.error("Error en Dashboard:", err.message);
                setError(err.message);
            } finally {
                setLoading(false);
            }
        };

        if (API_URL) fetchDashboardData();
    }, [API_URL]);

    if (loading) return <div className="modulo-container"><p>Cargando estadísticas gerenciales...</p></div>;
    if (error) return <div className="modulo-container"><p style={{ color: '#ef4444', fontWeight: 'bold' }}>⚠️ {error}</p></div>;
    if (!data) return null;

    // Cálculo de ventas totales (Hoy)
    const totalVentasHoyUSD = data.ventasPorMetodo?.reduce((acc, curr) => acc + curr.montoUSD, 0) || 0;

    return (
        <div className="dashboard-wrapper" style={{ padding: '20px', backgroundColor: '#f8fafc', minHeight: '100vh' }}>
            <h2 style={{ marginBottom: '25px', color: '#1e293b', fontWeight: '800' }}>📊 Resumen Gerencial</h2>

            {/* Tarjetas Superiores */}
            <div style={{ 
                display: 'grid', 
                gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', 
                gap: '20px', 
                marginBottom: '30px' 
            }}>
                <StatCard 
                    title="Ventas Totales (Hoy)" 
                    value={`$${totalVentasHoyUSD.toFixed(2)}`} 
                    subValue={`${(totalVentasHoyUSD * tasa).toLocaleString('es-VE')} Bs`}
                    color="#10b981" 
                />
                <StatCard 
                    title="Utilidad Bruta (Hoy)" 
                    value={`$${data.utilidadBrutaDiaUSD?.toFixed(2) || '0.00'}`} 
                    subValue="Basado en costo base"
                    color="#3b82f6" 
                />
                <StatCard 
                    title="Capital en Inventario" 
                    value={`$${data.valorInventarioCostoUSD?.toFixed(2) || '0.00'}`} 
                    subValue="Mercancía a precio de costo"
                    color="#f59e0b" 
                />
                <StatCard 
                    title="Movimientos de Tasa" 
                    value={data.cambiosDeTasaDelDia || '0'} 
                    subValue="Actualizaciones hoy"
                    color="#ef4444" 
                />
            </div>

            {/* Sección Inferior: Tablas y Listas */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '20px' }}>
                
                {/* Métodos de Pago */}
                <div className="modulo-container" style={tableContainerStyle}>
                    <h3 style={tableTitleStyle}>💰 Ventas por Método</h3>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead>
                            <tr style={{ borderBottom: '2px solid #e2e8f0' }}>
                                <th align="left" style={thStyle}>Método</th>
                                <th align="right" style={thStyle}>Monto USD</th>
                                <th align="right" style={thStyle}>Monto Bs</th>
                            </tr>
                        </thead>
                        <tbody>
                            {data.ventasPorMetodo?.map((v, i) => (
                                <tr key={i} style={{ borderBottom: '1px solid #f1f5f9' }}>
                                    <td style={tdStyle}>{v.metodo.replace('_', ' ')}</td>
                                    <td align="right" style={{ ...tdStyle, fontWeight: 'bold', color: '#059669' }}>${v.montoUSD.toFixed(2)}</td>
                                    <td align="right" style={tdStyle}>{v.montoVES.toLocaleString('es-VE')}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                {/* Top Productos */}
                <div className="modulo-container" style={tableContainerStyle}>
                    <h3 style={tableTitleStyle}>🏆 Top 5 Más Vendidos</h3>
                    {data.topMasVendidos?.map((p, i) => (
                        <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 0', borderBottom: '1px solid #f1f5f9' }}>
                            <div>
                                <span style={{ color: '#64748b', marginRight: '10px' }}>#{i+1}</span>
                                <span style={{ fontWeight: '600' }}>{p.descripcion}</span>
                            </div>
                            <div style={{ textAlign: 'right' }}>
                                <span style={{ display: 'block', fontWeight: 'bold', color: '#1e293b' }}>{p.cantidadTotal} {p.unidad || 'und.'}</span>
                                <small style={{ color: '#94a3b8' }}>${p.totalVendidoUSD.toFixed(2)}</small>
                            </div>
                        </div>
                    ))}
                    {(!data.topMasVendidos || data.topMasVendidos.length === 0) && <p style={{ color: '#94a3b8', padding: '10px' }}>No hay ventas registradas.</p>}
                </div>

                {/* Inventario Crítico */}
                <div className="modulo-container" style={{ ...tableContainerStyle, gridColumn: '1 / -1' }}>
                    <h3 style={tableTitleStyle}>⚠️ Alertas de Stock (Inventario Crítico)</h3>
                    <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                        {data.inventarioBajo?.map((item, index) => (
                            <div key={index} style={badgeStyle}>
                                <strong>{item.descripcion}</strong>: <span style={{ color: '#ef4444', fontWeight: '800' }}>{item.stockActual}</span> / {item.stockMinimo}
                            </div>
                        ))}
                        {(!data.inventarioBajo || data.inventarioBajo.length === 0) && <p style={{ color: '#059669' }}>✅ Todo el inventario está en niveles óptimos.</p>}
                    </div>
                </div>
            </div>
        </div>
    );
};

// --- ESTILOS ---
const tableContainerStyle = { background: 'white', padding: '20px', borderRadius: '15px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)' };
const tableTitleStyle = { marginBottom: '15px', fontSize: '1.1rem', color: '#334155', borderLeft: '4px solid #3b82f6', paddingLeft: '10px' };
const thStyle = { padding: '12px 8px', color: '#64748b', fontSize: '0.85rem', textTransform: 'uppercase' };
const tdStyle = { padding: '12px 8px', fontSize: '0.95rem' };
const badgeStyle = { backgroundColor: '#fee2e2', color: '#991b1b', padding: '8px 12px', borderRadius: '8px', fontSize: '0.85rem', border: '1px solid #fecaca' };

const StatCard = ({ title, value, subValue, color }) => (
    <div style={{ 
        background: 'white', padding: '22px', borderRadius: '15px', 
        borderLeft: `6px solid ${color}`, boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)'
    }}>
        <p style={{ margin: 0, color: '#64748b', fontSize: '0.85rem', fontWeight: '700', textTransform: 'uppercase' }}>{title}</p>
        <h3 style={{ margin: '12px 0 5px 0', fontSize: '1.8rem', color: '#1e293b' }}>{value}</h3>
        <small style={{ color: '#94a3b8', fontWeight: '500' }}>{subValue}</small>
    </div>
);

export default Dashboard;