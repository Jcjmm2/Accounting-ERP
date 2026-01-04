import React, { useState, useEffect, useContext } from 'react';
import { ConfigContext } from '../Context/ConfigContext';

const Dashboard = () => {
    const { API_URL, tasa } = useContext(ConfigContext);
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchDashboardData = async () => {
            try {
                const response = await fetch(`${API_URL}/Dashboard/resumen-gerencial`);
                if (response.ok) {
                    const result = await response.json();
                    setData(result);
                }
            } catch (error) {
                console.error("Error al cargar datos del dashboard:", error);
            } finally {
                setLoading(false);
            }
        };

        fetchDashboardData();
    }, [API_URL]);

    if (loading) return <div className="modulo-container"><p>Cargando estadísticas...</p></div>;
    if (!data) return <div className="modulo-container"><p>No se pudo cargar la información gerencial.</p></div>;

    // Supongamos que tu servicio devuelve: ventasHoy, totalArticulos, cxcPendiente, inventarioBajo
    return (
        <div className="dashboard-wrapper">
            <h2 style={{ marginBottom: '20px' }}>Resumen Gerencial</h2>

            {/* Tarjetas de Métricas Principales */}
            <div style={{ 
                display: 'grid', 
                gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', 
                gap: '20px', 
                marginBottom: '30px' 
            }}>
                <StatCard 
                    title="Ventas de Hoy" 
                    value={`$${data.ventasHoy?.toFixed(2) || '0.00'}`} 
                    subValue={`${((data.ventasHoy || 0) * tasa).toLocaleString('es-VE')} Bs`}
                    color="#10b981" 
                />
                <StatCard 
                    title="Ctas. por Cobrar" 
                    value={`$${data.cxcPendiente?.toFixed(2) || '0.00'}`} 
                    subValue="Deuda de clientes"
                    color="#ef4444" 
                />
                <StatCard 
                    title="Productos en Stock" 
                    value={data.totalArticulos || '0'} 
                    subValue="Total unidades"
                    color="#3b82f6" 
                />
                <StatCard 
                    title="Alertas de Stock" 
                    value={data.inventarioBajo?.length || '0'} 
                    subValue="Por debajo del mínimo"
                    color="#f59e0b" 
                />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                {/* Listado de Productos Críticos */}
                <div className="modulo-container">
                    <h3>⚠️ Inventario Crítico</h3>
                    <table style={{ fontSize: '0.85rem' }}>
                        <thead>
                            <tr>
                                <th>Producto</th>
                                <th>Stock</th>
                                <th>Mín.</th>
                            </tr>
                        </thead>
                        <tbody>
                            {data.inventarioBajo?.map((item, index) => (
                                <tr key={index}>
                                    <td>{item.descripcion}</td>
                                    <td style={{ color: '#ef4444', fontWeight: 'bold' }}>{item.stockActual}</td>
                                    <td>{item.stockMinimo}</td>
                                </tr>
                            ))}
                            {(!data.inventarioBajo || data.inventarioBajo.length === 0) && (
                                <tr><td colSpan="3">Todo el stock está optimo.</td></tr>
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Resumen de Movimientos Recientes o Top Productos */}
                <div className="modulo-container">
                    <h3>🏆 Top Productos (Hoy)</h3>
                    {data.topProductos?.map((p, i) => (
                        <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid #f1f5f9' }}>
                            <span>{p.nombre}</span>
                            <span style={{ fontWeight: 'bold' }}>{p.cantidad} vendidos</span>
                        </div>
                    ))}
                    {(!data.topProductos || data.topProductos.length === 0) && <p>Sin ventas registradas hoy.</p>}
                </div>
            </div>
        </div>
    );
};

// Componente interno para las tarjetas
const StatCard = ({ title, value, subValue, color }) => (
    <div style={{ 
        background: 'white', 
        padding: '20px', 
        borderRadius: '12px', 
        borderLeft: `6px solid ${color}`,
        boxShadow: '0 2px 4px rgba(0,0,0,0.05)'
    }}>
        <p style={{ margin: 0, color: '#64748b', fontSize: '0.9rem', fontWeight: '600' }}>{title}</p>
        <h3 style={{ margin: '10px 0 5px 0', fontSize: '1.5rem' }}>{value}</h3>
        <small style={{ color: '#94a3b8' }}>{subValue}</small>
    </div>
);

export default Dashboard;