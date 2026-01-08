import React, { useState, useEffect, useContext } from 'react';
import { ConfigContext } from '../Context/ConfigContext';

// --- 1. COMPONENTE DE APOYO (FUERA PARA EVITAR RE-CREACIÓN) ---
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
            autoFocus={autoFocus}
            className="w-full text-xl font-mono outline-none bg-transparent"
            value={declarado[campo]} 
            onChange={e => {
                const val = e.target.value;
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
    
    // --- 2. HOOKS ---
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
    const [cierreRealizado, setCierreRealizado] = useState(false); 

    useEffect(() => {
        if (isOpen) {
            obtenerTotalesSistema();
            setResultado(null);
            setCierreRealizado(false);
            setObservaciones("");
            setDeclarado({
                efectivoUSD: "", efectivoVES: "", pagoMovil: "",
                puntoBDV: "", puntoBancamiga: "", metal: ""
            });
        }
    }, [isOpen]);

    const imprimirTicketCierre = () => {
    // 1. Calculamos los totales justo antes de imprimir para asegurar datos frescos
    const totalSistemaUSD = datosSistema.sistemaUSD + datosSistema.sistemaMetal + 
        ((datosSistema.sistemaVES + datosSistema.sistemaPM + datosSistema.sistemaBDV + datosSistema.sistemaBancamiga) / tasa);

    const totalDeclaradoUSD = (parseFloat(declarado.efectivoUSD) || 0) + (parseFloat(declarado.Metal) || 0) + 
        (((parseFloat(declarado.efectivoVES) || 0) + (parseFloat(declarado.pagoMovil) || 0) + 
          (parseFloat(declarado.puntoBDV) || 0) + (parseFloat(declarado.puntoBancamiga) || 0)) / tasa);

    const ventana = window.open('', '_blank', 'width=400,height=600');
    ventana.document.write(`
        <html>
            <head>
                <title>Ticket de Cierre</title>
                <style>
                    body { font-family: 'Courier New', Courier, monospace; padding: 20px; font-size: 12px; line-height: 1.4; }
                    .center { text-align: center; }
                    .bold { font-weight: bold; }
                    .border { border-top: 1px dashed black; margin: 10px 0; padding-top: 10px; }
                    table { width: 100%; border-collapse: collapse; }
                    td { padding: 2px 0; }
                    .monto { text-align: right; }
                    .header-table { font-size: 10px; color: #555; }
                    .resumen-caja { background-color: #f0f0f0; padding: 5px; margin-top: 5px; }
                </style>
            </head>
            <body>
                <div class="center">
                    <h2 class="bold" style="margin-bottom: 5px;">REPORTE DE CIERRE</h2>
                    <p style="margin: 0;">Fecha: ${new Date().toLocaleString()}</p>
                    <p style="margin: 0;">Tasa: ${tasa} Bs/$</p>
                </div>

                <div class="border">
                    <p class="bold center" style="margin: 0 0 5px 0;">DETALLE DECLARADO</p>
                    <table>
                        <tr class="header-table"><td>CONCEPTO</td><td class="monto">DECLARADO</td></tr>
                        <tr><td>Efectivo USD:</td><td class="monto">${parseFloat(declarado.efectivoUSD || 0).toFixed(2)} $</td></tr>
                        <tr><td>Efectivo VES:</td><td class="monto">${parseFloat(declarado.efectivoVES || 0).toFixed(2)} Bs</td></tr>
                        <tr><td>Pago Móvil:</td><td class="monto">${parseFloat(declarado.pagoMovil || 0).toFixed(2)} Bs</td></tr>
                        <tr><td>Punto BDV:</td><td class="monto">${parseFloat(declarado.puntoBDV || 0).toFixed(2)} Bs</td></tr>
                        <tr><td>Punto Bancamiga:</td><td class="monto">${parseFloat(declarado.puntoBancamiga || 0).toFixed(2)} Bs</td></tr>
                        <tr><td>Metal/Otros:</td><td class="monto">${parseFloat(declarado.Metal || 0).toFixed(2)} $</td></tr>
                    </table>
                </div>

                <div class="border resumen-caja">
                    <p class="bold center" style="margin: 0 0 5px 0;">RESUMEN GENERAL (TOTALES)</p>
                    <table>
                        <tr><td>TOTAL SISTEMA:</td><td class="monto bold">${totalSistemaUSD.toFixed(2)} $</td></tr>
                        <tr><td>TOTAL DECLARADO:</td><td class="monto bold">${totalDeclaradoUSD.toFixed(2)} $</td></tr>
                        <tr class="header-table"><td colspan="2" class="monto">Equiv: ${(totalDeclaradoUSD * tasa).toFixed(2)} Bs</td></tr>
                    </table>
                </div>

                <div class="border">
                    <p class="bold center" style="margin: 0 0 5px 0;">RESULTADO DEL CUADRE</p>
                    <table>
                        <tr><td>ESTADO:</td><td class="monto bold">${(resultado?.estado || 'N/A').toUpperCase()}</td></tr>
                        <tr><td>Dif. USD:</td><td class="monto bold">${resultado?.diferenciaUSD?.toFixed(2)} $</td></tr>
                        <tr><td>Dif. VES:</td><td class="monto bold">${resultado?.diferenciaVES?.toFixed(2)} Bs</td></tr>
                        <tr><td>Dif. PM:</td><td class="monto bold">${resultado?.diferenciaPM?.toFixed(2)} Bs</td></tr>
                        <tr><td>Dif. BDV:</td><td class="monto bold">${resultado?.diferenciaBDV?.toFixed(2)} Bs</td></tr>
                        <tr><td>Dif. Bancamiga:</td><td class="monto bold">${resultado?.diferenciaBancamiga?.toFixed(2)} Bs</td></tr>
                        <tr><td>Dif. Metal:</td><td class="monto bold">${resultado?.diferenciaMetal?.toFixed(2)} $</td></tr>
                    </table>
                </div>

                <div class="border">
                    <p class="bold">OBSERVACIONES:</p>
                    <p>${observaciones || 'Sin observaciones'}</p>
                </div>

                <div class="center" style="margin-top: 50px;">
                    <p>_______________________</p>
                    <p>Firma del Cajero</p>
                    <p style="font-size: 9px; margin-top: 10px;">ID: CAJERO_PRINCIPAL</p>
                </div>
            </body>
        </html>
    `);
    ventana.document.close();
    ventana.print();
    ventana.close();
};

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
        } catch (error) { console.error("Error sistema:", error); }
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
                metalDeclarado: parseFloat(declarado.Metal) || 0,
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
        } catch (error) { console.error("Error arqueo:", error); } 
        finally { setCargando(false); }
    };

    const finalizarCierreDefinitivo = async () => {
        if (!window.confirm("¿Está seguro de cerrar el turno?")) return;
        setCargando(true);
        try {
            const payload = {
                usuario: "CAJERO_PRINCIPAL",
                montoCierreEfectivoUSD: parseFloat(declarado.efectivoUSD) || 0,
                montoCierreEfectivoVES: (parseFloat(declarado.efectivoVES) || 0) / tasa,
                montoCierrePagoMovil: (parseFloat(declarado.pagoMovil) || 0) / tasa,
                montoCierrePuntoBDV: (parseFloat(declarado.puntoBDV) || 0) / tasa,
                montoCierrePuntoBancamiga: (parseFloat(declarado.puntoBancamiga) || 0) / tasa,
                montoCierremetal: (parseFloat(declarado.Metal) || 0),
                observacionesCierre: observaciones || "Cierre de turno estándar",
            };
            const res = await fetch(`${API_URL}/Ventas/cerrar-caja`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            if (res.ok) {
                setCierreRealizado(true);
            }
        } catch (e) { alert("Error de conexión."); } 
        finally { setCargando(false); }
    };
    
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-[200] p-4 backdrop-blur-sm">
            <div className="bg-white w-full max-w-[500px] rounded-2xl p-6 shadow-2xl overflow-y-auto max-h-[95vh]">
                
                {cierreRealizado ? (
                    <div className="text-center py-10 animate-in fade-in zoom-in">
                        <div className="text-6xl mb-4">✅</div>
                        <h2 className="text-2xl font-black text-gray-800 mb-2">CIERRE EXITOSO</h2>
                        <p className="text-gray-500 mb-8">El turno ha sido cerrado y registrado.</p>
                        
                        <button 
                            onClick={imprimirTicketCierre}
                            className="w-full bg-blue-600 text-white font-black py-4 rounded-xl shadow-lg mb-4 flex items-center justify-center gap-2 hover:bg-blue-700"
                        >
                            🖨️ IMPRIMIR REPORTE DETALLADO
                        </button>
                        
                        <button onClick={() => window.location.reload()} className="w-full text-gray-500 font-bold py-2 underline">
                            Volver al Panel Principal
                        </button>
                    </div>
                ) : (
                    <>
                        <div className="flex justify-between items-center mb-4 border-b pb-2">
                            <h2 className="text-xl font-black uppercase italic">Arqueo de Turno</h2>
                            <div className="text-right">
                                <p className="text-[10px] font-bold text-gray-400">TASA BASE</p>
                                <p className="font-black text-blue-600">{tasa} $/Bs</p>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 gap-1">
                            <FilaComparacion titulo="Efectivo Dólares ($)" esperado={datosSistema.sistemaUSD} campo="efectivoUSD" color="bg-green-50 border-green-100" declarado={declarado} setDeclarado={setDeclarado} autoFocus={true} />
                            <FilaComparacion titulo="Efectivo Bolívares (Bs)" esperado={datosSistema.sistemaVES} campo="efectivoVES" color="bg-yellow-50 border-yellow-100" declarado={declarado} setDeclarado={setDeclarado} autoFocus={false} />
                            <FilaComparacion titulo="Pago Móvil (Bs)" esperado={datosSistema.sistemaPM} campo="pagoMovil" color="bg-purple-50 border-purple-100" declarado={declarado} setDeclarado={setDeclarado} autoFocus={false} />
                            <FilaComparacion titulo="Punto BDV (Bs)" esperado={datosSistema.sistemaBDV} campo="puntoBDV" color="bg-red-50 border-red-100" declarado={declarado} setDeclarado={setDeclarado} autoFocus={false} />
                            <FilaComparacion titulo="Punto Bancamiga (Bs)" esperado={datosSistema.sistemaBancamiga} campo="puntoBancamiga" color="bg-blue-50 border-blue-100" declarado={declarado} setDeclarado={setDeclarado} autoFocus={false} />
                            <FilaComparacion titulo="Metal / Otros ($)" esperado={datosSistema.sistemaMetal} campo="Metal" color="bg-gray-50 border-gray-100" declarado={declarado} setDeclarado={setDeclarado} autoFocus={false} />
                        </div>

                        {!resultado ? (
                            <button onClick={procesarArqueo} disabled={cargando} className="w-full mt-4 bg-gray-900 text-white font-black py-4 rounded-xl shadow-lg hover:bg-black transition-all">
                                {cargando ? "PROCESANDO..." : "📊 VERIFICAR CUADRE"}
                            </button>
                        ) : (
                            <div className="mt-4 space-y-4 animate-in slide-in-from-bottom-2">
                                <div className={`p-4 rounded-xl font-black text-center border-4 ${resultado.estado === 'Cuadrado' ? 'bg-green-100 border-green-600 text-green-800' : 'bg-red-100 border-red-600 text-red-800'}`}>
                                    {resultado.estado?.toUpperCase()}
                                </div>
                                <div className="flex justify-between px-2 text-sm font-mono">
                                    <span>Dif. USD: <b className={resultado.diferenciaUSD < 0 ? 'text-red-600' : 'text-green-600'}>{(resultado.diferenciaUSD|| 0).toFixed(2)} $</b></span>
                                    <span>Dif. VES: <b className={resultado.diferenciaVES < 0 ? 'text-red-600' : 'text-green-600'}>{(resultado.diferenciaVES|| 0).toFixed(2)} Bs</b></span>
                                    <span>Dif. PM: <b className={resultado.diferenciaPM < 0 ? 'text-red-600' : 'text-green-600'}>{(resultado.diferenciaPM || 0).toFixed(2)} Bs</b></span>
                                    <span>Dif. BDV: <b className={resultado.diferenciaBDV < 0 ? 'text-red-600' : 'text-green-600'}>{(resultado.diferenciaBDV|| 0).toFixed(2)} Bs</b></span>
                                    <span>Dif. Bancamiga: <b className={resultado.diferenciaBancamiga < 0 ? 'text-red-600' : 'text-green-600'}>{(resultado.diferenciaBancamiga|| 0).toFixed(2)} Bs</b></span>
                                    <span>Dif. Metal: <b className={resultado.diferenciametal < 0 ? 'text-red-600' : 'text-green-600'}>{(resultado.diferenciaMetal|| 0).toFixed(2)} $</b></span>
                                </div>
                                <textarea className="w-full p-3 border-2 border-gray-100 rounded-xl text-sm outline-none focus:border-blue-200" placeholder="Notas..." value={observaciones} onChange={e => setObservaciones(e.target.value)} />
                                <button onClick={finalizarCierreDefinitivo} disabled={cargando} className="w-full bg-red-600 text-white font-black py-4 rounded-xl shadow-xl hover:bg-red-700">
                                    {cargando ? "CERRANDO..." : "🔒 FINALIZAR Y CERRAR TURNO"}
                                </button>
                                <button onClick={() => setResultado(null)} className="w-full text-xs text-blue-600 font-bold underline">🔄 Corregir montos</button>
                            </div>
                        )}
                        <button onClick={onClose} className="mt-4 w-full text-gray-400 text-[10px] font-black uppercase">Cancelar</button>
                    </>
                )}
            </div>
        </div>
    );
};

export default ModalArqueo;