import React, { useState, useContext, useRef, useEffect } from 'react';
import { ConfigContext } from '../Context/ConfigContext';
import ModalCliente from '../Components/ModalCliente';
import ModalArqueo from '../Components/ModalArqueo';
import ModalApertura from '../Components/ModalApertura';

const CLIENTE_DEFECTO = { id: 1, nombre: "CLIENTE EVENTUAL", rif: "V00000000" };

const POS = () => {
  const { tasa, API_URL } = useContext(ConfigContext);
  const [carrito, setCarrito] = useState([]);
  const [busqueda, setBusqueda] = useState("");
  const [resultadosBusqueda, setResultadosBusqueda] = useState([]);
  const [indexSeleccionado, setIndexSeleccionado] = useState(-1);
  const [pagoCliente, setPagoCliente] = useState(0);
  const [cliente, setCliente] = useState(CLIENTE_DEFECTO);
  const [mostrarModalCliente, setMostrarModalCliente] = useState(false);
  const [productoEnPesaje, setProductoEnPesaje] = useState(null);
  const [cajaAbierta, setCajaAbierta] = useState(true);
  const [mostrarArqueo, setMostrarArqueo] = useState(false);
  const [pagos, setPagos] = useState({
    efectivoUSD: 0,
    efectivoVES: 0,
    pagoMovil: 0,
    puntoBDV: 0,
    puntoBancamiga: 0,
    Metal: 0
    });

  // Referencia para devolver el foco al buscador automáticamente
  const inputBusquedaRef = useRef(null);
  useEffect(() => {
      const manejarTeclas = (e) => {
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
            if (carrito.length > 0) {
                cambiarCantidadManual(carrito[carrito.length - 1]);
            }
        }

        if (e.key === "F7") {
            e.preventDefault();
            // CAMBIO: Ahora verifica el índice seleccionado por el cajero
            const idx = indexSeleccionado !== -1 ? indexSeleccionado : 0; 
            const productoResaltado = resultadosBusqueda[idx];

            if (productoResaltado?.codigoProd) { 
            verPresentaciones(productoResaltado.codigoProd);
            }
        }

        if (e.key === "F9") {
            e.preventDefault();
            setMostrarArqueo(true);
        }

        if (e.key === "F10") {
            e.preventDefault();
            finalizarVenta();
        }

        // Navegación por flechas con preventDefault para evitar scroll de página
        if (e.key === "ArrowDown") {
            e.preventDefault();
            if (resultadosBusqueda.length > 0) {
                setIndexSeleccionado(prev => 
                    prev < resultadosBusqueda.length - 1 ? prev + 1 : prev
                );
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
    // Dependencias actualizadas para que el teclado reconozca cambios en los resultados
  }, [carrito, busqueda, cliente, resultadosBusqueda, indexSeleccionado]);

    const manejarBusqueda = async (valor) => {
    setBusqueda(valor);
    setIndexSeleccionado(-1);
    if (valor.length < 2) {
        setResultadosBusqueda([]);
        return;
    }

    try {
        const res = await fetch(`${API_URL}/Productos/buscar?termino=${valor}&tasaDelDia=${tasa}`);
        if (res.ok) {
            const data = await res.json();

            const esCodigoBarrasFisico = valor.length >= 8 && /^\d+$/.test(valor); 

            if (data.length === 1 && (data[0].codigoBarras === valor || esCodigoBarrasFisico)) {
                agregarAlCarrito(data[0]);
                setBusqueda("");
                setResultadosBusqueda([]);
            } else {
                // --- LÓGICA DE FILTRADO RECUPERADA ---
                // Agrupamos por codigoProd para mostrar solo la primera coincidencia (la principal)
                const unicos = [];
                const codigosVistos = new Set();

                data.forEach(prod => {
                    if (!codigosVistos.has(prod.codigoProd)) {
                        codigosVistos.add(prod.codigoProd);
                        unicos.push(prod);
                    }
                });

                setResultadosBusqueda(unicos);
            }
        }
    } catch (error) {
        console.error("Error buscando:", error);
    }
  };
    
  // Gestión de Foco Automático
  useEffect(() => {
      // 1. Si el modal de arqueo está abierto, SALIMOS. 
      // No queremos que el buscador le robe el foco a los inputs del cuadre.
      if (mostrarArqueo) return;

      // 2. Si hay un producto en pesaje, el foco lo maneja ese modal, así que SALIMOS.
      if (productoEnPesaje) return;

      // 3. Si todo lo anterior es falso, mantenemos el foco en la búsqueda
      // (ideal para escáneres de códigos de barra o ventas rápidas)
      inputBusquedaRef.current?.focus();
    
    }, [busqueda, resultadosBusqueda, productoEnPesaje, mostrarArqueo]);

  const verPresentaciones = async (codigoMaestro) => {
    setBusqueda(codigoMaestro); // Ponemos "HUE-01" en el cuadro
    
    try {
        // Consultamos al API directamente por el código maestro
        const res = await fetch(`${API_URL}/Productos/buscar?termino=${codigoMaestro}&tasaDelDia=${tasa}`);
        if (res.ok) {
            const data = await res.json();
            // Seteamos los resultados SIN aplicar el filtro de "una sola línea" 
            // para que el cajero vea el desglose completo
            setResultadosBusqueda(data);
            if (data.length > 0) {
                setIndexSeleccionado(0);
            } 
        }
    } catch (error) {
        console.error("Error al expandir presentaciones:", error);
    }
  };

  // --- DENTRO DE POS.jsx ---

  const agregarAlCarrito = (prod) => {
      // 1. Detección de pesaje (usando los datos reales del objeto que vimos en consola)
      const esPesable = prod.unidad?.toUpperCase() === "KILO" || 
                      prod.unidad?.toUpperCase() === "GRAMO" || 
                        prod.idUnidad === 3 || prod.idUnidad === 4;

      if (esPesable) {
          setProductoEnPesaje(prod);
          setCantidadPeso(""); 
          setTimeout(() => {
              const el = document.getElementById("input-peso-balanza");
              if (el) el.focus();
          }, 150);
          return; 
      }

      // 2. Lógica para unidades fijas usando la versión funcional de setCarrito
      // Esto garantiza que siempre trabajamos con la lista de productos más reciente
      setCarrito(carritoActual => {
          // Buscamos si ya existe (usando == para evitar problemas de tipo string/number)
          const existe = carritoActual.find(item => item.idProductoUnidad == prod.idProductoUnidad);

          if (existe) {
              return carritoActual.map(item =>
                  item.idProductoUnidad == prod.idProductoUnidad 
                  ? { ...item, cantidad: item.cantidad + 1 } 
                : item
              );
          } else {
              return [...carritoActual, {
                  idProductoUnidad: prod.idProductoUnidad,
                  codigoProd: prod.codigoProd,
                  descripcion: prod.descripcion,
                  precio: prod.precioUSD || prod.precioMonedaBase, // El log mostró precioUSD
                  precioVES: (prod.precioUSD || prod.precioMonedaBase) * (tasa || 1),
                  tasaIVA: prod.tasaIVA || 0,
                  cantidad: 1,
                  unidad: prod.unidad 
              }];
          }
      });

      // 3. Limpieza de interfaz
      setBusqueda("");
      setResultadosBusqueda([]);
      setTimeout(() => {
              inputBusquedaRef.current?.focus();
          }, 100);
  };

   // --- Cálculos Centralizados ---
  const subtotalUSD = carrito.reduce((acc, item) => {const linea = Number(item.precio) * item.cantidad;return acc + Math.round(linea * 100) / 100;}, 0);
  const totalIVAUSD = carrito.reduce((acc, item) => {
    const precio = Number(item.precio) || 0;
    const tasaIva = Number(item.tasaIVA) || 0;
    return acc + (precio * (tasaIva / 100) * item.cantidad);
  }, 0);

  const totalUSD = subtotalUSD + totalIVAUSD;
  const totalVES = totalUSD * (tasa || 0);
  // --- Funciones de Lógica ---


  // Resetear índice al buscar
  useEffect(() => {
      setIndexSeleccionado(-1);
  }, [resultadosBusqueda]);

  // Auto-scroll para la selección del teclado
  useEffect(() => {
      if (indexSeleccionado !== -1) {
          const elemento = document.getElementById(`prod-res-${indexSeleccionado}`);
          if (elemento) {
              elemento.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
          }
      }
  }, [indexSeleccionado]);

  const [cantidadPeso, setCantidadPeso] = useState("");
   
// Resetear el índice cada vez que cambien los resultados de búsqueda
useEffect(() => {
    setIndexSeleccionado(-1);
}, [resultadosBusqueda]);
// Agrega esto debajo de tus otros useEffect
useEffect(() => {
    if (indexSeleccionado !== -1) {
        const elemento = document.getElementById(`prod-res-${indexSeleccionado}`);
        if (elemento) {
            elemento.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
        }
    }
}, [indexSeleccionado]);

  
  const confirmarPeso = (e) => {
    if (e) e.preventDefault();
    const valor = parseFloat(cantidadPeso);
    if (!valor || valor <= 0) return;

    const nuevoItem = {
        idProductoUnidad: productoEnPesaje.idProductoUnidad,
        codigoProd: productoEnPesaje.codigoProd,
        descripcion: productoEnPesaje.descripcion,
        precio: productoEnPesaje.precioUSD || productoEnPesaje.precioMonedaBase,
        tasaIVA: productoEnPesaje.tasaIVA || 0,
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

  // Agregamos todos los métodos solicitados

  // Agrega esta función antes de tus cálculos de totales
  const manejarCambioPago = (e) => {
    const { name, value } = e.target;
    // Solo permitimos números y punto decimal
    if (value === '' || /^[0-9]*\.?[0-9]*$/.test(value)) {
        setPagos(prev => ({
            ...prev,
            [name]: value // Guardamos como string para que el input sea fluido
        }));
    }
  };
// Cálculo del total pagado convirtiendo todo a USD (Moneda base)
const totalPagadoUSD = 
    (parseFloat(pagos.efectivoUSD|| 0)) + 
    (parseFloat(pagos.efectivoVES || 0) / tasa) + 
    (parseFloat(pagos.pagoMovil || 0) / tasa) + 
    (parseFloat(pagos.puntoBDV || 0) / tasa) + 
    (parseFloat(pagos.puntoBancamiga || 0) / tasa) + 
    (parseFloat(pagos.metal || 0) );

const vueltoUSD = totalPagadoUSD > totalUSD ? totalPagadoUSD - totalUSD : 0;
const faltaPorPagar = totalUSD > totalPagadoUSD ? totalUSD - totalPagadoUSD : 0;

const cambiarCantidadManual = (item) => {
  const nuevaCant = prompt(`Nueva cantidad para ${item.descripcion}:`, item.cantidad);
  
  if (nuevaCant !== null && !isNaN(nuevaCant) && String(nuevaCant).trim() !== "") {
    const valor = parseFloat(nuevaCant);
    if (valor <= 0) return;

    setCarrito(carritoActual => 
      carritoActual.map(i => 
        i.idProductoUnidad === item.idProductoUnidad 
        ? { ...i, cantidad: valor } 
        : i
      )
    );
  }
  setTimeout(() => inputBusquedaRef.current?.focus(), 150);
};

const finalizarVenta = async () => {
  // 1. Verificaciones iniciales
  if (carrito.length === 0) return;

  // Calculamos el total pagado sumando todos los campos (convertidos a USD)
  const totalPagadoUSD = 
    (Number(pagos.efectivoUSD)) + 
    (Number(pagos.metal)) + 
    (Number(pagos.efectivoVES) / tasa) + 
    (Number(pagos.pagoMovil) / tasa) + 
    (Number(pagos.puntoBDV) / tasa) + 
    (Number(pagos.puntoBancamiga) / tasa);

  // 2. Validación de pago suficiente
  if (totalPagadoUSD < (totalUSD - 0.01)) {
    const falta = totalUSD - totalPagadoUSD;
    alert(`⚠️ PAGO INSUFICIENTE:\nFaltan: $${falta.toFixed(2)} (${(falta * tasa).toFixed(2)} Bs.)`);
    return;
  }

  // 3. Construcción del Array de Pagos para la base de datos (Tabla VentasPagos)
  const listaPagos = [
    { metodoPago: 'EFECTIVO_USD', montoMonedaBase: Number(pagos.efectivoUSD), montoMonedaExt: Number(pagos.efectivoUSD), tasaDeCambio: 1 },
    { metodoPago: 'EFECTIVO_VES', montoMonedaBase: Number(pagos.efectivoVES) / tasa, montoMonedaExt: Number(pagos.efectivoVES), tasaDeCambio: tasa },
    { metodoPago: 'PAGO_MOVIL', montoMonedaBase: Number(pagos.pagoMovil) / tasa, montoMonedaExt: Number(pagos.pagoMovil), tasaDeCambio: tasa },
    { metodoPago: 'PUNTO_BDV', montoMonedaBase: Number(pagos.puntoBDV) / tasa, montoMonedaExt: Number(pagos.puntoBDV), tasaDeCambio: tasa },
    { metodoPago: 'PUNTO_BANCAMIGA', montoMonedaBase: Number(pagos.puntoBancamiga) / tasa, montoMonedaExt: Number(pagos.puntoBancamiga), tasaDeCambio: tasa },
    { metodoPago: 'METAL', montoMonedaBase: Number(pagos.metal), montoMonedaExt: Number(pagos.metal), tasaDeCambio: 1 }
  ].filter(p => p.montoMonedaBase > 0); // Solo enviamos los que tengan monto

  // 4. Preparación del objeto de venta final
  const ventaData = {
    clienteId: cliente.id || 1,
    fechaVenta: new Date().toISOString(),
    tipoMoneda: "USD",
    tasaDia: tasa, // Importante para el VentaService
    tasaDeCambio: tasa,
    metodoPago: listaPagos.length > 1 ? "MIXTO" : (listaPagos[0]?.metodoPago || "EFECTIVO_USD"),
    isAnulada: false,
    
    // Totales
    totalUSD: totalUSD,
    totalVES: totalUSD * tasa,
    totalMonedaBase: totalUSD,
    totalMonedaExt: totalUSD * tasa,
    subtotalMonedaBase: subtotalUSD,
    ivaMonedaBase: totalIVAUSD,

    // Array de pagos para la relación uno-a-muchos en C#
    pagos: listaPagos, 

    // Detalle de productos con codigoProd para validación de stock/IVA
    detalles: carrito.map(item => ({
      codigoProd: item.codigoProd, // <-- Crítico para evitar "Producto no existe"
      idProductoUnidad: item.idProductoUnidad || item.id,
      nombreUnidad: item.unidad,
      cantidad: parseFloat(item.cantidad),
      precioUnitarioMonedaBase: parseFloat(item.precio),
      subtotalLineaMonedaBase: item.precio * item.cantidad,
      tasaIVA: item.tasaIVA || 0,
      totalLineaMonedaBase: (item.precio * item.cantidad) * (1 + (item.tasaIVA / 100))
    }))
  };

  try {
    const response = await fetch(`${API_URL}/Ventas`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(ventaData)
    });

    if (!response.ok) {
      // Intentamos leer el mensaje de error del backend
      let msgError = "Error al procesar la venta";
      try {
        const errorData = await response.json();
        msgError = errorData.message || msgError;
      } catch {
        msgError = await response.text() || msgError;
      }
      throw new Error(msgError);
    }

    const resultado = await response.json();
    
    // 5. Éxito: Impresión y Limpieza de estados
    if (typeof imprimirTicket === 'function') {
        imprimirTicket(resultado);
    }

    setCarrito([]);
    setPagos({ 
      efectivoUSD: 0, efectivoVES: 0, pagoMovil: 0, 
      puntoBDV: 0, puntoBancamiga: 0, metal: 0 
    });
    setCliente(CLIENTE_DEFECTO);
    setBusqueda("");
    setResultadosBusqueda([]);

    alert("✅ Venta registrada con éxito");
    setTimeout(() => inputBusquedaRef.current?.focus(), 150);
    
  } catch (err) {
    console.error("Error en la operación:", err);
    alert(`⚠️ ATENCIÓN:\n${err.message}`);
  }
  };

    const imprimirTicket = (venta) => {
    const ventana = window.open('', 'PRINT', 'height=600,width=400');

    // Verificamos si la ventana realmente se abrió
    if (!ventana) {
        alert("El navegador bloqueó la impresión. Por favor, permite los popups para este sitio.");
        return;
    }

    ventana.document.write(`
        <html>
            <head>
                <style>
                    body { font-family: 'Courier New', monospace; width: 260px; font-size: 12px; padding: 10px; }
                    .text-center { text-align: center; }
                    .text-right { text-align: right; }
                    .linea { border-top: 1px dashed black; margin: 5px 0; }
                    .total { font-size: 14px; font-weight: bold; }
                </style>
            </head>
            <body onload="window.print(); window.close();">
                <div class="text-center"><b>${venta.negocio || 'TU NEGOCIO C.A.'}</b></div>
                <div class="text-center">RIF: J-12345678-9</div>
                <div class="linea"></div>
                <div>DOC: ${venta.numeroFactura || '000008'}</div>
                <div>FECHA: ${new Date().toLocaleString()}</div>
                <div class="linea"></div>
                <table>
                    <tbody>
                        ${venta.detalles.map(item => `
                            <tr>
                                <td colspan="3">${item.codigoProd} - ${item.nombreUnidad}</td>
                            </tr>
                            <tr>
                                <td>${Number(item.cantidad).toFixed(3)}</td>
                                <td>x ${item.precioUnitarioMonedaBase.toFixed(2)}</td>
                                <td class="text-right">$${(item.cantidad * item.precioUnitarioMonedaBase).toFixed(2)}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
                <div class="linea"></div>
                <div class="text-right total">TOTAL USD: $${venta.totalMonedaBase.toFixed(2)}</div>
                <div class="text-right total">TOTAL BS: ${venta.totalMonedaExt.toLocaleString('es-VE', {minimumFractionDigits: 2})}</div>
                <div class="text-center" style="margin-top:10px;">¡Gracias por su compra!</div>
            </body>
        </html>
    `);
    ventana.document.close();
 };

   useEffect(() => {
      verificarEstadoCaja();
  }, []);
  useEffect(() => {
      if (cajaAbierta) {
          // Usamos un pequeño delay para asegurar que el DOM esté listo
          const timer = setTimeout(() => {
              inputBusquedaRef.current?.focus();
          }, 300);
          return () => clearTimeout(timer);
      }
  }, [cajaAbierta]);

  const verificarEstadoCaja = async () => {
      try {
          const res = await fetch(`${API_URL}/Ventas/estado-caja`);
          if (res.ok) {
              const estaAbierta = await res.json();
              setCajaAbierta(estaAbierta);
          }
      } catch (e) {
          console.error("Error verificando caja:", e);
          setCajaAbierta(false);
          // Opcional: setCajaAbierta(false) para bloquear si el servidor está caído
      }
  };
  
return (
    <>
      {/* 1. ENVOLTORIO PRINCIPAL: Controla el bloqueo visual y funcional */}
      <div className={`transition-all duration-700 ${!cajaAbierta ? "pointer-events-none opacity-30 grayscale blur-[2px]" : ""}`} style={{ zIndex: 1 }}>
        
        <div className="flex h-screen bg-gray-100 font-sans">
          
          {/* SECCIÓN IZQUIERDA: CARRITO */}
          <div className="flex-1 p-4 flex flex-col gap-4">
            
            {/* Banner Cliente */}
            <div className="flex justify-between items-center bg-blue-600 p-4 rounded-xl text-white shadow-lg">
              <div>
                <span className="text-xs uppercase opacity-75">Cliente Actual:</span>
                <div className="font-bold text-lg">{cliente.nombre}</div>
                <div className="text-xs opacity-80">{cliente.rif}</div>
              </div>
              <button 
                onClick={() => setMostrarModalCliente(true)}
                className="bg-white text-blue-600 px-4 py-2 rounded-lg text-sm font-bold hover:bg-blue-50 transition"
              >
                CAMBIAR / NUEVO CLIENTE
              </button>
            </div>

            <div className="bg-white rounded-xl shadow-md flex-1 overflow-hidden flex flex-col border border-gray-200">
              <div className="p-4 border-b flex justify-between items-center bg-gray-50">
                <h2 className="text-xl font-bold text-gray-700 uppercase italic">🛒 Carrito de Ventas</h2>
                <span className="font-mono text-blue-600 font-black bg-blue-50 px-3 py-1 rounded-lg border border-blue-100">Tasa: {tasa} VES</span>
              </div>
              
              <div className="overflow-y-auto flex-1">
                <table className="w-full text-left border-collapse">
                  <thead className="bg-gray-100 sticky top-0 z-10">
                    <tr className="text-gray-600 text-[10px] uppercase font-black">
                      <th className="p-4">Producto / Presentación</th>
                      <th className="p-4 text-center">Cant.</th>
                      <th className="p-4">Precio ($)</th>
                      <th className="p-4 text-right">Subtotal</th>
                      <th className="p-4"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {/* Corregido: Agregado (item, index) para que funcione el resaltado del último item */}
                    {carrito.map((item, index) => (
                      <tr 
                        key={item.idProductoUnidad} 
                        className={`border-b hover:bg-blue-50/50 transition ${index === carrito.length - 1 ? 'bg-yellow-50/30' : ''}`}
                      >
                        <td className="p-4">
                          <div className="font-bold text-gray-800 uppercase text-sm">{item.descripcion}</div>
                          <div className="text-[10px] font-mono text-gray-400">{item.codigoProd}</div>
                        </td>
                        <td className="p-4 text-center">
                          <div className="flex flex-col items-center">
                            <button 
                              onClick={() => cambiarCantidadManual(item)}
                              className="font-black text-blue-600 text-lg bg-blue-50 px-3 py-1 rounded-lg border border-blue-200 hover:bg-blue-500 hover:text-white transition-all shadow-sm"
                              title="Click para cambiar cantidad (o F6 para el último)"
                            >
                              {Number(item.cantidad).toLocaleString('en-US', { maximumFractionDigits: 3 })}
                            </button>
                            <span className="text-[10px] mt-1 text-gray-400 font-normal uppercase">{item.unidad}</span>
                          </div>
                        </td>
                        <td className="p-4 font-mono text-gray-600 text-sm">${item.precio.toFixed(2)}</td>
                        <td className="p-4 text-right font-mono">
                          <div className="text-gray-900 font-black text-sm">
                            ${(item.precio * item.cantidad).toFixed(2)}
                          </div>
                          <div className="text-blue-700 text-[10px] font-bold">
                            {((item.precio * item.cantidad) * tasa).toLocaleString('es-VE', { minimumFractionDigits: 2 })} Bs.
                          </div>
                        </td>
                        <td className="p-4 text-center">
                          <button onClick={() => setCarrito(prev => prev.filter(i => i.idProductoUnidad !== item.idProductoUnidad))} className="hover:scale-125 transition-transform text-xl">🗑️</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* SECCIÓN DERECHA: TOTALES Y BÚSQUEDA */}
          <div className="w-96 p-4 bg-white border-l shadow-2xl flex flex-col gap-4 overflow-y-auto">

            {/* 1. Buscador de Productos */}
            <div className="relative" style={{ zIndex: 50 }}>
              <label className="block text-[10px] font-black mb-1 text-gray-400 uppercase">
                F2 - Buscador de Productos
              </label>
              <input
                ref={inputBusquedaRef}
                type="text"
                value={busqueda}
                onChange={(e) => manejarBusqueda(e.target.value)}
                className="w-full p-4 border-2 border-blue-50 rounded-xl focus:border-blue-500 outline-none text-lg shadow-sm font-bold placeholder:font-normal"
                placeholder="Escanear o escribir..."
                autoFocus
              />

              {/* Resultados de Búsqueda con soporte para navegación por teclado */}
              {resultadosBusqueda.length > 0 && (
                <div
                  className="absolute left-0 right-0 bg-white border-2 border-blue-500 rounded-xl shadow-[0px_10px_40px_rgba(0,0,0,0.4)] mt-1 max-h-80 overflow-y-auto"
                  style={{ zIndex: 9999 }}
                >
                  {resultadosBusqueda.map((prod, index) => (
                    <div
                      id={`prod-res-${index}`}
                      key={`${prod.idProductoUnidad}-${index}`}
                      role="button"
                      tabIndex="0"
                      className={`p-4 border-b flex justify-between items-center cursor-pointer transition-colors outline-none group
                        ${index === indexSeleccionado 
                          ? "bg-blue-600 text-white shadow-inner" 
                          : "hover:bg-blue-100 text-gray-800"
                        }`}
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        agregarAlCarrito(prod);
                      }}
                      // Mantenemos soporte de Enter individual por accesibilidad
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          agregarAlCarrito(prod);
                        }
                      }}
                    >
                      <div className="flex-1">
                        <span className={`font-bold block uppercase text-xs ${index === indexSeleccionado ? "text-white" : "text-gray-800"}`}>
                          {prod.descripcion}
                        </span>
                        <div className="flex items-center gap-2">
                          <small className={`font-mono text-[10px] ${index === indexSeleccionado ? "text-blue-100" : "text-gray-400"}`}>
                            {prod.codigo} | {prod.unidad}
                          </small>
            
                          {/* Botón de Presentaciones (F7) */}
                          <button
                              type="button"
                              onClick={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  verPresentaciones(prod.codigoProd);
                              }}
                              className={`px-2 py-0.5 rounded text-[10px] font-black border transition-colors
                                  ${index === indexSeleccionado 
                                      ? "bg-white text-blue-600 border-white" // Resaltado cuando está seleccionado
                                      : "bg-blue-50 text-blue-600 border-blue-200"
                                  }`}
                          >
                              {/* CAMBIO: Texto indicativo más claro */}
                              {index === indexSeleccionado ? "ENTER SELECCIONAR" : "📦 + F7"}
                          </button>
                        </div>
                      </div>
        
                      <div className="text-right">
                        <span className={`block font-black text-sm ${index === indexSeleccionado ? "text-white" : "text-blue-600"}`}>
                          ${(prod.precioUSD || 0).toFixed(2)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* 2. Pantalla de Totales (Negra) */}
            <div className="bg-gray-900 p-5 rounded-3xl text-white shadow-xl space-y-2">
              <div className="flex justify-between text-gray-400 text-[10px] uppercase font-bold">
                <span>Subtotal:</span><b className="font-mono text-white">${subtotalUSD.toFixed(2)}</b>
              </div>
              <div className="flex justify-between text-gray-400 text-[10px] uppercase font-bold">
                <span>IVA:</span><b className="font-mono text-white">${totalIVAUSD.toFixed(2)}</b>
              </div>
              <div className="pt-2 border-t border-gray-700 mt-2">
                <div className="text-right">
                  <div className="text-4xl font-black text-green-400 font-mono">${totalUSD.toFixed(2)}</div>
                  <div className="text-[11px] font-bold text-gray-400 italic">
                    ≈ {totalVES.toLocaleString('es-VE', { minimumFractionDigits: 2 })} Bs.
                  </div>
                </div>
              </div>
    
              <div className="grid grid-cols-2 gap-2 mt-4">
                <button 
                  onClick={() => setMostrarArqueo(true)} 
                  className="bg-white/10 hover:bg-white/20 text-white text-[9px] font-black py-2 rounded-lg border border-white/5 transition-all uppercase"
                >
                  📊 F9 Arqueo
                </button>
                {/*<button 
                  className="bg-white/10 text-white text-[9px] font-black py-2 rounded-lg opacity-40 cursor-not-allowed uppercase"
                ></div>*/}
                  {/*⚙️ Opciones*/}
                {/*</button>*/}
              </div>
            </div>
            

            {/* 3. Panel de Pagos Multimoneda */}
            <div className="p-4 bg-gray-50 rounded-2xl border border-gray-200 space-y-3 shadow-inner">
              <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-2">
                <span className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></span>
                Métodos de Pago
              </h3>

              <div className="space-y-2">
                <div className="flex items-center bg-white p-2 rounded-xl border border-green-200 shadow-sm">
                  <span className="text-[10px] font-black w-20 text-green-700">EFECTIVO $</span>
                  <input 
                    type="number" 
                    value={pagos.efectivoUSD || ""} 
                    onChange={(e) => setPagos({...pagos, efectivoUSD: e.target.value})} 
                    className="w-full outline-none text-right font-mono font-bold text-green-600" 
                    placeholder="0.00" 
                  />
                </div>

                <div className="space-y-1.5 bg-blue-50/50 p-2.5 rounded-xl border border-blue-100">
                  <span className="text-[8px] font-black text-blue-500 block mb-1 uppercase tracking-tighter">Pagos en Bolívares (Tasa: {tasa})</span>
                  {[
                    { label: 'EFECTIVO BS', key: 'efectivoVES' },
                    { label: 'PAGO MÓVIL', key: 'pagoMovil' },
                    { label: 'PUNTO BDV', key: 'puntoBDV' },
                    { label: 'PUNTO BANCAMIGA', key: 'puntoBancamiga' }
                    
                  ].map((metodo) => (
                    <div key={metodo.key} className="flex items-center bg-white p-1.5 rounded-lg border border-blue-100 shadow-sm">
                      <span className="text-[9px] font-bold w-24 text-gray-500 uppercase">{metodo.label}</span>
                      <input 
                        type="number" 
                        value={pagos[metodo.key] || ""} 
                        onChange={(e) => setPagos({...pagos, [metodo.key]: e.target.value})} 
                        className="w-full outline-none text-right text-xs font-mono font-bold" 
                        placeholder="0.00" 
                      />
                    </div>
                  ))}
                </div>

                <div className="flex items-center bg-amber-50 p-2 rounded-xl border border-amber-200 shadow-sm">
                  <span className="text-[10px] font-black w-20 text-amber-700">METAL (USD)</span>
                  <input 
                    type="number" 
                    value={pagos.metal || ""} 
                    onChange={(e) => setPagos({...pagos, metal: e.target.value})} 
                    className="w-full bg-transparent outline-none text-right font-mono font-bold text-amber-800" 
                    placeholder="0.00" 
                  />
                </div>
              </div>

              <div className="mt-4 p-3 rounded-2xl bg-gray-900 text-white shadow-lg transition-all">
                {faltaPorPagar > 0.01 ? (
                  <div className="flex justify-between items-center">
                    <div className="flex flex-col">
                      <span className="text-[9px] text-orange-400 font-black uppercase tracking-widest">Faltante</span>
                      <span className="text-[10px] text-gray-400">Restante en Bs: {(faltaPorPagar * tasa).toFixed(2)}</span>
                    </div>
                    <span className="text-2xl font-mono text-orange-400 font-black">${faltaPorPagar.toFixed(2)}</span>
                  </div>
                ) : (          
                  <div className="flex justify-between items-center">
                    <div className="flex flex-col">
                      <span className="text-[9px] text-green-400 font-black uppercase tracking-widest">Cambio</span>
                      <span className="text-[10px] text-gray-400">Entregar en Bs: {(vueltoUSD * tasa).toFixed(2)}</span>
                    </div>
                    <span className="text-2xl font-mono text-green-400 font-black">${vueltoUSD.toFixed(2)}</span>
                  </div>
                )}
              </div>

              <button 
                onClick={finalizarVenta}
                disabled={totalPagadoUSD < (totalUSD - 0.01)}
                className={`w-full py-4 rounded-2xl font-black text-base transition-all shadow-md ${
                    totalPagadoUSD >= (totalUSD - 0.01) 
                    ? "bg-green-500 hover:bg-green-600 text-white active:scale-95 cursor-pointer" 
                    : "bg-gray-200 text-gray-400 cursor-not-allowed"
                }`}
              >
                {totalPagadoUSD >= (totalUSD - 0.01) ? "🛒 REGISTRAR VENTA (F10)" : "ESPERANDO PAGO..."}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* 2. MODALES */}
      <ModalApertura 
          isOpen={!cajaAbierta} 
          API_URL={API_URL} 
          onOpenSuccess={() => {
              setCajaAbierta(true);
              setTimeout(() => inputBusquedaRef.current?.focus(), 500);
          }} 
      />

      {productoEnPesaje && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[10000] backdrop-blur-sm">
          <div className="bg-white p-8 rounded-3xl shadow-2xl w-96 text-center border-4 border-blue-500">
            <h2 className="text-2xl font-black mb-2 uppercase text-gray-800">{productoEnPesaje.descripcion}</h2>
            <p className="text-blue-600 font-bold mb-6 italic">Ingrese cantidad en {productoEnPesaje.unidad}</p>
      
            <form onSubmit={(e) => {
              e.preventDefault();
              e.stopPropagation();
              confirmarPeso(e);
              }}>
              <input 
                id="input-peso-balanza"
                type="number" 
                step="0.001"
                value={cantidadPeso}
                onChange={(e) => setCantidadPeso(e.target.value)}
                onKeyDown={(e) => {
                              if (e.key === 'Enter') e.stopPropagation();
                          }}
                className="w-full text-5xl p-4 border-b-4 border-blue-500 outline-none text-center font-mono mb-8 bg-blue-50"
                placeholder="0.000"
                autoFocus
              />
              <div className="flex gap-4">
                <button 
                  type="button"
                  onClick={() => {setProductoEnPesaje(null);setTimeout(() => inputBusquedaRef.current?.focus(), 100);}}
                  className="flex-1 bg-gray-200 py-4 rounded-xl font-bold text-gray-600 hover:bg-gray-300 transition"
                >
                  CANCELAR
                </button>
                <button 
                  type="submit"
                  className="flex-1 bg-blue-600 py-4 rounded-xl font-bold text-white hover:bg-blue-700 shadow-lg transition"
                >
                  ACEPTAR
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <ModalArqueo 
        isOpen={mostrarArqueo} 
        onClose={() => setMostrarArqueo(false)}
        API_URL={API_URL}
        //onWheel={(e) => e.target.blur()}
      />  

      <ModalCliente 
        isOpen={mostrarModalCliente} 
        onClose={() => setMostrarModalCliente(false)}
        onSelectCliente={(c) => setCliente(c)}
        API_URL={API_URL}
      />
    </>
  );
};

export default POS;