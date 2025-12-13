import React, { useState, useEffect } from 'react';
import axios from 'axios';

const TasaDeCambio = ({ API_URL }) => {
    // Estado para la tasa actual y el formulario de nueva tasa
    const [tasaActual, setTasaActual] = useState(null);
    const [nuevaTasa, setNuevaTasa] = useState('');
    const [message, setMessage] = useState('');
    const [loading, setLoading] = useState(true);

    // 1. Obtener la última tasa registrada
    const fetchTasaActual = async () => {
        setLoading(true);
        try {
            // CORRECCIÓN APLICADA AQUÍ: 
            // 1. Cambiado de /TasaDeCambio a /TasasDeCambio (Plural)
            // 2. Cambiado de /ultima a /vigente (Nombre de la acción en C#)
            const response = await axios.get(`${API_URL}/TasasDeCambio/vigente`); 
            
            // Nota: En C# la propiedad se llama Tasa, pero en el frontend usas valorTasa.
            // Es posible que el objeto de C# solo tenga la propiedad Tasa, no valorTasa.
            // Ajustaré la línea de abajo usando la propiedad Tasa que sí existe en el modelo.
            
            setTasaActual(response.data);
            
            // CORRECCIÓN ADICIONAL: Usar la propiedad 'Tasa' del modelo C#
            // El modelo C# tiene una propiedad llamada Tasa (decimal), no valorTasa.
            setNuevaTasa(response.data.tasa.toString()); 
            
            setMessage('');
        } catch (error) {
            // El mensaje de error también se corrige para la nueva ruta.
            setMessage('Error al cargar la tasa actual. Asegúrese de que el endpoint /TasasDeCambio/vigente esté implementado.');
            setTasaActual(null);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchTasaActual();
    }, []);

    // 2. Manejar el registro de la nueva tasa
    const handleSaveTasa = async (e) => {
        e.preventDefault();
        
        if (!nuevaTasa || isNaN(parseFloat(nuevaTasa))) {
            setMessage('Por favor, ingrese un valor numérico válido para la tasa.');
            return;
        }

        const tasaData = {
            // CORRECCIÓN ADICIONAL: Usar la propiedad 'Tasa' del modelo C#
            // El modelo C# tiene una propiedad llamada Tasa, no valorTasa.
            Tasa: parseFloat(nuevaTasa),
            // La fecha se establecerá en el backend con la hora local de Venezuela
        };

        try {
            // CORRECCIÓN APLICADA AQUÍ: 
            // Cambiado de /TasaDeCambio a /TasasDeCambio (Plural)
            await axios.post(`${API_URL}/TasasDeCambio`, tasaData);
            setMessage('✅ Nueva tasa registrada con éxito.');
            setNuevaTasa('');
            fetchTasaActual(); // Recarga para ver la nueva tasa
        } catch (error) {
            console.error("Error al registrar la tasa:", error);
            setMessage('❌ Error al registrar la tasa. Verifique el servidor.');
        }
    };

    if (loading) {
        return <h2>Cargando Tasa de Cambio...</h2>;
    }

    return (
        <div style={{ maxWidth: '600px', margin: '0 auto', padding: '20px', border: '1px solid #ddd', borderRadius: '8px' }}>
            <h2>Gestión de Tasa de Cambio (VES/USD)</h2>
            
            {tasaActual && (
                <div style={{ marginBottom: '20px', padding: '15px', border: '1px solid #007bff', borderRadius: '5px', backgroundColor: '#e9f5ff' }}>
                    <h4>Tasa de Cambio Actual:</h4>
                    <p>
                        {/* CORRECCIÓN ADICIONAL: Usar la propiedad 'Tasa' del modelo C# */}
                        <strong>1 USD = {tasaActual.tasa.toFixed(2)} VES</strong>
                    </p>
                    <p style={{ fontSize: '0.9em', color: '#555' }}>
                        {/* CORRECCIÓN ADICIONAL: Usar la propiedad 'FechaVigencia' del modelo C# */}
                        *Vigente desde: {new Date(tasaActual.fechaVigencia).toLocaleDateString()}*
                    </p>
                </div>
            )}

            <h3>Registrar Nueva Tasa</h3>
            <form onSubmit={handleSaveTasa}>
                <div style={{ marginBottom: '15px' }}>
                    <label htmlFor="nuevaTasa" style={{ display: 'block', marginBottom: '5px' }}>
                        Valor de la Tasa (VES por 1 USD):
                    </label>
                    <input
                        id="nuevaTasa"
                        type="number"
                        step="0.01"
                        value={nuevaTasa}
                        onChange={(e) => setNuevaTasa(e.target.value)}
                        required
                        style={{ width: '100%', padding: '8px', boxSizing: 'border-box' }}
                    />
                </div>
                
                <button type="submit" className="btn btn-primary">
                    Guardar Tasa
                </button>
            </form>

            {message && (
                <div 
                    style={{ marginTop: '20px', padding: '10px', borderRadius: '4px', backgroundColor: message.includes('✅') ? '#d4edda' : '#f8d7da', color: message.includes('✅') ? '#155724' : '#721c24' }}
                >
                    {message}
                </div>
            )}
        </div>
    );
};

export default TasaDeCambio;