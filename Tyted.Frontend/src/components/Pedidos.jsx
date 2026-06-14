import React, { useState, useEffect, useContext, useRef } from 'react';
import { ConfigContext } from '../Context/ConfigContext';
import ModalCliente from './ModalCliente';
import { Html5Qrcode } from "html5-qrcode";

const CLIENTE_DEFECTO = { id: 1, nombre: "CLIENTE EVENTUAL", rif: "V00000000" };

const Pedidos = () => {
    const { API_URL, tasa } = useContext(ConfigContext);
    const getAuthHeaders = () => ({
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem("token")}`
    });

    // --- ESTADOS GLOBALES ---
    const [vista, setVista] = useState('nuevo'); // 'nuevo' (Tipo POS) o 'lista' (Tabla)
    const [procesando, setProcesando] = useState(false);

    // --- ESTADOS PARA "NUEVO PEDIDO" (COPIA DE POS.JSX) ---
    const [carrito, setCarrito] = useState([]);
    const [busqueda, setBusqueda] = useState("");
    const [resultadosBusqueda, setResultadosBusqueda] = useState([]);
    const [indexSeleccionado, setIndexSeleccionado] = useState(-1);
    const [cliente, setCliente] = useState(CLIENTE_DEFECTO);
    const [mostrarScanner, setMostrarScanner] = useState(false);
    const [mostrarModalCliente, setMostrarModalCliente] = useState(false);
    const [errorBusqueda, setErrorBusqueda] = useState(null);
    
    // Estados para Pesaje (Balanza)
    const [productoEnPesaje, setProductoEnPesaje] = useState(null);
    const [cantidadPeso, setCantidadPeso] = useState("");

    // --- ESTADOS PARA "LISTA DE PEDIDOS" ---
    const [listaPedidos, setListaPedidos] = useState([]);
    const [cargandoLista, setCargandoLista] = useState(false);

    const inputBusquedaRef = useRef(null);

    // ========================================================================
    //  LOGICA DE TECLADO Y BÚSQUEDA (IDÉNTICA AL POS)
    // ========================================================================
    useEffect(() => {
        const manejarTeclas = (e) => {
            if (vista !== 'nuevo') return; // Solo funciona en modo POS
            if (productoEnPesaje) return;

            if (e.key === "Escape") {
                setBusqueda("");
                setResultadosBusqueda([]);
                setIndexSeleccionado(-1);
            }
            if (e.key === "F2") {
                e.preventDefault();
                inputBusquedaRef.current?.focus();
            }
            if (e.key === "F6") {
                e.preventDefault();
                if (carrito.length > 0) cambiarCantidadManual(carrito[carrito.length - 1]);
            }
            if (e.key === "F7") {
                e.preventDefault();
                const idx = indexSeleccionado !== -1 ? indexSeleccionado : 0;
                const prod = resultadosBusqueda[idx];
                if (prod?.codigoProd) verPresentaciones(prod.codigoProd);
            }
            if (e.key === "F10") {
                e.preventDefault();
                guardarPedido();
            }
            // Navegación
            if (e.key === "ArrowDown") {
                e.preventDefault();
                if (resultadosBusqueda.length > 0) {
                    setIndexSeleccionado(prev => prev < resultadosBusqueda.length - 1 ? prev + 1 : prev);
                }
            }
            if (e.key === "ArrowUp") {
                e.preventDefault();
                if (resultadosBusqueda.length > 0) {
                    setIndexSeleccionado(prev => (prev > 0 ? prev - 1 : 0));
                }
            }
            if (e.key === "Enter") {
                if (indexSeleccionado !== -1 && resultadosBusqueda[indexSeleccionado]) {
                    e.preventDefault();
                    agregarAlCarrito(resultadosBusqueda[indexSeleccionado]);
                }
            }
        };

        window.addEventListener("keydown", manejarTeclas);
        return () => window.removeEventListener("keydown", manejarTeclas);
    }, [carrito, busqueda, resultadosBusqueda, indexSeleccionado, vista, productoEnPesaje]);

    // Gestión de Foco Automático
    useEffect(() => {
        if (vista === 'nuevo' && !productoEnPesaje && !mostrarModalCliente) {
            inputBusquedaRef.current?.focus();
        }
    }, [vista, productoEnPesaje, mostrarModalCliente, busqueda]);

    // Scroll automático en resultados
    useEffect(() => {
        if (indexSeleccionado !== -1) {
            document.getElementById(`prod-res-${indexSeleccionado}`)?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
        }
    }, [indexSeleccionado]);

    // --- LOGICA DEL ESCANER DE CAMARA (HTML5-QRCODE) ---
    useEffect(() => {
        if (!mostrarScanner) return;

        // Creamos la instancia del escáner manual
        const html5QrCode = new Html5Qrcode("reader");
        
        const config = { 
            fps: 10, 
            qrbox: { width: 250, height: 150 },
            aspectRatio: 1.0 
        };

        const qrCodeSuccessCallback = (decodedText) => {
            // Al detectar un código, ejecutamos la búsqueda y cerramos
            manejarBusqueda(decodedText);
            setMostrarScanner(false);
        };

        // Iniciamos el escaneo forzando la cámara trasera ("environment")
        html5QrCode.start(
            { facingMode: "environment" }, 
            config, 
            qrCodeSuccessCallback
        ).catch(err => console.error("Error al iniciar la cámara:", err));

        return () => {
            // Importante: Detener la cámara cuando el componente se desmonte o se cierre el scanner
            html5QrCode.stop().catch(err => console.error("Error al detener el scanner:", err));
        };
    }, [mostrarScanner]);

    // --- FUNCIONES DE BÚSQUEDA ---
    const manejarBusqueda = async (valor) => {
        setBusqueda(valor);
        setIndexSeleccionado(-1);
        setErrorBusqueda(null);
        if (valor.length < 2) {
            setResultadosBusqueda([]);
            return;
        }

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000);

        try {
            const res = await fetch(`${API_URL}/Productos/buscar?termino=${valor}&tasaDelDia=${tasa}`, {
                headers: getAuthHeaders(),
                signal: controller.signal
            });
            clearTimeout(timeoutId);

            if (res.ok) {
                const data = await res.json();
                
                // Lógica exacta del POS: Si es código exacto, agrega directo
                const esCodigoBarrasFisico = valor.length >= 8 && /^\d+$/.test(valor);
                if (data.length === 1 && (data[0].codigoBarras === valor || esCodigoBarrasFisico)) {
                    agregarAlCarrito(data[0]);
                    setBusqueda("");
                    setResultadosBusqueda([]);
                } else {
                    // Filtrar duplicados visuales
                    const unicos = [];
                    const codigosVistos = new Set();
                    data.forEach(prod => {
                        if (!codigosVistos.has(prod.codigoProd)) {
                            codigosVistos.add(prod.codigoProd);
                            unicos.push(prod);
                        }
                    });
                    setResultadosBusqueda(unicos);
                    if (unicos.length === 0) setErrorBusqueda("🔍 Producto no encontrado");
                }
            } else {
                setResultadosBusqueda([]);
                if (res.status === 404) setErrorBusqueda("🔍 Producto no encontrado");
            }
        } catch (error) {
            console.error(error);
            if (error.name === 'AbortError') {
                setErrorBusqueda("⏳ El servidor local tarda mucho en responder...");
            } else {
                setErrorBusqueda("⚠️ Error de conexión");
            }
        }
    };

    const verPresentaciones = async (codigoMaestro) => {
        setBusqueda(codigoMaestro);
        try {
            const res = await fetch(`${API_URL}/Productos/buscar?termino=${codigoMaestro}&tasaDelDia=${tasa}` , {
            headers: getAuthHeaders()
            });
            if (res.ok) {
                const data = await res.json();
                setResultadosBusqueda(data); // Mostramos todas las variantes
                if (data.length > 0) setIndexSeleccionado(0);
            }
        } catch (error) { console.error(error); }
    };

    // ========================================================================
    //  GESTIÓN DEL CARRITO Y CÁLCULOS (MOTOR DEL POS)
    // ========================================================================
    const agregarAlCarrito = (prod) => {
        // Lógica de pesaje
        const esPesable = prod.unidad?.toUpperCase() === "KILO" || prod.unidad?.toUpperCase() === "GRAMO" || prod.idUnidad === 3 || prod.idUnidad === 4;
        if (esPesable) {
            setProductoEnPesaje(prod);
            setCantidadPeso("");
            setTimeout(() => document.getElementById("input-peso-pedidos")?.focus(), 150);
            return;
        }

        setCarrito(prev => {
            const existe = prev.find(item => item.idProductoUnidad === prod.idProductoUnidad);
            if (existe) {
                return prev.map(item => item.idProductoUnidad === prod.idProductoUnidad ? { ...item, cantidad: item.cantidad + 1 } : item);
            }
            return [...prev, {
                idProductoUnidad: prod.idProductoUnidad,
                codigoProd: prod.codigoProd,
                descripcion: prod.descripcion || prod.Descripcion,
                precio: prod.precioUSD || prod.precioMonedaBase,
                porcentajeIva: prod.porcentajeIva || 0,
                cantidad: 1,
                unidad: prod.unidad
            }];
        });
        setBusqueda("");
        setResultadosBusqueda([]);
        setTimeout(() => inputBusquedaRef.current?.focus(), 100);
    };

    const confirmarPeso = (e) => {
        e.preventDefault();
        const valor = parseFloat(cantidadPeso);
        if (!valor || valor <= 0) return;

        const nuevoItem = {
            idProductoUnidad: productoEnPesaje.idProductoUnidad,
            codigoProd: productoEnPesaje.codigoProd,
            descripcion: productoEnPesaje.descripcion,
            precio: productoEnPesaje.precioUSD || productoEnPesaje.precioMonedaBase,
            porcentajeIva: productoEnPesaje.porcentajeIva || 0,
            cantidad: valor,
            unidad: productoEnPesaje.unidad
        };
        setCarrito(prev => [...prev, nuevoItem]);
        setProductoEnPesaje(null);
        setCantidadPeso("");
        setBusqueda("");
        setResultadosBusqueda([]);
        setTimeout(() => inputBusquedaRef.current?.focus(), 150);
    };

    const cambiarCantidadManual = (item) => {
        const nuevaCant = prompt(`Nueva cantidad para ${item.descripcion}:`, item.cantidad);
        if (nuevaCant && !isNaN(nuevaCant) && parseFloat(nuevaCant) > 0) {
            setCarrito(prev => prev.map(i => i.idProductoUnidad === item.idProductoUnidad ? { ...i, cantidad: parseFloat(nuevaCant) } : i));
        }
        setTimeout(() => inputBusquedaRef.current?.focus(), 150);
    };

    // --- CÁLCULOS EXACTOS DEL POS ---
    const subtotalUSD = carrito.reduce((acc, item) => acc + (item.precio * item.cantidad), 0);
    const totalIVAUSD = carrito.reduce((acc, item) => acc + (item.precio * item.cantidad * (item.porcentajeIva / 100)), 0);
    const totalUSD = subtotalUSD + totalIVAUSD;
    const totalVES = totalUSD * tasa;
    // --- CALCULOS DE TOTALES EN PEDIDOS.JSX ---
    const subtotalPedido = carrito.reduce((acc, item) => acc + (Number(item.precio) * Number(item.cantidad)), 0);

    const ivaPedido = carrito.reduce((acc, item) => {
        const p = Number(item.precio) || 0;
        const cant = Number(item.cantidad) || 0;
        const pct = Number(item.porcentajeIva) || 0;
        return acc + (p * (pct / 100) * cant);
    }, 0);

    const totalConIva = subtotalPedido + ivaPedido;

    // ========================================================================
    //  INTERACCIÓN CON BACKEND (PEDIDOS CONTROLLER)
    // ========================================================================
    // --- GUARDAR PEDIDO (POST A API/PEDIDOS) ---
    // --- GUARDAR PEDIDO (POST A API/PEDIDOS) ---
    const guardarPedido = async () => {
        if (carrito.length === 0) return alert("El carrito está vacío");

        // VALIDACIÓN PREVIA: Verificar que todos los items tengan ID de Unidad
        const itemsInvalidos = carrito.filter(i => !i.idProductoUnidad);
        if (itemsInvalidos.length > 0) {
            alert("Error: Hay productos en el carrito sin identificación de unidad. Intente agregarlos nuevamente.");
            return;
        }
        
        // 1. Construcción del Objeto EXACTA según tu modelo C#
        const pedidoData = {
            clienteId: Number(cliente.id), 
            nombreCliente: cliente.nombre,
            rifCliente: cliente.rif,
            // Ahora el total del pedido SÍ incluye el IVA
            montoTotalUSD: Number(totalConIva.toFixed(2)), 
    
            detalles: carrito.map(item => {
                const precio = Number(item.precio);
                const cant = Number(item.cantidad);
                const pctIva = Number(item.porcentajeIva || 0);
                const subtotalLinea = precio * cant;
                const montoIvaLinea = subtotalLinea * (pctIva / 100);

                return {
                    codigoProd: item.codigoProd || "GENERICO",
                    descripcion: item.descripcion,
                    cantidad: cant,
                    precioUnitarioUSD: precio,
            
                    // --- CAMPOS DE IVA ---
                    tasaIVA: pctIva,
                    porcentajeIva: pctIva, 
                    montoIvaUSD: Number(montoIvaLinea.toFixed(2)),
                    subtotalUSD: Number(subtotalLinea.toFixed(2)), // Neto
                    totalLineaUSD: Number((subtotalLinea + montoIvaLinea).toFixed(2)), // Bruto
            
                    idProductoUnidad: Number(item.idProductoUnidad) 
                };
            })
        };

        console.log("JSON Enviado:", JSON.stringify(pedidoData, null, 2));

        try {
            setProcesando(true);
            const res = await fetch(`${API_URL}/Pedidos`, {
                method: 'POST',
                headers: getAuthHeaders(),
                body: JSON.stringify(pedidoData)
            });

            if (res.ok) {
                const data = await res.json();
                alert(`✅ Pedido #${data.id} guardado con éxito.`);
                setCarrito([]);
                setCliente(CLIENTE_DEFECTO);
            } else {
                const errorText = await res.text();
                console.error("Respuesta del servidor:", errorText);
                alert("Error al guardar (Ver consola): " + errorText);
            }
        } catch (error) {
            console.error("Error de red:", error);
            alert("Error de conexión");
        } finally {
            setProcesando(false);
            setTimeout(() => inputBusquedaRef.current?.focus(), 150);
        }
    };

    const cargarListaPedidos = async () => {
        try {
            setCargandoLista(true);
            const res = await fetch(`${API_URL}/Pedidos`, {
                headers: getAuthHeaders()
            });
            if (res.ok) {
                const data = await res.json();
                setListaPedidos(data);
            }
        } catch (e) { console.error(e); } 
        finally { setCargandoLista(false); }
    };

    // Al cambiar a vista lista, cargamos los datos
    useEffect(() => {
        if (vista === 'lista') cargarListaPedidos();
    }, [vista]);

    const facturarPedido = async (id, metodo, credito) => {
        if(!window.confirm("¿Convertir pedido en factura?")) return;
        try {
            const res = await fetch(`${API_URL}/Pedidos/${id}/facturar?metodoPago=${metodo}&esCredito=${credito}`, { 
                method: 'POST',
                headers: getAuthHeaders()
                });
            if (res.ok) {
                const data = await res.json();
                alert(`Factura #${data.factura} generada.`);
                cargarListaPedidos();
            } else {
                alert("Error al facturar");
            }
        } catch (e) { alert("Error de conexión"); }
    };

    // ========================================================================
    //  RENDERIZADO
    // ========================================================================
    return (
        <div className="flex flex-col h-screen bg-gray-100 font-sans">
            
            {/* BARRA DE NAVEGACIÓN SUPERIOR */}
            <div className="bg-white border-b px-6 py-3 flex justify-between items-center shadow-sm z-20">
                <div className="flex gap-4">
                    <button 
                        onClick={() => setVista('nuevo')}
                        className={`px-4 py-2 rounded-lg font-black uppercase text-xs transition ${vista === 'nuevo' ? 'bg-blue-600 text-white shadow-lg' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}
                    >
                        ➕ Nuevo Pedido (Terminal)
                    </button>
                    <button 
                        onClick={() => setVista('lista')}
                        className={`px-4 py-2 rounded-lg font-black uppercase text-xs transition ${vista === 'lista' ? 'bg-blue-600 text-white shadow-lg' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}
                    >
                        📋 Lista Pendientes
                    </button>
                </div>
                <div className="text-right">
                    <div className="text-[10px] font-bold text-gray-400 uppercase">Tasa del Día</div>
                    <div className="font-mono font-black text-blue-600">{tasa} VES/$</div>
                </div>
            </div>

            {/* VISTA: NUEVO PEDIDO (ESTILO POS) */}
            {vista === 'nuevo' && (
                <div className="flex flex-1 overflow-hidden">
                    {/* PANEL IZQUIERDO: BÚSQUEDA Y CARRITO */}
                    <div className="flex-1 flex flex-col p-4 gap-4">
                        {/* Buscador y Resultados */}
                        <div className="relative z-50">
                            <div className="flex gap-2">
                                <input
                                    ref={inputBusquedaRef}
                                    type="text"
                                    value={busqueda}
                                    onChange={(e) => manejarBusqueda(e.target.value)}
                                    className={`flex-1 p-4 border-2 rounded-xl outline-none text-lg shadow-sm font-bold transition-all ${
                                        errorBusqueda ? 'border-red-500 bg-red-50' : 'border-blue-50 focus:border-blue-500 bg-white'
                                    }`}
                                    placeholder="🔍 F2 - Buscar..."
                                    autoFocus
                                />
                                {/* Botón de Cámara (Solo visible en dispositivos móviles o pantallas pequeñas) */}
                                <button 
                                    onClick={() => setMostrarScanner(!mostrarScanner)}
                                    className="md:hidden bg-blue-600 text-white p-4 rounded-xl shadow-lg active:bg-blue-800 transition-colors"
                                    title="Escanear Código de Barras"
                                >
                                    {mostrarScanner ? '✕' : '📷'}
                                </button>
                            </div>

                            {/* Contenedor del Lector de Cámara */}
                            {mostrarScanner && (
                                <div id="reader" className="mt-4 rounded-2xl overflow-hidden border-4 border-blue-500 shadow-2xl bg-black min-h-[250px]">
                                    {/* Aquí se renderizará el visor de la cámara */}
                                    <p className="text-white text-center p-10 text-xs">Iniciando cámara...</p>
                                </div>
                            )}
                            
                            {/* Alerta Error */}
                            {errorBusqueda && (
                                <div className="absolute right-0 top-0 bottom-0 flex items-center pr-4">
                                    <span className="text-red-500 font-bold text-xs uppercase">{errorBusqueda}</span>
                                </div>
                            )}
                            
                            {/* Lista Desplegable */}
                            {resultadosBusqueda.length > 0 && (
                                <div className="absolute left-0 right-0 bg-white border-2 border-blue-500 rounded-xl shadow-2xl mt-1 max-h-80 overflow-y-auto">
                                    {resultadosBusqueda.map((prod, index) => (
                                        <div
                                            key={index}
                                            id={`prod-res-${index}`}
                                            className={`p-3 border-b flex justify-between items-center cursor-pointer ${
                                                index === indexSeleccionado ? "bg-blue-600 text-white" : "hover:bg-blue-50"
                                            }`}
                                            onClick={() => agregarAlCarrito(prod)}
                                        >
                                            <div>
                                                <div className="font-bold uppercase text-xs">{prod.descripcion}</div>
                                                <div className={`text-[10px] font-mono ${index === indexSeleccionado ? 'text-blue-200':'text-gray-400'}`}>
                                                    {prod.codigoProd} | {prod.unidad}
                                                </div>
                                            </div>
                                            <div className="font-black text-sm">${(prod.precioUSD || 0).toFixed(2)}</div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Tabla del Carrito */}
                        <div className="bg-white rounded-xl shadow flex-1 overflow-hidden flex flex-col border border-gray-200">
                            <div className="overflow-y-auto flex-1">
                                <table className="w-full text-left">
                                    <thead className="bg-gray-100 sticky top-0">
                                        <tr className="text-gray-600 text-[10px] uppercase font-black">
                                            <th className="p-3">Producto</th>
                                            <th className="p-3 text-center">Cant.</th>
                                            <th className="p-3 text-right">Precio</th>
                                            <th className="p-3 text-right">Total</th>
                                            <th className="p-3"></th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {carrito.map((item, i) => (
                                            <tr key={i} className={`border-b ${i === carrito.length -1 ? 'bg-yellow-50' : ''}`}>
                                                <td className="p-3">
                                                    <div className="font-bold text-gray-800 text-xs uppercase">{item.descripcion}</div>
                                                </td>
                                                <td className="p-3 text-center">
                                                    <button 
                                                        onClick={() => cambiarCantidadManual(item)}
                                                        className="font-black text-blue-600 bg-blue-50 px-2 rounded border border-blue-100 hover:bg-blue-500 hover:text-white"
                                                    >
                                                        {item.cantidad}
                                                    </button>
                                                </td>
                                                <td className="p-3 text-right font-mono text-sm">${item.precio.toFixed(2)}</td>
                                                <td className="p-3 text-right font-mono font-black text-sm">${(item.precio * item.cantidad).toFixed(2)}</td>
                                                <td className="p-3 text-center">
                                                    <button onClick={() => setCarrito(prev => prev.filter((_, idx) => idx !== i))}>🗑️</button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>

                    {/* PANEL DERECHO: TOTALES Y CLIENTE */}
                    <div className="w-96 bg-gray-900 text-white p-6 flex flex-col shadow-2xl z-10">
                        {/* Selector Cliente */}
                        <div className="mb-6 bg-gray-800 p-4 rounded-xl border border-gray-700">
                            <div className="text-xs text-blue-400 font-black uppercase mb-1">Cliente Asignado</div>
                            <div className="font-bold text-lg truncate">{cliente.nombre}</div>
                            <div className="text-sm text-gray-400 font-mono mb-3">{cliente.rif}</div>
                            <button 
                                onClick={() => setMostrarModalCliente(true)}
                                className="w-full bg-blue-600 hover:bg-blue-700 py-2 rounded-lg text-xs font-black uppercase transition"
                            >
                                Cambiar Cliente
                            </button>
                        </div>

                        {/* Desglose de Totales */}
                        <div className="space-y-2 mb-auto">
                            <div className="flex justify-between text-xs text-gray-400 uppercase font-bold">
                                <span>Subtotal</span>
                                <span>${subtotalUSD.toFixed(2)}</span>
                            </div>
                            <div className="flex justify-between text-xs text-gray-400 uppercase font-bold">
                                <span>Impuestos (IVA)</span>
                                <span>${totalIVAUSD.toFixed(2)}</span>
                            </div>
                            <div className="border-t border-gray-700 my-2 pt-2">
                                <div className="flex justify-between items-end">
                                    <span className="text-xl font-black text-green-400">TOTAL</span>
                                    <div className="text-right">
                                        <div className="text-4xl font-mono font-black text-white">${totalUSD.toFixed(2)}</div>
                                        <div className="text-sm text-gray-400 italic">≈ {totalVES.toLocaleString('es-VE', {maximumFractionDigits: 2})} Bs</div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Botones de Acción */}
                        <div className="space-y-3 mt-6">
                            <button 
                                onClick={guardarPedido}
                                disabled={carrito.length === 0 || procesando}
                                className={`w-full py-4 rounded-xl font-black text-lg uppercase shadow-lg transition transform active:scale-95 ${
                                    carrito.length === 0 ? 'bg-gray-700 text-gray-500 cursor-not-allowed' : 'bg-green-500 hover:bg-green-600 text-white'
                                }`}
                            >
                                {procesando ? 'Guardando...' : '💾 Guardar Pedido (F10)'}
                            </button>
                            <button 
                                onClick={() => { setCarrito([]); setCliente(CLIENTE_DEFECTO); }}
                                className="w-full py-3 rounded-xl font-bold text-xs uppercase text-gray-400 hover:bg-gray-800 hover:text-white transition"
                            >
                                Cancelar / Limpiar
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* VISTA: LISTA DE PEDIDOS PENDIENTES */}
            {vista === 'lista' && (
                <div className="flex-1 p-8 overflow-y-auto bg-gray-50">
                    <div className="max-w-5xl mx-auto bg-white rounded-2xl shadow-xl overflow-hidden border border-gray-200">
                        <div className="p-6 border-b flex justify-between items-center bg-gray-50">
                            <h2 className="text-xl font-black text-gray-700 uppercase italic">📦 Pedidos por Facturar</h2>
                            <button onClick={cargarListaPedidos} className="text-blue-600 font-bold text-sm hover:underline">🔄 Actualizar</button>
                        </div>
                        <table className="w-full text-left">
                            <thead className="bg-white border-b">
                                <tr className="text-gray-400 text-[10px] uppercase font-black tracking-wider">
                                    <th className="p-4"># ID</th>
                                    <th className="p-4">Cliente</th>
                                    <th className="p-4">Fecha</th>
                                    <th className="p-4 text-right">Monto ($)</th>
                                    <th className="p-4 text-center">Acciones</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {cargandoLista ? (
                                    <tr><td colSpan="5" className="p-8 text-center text-gray-400">Cargando pedidos...</td></tr>
                                ) : listaPedidos.length === 0 ? (
                                    <tr><td colSpan="5" className="p-8 text-center text-gray-400 italic">No hay pedidos pendientes</td></tr>
                                ) : (
                                    listaPedidos.map(p => (
                                        <tr key={p.id} className="hover:bg-blue-50 transition">
                                            <td className="p-4 font-mono font-bold text-blue-600">#{p.id}</td>
                                            <td className="p-4">
                                                <div className="font-bold text-sm text-gray-800">{p.cliente ? p.cliente.nombre : 'Sin Cliente'}</div>
                                                <div className="text-xs text-gray-400">{p.rifCliente}</div>
                                            </td>
                                            <td className="p-4 text-xs text-gray-500">{new Date(p.fecha).toLocaleString()}</td>
                                            <td className="p-4 text-right font-black text-gray-800">${p.montoTotalUSD.toFixed(2)}</td>
                                            <td className="p-4 flex justify-center gap-2">
                                                <button 
                                                    onClick={() => facturarPedido(p.id, "Efectivo", false)}
                                                    className="bg-green-100 text-green-700 px-3 py-1 rounded text-xs font-bold hover:bg-green-200"
                                                >
                                                    Facturar
                                                </button>
                                                {/* Aquí podrías agregar botón para "Cargar al POS" si quisieras editarlo */}
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* MODALES AUXILIARES */}
            <ModalCliente 
                isOpen={mostrarModalCliente} 
                onClose={() => setMostrarModalCliente(false)}
                onSelectCliente={setCliente}
                API_URL={API_URL}
            />

            {/* MODAL DE PESAJE (IDÉNTICO AL POS) */}
            {productoEnPesaje && (
                <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[9999] backdrop-blur-sm">
                    <div className="bg-white p-8 rounded-3xl shadow-2xl w-96 text-center border-4 border-blue-500 animate-in zoom-in duration-200">
                        <h2 className="text-xl font-black mb-2 uppercase text-gray-800">{productoEnPesaje.descripcion}</h2>
                        <p className="text-blue-600 font-bold mb-6 italic">Ingrese peso en {productoEnPesaje.unidad}</p>
                        <form onSubmit={confirmarPeso}>
                            <input 
                                id="input-peso-pedidos"
                                type="number" step="0.001"
                                value={cantidadPeso}
                                onChange={(e) => setCantidadPeso(e.target.value)}
                                className="w-full text-5xl p-4 border-b-4 border-blue-500 outline-none text-center font-mono mb-8 bg-blue-50 rounded-t-lg"
                                placeholder="0.000"
                                autoFocus
                            />
                            <div className="flex gap-4">
                                <button type="button" onClick={() => setProductoEnPesaje(null)} className="flex-1 bg-gray-200 py-3 rounded-xl font-bold text-gray-600">CANCELAR</button>
                                <button type="submit" className="flex-1 bg-blue-600 py-3 rounded-xl font-bold text-white hover:bg-blue-700 shadow-lg">ACEPTAR</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
    
};

export default Pedidos;