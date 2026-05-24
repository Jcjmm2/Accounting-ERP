import React, { useState, useContext } from 'react';
import { ConfigContext } from '../Context/ConfigContext';

const TasaDeCambio = () => {
    const { API_URL, setTasa } = useContext(ConfigContext);
    const getAuthHeaders = () => ({
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem("token")}`
    });
    
    // Estados para los valores nominales en VES que el usuario ve en la calle
    const [tasaUSDT, setTasaUSDT] = useState(""); 
    const [tasaEfectivo, setTasaEfectivo] = useState("");
    const [tasaBCV, setTasaBCV] = useState("");
    const [loading, setLoading] = useState(false);

    const registrarSistemaTasas = async () => {
        const valUSDT = parseFloat(tasaUSDT);
        const valEfectivo = parseFloat(tasaEfectivo);
        const valBCV = parseFloat(tasaBCV);

        if (!valUSDT || !valEfectivo || !valBCV) {
            return alert("Por favor, complete las tres tasas para sincronizar el sistema.");
        }

        setLoading(true);
        try {
            // CÁLCULO INTERNO DE FACTORES
            // El factor es la relación: Tasa Destino / Tasa Base (USDT)
            // Esto define qué porción de 1 USDT representa cada moneda
            const factorEfectivoCalculado = (valEfectivo / valUSDT).toFixed(4);
            const factorBCVCalculado = (valBCV / valUSDT).toFixed(4);

            const configuracion = [
                { 
                    nombre: "USDT", 
                    valor: valUSDT, 
                    origen: "1.00" 
                },
                { 
                    nombre: "Efectivo USD", 
                    valor: valEfectivo, 
                    origen: factorEfectivoCalculado.toString() 
                },
                { 
                    nombre: "BCV", 
                    valor: valBCV, 
                    origen: factorBCVCalculado.toString() 
                }
            ];

            for (const t of configuracion) {
                await fetch(`${API_URL}/TasaDeCambio/registrar-nueva-tasa`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
                    body: JSON.stringify({
                        valorTasa: t.valor,
                        nombreTasa: t.nombre,
                        monedaOrigen: t.origen, // Se guarda el factor calculado internamente
                        monedaDestino: "VES",
                        usuario: "Admin_POS"
                    })
                });
            }

            setTasa(valUSDT); 
            alert(`✅ Sistema actualizado.\nFactores calculados:\nEfectivo: ${factorEfectivoCalculado}\nBCV: ${factorBCVCalculado}`);
            
            // Limpiar campos
            setTasaUSDT(""); setTasaEfectivo(""); setTasaBCV("");
        } catch (error) {
            alert("Error al sincronizar con el servidor");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="p-6 bg-white rounded-xl shadow-lg max-w-md mx-auto mt-10 border-t-8 border-blue-600">
            <h2 className="text-xl font-bold text-gray-800 mb-2 text-center">Actualización de Tasas</h2>
            <p className="text-xs text-gray-500 text-center mb-6">Ingrese el valor actual en VES para cada tipo de cambio</p>
            
            <div className="space-y-4">
                {/* Entrada USDT */}
                <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
                    <label className="block text-[10px] font-black text-blue-600 uppercase">Tasa USDT (Base)</label>
                    <input 
                        type="number" value={tasaUSDT}
                        onChange={(e) => setTasaUSDT(e.target.value)}
                        className="w-full text-2xl font-mono bg-transparent outline-none"
                        placeholder="0.00"
                    />
                </div>

                {/* Entrada Efectivo */}
                <div className="p-3 bg-green-50 rounded-lg border border-green-200">
                    <label className="block text-[10px] font-black text-green-600 uppercase">Tasa Dólar Efectivo</label>
                    <input 
                        type="number" value={tasaEfectivo}
                        onChange={(e) => setTasaEfectivo(e.target.value)}
                        className="w-full text-2xl font-mono bg-transparent outline-none"
                        placeholder="0.00"
                    />
                </div>

                {/* Entrada BCV */}
                <div className="p-3 bg-orange-50 rounded-lg border border-orange-200">
                    <label className="block text-[10px] font-black text-orange-600 uppercase">Tasa BCV</label>
                    <input 
                        type="number" value={tasaBCV}
                        onChange={(e) => setTasaBCV(e.target.value)}
                        className="w-full text-2xl font-mono bg-transparent outline-none"
                        placeholder="0.00"
                    />
                </div>

                <button 
                    onClick={registrarSistemaTasas}
                    disabled={loading || !tasaUSDT || !tasaEfectivo || !tasaBCV}
                    className="w-full py-4 bg-blue-600 text-white rounded-lg font-bold hover:bg-blue-700 disabled:bg-gray-300 transition-all"
                >
                    {loading ? "PROCESANDO..." : "ACTUALIZAR SISTEMA"}
                </button>
            </div>
        </div>
    );
};

export default TasaDeCambio;