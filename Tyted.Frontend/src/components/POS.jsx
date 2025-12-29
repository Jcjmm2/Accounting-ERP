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
  const [pagoCliente, setPagoCliente] = useState(0);
  const [cliente, setCliente] = useState(CLIENTE_DEFECTO);
  const [mostrarModalCliente, setMostrarModalCliente] = useState(false);
  const [resultadosBusqueda, setResultadosBusqueda] = useState([]);
  const [productoEnPesaje, setProductoEnPesaje] = useState(null);
  const [cantidadPeso, setCantidadPeso] = useState("");
    useEffect(() => {
      const manejarTeclas = (e) => {
          // ESC: Limpia buscador y resultados
          if (e.key === "Escape") {
              setBusqueda("");
              setResultadosBusqueda([]);
          }

          // F2: Enfoca el buscador desde cualquier parte
          if (e.key === "F2") {
              e.preventDefault();
              inputBusquedaRef.current?.focus();
          }
          // F9: Abre el Arqueo de Caja
          if (e.key === "F9") {
              e.preventDefault();
              setMostrarArqueo(true);
          }

          // Dentro del manejarTeclas...
          if (e.key === "F10") {
              e.preventDefault();
              finalizarVenta("EFECTIVO USD");
          }
          if (e.key === "F11") {
              e.preventDefault();
              finalizarVenta("PAGO MOVIL");
          }
      };

      window.addEventListener("keydown", manejarTeclas);
      return () => window.removeEventListener("keydown", manejarTeclas);
  }, [carrito, busqueda, cliente]);

  // --- ESTADOS DE CAJA ---
  const [cajaAbierta, setCajaAbierta] = useState(true); 

  // Verificamos el estado apenas carga el componente
  useEffect(() => {
      verificarEstadoCaja();
  }, []);

  const verificarEstadoCaja = async () => {
      try {
          const res = await fetch(`${API_URL}/Ventas/estado-caja`);
          if (res.ok) {
              const estaAbierta = await res.json();
              setCajaAbierta(estaAbierta);
          }
      } catch (e) {
          console.error("Error verificando caja:", e);
          // Opcional: setCajaAbierta(false) para bloquear si el servidor está caído
      }
  };

  const [mostrarArqueo, setMostrarArqueo] = useState(false);

  // Referencia para devolver el foco al buscador automáticamente
  const inputBusquedaRef = useRef(null);

  // --- Cálculos Centralizados ---
  const subtotalUSD = carrito.reduce((acc, item) => {const linea = Number(item.precio) * item.cantidad;return acc + Math.round(linea * 100) / 100;}, 0);
  const totalIVAUSD = carrito.reduce((acc, item) => {
    const precio = Number(item.precio) || 0;
    const tasaIva = Number(item.tasaIVA) || 0;
    return acc + (precio * (tasaIva / 100) * item.cantidad);
  }, 0);

  const totalUSD = subtotalUSD + totalIVAUSD;
  const totalVES = totalUSD * (tasa || 0);
  const vueltoUSD = pagoCliente > totalUSD ? pagoCliente - totalUSD : 0;
  const vueltoVES = vueltoUSD * tasa;

  // --- Funciones de Lógica ---

  const manejarBusqueda = async (valor) => {
    setBusqueda(valor);
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
  };

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

    const finalizarVenta = async (metodo) => {
        if (carrito.length === 0) return;

        const ventaData = {
            clienteId: cliente.id || 1,
            tipoMoneda: "USD",
            tasaDeCambio: tasa,
            metodoPago: metodo,
            subtotalMonedaBase: subtotalUSD,
            ivaMonedaBase: totalIVAUSD,
            totalMonedaBase: totalUSD,
            subtotalMonedaExt: subtotalUSD * tasa,
            ivaMonedaExt: totalIVAUSD * tasa,
            totalMonedaExt: totalUSD * tasa,
            isAnulada: false,
            detalles: carrito.map(item => ({
                codigoProd: item.codigoProd,
                idProductoUnidad: item.idProductoUnidad,
                nombreUnidad: item.unidad,
                cantidad: item.cantidad,
                tasaIVA: item.tasaIVA || 0,
                precioUnitarioMonedaBase: item.precio,
                subtotalLineaMonedaBase: item.precio * item.cantidad,
                totalLineaMonedaBase: (item.precio * item.cantidad) * (1 + (item.tasaIVA / 100))
            }))
        };

        try {
            const response = await fetch(`${API_URL}/Ventas`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(ventaData)
            });

            if (response.ok) {
                const resultado = await response.json();
            
                // 1. IMPRESIÓN AUTOMÁTICA
                imprimirTicket(resultado);

                // 2. LIMPIEZA COMPLETA PARA EL PRÓXIMO CLIENTE
                setCarrito([]);
                setPagoCliente(0);
                setBusqueda("");
                setResultadosBusqueda([]);
                setCliente(CLIENTE_DEFECTO); // Volvemos al cliente por defecto
            
                // 3. FOCO AL BUSCADOR
                setTimeout(() => inputBusquedaRef.current?.focus(), 150);
            
            } else {
            // Si el servidor responde con error (404, 500, etc)
            const errorTexto = await response.text(); // Leemos como texto para evitar el SyntaxError
            console.error("Error del servidor:", errorTexto);
            alert(`Error ${response.status}: No se pudo procesar la venta.`);
        }
    } catch (err) {
        console.error("Error de conexión:", err);
        alert("No hay conexión con el servidor (Verifica si el API está corriendo).");
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
                    {carrito.map(item => (
                      <tr key={item.idProductoUnidad} className="border-b hover:bg-blue-50/50 transition">
                        <td className="p-4">
                          <div className="font-bold text-gray-800 uppercase text-sm">{item.descripcion}</div>
                          <div className="text-[10px] font-mono text-gray-400">{item.codigoProd}</div>
                        </td>
                        <td className="p-4 text-center font-black text-blue-600 text-lg">
                          {Number(item.cantidad).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 3 })}
                          <span className="text-[10px] ml-1 text-gray-400 font-normal">{item.unidad}</span>
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
          <div className="w-96 p-4 bg-white border-l shadow-2xl flex flex-col gap-4">
  
            {/* Buscador con Z-Index superior para evitar bloqueos */}
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

              {/* Contenedor de Resultados con prioridad máxima de clic */}
              {resultadosBusqueda.length > 0 && (
                <div 
                  className="absolute left-0 right-0 bg-white border-2 border-blue-500 rounded-xl shadow-[0px_10px_40px_rgba(0,0,0,0.4)] mt-1 max-h-80 overflow-y-auto"
                  style={{ zIndex: 9999, pointerEvents: 'auto' }} 
                >
                  {resultadosBusqueda.map((prod, index) => (
                    <div 
                      key={`${prod.idProductoUnidad}-${index}`} 
                      tabIndex="0" 
                      role="button"
                      className="p-4 hover:bg-blue-100 border-b flex justify-between items-center cursor-pointer outline-none focus:bg-blue-200 transition-colors group"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        agregarAlCarrito(prod);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          e.stopPropagation();
                          agregarAlCarrito(prod);
                        }
                      }}
                    >
                      <div className="flex-1">
                        <span className="font-bold block text-gray-800 uppercase text-xs pointer-events-none">
                          {prod.descripcion}
                        </span>
                        <div className="flex items-center gap-2">
                          <small className="text-gray-400 font-mono text-[10px] pointer-events-none">
                            {prod.codigoProd} | {prod.unidad}
                          </small>
        
                          {/* Botón para ver otras presentaciones (Kilo/Gramo/etc) */}
                          <button
                            type="button"
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation(); // IMPORTANTE: Evita que se dispare el agregarAlCarrito del padre
                              verPresentaciones(prod.codigoProd);
                            }}
                            className="bg-blue-50 text-blue-600 px-2 py-0.5 rounded text-[10px] font-black hover:bg-blue-600 hover:text-white transition-all transform active:scale-90"
                            title="Ver más presentaciones"
                          >
                            📦 +
                          </button>
                        </div>
                      </div>
                      <div className="text-right pointer-events-none">
                        <span className="block font-black text-blue-600 text-sm">
                          ${(prod.precioUSD || 0).toFixed(2)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Desglose de Totales */}
            <div className="bg-gray-900 p-6 rounded-3xl text-white shadow-xl space-y-3">
              <div className="flex justify-between text-gray-400 text-xs uppercase font-bold">
                <span>Subtotal:</span><b className="font-mono text-white text-sm">${subtotalUSD.toFixed(2)}</b>
              </div>
              <div className="flex justify-between text-gray-400 text-xs uppercase font-bold">
                <span>IVA:</span><b className="font-mono text-white text-sm">${totalIVAUSD.toFixed(2)}</b>
              </div>
              <div className="pt-4 border-t border-gray-700">
                <div className="text-right">
                  <div className="text-5xl font-black text-green-400 font-mono">${totalUSD.toFixed(2)}</div>
                  <div className="text-sm font-bold text-gray-400 mt-1 italic">
                     ≈ {totalVES.toLocaleString('es-VE', { minimumFractionDigits: 2 })} Bs.
                  </div>
                </div>
              </div>
              
              <div className="space-y-3 mt-6">
                <button 
                  onClick={() => setMostrarArqueo(true)} 
                  className="w-full bg-white/10 hover:bg-white/20 text-white text-[10px] font-black py-2 rounded-xl transition-all uppercase tracking-widest border border-white/10"
                >
                  📊 F9 - Arqueo de Caja
                </button>
                <button 
                  onClick={() => finalizarVenta("EFECTIVO USD")}
                  className="w-full bg-green-500 hover:bg-green-600 text-white font-black py-4 rounded-2xl shadow-lg transition-all flex justify-between px-6 items-center group"
                >
                  <span className="text-xs uppercase">F10 - EFECTIVO USD</span>
                  <span className="text-xl group-active:scale-90 transition-transform">${totalUSD.toFixed(2)}</span>
                </button>

                <button 
                  onClick={() => finalizarVenta("PAGO MOVIL")}
                  className="w-full bg-blue-500 hover:bg-blue-600 text-white font-black py-4 rounded-2xl shadow-lg transition-all flex justify-between px-6 items-center group"
                >
                  <span className="text-xs uppercase">F11 - PAGO MOVIL</span>
                  <span className="text-sm group-active:scale-90 transition-transform">{totalVES.toLocaleString('es-VE')} Bs.</span>
                </button>
              </div>
            </div>

            {/* Calculadora de Vuelto */}
            <div className="p-4 bg-yellow-50 rounded-2xl border border-yellow-200">
              <label className="block text-[10px] font-black text-yellow-700 mb-1 uppercase">Pago del Cliente ($)</label>
              <input 
                type="number" 
                value={pagoCliente || ""}
                onChange={(e) => setPagoCliente(Number(e.target.value))}
                className="w-full p-2 text-3xl border-b-2 border-yellow-300 bg-transparent font-mono outline-none text-yellow-900"
                placeholder="0.00"
              />
              {pagoCliente > 0 && (
                <div className="mt-3 text-right animate-pulse">
                  <span className="block text-[10px] font-black text-red-500 uppercase italic">Cambio a entregar:</span>
                  <span className="text-3xl font-black text-red-600">${vueltoUSD.toFixed(2)}</span>
                  <div className="text-xs font-bold text-red-400">{vueltoVES.toLocaleString('es-VE')} Bs.</div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* 2. MODALES (Fuera del div de bloqueo) */}
      
      {/* Modal de Apertura - Este bloquea todo si cajaAbierta es false */}
      <ModalApertura 
          isOpen={!cajaAbierta} 
          API_URL={API_URL} 
          onOpenSuccess={() => {
              setCajaAbierta(true);
              setTimeout(() => inputBusquedaRef.current?.focus(), 500);
          }} 
      />

      {/* Modal de Pesaje - CORREGIDO */}
      {productoEnPesaje && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[10000] backdrop-blur-sm">
          <div className="bg-white p-8 rounded-3xl shadow-2xl w-96 text-center border-4 border-blue-500">
            <h2 className="text-2xl font-black mb-2 uppercase text-gray-800">{productoEnPesaje.descripcion}</h2>
            <p className="text-blue-600 font-bold mb-6 italic">Ingrese cantidad en {productoEnPesaje.unidad}</p>
      
            <form onSubmit={confirmarPeso}>
              <input 
                id="input-peso-balanza"
                type="number" 
                step="0.001"
                value={cantidadPeso}
                onChange={(e) => setCantidadPeso(e.target.value)}
                className="w-full text-5xl p-4 border-b-4 border-blue-500 outline-none text-center font-mono mb-8 bg-blue-50"
                placeholder="0.000"
                autoFocus
              />
              <div className="flex gap-4">
                <button 
                  type="button"
                  onClick={() => setProductoEnPesaje(null)}
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