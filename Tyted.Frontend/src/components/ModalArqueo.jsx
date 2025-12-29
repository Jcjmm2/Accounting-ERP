import React, { useState, useEffect } from 'react';

// Sub-componente Reporte con protección contra nulos
const ReporteProductos = ({ API_URL }) => {
    const [datos, setDatos] = useState([]);

    useEffect(() => {
        fetch(`${API_URL}/Ventas/reporte-productos`)
            .then(res => res.json())
            .then(data => setDatos(data))
            .catch(err => console.error("Error reporte:", err));
    }, [API_URL]);

    return (
        <div className="mt-4 bg-gray-50 rounded-xl overflow-hidden border border-gray-200">
            <div className="bg-gray-100 p-2 text-[10px] font-black text-gray-500 uppercase italic">Resumen de Artículos Vendidos</div>
            <table className="w-full text-xs">
                <tbody>
                    {datos.map((item, i) => (
                        <tr key={i} className="border-t bg-white">
                            <td className="p-2 font-bold">{item.codigo}</td>
                            <td className="p-2 text-center">{(item.cantidadTotal || 0).toFixed(3)} {item.unidad}</td>
                            <td className="p-2 text-right font-mono text-blue-600">${(item.totalUSD || 0).toFixed(2)}</td>
                        </tr>
                    ))}
                    {datos.length === 0 && (
                        <tr><td colSpan="3" className="p-4 text-center text-gray-400 italic">No hay ventas registradas.</td></tr>
                    )}
                </tbody>
            </table>
        </div>
    );
};

