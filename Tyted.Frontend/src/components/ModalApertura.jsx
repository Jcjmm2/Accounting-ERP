import React, { useState } from 'react';

const ModalApertura = ({ isOpen, onOpenSuccess, API_URL }) => {
    const [montoInicial, setMontoInicial] = useState(0);
    const [cargando, setCargando] = useState(false);

    if (!isOpen) return null;

    const manejarApertura = async () => {
        if (montoInicial < 0) {
            alert("El monto inicial no puede ser negativo");
            return;
        }

        setCargando(true);
        try {
            const res = await fetch(`${API_URL}/Ventas/abrir-caja`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(parseFloat(montoInicial))
            });

            if (res.ok) {
                onOpenSuccess(); // Notifica al POS que ya puede habilitar la venta
            } else {
                const err = await res.text();
                alert(err);
            }
        } catch (error) {
            console.error("Error al abrir caja:", error);
        } finally {
            setCargando(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-gray-900/90 backdrop-blur-md flex items-center justify-center z-[300]">
            <div className="bg-white w-[400px] rounded-3xl p-8 shadow-2xl text-center border-4 border-blue-500">
                <div className="w-20 h-20 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <span className="text-4xl">🔑</span>
                </div>
                
                <h2 className="text-2xl font-black text-gray-800 uppercase italic">Apertura de Turno</h2>
                <p className="text-gray-500 text-sm mb-6">Ingrese el efectivo base para dar cambio (Sencillo)</p>

                <div className="mb-8">
                    <label className="text-[10px] font-black text-gray-400 uppercase block mb-2">Fondo de Caja inicial (USD)</label>
                    <div className="relative">
                        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-2xl font-bold text-gray-400">$</span>
                        <input 
                            type="number" 
                            className="w-full text-4xl font-mono text-center border-b-4 border-gray-100 outline-none focus:border-blue-500 pb-2 pl-8"
                            value={montoInicial}
                            onChange={(e) => setMontoInicial(e.target.value)}
                            autoFocus
                        />
                    </div>
                </div>

                <button 
                    onClick={manejarApertura}
                    disabled={cargando}
                    className={`w-full py-4 rounded-2xl font-black text-white shadow-xl transition-all ${cargando ? 'bg-gray-400' : 'bg-blue-600 hover:bg-blue-700 active:scale-95'}`}
                >
                    {cargando ? 'PROCESANDO...' : 'INICIAR OPERACIONES'}
                </button>
            </div>
        </div>
    );
};

export default ModalApertura;