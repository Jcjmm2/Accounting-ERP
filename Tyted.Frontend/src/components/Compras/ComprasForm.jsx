import React, { useState, useEffect } from 'react';
import DetalleCompra from './DetalleCompra'; // Asegúrate que la ruta a DetalleCompra.jsx sea correcta
import axios from 'axios';

// Asegúrate de que esta URL base apunte a tu API
const API_URL = 'http://localhost:5077/api'; 

const ComprasForm = () => {
    
    // Estado para la cabecera de la compra
    const [compra, setCompra] = useState({
        idProveedor: '',
        fechaCompra: new Date().toISOString().split('T')[0],
        tipoMoneda: 'HNL',
        tasaCambio: 1.00,
        totalMonedaBase: 0,
        totalMonedaExt: 0,
        detalles: []
    });

    // Estados adicionales
    const [proveedores, setProveedores] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    // ==========================================================
    // 1. Efecto para cargar proveedores
    // ==========================================================
    useEffect(() => {
        const fetchInitialData = async () => {
            try {
                // LLAMADA REAL: Carga la lista de proveedores
                const resProveedores = await axios.get(`${API_URL}/Proveedores`); 
                setProveedores(resProveedores.data);
                
            } catch (err) {
                console.error("Error al cargar datos iniciales:", err);
                // Si la llamada falla, asegúrate de que el error que ves en el navegador
                // no sea el simulado de abajo si no lo has quitado.
                setError("Error al cargar proveedores. Revise la consola del navegador.");
                
                // NOTA: ELIMINA esta línea si ya no necesitas el fallback
                // setProveedores([{ idProveedor: 1, nombre: 'Proveedor Central (Simulado)' }]); 
            }
        };
        fetchInitialData();
    }, []);

    // ... (handleInputChange, handleDetallesChange, handleSubmit se mantienen igual) ...

    const handleInputChange = (e) => {
        const { name, value } = e.target;
        setCompra(prev => ({
            ...prev,
            [name]: name === 'tasaCambio' ? parseFloat(value) || 0 : value
        }));
    };

    const handleDetallesChange = (newDetalles) => {
        setCompra(prev => {
            const totalBase = newDetalles.reduce((sum, detalle) => 
                sum + (parseFloat(detalle.cantidadComprada) * parseFloat(detalle.costoUnitarioMonedaBase)), 0
            );
            
            const totalExt = prev.tasaCambio > 0 ? totalBase / prev.tasaCambio : 0;

            return {
                ...prev,
                detalles: newDetalles,
                totalMonedaBase: totalBase.toFixed(2),
                totalMonedaExt: totalExt.toFixed(4)
            };
        });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        if (!compra.idProveedor) {
            setError("Debe seleccionar un proveedor.");
            setLoading(false);
            return;
        }

        const compraAEnviar = {
            ...compra,
            idProveedor: parseInt(compra.idProveedor),
            tasaCambio: parseFloat(compra.tasaCambio),
            totalMonedaBase: parseFloat(compra.totalMonedaBase),
            totalMonedaExt: parseFloat(compra.totalMonedaExt),
            detalles: compra.detalles.map(d => ({
                codigoProd: d.codigoProd,
                idProductoUnidad: d.idProductoUnidad,
                cantidadComprada: parseFloat(d.cantidadComprada),
                costoUnitarioMonedaBase: parseFloat(d.costoUnitarioMonedaBase),
                costoUnitarioMonedaExt: parseFloat(d.costoUnitarioMonedaExt),
                totalLineaMonedaBase: parseFloat(d.totalLineaMonedaBase),
            }))
        };
        
        try {
            const response = await axios.post(`${API_URL}/Compras`, compraAEnviar);
            alert(`¡Compra registrada con éxito! ID: ${response.data.idCompra}`);
            
            setCompra({ 
                idProveedor: '',
                fechaCompra: new Date().toISOString().split('T')[0],
                tipoMoneda: 'HNL',
                tasaCambio: 1.00,
                totalMonedaBase: 0,
                totalMonedaExt: 0,
                detalles: []
            });
            
        } catch (err) {
            console.error("Error al registrar la compra:", err.response ? err.response.data : err.message);
            const errorMsg = err.response?.data?.title || err.response?.data || err.message;
            setError(`Error: ${errorMsg}`);
            
        } finally {
            setLoading(false);
        }
    };

    // ==========================================================
    // 4. Renderizado (SE APLICAN LAS CORRECCIONES EN EL SELECT)
    // ==========================================================
    return (
        <div className="container mt-4">
            <h2>Registro de Nueva Compra</h2>
            {error && <div className="alert alert-danger">{error}</div>}
            
            <form onSubmit={handleSubmit}>
                {/* Cabecera de la Compra */}
                <div className="card mb-4 p-3">
                    <h5 className="card-title">Datos de la Cabecera</h5>
                    <div className="row g-3">
                        <div className="col-md-6">
                            
                            <label className="form-label" htmlFor="compraProveedor">Proveedor</label>
                            <select 
                                className="form-control"
                                name="idProveedor"
                                id="compraProveedor" 
                                value={compra.idProveedor}
                                onChange={handleInputChange}
                                required
                            >
                                <option value="">Seleccione un Proveedor</option>
                                {/* CORRECCIÓN CRÍTICA: Mapeo de proveedores */}
                                {proveedores.map(prov => (
                                    <option 
                                        key={prov.codigoProv} 
                                        value={prov.codigoProv} // Asumo CodigoProv como el ID
                                    >
                                        {prov.razonsocial} {/* Asumo Razonsocial como el nombre */}
                                    </option>
                                ))}
                                {/* FIN DE CORRECCIÓN */}
                            </select>
                        </div>
                        <div className="col-md-3">
                            <label className="form-label" htmlFor="compraFecha">Fecha</label>
                            <input 
                                type="date"
                                className="form-control"
                                name="fechaCompra"
                                id="compraFecha" 
                                value={compra.fechaCompra}
                                onChange={handleInputChange}
                                required
                            />
                        </div>
                        <div className="col-md-3">
                            <label className="form-label" htmlFor="compraTasa">Tasa de Cambio</label>
                            <input 
                                type="number"
                                step="0.01"
                                className="form-control"
                                name="tasaCambio"
                                id="compraTasa"
                                value={compra.tasaCambio}
                                onChange={handleInputChange}
                                required
                            />
                        </div>
                    </div>
                </div>

                {/* Componente de Detalles (Tabla de Productos) */}
                <DetalleCompra 
                    detalles={compra.detalles} 
                    tasaCambio={compra.tasaCambio}
                    onDetallesChange={handleDetallesChange} 
                />

                {/* Totales y Botón de Envío */}
                <div className="card p-3 mt-4">
                    <h5 className="card-title">Totales</h5>
                    <div className="d-flex justify-content-between">
                        <strong>Total Moneda Base ({compra.tipoMoneda}):</strong>
                        <span>{compra.totalMonedaBase}</span>
                    </div>
                    <div className="d-flex justify-content-between">
                        <strong>Total Moneda Extranjera (USD):</strong>
                        <span>{compra.totalMonedaExt}</span>
                    </div>
                </div>

                <button 
                    type="submit" 
                    className="btn btn-success mt-3 w-100"
                    disabled={loading || compra.detalles.length === 0 || !compra.idProveedor}
                >
                    {loading ? 'Registrando...' : 'Registrar Compra'}
                </button>
            </form>
        </div>
    );
};

export default ComprasForm;