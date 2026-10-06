import React, { useState, useContext } from 'react';
import { ConfigContext } from '../Context/ConfigContext';

const ArqueoCaja = () => {
    const { API_URL } = useContext(ConfigContext);
    const [declarado, setDeclarado] = useState({ usd: 0, ves: 0 });
    const [resultado, setResultado] = useState(null);
    const [error, setError] = useState(null);
    // --- FUNCIÓN PARA OBTENER HEADERS CON TOKEN ---
    const getAuthHeaders = () => {
        const token = localStorage.getItem('token');
        return {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        };
    };

const procesarArqueo = async () => {
        try {
            setError(null);
            
            // 1. Obtener el nombre de usuario real del localStorage o del contexto de auth
            // Si guardas el objeto usuario al loguearte, extráelo de ahí.
            const usernameActivo = localStorage.getItem('username') || "Usuario Desconocido";

            const payload = {
                usuario: usernameActivo, // Dinamizado con el usuario real
                efectivoUSDDeclarado: parseFloat(declarado.usd) || 0,
                efectivoVESDeclarado: parseFloat(declarado.ves) || 0,
                pagoMovilDeclarado: parseFloat(declarado.pagoMovil) || 0,
                observaciones: `Cierre de caja efectuado por ${usernameActivo}` 
            };

            const res = await fetch(`${API_URL}/Ventas/consultar-cuadre-caja`, {
                method: 'POST',
                headers: getAuthHeaders(), // AGREGADO: Token de seguridad
                body: JSON.stringify(payload)
            });

            if (res.ok) {
                const data = await res.json();
                setResultado(data);
                alert("✅ Arqueo procesado con éxito");
            } else if (res.status === 401) {
                setError("No autorizado: Tu sesión ha expirado.");
            } else {
                const errorData = await res.text();
                setError("Error en el servidor: " + errorData);
            }
        } catch (error) {
            console.error("Error en arqueo:", error);
            setError("Error de conexión al procesar el cierre.");
        }
    };

    return (
        <div className="p-6 max-w-4xl mx-auto">
            <h1 className="text-2xl font-black mb-6 text-gray-800 uppercase">Cierre de Caja Diario</h1>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                {/* Entradas del Cajero */}
                <div className="bg-white p-6 rounded-2xl shadow-lg border-t-4 border-yellow-500">
                    <h2 className="font-bold text-gray-600 mb-4">CONTEO FÍSICO</h2>
                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-bold text-gray-500">Total Efectivo USD en Caja:</label>
                            <input 
                                type="number" 
                                value={declarado.usd} 
                                onChange={(e) => setDeclarado({...declarado, usd: parseFloat(e.target.value) || 0})}
                                className="w-full text-2xl p-2 border-b-2 border-gray-200 outline-none focus:border-yellow-500 font-mono"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-bold text-gray-500">Total Efectivo VES en Caja:</label>
                            <input 
                                type="number" 
                                value={declarado.ves} 
                                onChange={(e) => setDeclarado({...declarado, ves: parseFloat(e.target.value) || 0})}
                                className="w-full text-2xl p-2 border-b-2 border-gray-200 outline-none focus:border-yellow-500 font-mono"
                            />
                        </div>
                        <button 
                            onClick={procesarArqueo}
                            className="w-full bg-black text-white font-bold py-3 rounded-xl hover:bg-gray-800 transition"
                        >
                            COMPARAR CON SISTEMA
                        </button>
                    </div>
                </div>

                {/* Mensaje de error de conexión/autorización */}
                {error && (
                    <div style={{ gridColumn: '1 / -1', background: '#fee2e2', border: '1px solid #f87171', color: '#b91c1c', padding: '12px 16px', borderRadius: '12px', fontWeight: 'bold' }}>
                        ⚠️ {error}
                    </div>
                )}

                {/* Resultado del Sistema */}
                {resultado && (
                    <div className={`p-6 rounded-2xl shadow-lg text-white ${resultado.diferencias.usd === 0 && resultado.diferencias.ves === 0 ? 'bg-green-600' : 'bg-red-500'}`}>
                        <h2 className="font-bold mb-4 uppercase">Resultado del Cuadre</h2>
                        <div className="space-y-2 font-mono">
                            <div className="flex justify-between border-b border-white/20 pb-1">
                                <span>Sistema USD:</span> <span>${resultado.sistema.usd.toFixed(2)}</span>
                            </div>
                            <div className="flex justify-between border-b border-white/20 pb-1">
                                <span>Diferencia USD:</span> <span>${resultado.diferencias.usd.toFixed(2)}</span>
                            </div>
                            <div className="flex justify-between border-b border-white/20 pb-1 mt-4">
                                <span>Sistema VES:</span> <span>{resultado.sistema.ves.toLocaleString('es-VE')} Bs.</span>
                            </div>
                            <div className="flex justify-between">
                                <span>Diferencia VES:</span> <span>{resultado.diferencias.ves.toLocaleString('es-VE')} Bs.</span>
                            </div>
                        </div>
                        <div className="mt-6 text-center text-xl font-black bg-white/20 py-2 rounded-lg">
                            {resultado.mensaje}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default ArqueoCaja;