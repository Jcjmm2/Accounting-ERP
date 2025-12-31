import React, { useState, useEffect, useContext } from 'react';
import { ConfigContext } from '../Context/ConfigContext';

const ModalArqueo = ({ isOpen, onClose, API_URL }) => {
    const { tasa } = useContext(ConfigContext);
    const [datosSistema, setDatosSistema] = useState({ sistemaUSD: 0, sistemaPM: 0 });
    const [declarado, setDeclarado] = useState({
        efectivoUSD: 0,
        efectivoVES: 0,
        pagoMovilVES: 0
    });
    const [observaciones, setObservaciones] = useState("");
    const [resultado, setResultado] = useState(null);
    const [cargando, setCargando] = useState(false);

    // Cargar datos esperados del sistema al abrir
    useEffect(() => {
        if (isOpen) {
            obtenerTotalesSistema();
        }
    }, [isOpen]);

    const obtenerTotalesSistema = async () => {
        try {
            const res = await fetch(`${API_URL}/Ventas/totales-sistema-hoy`);
            if (res.ok) {
                const data = await res.json();
                setDatosSistema(data);
            }
        } catch (e) { console.error("Error sistema:", e); }
    };

    // Conversiones automáticas
    const efectivoVESenUSD = declarado.efectivoVES / tasa;
    const pagoMovilUSDEquivalente = declarado.pagoMovilVES / tasa;
    const totalEfectivoFinalUSD = declarado.efectivoUSD + efectivoVESenUSD;

    if (!isOpen) return null;

    // Función de impresión mejorada
    const imprimirArqueo = (data, declaUSD, declaPM, obs) => {
        const ventana = window.open('', 'PRINT', 'height=600,width=400');
        ventana.document.write(`
            <html>
                <head><style>body { font-family: 'Courier New', monospace; font-size: 12px; padding: 20px; width: 300px; } .text-center { text-align: center; } .bold { font-weight: bold; } .hr { border-top: 1px dashed black; margin: 10px 0; }</style></head>
                <body onload="window.print(); window.close();">
                    <div class="text-center bold">*** REPORTE DE CIERRE ***</div>
                    <div class="hr"></div>
                    <div>SISTEMA (ESPERADO):</div>
                    <div>USD: $${(data.esperadoUSD || 0).toFixed(2)}</div>
                    <div>PM: $${(data.esperadoVES || 0).toFixed(2)}</div>
                    <div class="hr"></div>
                    <div>DECLARADO:</div>
                    <div>Fisico Total: $${declaUSD.toFixed(2)}</div>
                    <div>Pago Móvil: $${declaPM.toFixed(2)}</div>
                    <div class="hr"></div>
                    <div class="bold">DIFERENCIAS:</div>
                    <div>USD: $${(data.diferenciaUSD || 0).toFixed(2)}</div>
                    <div>PM: $${(data.diferenciaVES || 0).toFixed(2)}</div>
                    <div class="bold text-center">ESTADO: ${data.estado?.toUpperCase()}</div>
                    <div class="hr"></div>
                    ${obs ? `<div>OBS: ${obs}</div><div class="hr"></div>` : ''}
                    <div class="text-center">FIN DEL REPORTE</div>
                </body>
            </html>
        `);
        ventana.document.close();
    };

    const procesarArqueo = async () => {
        try {
            const res = await fetch(`${API_URL}/Ventas/consultar-cuadre-caja`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    usuario: "CAJERO_PRINCIPAL",
                    efectivoUSDDeclarado: totalEfectivoFinalUSD,
                    pagoMovilDeclarado: pagoMovilUSDEquivalente,
                })
            });
            if (res.ok) {
                const data = await res.json();
                setResultado(data);
            }
        } catch (e) { alert("Error al consultar diferencias."); }
    };

    const finalizarCierreDefinitivo = async () => {
        if (!window.confirm("¿CONFIRMAR CIERRE FINAL?")) return;
        setCargando(true);
        try {
            const res = await fetch(`${API_URL}/Ventas/cerrar-caja`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    efectivoUSDDeclarado: totalEfectivoFinalUSD,
                    pagoMovilDeclarado: pagoMovilUSDEquivalente,
                    observaciones: observaciones 
                })
            });
            if (res.ok) {
                imprimirArqueo(resultado, totalEfectivoFinalUSD, pagoMovilUSDEquivalente, observaciones);
                window.location.href = "/"; 
            }
        } catch (error) { alert("Error crítico al cerrar."); setCargando(false); }
    };

    return (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[200] p-4 backdrop-blur-sm">
            <div className="bg-white w-full max-w-[500px] rounded-2xl p-6 shadow-2xl overflow-y-auto max-h-[90vh]">
                <h2 className="text-xl font-black mb-4 uppercase italic border-b pb-2">Arqueo de Caja</h2>
                
                {/* INFO DEL SISTEMA */}
                <div className="grid grid-cols-2 gap-3 mb-4">
                    <div className="bg-blue-50 p-2 rounded-lg border border-blue-100">
                        <p className="text-[9px] font-bold text-blue-500 uppercase">Esperado Efectivo</p>
                        <p className="font-mono font-bold text-blue-700">${datosSistema.sistemaUSD.toFixed(2)}</p>
                    </div>
                    <div className="bg-purple-50 p-2 rounded-lg border border-purple-100">
                        <p className="text-[9px] font-bold text-purple-500 uppercase">Esperado P. Móvil</p>
                        <p className="font-mono font-bold text-purple-700">${datosSistema.sistemaPM.toFixed(2)}</p>
                    </div>
                </div>

                <div className="space-y-4">
                    {/* EFECTIVO USD */}
                    <div className="bg-gray-50 p-3 rounded-lg border border-gray-200">
                        <label className="text-[10px] font-black text-gray-400 block uppercase">Efectivo Físico ($)</label>
                        <input type="number" className="w-full text-2xl font-mono outline-none bg-transparent" 
                               value={declarado.efectivoUSD} onChange={e => setDeclarado({...declarado, efectivoUSD: parseFloat(e.target.value) || 0})} />
                    </div>

                    {/* EFECTIVO BS */}
                    <div className="bg-yellow-50/50 p-3 rounded-lg border border-yellow-200">
                        <label className="text-[10px] font-black text-yellow-600 block uppercase">Efectivo en Bolívares (Bs.)</label>
                        <input type="number" className="w-full text-xl font-mono outline-none bg-transparent" 
                               placeholder="Monto en Bs." onChange={e => setDeclarado({...declarado, efectivoVES: parseFloat(e.target.value) || 0})} />
                        <p className="text-[10px] text-right text-yellow-700 font-bold italic">+ ${efectivoVESenUSD.toFixed(2)} USD</p>
                    </div>

                    {/* PAGO MÓVIL BS */}
                    <div className="bg-blue-50/50 p-3 rounded-lg border border-blue-200">
                        <label className="text-[10px] font-black text-blue-600 block uppercase">Pago Móvil Recibido (Bs.)</label>
                        <input type="number" className="w-full text-xl font-mono outline-none bg-transparent" 
                               placeholder="Monto en Bs." onChange={e => setDeclarado({...declarado, pagoMovilVES: parseFloat(e.target.value) || 0})} />
                        <p className="text-[10px] text-right text-blue-700 font-bold italic">Suman: ${pagoMovilUSDEquivalente.toFixed(2)} USD</p>
                    </div>

                    {!resultado ? (
                        <button onClick={procesarArqueo} className="w-full bg-blue-600 text-white font-bold py-3 rounded-xl uppercase shadow-md hover:bg-blue-700">
                            Calcular Diferencias
                        </button>
                    ) : (
                        <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2">
                            <div className={`p-3 rounded-xl font-black text-center border-2 ${resultado.estado === 'Cuadrado' ? 'bg-green-100 border-green-500 text-green-700' : 'bg-red-100 border-red-500 text-red-700'}`}>
                                ESTADO: {resultado.estado?.toUpperCase()}
                            </div>
                            <div className="grid grid-cols-2 gap-2 text-xs font-mono bg-gray-100 p-2 rounded-lg">
                                <span>Dif. Efectivo:</span> <span className={`text-right ${resultado.diferenciaUSD < 0 ? 'text-red-600' : 'text-green-600'}`}>${resultado.diferenciaUSD?.toFixed(2)}</span>
                                <span>Dif. P. Móvil:</span> <span className={`text-right ${resultado.diferenciaVES < 0 ? 'text-red-600' : 'text-green-600'}`}>${resultado.diferenciaVES?.toFixed(2)}</span>
                            </div>
                            <textarea className="w-full p-2 border rounded-lg text-sm bg-yellow-50" placeholder="Observaciones..." value={observaciones} onChange={e => setObservaciones(e.target.value)} rows="2" />
                            <button onClick={finalizarCierreDefinitivo} disabled={cargando} className="w-full bg-red-600 text-white font-black py-4 rounded-xl shadow-lg hover:bg-red-700">
                                {cargando ? "PROCESANDO..." : "🔒 CONFIRMAR Y CERRAR TURNO"}
                            </button>
                            </div>
                    )}
                </div>
                <button onClick={onClose} className="mt-4 w-full text-gray-400 text-xs font-bold uppercase hover:text-gray-600">Cancelar</button>
            </div>
        </div>
    );
};

export default ModalArqueo;