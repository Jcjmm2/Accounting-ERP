import React, { useState, useContext } from 'react';
import { ConfigContext } from '../Context/ConfigContext';

const TasaDeCambio = () => {
    const { API_URL, setTasa } = useContext(ConfigContext);
    const [nuevaTasa, setNuevaTasa] = useState("");
    const [loading, setLoading] = useState(false);

    const guardarTasa = async () => {
        if (!nuevaTasa || nuevaTasa <= 0) return alert("Ingrese una tasa válida");
        
        setLoading(true);
        try {
            const response = await fetch(`${API_URL}/TasaDeCambio/registrar-nueva-tasa`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    valorTasa: parseFloat(nuevaTasa),
                    usuario: "Admin_POS" // O el usuario logueado
                })
            });

            if (response.ok) {
                const data = await response.json();
                setTasa(data.valor); // Actualizamos el estado global inmediatamente
                alert("Tasa actualizada exitosamente");
                setNuevaTasa("");
            }
        } catch (error) {
            console.error("Error al guardar:", error);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="p-6 bg-white rounded-lg shadow-md max-w-md mx-auto mt-10">
            <h2 className="text-2xl font-bold mb-4 text-blue-600">Configuración de Tasa</h2>
            <div className="space-y-4">
                <div>
                    <label className="block text-sm font-medium text-gray-700">Tasa del día (VES/USD)</label>
                    <input 
                        type="number" 
                        value={nuevaTasa}
                        onChange={(e) => setNuevaTasa(e.target.value)}
                        className="mt-1 block w-full border-gray-300 rounded-md shadow-sm p-2 bg-blue-50"
                        placeholder="Ej: 54.20"
                    />
                </div>
                <button 
                    onClick={guardarTasa}
                    disabled={loading}
                    className="w-full bg-blue-600 text-white py-2 rounded-md hover:bg-blue-700 disabled:bg-gray-400"
                >
                    {loading ? "Guardando..." : "Actualizar Tasa"}
                </button>
            </div>
        </div>
    );
};

export default TasaDeCambio;