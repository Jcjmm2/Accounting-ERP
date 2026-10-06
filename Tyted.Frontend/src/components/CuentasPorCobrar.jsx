import React, { useState, useEffect, useContext } from 'react';
import { ConfigContext } from '../Context/ConfigContext';

const CuentasPorCobrar = () => {
    const { API_URL, tasa } = useContext(ConfigContext);
    const [cuentas, setCuentas] = useState([]);
    const [loading, setLoading] = useState(true);
    
    // Estado para el modal de abono
    const [seleccionada, setSeleccionada] = useState(null);
    const [montoAbono, setMontoAbono] = useState('');

    const getAuthHeaders = (incluirJson = true) => {
        const token = localStorage.getItem("token");
        const headers = {
            'Authorization': `Bearer ${token}`
        };
        if (incluirJson) {
            headers['Content-Type'] = 'application/json';
        }
        return headers;
    };

    useEffect(() => {
        cargarCuentas();
    }, []);

const cargarCuentas = async () => {
        try {
            setLoading(true);
            
            const res = await fetch(`${API_URL}/Pagos/cxc/pendientes`, {
                method: 'GET',
                headers: getAuthHeaders(false) 
            });

            if (res.ok) {
                const data = await res.json();
                setCuentas(data);
            } else if (res.status === 401) {
                console.error("No autorizado. Token inválido o expirado.");
            }
        } catch (error) {
            console.error("Error al cargar cuentas:", error);
        } finally {
            setLoading(false);
        }
    };

    const registrarAbono = async (e) => {
        e.preventDefault();
        
        if (!montoAbono || parseFloat(montoAbono) <= 0) return;

        const abonoDto = {
            idCuenta: seleccionada.id,
            montoAbonadoMonedaBase: parseFloat(montoAbono) // El backend espera USD
        };

        try {
            const res = await fetch(`${API_URL}/Pagos/cxc/abono`, {
                method: 'POST',
                headers: getAuthHeaders(true),
                body: JSON.stringify(abonoDto)
            });

            if (res.ok) {
                alert("Abono registrado con éxito");
                setSeleccionada(null);
                setMontoAbono('');
                cargarCuentas();
            } else {
                const errorMsg = await res.text();
                alert("Error: " + errorMsg);
            }
        } catch {
            alert("Error de conexión");
        }
    };

    return (
        <div className="modulo-container">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h2>Cuentas por Cobrar (Clientes)</h2>
                <button onClick={cargarCuentas} className="btn-primary" style={{ background: '#64748b' }}>🔄 Actualizar</button>
            </div>

            {loading ? <p>Cargando deudas...</p> : (
                <table style={{ marginTop: '20px' }}>
                    <thead>
                        <tr>
                            <th>Cliente</th>
                            <th>Factura</th>
                            <th>Vencimiento</th>
                            <th>Total ($)</th>
                            <th>Saldo Pendiente ($)</th>
                            <th>Saldo en Bs (Tasa: {tasa})</th>
                            <th>Acción</th>
                        </tr>
                    </thead>
                    <tbody>
                        {cuentas.length === 0 ? (
                            <tr><td colSpan="7" style={{ textAlign: 'center' }}>No hay deudas pendientes</td></tr>
                        ) : cuentas.map(c => (
                            <tr key={c.id}>
                                <td>
                                    <strong>{c.cliente?.nombre}</strong><br />
                                    <small style={{ color: '#64748b' }}>{c.cliente?.rif}</small>
                                </td>
                                <td>#{c.ventaId}</td>
                                <td>{new Date(c.fechaVencimiento).toLocaleDateString()}</td>
                                <td>${c.totalOriginalUSD.toFixed(2)}</td>
                                <td style={{ color: '#ef4444', fontWeight: 'bold' }}>
                                    ${c.saldoRestanteUSD.toFixed(2)}
                                </td>
                                <td style={{ color: '#2563eb' }}>
                                    {(c.saldoRestanteUSD * tasa).toLocaleString('es-VE')} Bs
                                </td>
                                <td>
                                    <button 
                                        onClick={() => setSeleccionada(c)}
                                        className="btn-primary"
                                        style={{ padding: '5px 10px', fontSize: '0.8rem' }}
                                    >
                                        💸 Abonar
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            )}

            {/* Modal de Abono Simple */}
            {seleccionada && (
                <div style={{
                    position: 'fixed', top: 0, left: 0, width: '100%', height: '100%',
                    background: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000
                }}>
                    <div className="modulo-container" style={{ width: '400px' }}>
                        <h3>Registrar Abono</h3>
                        <p>Cliente: <strong>{seleccionada.cliente?.nombre}</strong></p>
                        <p>Deuda actual: <span style={{ color: '#ef4444' }}>${seleccionada.saldoRestanteUSD.toFixed(2)}</span></p>
                        
                        <form onSubmit={registrarAbono}>
                            <label>Monto a abonar (USD $):</label>
                            <input 
                                type="number" 
                                step="0.01" 
                                autoFocus
                                value={montoAbono}
                                onChange={(e) => setMontoAbono(e.target.value)}
                                placeholder="Ej: 10.50"
                                style={{ marginBottom: '15px' }}
                            />
                            
                            <div style={{ display: 'flex', gap: '10px' }}>
                                <button type="submit" className="btn-primary" style={{ flex: 1 }}>Confirmar Pago</button>
                                <button 
                                    type="button" 
                                    onClick={() => setSeleccionada(null)} 
                                    style={{ flex: 1, background: '#cbd5e1', border: 'none', borderRadius: '6px', cursor: 'pointer' }}
                                >
                                    Cancelar
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default CuentasPorCobrar;