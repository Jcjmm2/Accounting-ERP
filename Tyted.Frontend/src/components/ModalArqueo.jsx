import React, { useState, useEffect, useContext } from 'react';
import { ConfigContext } from '../Context/ConfigContext';

// --- 1. COMPONENTE FUERA DEL PRINCIPAL ---
// Esto evita que el input pierda el foco al escribir
const FilaComparacion = ({ titulo, esperado, campo, color, declarado, setDeclarado, autoFocus }) => (
    <div className={`p-3 rounded-xl border-2 mb-2 ${color} transition-all`}>
        <div className="flex justify-between items-center mb-1">
            <span className="text-[10px] font-black uppercase opacity-70">{titulo}</span>
            <span className="text-[10px] font-bold italic text-gray-500">
                Sistema: {esperado.toFixed(2)}
            </span>
        </div>
        <input 
            type="text" 
            inputMode="decimal" 
            autoFocus={autoFocus} // Solo será true para el primer campo
            className="w-full text-xl font-mono outline-none bg-transparent"
            value={declarado[campo]} 
            onChange={e => {
                const val = e.target.value;
                // Permite: vacío, números y un solo punto
                if (val === '' || /^[0-9]*\.?[0-9]*$/.test(val)) {
                    setDeclarado(prev => ({ ...prev, [campo]: val }));
                }
            }}
            onFocus={(e) => e.target.select()} 
            placeholder="0.00"
        />
    </div>
);