const ModalArqueo = ({ isOpen, onClose, API_URL }) => {
    const [declarado, setDeclarado] = useState({ usd: 0, pagoMovil: 0 });
    const [observaciones, setObservaciones] = useState("");
    const [resultado, setResultado] = useState(null);
    const [cargando, setCargando] = useState(false);

    if (!isOpen) return null;

    // 1. FUNCIÓN DE IMPRESIÓN (Protección contra 'toFixed' de valores indefinidos)
    const imprimirArqueo = (data, decla, obs) => {
        if (!data) return;
        const ventana = window.open('', 'PRINT', 'height=600,width=400');
        if (!ventana) return;

        // Se usa || 0 en todas las propiedades numéricas
        const espUSD = data.esperadoUSD || 0;
        const espVES = data.esperadoVES || 0;
        const difUSD = data.diferenciaUSD || 0;
        const difVES = data.diferenciaVES || 0;
        const estado = data.estado || "Desconocido";

        ventana.document.write(`
            <html>
                <head>
                    <style>
                        body { font-family: 'Courier New', monospace; font-size: 12px; padding: 20px; width: 300px; }
                        .text-center { text-align: center; }
                        .bold { font-weight: bold; }
                        .hr { border-top: 1px dashed black; margin: 10px 0; }
                    </style>
                </head>
                <body onload="window.print(); window.close();">
                    <div class="text-center bold">*** REPORTE DE CIERRE ***</div>
                    <div class="hr"></div>
                    <div>SISTEMA (ESPERADO):</div>
                    <div>USD: $${espUSD.toFixed(2)}</div>
                    <div>PM: $${espVES.toFixed(2)}</div>
                    <div class="hr"></div>
                    <div>DECLARADO:</div>
                    <div>Físico USD: $${parseFloat(decla.usd || 0).toFixed(2)}</div>
                    <div>Pago Móvil: $${parseFloat(decla.pagoMovil || 0).toFixed(2)}</div>
                    <div class="hr"></div>
                    <div class="bold">DIFERENCIAS:</div>
                    <div>USD: $${difUSD.toFixed(2)}</div>
                    <div>PM: $${difVES.toFixed(2)}</div>
                    <div class="bold text-center">ESTADO: ${estado.toUpperCase()}</div>
                    <div class="hr"></div>
                    ${obs ? `<div>OBS: ${obs}</div><div class="hr"></div>` : ''}
                    <div class="text-center">FIN DEL REPORTE</div>
                </body>
            </html>
        `);
        ventana.document.close();
    };

    // 2. CONSULTAR CUADRE
    const procesarArqueo = async () => {
        try {
            const res = await fetch(`${API_URL}/Ventas/consultar-cuadre-caja`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    usuario: "CAJERO_PRINCIPAL",
                    efectivoUSDDeclarado: parseFloat(declarado.usd) || 0,
                    pagoMovilDeclarado: parseFloat(declarado.pagoMovil) || 0,
                })
            });
            if (res.ok) {
                const data = await res.json();
                setResultado(data);
            } else {
                alert("Error al obtener el cuadre del servidor.");
            }
        } catch (e) {
            alert("Error de conexión al calcular diferencias.");
        }
    };

    // 3. CIERRE DEFINITIVO (Evita pantalla blanca con redirección limpia)
    const finalizarCierreDefinitivo = async () => {
        if (!resultado) {
            alert("⚠️ Debes hacer clic en 'CALCULAR DIFERENCIAS' primero.");
            return;
        }

        if (!window.confirm("¿CONFIRMAR CIERRE FINAL? El sistema se reiniciará.")) return;

        setCargando(true);
        try {
            const res = await fetch(`${API_URL}/Ventas/cerrar-caja`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    efectivoUSDDeclarado: parseFloat(declarado.usd) || 0,
                    pagoMovilDeclarado: parseFloat(declarado.pagoMovil) || 0,
                    observaciones: observaciones 
                })
            });

            if (res.ok) {
                imprimirArqueo(resultado, declarado, observaciones);
                alert("✅ CAJA CERRADA EXITOSAMENTE");
                
                // REDIRECCIÓN LIMPIA: Evita la pantalla blanca al forzar carga de ruta raíz
                window.location.href = "/"; 
            } else {
                alert("El servidor rechazó el cierre. Verifique los datos.");
                setCargando(false);
            }
        } catch (error) {
            alert("Error crítico de red al intentar cerrar.");
            setCargando(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[200] p-4 backdrop-blur-sm">
            <div className="bg-white w-full max-w-[500px] rounded-2xl p-6 shadow-2xl overflow-y-auto max-h-[90vh]">
                <h2 className="text-xl font-black mb-4 uppercase italic">Arqueo de Caja</h2>
                
                <div className="space-y-4">
                    <div className="bg-gray-50 p-3 rounded-lg border border-gray-200">
                        <label className="text-[10px] font-black text-gray-400 block uppercase italic">Efectivo USD ($)</label>
                        <input type="number" className="w-full text-2xl font-mono outline-none bg-transparent" 
                               value={declarado.usd} onChange={e => setDeclarado({...declarado, usd: e.target.value})} />
                    </div>

                    <div className="bg-gray-50 p-3 rounded-lg border border-gray-200">
                        <label className="text-[10px] font-black text-gray-400 block uppercase italic">Pago Móvil USD ($)</label>
                        <input type="number" className="w-full text-2xl font-mono outline-none bg-transparent" 
                               value={declarado.pagoMovil} onChange={e => setDeclarado({...declarado, pagoMovil: e.target.value})} />
                    </div>

                    {!resultado ? (
                        <button onClick={procesarArqueo} className="w-full bg-blue-600 text-white font-bold py-3 rounded-xl uppercase shadow-md hover:bg-blue-700 transition-colors">
                            Calcular Diferencias
                        </button>
                    ) : (
                        <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
                            <div className={`p-3 rounded-xl font-black text-center border-2 ${resultado.estado === 'Cuadrado' ? 'bg-green-100 border-green-200 text-green-700' : 'bg-red-100 border-red-200 text-red-700'}`}>
                                ESTADO: {resultado.estado?.toUpperCase()}
                            </div>
                            
                            <textarea 
                                className="w-full p-2 border rounded-lg text-sm bg-yellow-50 outline-none"
                                placeholder="Notas u observaciones del cierre..."
                                value={observaciones}
                                onChange={e => setObservaciones(e.target.value)}
                                rows="2"
                            />

                            <button onClick={finalizarCierreDefinitivo} disabled={cargando} className="w-full bg-red-600 text-white font-black py-4 rounded-xl shadow-lg hover:bg-red-700 transition-all">
                                {cargando ? "PROCESANDO..." : "🔒 CONFIRMAR Y CERRAR TURNO"}
                            </button>

                            <ReporteProductos API_URL={API_URL} />
                        </div>
                    )}
                </div>
                <button onClick={onClose} className="mt-4 w-full text-gray-400 text-xs font-bold uppercase hover:text-gray-600 transition-colors">
                    Cancelar y Volver
                </button>
            </div>
        </div>
    );
};

export default ModalArqueo;