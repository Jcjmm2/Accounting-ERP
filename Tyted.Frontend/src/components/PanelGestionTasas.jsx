import React, { useState, useEffect } from 'react';
import axios from 'axios';

const PanelGestionTasas = ({ API_URL }) => {
    
    // ======================================
    // 1. ESTADOS
    // ======================================
    const [tasaVigente, setTasaVigente] = useState(null);
    const [historialTasas, setHistorialTasas] = useState([]);
    const [nuevaTasa, setNuevaTasa] = useState(''); // Input para la nueva tasa
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [successMessage, setSuccessMessage] = useState(null);

    // ======================================
    // 2. FUNCIÓN DE CARGA DE DATOS (Fetch)
    // ======================================
    const fetchTasas = async () => {
        setLoading(true);
        setError(null);

        try {
            // A. Obtener la tasa vigente
            const vigenteResponse = await axios.get(`${API_URL}/TasasDeCambio/vigente`);
            setTasaVigente(vigenteResponse.data);

            // B. Obtener el historial completo
            const historialResponse = await axios.get(`${API_URL}/TasasDeCambio`);
            setHistorialTasas(historialResponse.data);

        } catch (err) {
            setError('Error al cargar la tasa de cambio o historial. Verifique el Backend.');
            console.error('Error fetching tasas:', err);
        } finally {
            setLoading(false);
        }
    };

    // Cargar datos al montar el componente
    useEffect(() => {
        fetchTasas();
    }, [API_URL]);

    // ======================================
    // 3. HANDLERS (Registro de Nueva Tasa)
    // ======================================
    const handleRegisterTasa = async (e) => {
        e.preventDefault();
        setError(null);
        setSuccessMessage(null);
        
        const tasaNumerica = parseFloat(nuevaTasa);
        if (isNaN(tasaNumerica) || tasaNumerica <= 0) {
            setError('Por favor, ingrese un valor de tasa válido y positivo.');
            return;
        }

        const tasaData = {
            tasa: tasaNumerica,
            // Las propiedades FechaVigencia, MonedaOrigen y MonedaDestino
            // serán manejadas/forzadas por el Backend
        };

        try {
            await axios.post(`${API_URL}/TasasDeCambio`, tasaData);
            
            setSuccessMessage(`¡Tasa de ${tasaNumerica.toFixed(4)} registrada con éxito!`);
            setNuevaTasa(''); // Limpiar el input
            fetchTasas(); // Recargar la lista y la tasa vigente

        } catch (err) {
            setError('Error al registrar la nueva tasa. Consulte la consola para detalles.');
            console.error('Error registering new tasa:', err);
        }
    };

    // ======================================
    // 4. RENDERIZADO
    // ======================================
    if (loading) return <h2>Cargando información de Tasas de Cambio...</h2>;

    // Formateo de fecha y tasa para la UI
    const formatDate = (dateString) => {
        const date = new Date(dateString);
        return date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
    };
    
    // Función para formatear la tasa
    const formatTasa = (tasa) => parseFloat(tasa).toFixed(4);
    
    return (
        <div style={{ padding: '20px' }}>
            <h2>Gestión de Tasa de Cambio (VES/USD)</h2>

            {error && <div className="alert alert-danger">{error}</div>}
            {successMessage && <div className="alert alert-success">{successMessage}</div>}

            {/* ------------------ TASA VIGENTE ------------------ */}
            <div style={{ border: '2px solid #007bff', padding: '15px', marginBottom: '30px', borderRadius: '8px', backgroundColor: '#e9f7fe' }}>
                <h3>Tasa Vigente Actual</h3>
                {tasaVigente ? (
                    <div style={{ fontSize: '1.5em', fontWeight: 'bold' }}>
                        1 {tasaVigente.monedaOrigen} = 
                        <span style={{ color: '#007bff', marginLeft: '10px' }}>
                             {formatTasa(tasaVigente.tasa)} {tasaVigente.monedaDestino}
                        </span>
                        <p style={{ fontSize: '0.8em', fontWeight: 'normal', color: '#666', marginTop: '5px' }}>
                            (Vigente desde: {formatDate(tasaVigente.fechaVigencia)})
                        </p>
                    </div>
                ) : (
                    <p style={{ color: '#856404' }}>No hay tasas registradas. Por favor, registre la primera tasa.</p>
                )}
            </div>
            
            {/* ------------------ REGISTRO DE NUEVA TASA ------------------ */}
            <div style={{ border: '1px solid #28a745', padding: '15px', marginBottom: '30px', borderRadius: '8px', backgroundColor: '#e6ffef' }}>
                <h4>Registrar Nueva Tasa (USD a VES)</h4>
                <form onSubmit={handleRegisterTasa} style={{ display: 'flex', gap: '15px', alignItems: 'center' }}>
                    <label>
                        1 USD = 
                        <input 
                            type="number" 
                            step="0.0001" 
                            value={nuevaTasa}
                            onChange={(e) => setNuevaTasa(e.target.value)}
                            placeholder="Ej: 36.5000"
                            required
                            style={{ marginLeft: '5px', width: '150px' }}
                        /> 
                        VES
                    </label>
                    <button type="submit" className="btn btn-success">
                        Registrar Tasa
                    </button>
                </form>
            </div>

            {/* ------------------ HISTORIAL DE TASAS ------------------ */}
            <div style={{ marginTop: '30px' }}>
                <h4>Historial de Tasas Registradas</h4>
                {historialTasas.length > 0 ? (
                    <table className="table" style={{ width: '600px', marginTop: '10px' }}>
                        <thead>
                            <tr>
                                <th>Fecha Vigencia</th>
                                <th>Tasa (VES/USD)</th>
                                <th>Moneda Origen/Destino</th>
                            </tr>
                        </thead>
                        <tbody>
                            {historialTasas.map((tasa) => (
                                <tr key={tasa.idTasa}>
                                    <td>{formatDate(tasa.fechaVigencia)}</td>
                                    <td>{formatTasa(tasa.tasa)}</td>
                                    <td>{tasa.monedaOrigen} / {tasa.monedaDestino}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                ) : (
                    <p>No hay historial de tasas disponible.</p>
                )}
            </div>
        </div>
    );
};

export default PanelGestionTasas;