const ModalArqueo = ({ isOpen, onClose, API_URL }) => {
    const { tasa } = useContext(ConfigContext);
    
    const [datosSistema, setDatosSistema] = useState({
        sistemaUSD: 0, sistemaVES: 0, sistemaPM: 0,
        sistemaBDV: 0, sistemaBancamiga: 0, sistemaMetal: 0
    });

    const [declarado, setDeclarado] = useState({
        efectivoUSD: "", efectivoVES: "", pagoMovil: "", 
        puntoBDV: "", puntoBancamiga: "", metal: ""
    });

    const [observaciones, setObservaciones] = useState("");
    const [resultado, setResultado] = useState(null);
    const [cargando, setCargando] = useState(false);

    useEffect(() => {
        if (isOpen) {
            obtenerTotalesSistema();
            setResultado(null);
            setObservaciones("");
            setDeclarado({
                efectivoUSD: "", efectivoVES: "", pagoMovil: "",
                puntoBDV: "", puntoBancamiga: "", metal: ""
            });
        }
    }, [isOpen]);

    const obtenerTotalesSistema = async () => {
        try {
            const res = await fetch(`${API_URL}/Ventas/reporte-diario`);
            if (res.ok) {
                const data = await res.json();
                setDatosSistema({
                    sistemaUSD: data.montoEfectivoUSD || 0,
                    sistemaVES: data.montoEfectivoVES || 0,
                    sistemaPM: data.montoPagoMovil || 0,
                    sistemaBDV: data.montoBDV || 0, 
                    sistemaBancamiga: data.montoBancamiga || 0,
                    sistemaMetal: data.montoMetal || 0
                });
            }
        } catch (error) {
            console.error("Error al cargar datos del sistema:", error);
        }
    };

    const procesarArqueo = async () => {
        setCargando(true);
        try {
            const payload = {
                usuario: "CAJERO_PRINCIPAL",
                efectivoUSDDeclarado: parseFloat(declarado.efectivoUSD) || 0,
                efectivoVESDeclarado: parseFloat(declarado.efectivoVES) || 0,
                pagoMovilDeclarado: parseFloat(declarado.pagoMovil) || 0,
                bdvDeclarado: parseFloat(declarado.puntoBDV) || 0,
                bancamigaDeclarado: parseFloat(declarado.puntoBancamiga) || 0,
                metalDeclarado: parseFloat(declarado.metal) || 0,
                observaciones: observaciones 
            };

            const res = await fetch(`${API_URL}/Ventas/consultar-cuadre-caja`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (res.ok) {
                const data = await res.json();
                setResultado(data);
            }
        } catch (error) {
            console.error("Error en arqueo:", error);
        } finally { setCargando(false); }
    };

    const finalizarCierreDefinitivo = async () => {
        if (!window.confirm("¿Está seguro de cerrar el turno?")) return;
        setCargando(true);
        try {
            const payload = {
                usuario: "CAJERO_PRINCIPAL",
                montoCierreEfectivoUSD: parseFloat(declarado.efectivoUSD) || 0,
                montoCierrePagoMovilUSD: (parseFloat(declarado.pagoMovil) || 0) / tasa,
                observacionesCierre: observaciones || "Cierre de turno estándar",
            };

            const res = await fetch(`${API_URL}/Ventas/cerrar-caja`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (res.ok) {
            // EN LUGAR DE RELOAD, ACTIVAMOS LA VISTA DE ÉXITO
            setCierreRealizado(true); 
            } else {
               alert("Error al procesar el cierre en el servidor.");
           }
       } catch (e) {
           alert("Error de conexión.");
       } finally { setCargando(false); }
    };
    
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-[200] p-4 backdrop-blur-sm">
            <div className="bg-white w-full max-w-[500px] rounded-2xl p-6 shadow-2xl overflow-y-auto max-h-[95vh]">
                <div className="flex justify-between items-center mb-4 border-b pb-2">
                    <h2 className="text-xl font-black uppercase italic">Arqueo de Turno</h2>
                    <div className="text-right">
                        <p className="text-[10px] font-bold text-gray-400">TASA</p>
                        <p className="font-black text-blue-600">{tasa} Bs/$</p>
                    </div>
                </div>

                <div className="grid grid-cols-1 gap-1">
                    {/* Aquí controlamos quién tiene el autoFocus inicial */}
                    <FilaComparacion 
                        titulo="Efectivo Dólares ($)" 
                        esperado={datosSistema.sistemaUSD} 
                        campo="efectivoUSD" 
                        color="bg-green-50 border-green-100 focus-within:border-green-400"
                        declarado={declarado}
                        setDeclarado={setDeclarado}
                        autoFocus={true} // El primero inicia con foco
                    />
                    <FilaComparacion 
                        titulo="Efectivo Bolívares (Bs)" 
                        esperado={datosSistema.sistemaVES} 
                        campo="efectivoVES" 
                        color="bg-yellow-50 border-yellow-100 focus-within:border-yellow-400"
                        declarado={declarado}
                        setDeclarado={setDeclarado}
                        autoFocus={false}
                    />
                    <FilaComparacion 
                        titulo="Pago Móvil (Bs)" 
                        esperado={datosSistema.sistemaPM} 
                        campo="pagoMovil" 
                        color="bg-purple-50 border-purple-100 focus-within:border-purple-400"
                        declarado={declarado}
                        setDeclarado={setDeclarado}
                        autoFocus={false}
                    />
                    <FilaComparacion 
                        titulo="Punto BDV (Bs)" 
                        esperado={datosSistema.sistemaBDV} 
                        campo="puntoBDV" 
                        color="bg-red-50 border-red-100 focus-within:border-red-400"
                        declarado={declarado}
                        setDeclarado={setDeclarado}
                        autoFocus={false}
                    />
                    <FilaComparacion 
                        titulo="Punto Bancamiga (Bs)" 
                        esperado={datosSistema.sistemaBancamiga} 
                        campo="puntoBancamiga" 
                        color="bg-blue-50 border-blue-100 focus-within:border-blue-400"
                        declarado={declarado}
                        setDeclarado={setDeclarado}
                        autoFocus={false}
                    />
                    <FilaComparacion 
                        titulo="Metal / Otros ($)" 
                        esperado={datosSistema.sistemaMetal} 
                        campo="metal" 
                        color="bg-gray-50 border-gray-100 focus-within:border-gray-400"
                        declarado={declarado}
                        setDeclarado={setDeclarado}
                        autoFocus={false}
                    />
                </div>

                {/* Resto del código de botones y resultados igual... */}
                {!resultado ? (
                    <button onClick={procesarArqueo} disabled={cargando} className="w-full mt-4 bg-gray-900 text-white font-black py-4 rounded-xl uppercase shadow-lg hover:bg-black transition-all">
                        {cargando ? "Calculando..." : "📊 Verificar Cuadre"}
                    </button>
                ) : (
                    <div className="mt-4 space-y-4 animate-in fade-in zoom-in-95">
                        <div className={`p-4 rounded-xl font-black text-center border-4 ${resultado.estado === 'Cuadrado' ? 'bg-green-100 border-green-600 text-green-800' : 'bg-red-100 border-red-600 text-red-800'}`}>
                            {resultado.estado?.toUpperCase()}
                        </div>
                        <div className="p-4 rounded-xl bg-white border-2 border-gray-100 shadow-inner">
                            <h3 className="text-center font-black text-[10px] text-gray-500 mb-3 tracking-widest uppercase">Detalle</h3>
                            <div className="space-y-2 text-sm font-mono">
                                <div className="flex justify-between">
                                    <span>Dif. USD:</span>
                                    <span className={resultado.diferenciaUSD >= 0 ? "text-green-600" : "text-red-600 font-bold"}>
                                        {resultado.diferenciaUSD.toFixed(2)} $
                                    </span>
                                </div>
                                <div className="flex justify-between border-t pt-2">
                                    <span>Dif. VES:</span>
                                    <span className={resultado.diferenciaVES >= 0 ? "text-green-600" : "text-red-600 font-bold"}>
                                        {resultado.diferenciaVES.toFixed(2)} Bs
                                    </span>
                                </div>
                            </div>
                        </div>
                        <textarea className="w-full p-3 border-2 border-gray-100 rounded-xl text-sm bg-yellow-50/30 focus:border-yellow-200 outline-none" placeholder="Notas opcionales..." value={observaciones} onChange={e => setObservaciones(e.target.value)} />
                        <button onClick={finalizarCierreDefinitivo} disabled={cargando} className="w-full bg-red-600 text-white font-black py-4 rounded-xl shadow-xl hover:bg-red-700 transition-colors">
                            {cargando ? "PROCESANDO..." : "🔒 FINALIZAR Y CERRAR TURNO"}
                        </button>
                        <button onClick={() => setResultado(null)} className="w-full text-xs text-blue-600 font-bold underline py-2">🔄 Recalcular / Corregir montos</button>
                    </div>
                )}
                
                <button onClick={onClose} className="mt-4 w-full text-gray-400 text-[10px] font-black uppercase hover:text-gray-600">Cancelar</button>
            </div>
        </div>
    );
};

const [cierreRealizado, setCierreRealizado] = useState(false); // Para mostrar la pantalla de impresión

const imprimirTicketCierre = () => {
    const ventana = window.open('', '_blank', 'width=400,height=600');
    ventana.document.write(`
        <html>
            <head>
                <title>Ticket de Cierre</title>
                <style>
                    body { font-family: 'Courier New', Courier, monospace; font-size: 12px; padding: 20px; }
                    .text-center { text-align: center; }
                    .bold { font-weight: bold; }
                    .border-t { border-top: 1px dashed #000; margin-top: 10px; padding-top: 10px; }
                    table { width: 100%; }
                    .monto { text-align: right; }
                </style>
            </head>
            <body>
                <div class="text-center">
                    <h2 class="bold">REPORTE DE CIERRE</h2>
                    <p>Fecha: ${new Date().toLocaleString()}</p>
                </div>
                <div class="border-t">
                    <table>
                        <tr><td>Efectivo USD:</td><td class="monto">${parseFloat(declarado.efectivoUSD || 0).toFixed(2)} $</td></tr>
                        <tr><td>Efectivo VES:</td><td class="monto">${parseFloat(declarado.efectivoVES || 0).toFixed(2)} Bs</td></tr>
                        <tr><td>Pago Móvil:</td><td class="monto">${parseFloat(declarado.pagoMovil || 0).toFixed(2)} Bs</td></tr>
                        <tr><td>Puntos:</td><td class="monto">${(parseFloat(declarado.puntoBDV || 0) + parseFloat(declarado.puntoBancamiga || 0)).toFixed(2)} Bs</td></tr>
                    </table>
                </div>
                <div class="border-t">
                    <p class="bold text-center">ESTADO: ${resultado?.estado?.toUpperCase()}</p>
                    <p>Diferencia USD: ${resultado?.diferenciaUSD?.toFixed(2)} $</p>
                    <p>Diferencia VES: ${resultado?.diferenciaVES?.toFixed(2)} Bs</p>
                </div>
                <div class="border-t text-center">
                    <p>Observaciones: ${observaciones || 'Ninguna'}</p>
                </div>
                <div class="text-center" style="margin-top: 30px;">
                    <p>_______________________</p>
                    <p>Firma del Cajero</p>
                </div>
            </body>
        </html>
    `);
    ventana.document.close();
    ventana.print();
    ventana.close();
};

export default ModalArqueo;