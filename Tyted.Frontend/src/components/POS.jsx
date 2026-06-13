import React, { useState, useContext, useRef, useEffect } from 'react';
import { ConfigContext } from '../Context/ConfigContext';
import ModalCliente from './ModalCliente';
import ModalArqueo from './ModalArqueo';
import ModalApertura from './ModalApertura';
import Swal from 'sweetalert2';

const CLIENTE_DEFECTO = { id: 1, nombre: "CLIENTE EVENTUAL", rif: "V00000000" };
const getAuthHeaders = () => ({
  'Content-Type': 'application/json',
  'Authorization': `Bearer ${localStorage.getItem("token")}`
  });
const POS = () => {
  const { tasa, API_URL, user } = useContext(ConfigContext);
  // Fase 3.3: Recuperar carrito al cargar
  const [carrito, setCarrito] = useState(() => {
    try {
      const saved = localStorage.getItem("tyted_carrito_v1");
      return saved ? JSON.parse(saved) : [];
    } catch { return []; }
  });

  // Sincronizar carrito con LocalStorage automáticamente
  useEffect(() => {
    localStorage.setItem("tyted_carrito_v1", JSON.stringify(carrito));
  }, [carrito]);

  const [busqueda, setBusqueda] = useState("");
  const [resultadosBusqueda, setResultadosBusqueda] = useState([]);
  const [indexSeleccionado, setIndexSeleccionado] = useState(-1);
  const [pagoCliente, setPagoCliente] = useState(0);
  const [cliente, setCliente] = useState(CLIENTE_DEFECTO);
  const [mostrarModalCliente, setMostrarModalCliente] = useState(false);
  const [productoEnPesaje, setProductoEnPesaje] = useState(null);
  const [cajaAbierta, setCajaAbierta] = useState(false);
  const [mostrarArqueo, setMostrarArqueo] = useState(false);
  const [mostrarHistorial, setMostrarHistorial] = useState(false);
  const [esCredito, setEsCredito] = useState(false);
  const [errorBusqueda, setErrorBusqueda] = useState(null);
  const [pagos, setPagos] = useState({
    efectivoUSD: 0,
    efectivoVES: 0,
    pagoMovil: 0,
    puntoBDV: 0,
    puntoBancamiga: 0,
    Metal: 0
    });
  const [datosEmpresa, setDatosEmpresa] = useState({
        razonSocial: "CARGANDO...",
        rif: "",
        direccion: "",
        telefono: ""
      });
      useEffect(() => {
    const cargarDatosEmpresa = async () => {
        try {
            const res = await fetch(`${API_URL}/Empresa/configuracion`,{
            headers: getAuthHeaders() // Agrégalo si el endpoint está protegido
        });
            if (res.ok) {
                const data = await res.json();
                // Aseguramos que data tenga datos, si no, mantenemos valores seguros
                setDatosEmpresa(data || {});
            }
        } catch (error) {
            console.error("Error cargando datos de empresa:", error);
        }
    };
    cargarDatosEmpresa();
    }, [API_URL]);

  // --- NUEVO ESTADO PARA PEDIDOS PENDIENTES ---
const [mostrarModalPedidos, setMostrarModalPedidos] = useState(false);

const [pedidoIdOrigen, setPedidoIdOrigen] = useState(null);

// --- FUNCIÓN PARA CARGAR EL PEDIDO AL CARRITO ---
const cargarPedidoAlCarrito = (pedido) => {
    if (!pedido || !pedido.detalles) return;

    const nuevosProductos = pedido.detalles.map(det => {
        const infoRaiz = det.productoUnidadNavigation?.producto;
        
        // 1. Lógica de IVA estandarizada (basada en tu ID de Tasa)
        const idTasa = infoRaiz?.idTasaIVA || det.idTasaIVA;
        let porcentaje = 0;
        if (idTasa === 2 || idTasa === 4) porcentaje = 16;
        else if (idTasa === 3) porcentaje = 8;

        const precioUSD = Number(det.precioUnitarioUSD) || 0;
        const cant = Number(det.cantidad) || 0;

        // 2. Retornamos el objeto EXACTAMENTE con la misma estructura que agregarAlCarrito
        return {
            idProductoUnidad: det.idProductoUnidad,
            codigoProd: det.codigoProd || infoRaiz?.codigoProd || 'S/C',
            descripcion: infoRaiz?.descripcion || det.descripcion || 'PRODUCTO', 
            precio: precioUSD, // Usamos 'precio' a secas como tu función
            porcentajeIva: porcentaje,
            precioVES: precioUSD * (tasa || 1),
            esExento: porcentaje === 0,
            cantidad: cant,
            unidad: det.nombreUnidad || det.unidad || 'UND',
            // Agregamos subtotal e impuesto para los cálculos del POS
            subtotal: precioUSD * cant,
            impuesto: precioUSD * (porcentaje / 100)
        };
    });

    // 3. Cargamos los productos al estado
    setCarrito(nuevosProductos);

    // 4. Sincronizamos el cliente
    if (pedido.cliente) {
        setCliente({
            id: pedido.cliente.id,
            nombre: pedido.cliente.nombre,
            rif: pedido.cliente.rif
        });
    } else {
        setCliente(CLIENTE_DEFECTO);
    }

    // 5. Control de interfaz
    if (typeof setMostrarModalPedidos === 'function') setMostrarModalPedidos(false);
    if (typeof setPedidoIdOrigen === 'function') setPedidoIdOrigen(pedido.id);
    
    console.log(`✅ Pedido #${pedido.id} cargado con éxito`, nuevosProductos);
};

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
    setErrorBusqueda(null);
    if (valor.length < 2) {
        setResultadosBusqueda([]);
        return;
    }

    try {
        const res = await fetch(`${API_URL}/Productos/buscar?termino=${valor}&tasaDelDia=${tasa}`, {
          method: 'GET', // Es buena práctica ser explícito
          headers: getAuthHeaders()
    });
          
        if (res.status === 404) {
            throw new Error("PRODUCTO_NO_ENCONTRADO");
        }

        if (!res.ok) {
            throw new Error("ERROR_SERVIDOR");
        }
        if (res.ok){
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
                if (unicos.length === 0) {
                        setErrorBusqueda("🔍 Producto no encontrado");
                }
            }
        }
    } catch (error) {
        if (error.message === "PRODUCTO_NO_ENCONTRADO") {
            setErrorBusqueda("🔍 Producto no encontrado");
        } else {
            setErrorBusqueda("⚠️ Error de red local. Verifique el servidor.");
        }
        setResultadosBusqueda([]);
    }
  };

  const notificar = (mensaje, tipo = 'info') => {
    Swal.fire({
      icon: tipo,
      title: tipo === 'error' ? 'Atención' : 'Operación Exitosa',
      text: mensaje,
      confirmButtonColor: '#2563eb'
    });
  };

  const [procesando, setProcesando] = useState(false);

  useEffect(() => {
    // Si el cliente es eventual, forzar a que no sea crédito
    if (cliente.id === 1) {
        setEsCredito(false);
    }
}, [cliente]);

const guardarPedido = async () => {
    if (carrito.length === 0) return notificar("El carrito está vacío", "error");

    // Validación de integridad (tomada de tu archivo Pedidos.jsx)
    const itemsInvalidos = carrito.filter(i => !i.idProductoUnidad);
    if (itemsInvalidos.length > 0) {
        notificar("Hay productos sin ID de unidad. Intente agregarlos de nuevo.", "error");
        return;
    }

    // Estructura de datos idéntica a la que espera tu API
    const pedidoData = {
        clienteId: Number(cliente.id),
        nombreCliente: cliente.nombre,
        rifCliente: cliente.rif,
        montoTotalUSD: Number(totalUSD.toFixed(2)),
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
                tasaIVA: pctIva,
                porcentajeIva: pctIva,
                montoIvaUSD: Number(montoIvaLinea.toFixed(2)),
                subtotalUSD: Number(subtotalLinea.toFixed(2)),
                totalLineaUSD: Number((subtotalLinea + montoIvaLinea).toFixed(2)),
                idProductoUnidad: Number(item.idProductoUnidad)
            };
        })
    };

    try {
        setProcesando(true);
        const res = await fetch(`${API_URL}/Pedidos`, {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify(pedidoData)
        });

        if (res.ok) {
            const data = await res.json();
            notificar(`Pedido #${data.id} guardado con éxito.`, "success");
            
            // Limpiar el POS para el siguiente cliente
            setCarrito([]);
            setCliente(CLIENTE_DEFECTO);
            setPagos({ efectivoUSD: 0, efectivoVES: 0, pagoMovil: 0, puntoBDV: 0, puntoBancamiga: 0, Metal: 0 });
            
            // Refrescar la lista de pedidos pendientes en el POS (si tienes la función)
            if (typeof obtenerPedidosPendientes === 'function') obtenerPedidosPendientes();
        } else {
            const errorText = await res.text();
            notificar("Error al guardar pedido: " + errorText, "error");
        }
    } catch (error) {
        console.error("Error:", error);
        notificar("Error de conexión al intentar guardar el pedido", "error");
    } finally {
        setProcesando(false);
        setTimeout(() => inputBusquedaRef.current?.focus(), 150);
    }
};

const obtenerPedidosPendientes = async () => {
    try {
        const response = await fetch(`${API_URL}/Pedidos`, {
          headers: getAuthHeaders()
        });
        if (response.ok) {
            const data = await response.json();
            // Si tienes un estado para los pedidos en el POS, lo actualizas aquí
            // setPedidos(data); 
            console.log("Lista de pedidos actualizada");
        }
    } catch (error) {
        console.error("Error al refrescar pedidos:", error);
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
        const res = await fetch(`${API_URL}/Productos/buscar?termino=${codigoMaestro}&tasaDelDia=${tasa}`, {
          headers: getAuthHeaders()
        });
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

  const agregarAlCarrito = (prod) => {
    // 1. Detección de pesaje (Kilo/Gramo)
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

    // 2. Lógica para unidades fijas
    setCarrito(carritoActual => {
        const existe = carritoActual.find(item => item.idProductoUnidad == prod.idProductoUnidad);

        if (existe) {
            return carritoActual.map(item =>
                item.idProductoUnidad == prod.idProductoUnidad 
                ? { 
                    ...item, 
                    cantidad: item.cantidad + 1,
                    subtotal: (item.cantidad + 1) * item.precio // Recalcular subtotal base
                  } 
                : item
            );
      } else {
              return [...carritoActual, {
                idProductoUnidad: prod.idProductoUnidad,
                codigoProd: prod.codigoProd,
                descripcion: prod.descripcion || prod.Descripcion,
                precio: prod.precioUSD || prod.precioMonedaBase,
                porcentajeIva: prod.porcentajeIva || 0,
                precioVES: (prod.precioUSD || prod.precioMonedaBase) * (tasa || 1),
                // --- NUEVOS CAMPOS FISCALES ---
                esExento: prod.esExento || false,
                cantidad: 1,
                unidad: prod.unidad,
              }];
        }
    });

    // 3. Limpieza
    setBusqueda("");
    setResultadosBusqueda([]);
    setTimeout(() => { inputBusquedaRef.current?.focus(); }, 100);
  };

const subtotalUSD = carrito.reduce((acc, item) => {
    const linea = Number(item.precio) * item.cantidad;
    return acc + Math.round(linea * 100) / 100;
}, 0);

// 2. Luego calculamos el IVA (Depende de los items, no de subtotalUSD)
const totalIVAUSD = carrito.reduce((acc, item) => {
    const precio = Number(item.precio) || 0;
    const porcentaje = Number(item.porcentajeIva) || 0; 
    return acc + (precio * (porcentaje / 100) * item.cantidad);
}, 0);

// 3. FINALMENTE el Total (Porque depende de que las dos anteriores ya existan)
const totalUSD = subtotalUSD + totalIVAUSD;
const totalVES = totalUSD * (tasa || 0);

const finalizarVenta = async (tipoVenta = null) => {
  if (carrito.length === 0) return;

  if (!tasa || tasa <= 0) {
    notificar("La tasa de cambio del día no es válida. Por favor, actualice la tasa.", "error");
    return;
  }

  const creditoFinal = tipoVenta !== null ? tipoVenta : esCredito;

  // 1. Cálculo del total pagado para validación (asegurando números)
  const totalPagadoUSD = 
    (Number(pagos.efectivoUSD || 0)) + 
    (Number(pagos.Metal || 0)) + 
    (Number(pagos.efectivoVES || 0) / tasa) + 
    (Number(pagos.pagoMovil || 0) / tasa) + 
    (Number(pagos.puntoBDV || 0) / tasa) + 
    (Number(pagos.puntoBancamiga || 0) / tasa);

  if (creditoFinal) {
        if (cliente.id === 1) {
            notificar("No se puede otorgar crédito al CLIENTE EVENTUAL.", "error");
            return;
        }
        if (!cliente.permitirCredito) {
            notificar("Este cliente no tiene autorizado el uso de crédito.", "error");
            return;
        }
    } else {
        // Validación para venta de contado
        if (totalPagadoUSD < (totalUSD - 0.01)) {
            notificar(`Pago insuficiente. Total: $${totalUSD.toFixed(2)} - Pagado: $${totalPagadoUSD.toFixed(2)}`, "error");
            return;
        }
    }
  
  // 2. Preparación de los pagos para la API
  const listaPagos = Object.entries(pagos)
    .filter(([_, monto]) => Number(monto) > 0)
    .map(([metodo, monto]) => {
      const valor = Number(monto);
      const esDolar = metodo === 'efectivoUSD' || metodo === 'Metal';
      const nombresMetodos = {
        efectivoUSD: 'EFECTIVO_USD',
        efectivoVES: 'EFECTIVO_VES',
        pagoMovil: 'PAGO_MOVIL',
        puntoBDV: 'PUNTO_BDV',
        puntoBancamiga: 'PUNTO_BANCAMIGA',
        Metal: 'METAL'
      };
      return {
        metodoPago: nombresMetodos[metodo] || metodo.toUpperCase(),
        montoMonedaBase: esDolar ? valor : valor / tasa,
        montoMonedaExt: esDolar ? valor * tasa : valor,
        tasaDeCambio: esDolar ? 1 : tasa
      };
    });

  // 3. Construcción del objeto Venta
  const ventaData = {
    clienteId: cliente.id || 1,
    usuario: user.username,
    esCredito: creditoFinal,
    fechaVenta: new Date().toISOString(),
    fechaVencimiento: creditoFinal ? new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString() : null,
    tipoMoneda: "USD",
    pedidoId: pedidoIdOrigen,
    tasaDia: tasa,
    tasaDeCambio: tasa,
    metodoPago: creditoFinal ? "CREDITO" : (listaPagos.length > 1 ? "MIXTO" : (listaPagos[0]?.metodoPago || "EFECTIVO_USD")),
    isAnulada: false,
    totalMonedaBase: totalUSD,
    totalMonedaExt: totalUSD * tasa,
    subtotalMonedaBase: subtotalUSD,
    ivaMonedaBase: totalIVAUSD,
    pagos: creditoFinal ? [] : [
            { metodoPago: "EFECTIVO_USD", monto: pagos.efectivoUSD, t: 1 },
            { metodoPago: "EFECTIVO_VES", monto: pagos.efectivoVES, t: tasa },
            { metodoPago: "PAGO_MOVIL", monto: pagos.pagoMovil, t: tasa },
            { metodoPago: "PUNTO_BDV", monto: pagos.puntoBDV, t: tasa },
            { metodoPago: "PUNTO_BANCAMIGA", monto: pagos.puntoBancamiga, t: tasa },
            { metodoPago: "METAL", monto: pagos.Metal, t: 1 }

        ].filter(p => p.monto > 0).map(p => ({
            metodoPago: p.metodoPago,
            montoMonedaBase: p.t === 1 ? Number(p.monto) : Number(p.monto) / tasa,
            montoMonedaExt: p.t === 1 ? Number(p.monto) * tasa : Number(p.monto),
            tasaDeCambio: p.t
        })),

    detalles: carrito.map(item => ({
      codigoProd: item.codigoProd,
      // Enviamos la descripción aunque el server la ignore, para depuración
      descripcion: item.nombre || item.descripcion || "PRODUCTO",
      idProductoUnidad: item.idProductoUnidad,
      nombreUnidad: item.unidad,
      cantidad: parseFloat(item.cantidad),
      precioUnitarioMonedaBase: parseFloat(item.precio),
      subtotalLineaMonedaBase: item.precio * item.cantidad,
      tasaIVA: item.porcentajeIva || 0,
      totalLineaMonedaBase: (item.precio * item.cantidad) * (1 + ((item.porcentajeIva || 0) / 100))
    }))
  };

  console.log("Objeto enviado a la API:", JSON.stringify(ventaData, null, 2));

  try {
    const response = await fetch(`${API_URL}/Ventas`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(ventaData)
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(errorText || "Error en el servidor");
    }

    const ventaGuardada = await response.json();

    // 4. RECUPERACIÓN DE DESCRIPCIONES PARA EL TICKET
    // Cruzamos los datos de la respuesta con el carrito local que aún existe en memoria
    const ventaParaTicket = {
      ...ventaGuardada,
      clienteNombre: cliente.nombre,
      clienteRif: cliente.rif,
      condicion: creditoFinal ? "CRÉDITO" : "CONTADO",
      detalles: ventaGuardada.detalles.map((detalle) => {
        const itemLocal = carrito.find(c => c.codigoProd === detalle.codigoProd);
        return {
          ...detalle,
          descripcion: itemLocal ? itemLocal.descripcion : "PRODUCTO"
        };
      })
    };    

    // 5. Impresión y limpieza de estados
    if (typeof imprimirTicket === 'function') {
      imprimirTicket(ventaParaTicket);
    }

    setCarrito([]);
    setPagos({ 
      efectivoUSD: 0, efectivoVES: 0, pagoMovil: 0, 
      puntoBDV: 0, puntoBancamiga: 0, Metal: 0 
    });
    setCliente(CLIENTE_DEFECTO);
    setPedidoIdOrigen(null);
    setEsCredito(false);
    setBusqueda("");
    setResultadosBusqueda([]);
    obtenerPedidosPendientes();
    
    alert(esCredito ? "✅ Venta a CRÉDITO registrada" : "✅ Venta registrada con éxito");
    setTimeout(() => inputBusquedaRef.current?.focus(), 150);
    

  } catch (err) {
    console.error("Error en la operación:", err);
    alert(`⚠️ ATENCIÓN:\n${err.message}`);
  }
};

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
        porcentajeIva: productoEnPesaje.porcentajeIva || 0,
        esExento: productoEnPesaje.esExento || false,
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
    (parseFloat(pagos.Metal || 0) );

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

const puedeFinalizar = carrito.length > 0 && (esCredito || totalPagadoUSD >= (totalUSD - 0.01));
const diferencia = totalUSD - totalPagadoUSD;



    const imprimirTicket = (venta) => {
    const ventana = window.open('', 'PRINT', 'height=600,width=400');

    if (!ventana) {
      notificar("El navegador bloqueó la impresión. Por favor, permite los popups.", "error");
      return;
    }

    // 1. Cálculos de totales en Bs (Moneda Extranjera)
    // Intentamos usar el valor del backend, si no, calculamos: Base * Tasa
    const montoExentoBs = venta.detalles.reduce((acc, item) => 
      acc + (item.tasaIVA === 0 ? (Number(item.subtotalLineaMonedaExt) || (Number(item.subtotalLineaMonedaBase) * venta.tasaDeCambio) || 0) : 0), 0);
    
    const baseImponibleBs = venta.detalles.reduce((acc, item) => 
      acc + (item.tasaIVA > 0 ? (Number(item.subtotalLineaMonedaExt) || (Number(item.subtotalLineaMonedaBase) * venta.tasaDeCambio) || 0) : 0), 0);

    const impuestoTotalBs = venta.detalles.reduce((acc, item) => 
      acc + (Number(item.ivaLineaMonedaExt) || (Number(item.totalLineaMonedaBase - item.subtotalLineaMonedaBase) * venta.tasaDeCambio) || 0), 0);

    ventana.document.write(`
    <html>
      <head>
        <style>
          body { font-family: 'Courier New', monospace; width: 260px; font-size: 12px; padding: 10px; margin: 0; }
          .text-center { text-align: center; }
          .text-right { text-align: right; }
          .linea { border-top: 1px dashed black; margin: 5px 0; }
          .total { font-size: 13px; font-weight: bold; }
          table { width: 100%; border-collapse: collapse; }
          .seccion-cliente { margin: 8px 0; font-size: 11px; }
        </style>
      </head>
      <body onload="window.print(); window.close();">
        <div class="text-center"><b>${datosEmpresa.razonSocial || 'NOMBRE DE EMPRESA'}</b></div>
        <div class="text-center">RIF: ${datosEmpresa.rif || 'J-00000000'}</div>
        <div class="direccion">${datosEmpresa.direccion || ''}</div>
        <div class="text-center" style="font-size:10px;">Telf: ${datosEmpresa.telefono || ''}</div>
        
        <div class="linea"></div>
        
        <div class="seccion-cliente">
          <div><b>CLIENTE:</b> ${venta.clienteNombre || 'CLIENTE EVENTUAL'}</div>
          <div><b>CI/RIF:</b> ${venta.clienteRif || 'V00000000'}</div>
          <div><b>CONDICIÓN:</b> ${venta.esCredito ? 'CRÉDITO' : 'CONTADO'}</div>
        </div>

        <div class="linea"></div>
        <div>DOC: ${venta.numeroFactura || '000000'}</div>
        <div>FECHA: ${new Date(venta.fechaVenta).toLocaleString()}</div>
        <div class="linea"></div>
        
        <table>
          <tbody>
            ${venta.detalles.map(item => `
              <tr><td colspan="3"><b>${item.descripcion}</b></td></tr>
              <tr>
                <td>${Number(item.cantidad).toFixed(3)}</td>
                <td>x ${(Number(item.precioUnitarioMonedaExt) || item.precioUnitarioMonedaBase * venta.tasaDeCambio).toFixed(2)}</td>
                <td class="text-right">${(Number(item.subtotalLineaMonedaExt) || item.subtotalLineaMonedaBase * venta.tasaDeCambio).toFixed(2)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
        
        <div class="linea"></div>
        <div class="text-right">EXENTO: ${montoExentoBs.toLocaleString('es-VE')} Bs.</div>
        <div class="text-right">BASE:   ${baseImponibleBs.toLocaleString('es-VE')} Bs.</div>
        <div class="text-right">IVA:    ${impuestoTotalBs.toLocaleString('es-VE')} Bs.</div>
        <div class="text-right total">TOTAL BS: ${venta.totalMonedaExt.toLocaleString('es-VE')}</div>
        <div class="text-right" style="font-size: 10px;">REF USD: $${venta.totalMonedaBase.toFixed(2)}</div>
        
        <div class="linea"></div>
        <div style="font-size: 10px;"><b>FORMAS DE PAGO:</b></div>
        ${venta.pagos.map(pago => `
          <div style="font-size: 10px; display: flex; justify-content: space-between;">
            <span>${pago.metodoPago.replace('_', ' ')}:</span>
            <span>${pago.montoMonedaExt.toLocaleString('es-VE', {minimumFractionDigits: 2})} ${pago.metodoPago.includes('USD') || pago.metodoPago === 'METAL' ? 'Bs.' : 'Bs.'}</span>
          </div>
        `).join('')}

        <div class="linea"></div>
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
      const token = localStorage.getItem("token");
      try {
          const res = await fetch(`${API_URL}/Ventas/estado-caja`, {
              method: 'GET',
              headers: getAuthHeaders()
          });
          if (res.ok) {
              const estaAbierta = await res.json();
              console.log("Estado de caja recibido:", estaAbierta);
              setCajaAbierta(estaAbierta);
          } else {
              // Si el token expiró o hay error 401, asumimos caja cerrada
              console.warn("No se pudo verificar caja (posible error de token), bloqueando...");
              setCajaAbierta(false);
          }
      } catch (e) {
          console.error("Error verificando caja:", e);
          setCajaAbierta(false);
          // Opcional: setCajaAbierta(false) para bloquear si el servidor está caído
      }
  };

console.log("Cliente Actual:", cliente.nombre, "Permitir Crédito:", cliente.permitirCredito);
  
return (
    <>
      {/* 1. ENVOLTORIO PRINCIPAL: Controla el bloqueo visual y funcional */}
      {/* Barra de Información del Sistema */}
      <div className="flex justify-between items-center mb-4 bg-gray-800 text-white p-2 rounded-lg text-xs font-bold uppercase tracking-wider">
        <span>🏪 {datosEmpresa.razonSocial}</span>
        <div className="flex gap-4 items-center">
          <button 
            onClick={() => setMostrarHistorial(true)}
            className="bg-red-500/20 hover:bg-red-500/40 text-red-200 border border-red-500/50 px-3 py-1 rounded transition-all text-[10px] font-black"
          >
            📋 HISTORIAL / ANULAR
          </button>
          <span className="text-green-400">👤 Cajero: {user?.username || 'DESCONOCIDO'}</span>
          <span className="text-blue-400">💼 Rol: {user?.rol || 'N/A'}</span>
        </div>
      </div>
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
                className={`w-full p-4 border-2 rounded-xl outline-none text-lg shadow-sm font-bold transition-all ${
                        errorBusqueda 
                          ? 'border-red-500 bg-red-50 shadow-[0_0_15px_rgba(239,68,68,0.2)]' 
                          : 'border-blue-50 focus:border-blue-500 bg-white'
                      }`}
                placeholder="Escanear o escribir..."
                autoFocus
              />
              {errorBusqueda && (
                <div className="absolute right-[105%] top-1/2 -translate-y-1/2 bg-red-600 text-white px-4 py-3 rounded-xl shadow-2xl flex items-center gap-2 animate-in fade-in zoom-in duration-300 whitespace-nowrap">
                  <span className="text-lg">🚫</span>
                  <div className="flex flex-col">
                    <span className="text-[10px] font-black opacity-80 leading-none">ERROR</span>
                    <span className="text-xs font-bold uppercase">{errorBusqueda}</span>
                  </div>
                    <button 
                      onClick={() => setErrorBusqueda(null)} 
                      className="ml-2 bg-red-700 hover:bg-red-800 w-6 h-6 rounded-full flex items-center justify-center transition-colors"
                      >
                      ✕
                      </button>
                     {/* Flechita del indicador */}
                  <div className="absolute -right-2 top-1/2 -translate-y-1/2 w-0 h-0 border-t-[8px] border-t-transparent border-l-[10px] border-l-red-600 border-b-[8px] border-b-transparent"></div>
                </div>
              )}
              

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
  
              {/* Fila de Subtotal */}
              <div className="flex justify-between text-gray-400 text-[10px] uppercase font-bold">
                <span>Subtotal:</span>
                <b className="font-mono text-white">${subtotalUSD.toFixed(2)}</b>
              </div>

              {/* Fila de IVA */}
              <div className="flex justify-between text-gray-400 text-[10px] uppercase font-bold">
                <span>IVA:</span>
                <b className="font-mono text-white">${totalIVAUSD.toFixed(2)}</b>
              </div>

              {/* Línea divisoria y Total */}
              <div className="pt-2 border-t border-gray-700 mt-2">
                <div className="text-right">
                  {/* Total en Dólares (Moneda Base) */}
                  <div className="text-4xl font-black text-green-400 font-mono">
                    ${totalUSD.toFixed(2)}
                  </div>
      
                  {/* Total en Bolívares (Moneda Extranjera) */}
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
                    onWheel={(e) => e.target.blur()} 
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
                        onWheel={(e) => e.target.blur()} 
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
                    value={pagos.Metal || ""} 
                    onChange={(e) => setPagos({...pagos, Metal: e.target.value})}
                    onWheel={(e) => e.target.blur()} 
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
              

              {/* Panel de Totales y Botón */}
              <div className="p-6 border-t bg-white">
                {esCredito && cliente.id === 1 && (
                  <div className="bg-red-100 text-red-700 p-3 rounded-xl mb-4 text-center font-bold animate-pulse">
                    ⚠️ SELECCIONE UN CLIENTE REGISTRADO PARA OTORGAR CRÉDITO
                  </div>
                )}
  
                <div className="flex flex-col gap-3">
                  {/* BOTÓN 1: FINALIZAR VENTA (CONTADO) */}
                  <button
                    onClick={() => {
                      setEsCredito(false);
                      finalizarVenta();
                    }}
                    // Se deshabilita si el carrito está vacío O si no se ha pagado el total
                    disabled={carrito.length === 0 || totalPagadoUSD < (totalUSD - 0.01)}
                    className={`w-full py-4 rounded-2xl font-black text-xl shadow-lg transition-all ${
                      carrito.length > 0 && totalPagadoUSD >= (totalUSD - 0.01)
                        ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                        : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                    }`}
                  >
                    <div className="flex flex-col">
                      <span>✅ FINALIZAR VENTA</span>
                      <span className="text-xs font-normal opacity-80">Pago de Contado / Mixto</span>
                    </div>
                  </button>

                  {/* BOTÓN 2: REGISTRAR CRÉDITO */}
                  <button
                    onClick={() => finalizarVenta(true)}
                    // BLOQUEO TRIPLE: Carrito vacío OR Cliente Eventual OR Sin permiso de crédito
                    disabled={
                      carrito.length === 0 || 
                      cliente.id === 1 || 
                      cliente.permitirCredito === false // Validación estricta
                    }
                    className={`w-full py-4 rounded-2xl font-black text-xl shadow-lg transition-all ${
                      carrito.length > 0 && cliente.id !== 1 && cliente.permitirCredito
                        ? 'bg-orange-500 hover:bg-orange-600 text-white'
                        : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                    }`}
                  >
                    <div className="flex flex-col">
                      <span>📦 REGISTRAR CRÉDITO</span>
                      <span className="text-xs font-normal opacity-80">
                        {cliente.id === 1 
                          ? 'No disponible para Cliente Eventual' 
                          : !cliente.permitirCredito 
                            ? `🚫 ${cliente.nombre} NO TIENE CRÉDITO AUTORIZADO` 
                            : `Asignar a: ${cliente.nombre}`}
                      </span>
                    </div>
                  </button>
                  {/* NUEVO BOTÓN: IMPORTAR PEDIDO */}
                      <button 
                      
                        onClick={() => setMostrarModalPedidos(true)}
                        
                        className="bg-orange-500 text-white p-2 rounded-lg hover:bg-orange-600 transition shadow-sm font-bold text-xs flex items-center gap-1"
                      >
                        <span>📋</span> PEDIDOS
                      </button>
                      <div className="flex flex-col gap-2 mt-4">
                          {/* Botón para guardar y esperar al cliente */}
                          <button
                              onClick={guardarPedido}
                              disabled={procesando || carrito.length === 0}
                              className={`w-full py-3 rounded-xl font-black text-lg transition-all border-2 ${
                                  procesando 
                                  ? 'bg-gray-100 text-gray-400 border-gray-200' 
                                  : 'bg-yellow-50 text-yellow-700 border-yellow-200 hover:bg-yellow-100'
                              }`}
                          >
                              {procesando ? 'GUARDANDO...' : '⏸️ GUARDAR PEDIDO (ESPERAR)'}
                          </button>

                          {/* Tu botón actual de Finalizar Venta */}
                          <button
                              onClick={() => finalizarVenta()}
                              disabled={!puedeFinalizar || procesando}
                              className={`w-full py-4 rounded-xl font-black text-2xl shadow-lg transition-all ${
                                  puedeFinalizar && !procesando
                                  ? 'bg-green-600 text-white hover:bg-green-700' 
                                  : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                              }`}
                          >
                              {esCredito ? 'REGISTRAR CRÉDITO' : 'FINALIZAR VENTA'}
                          </button>
                      </div>
                </div>
              </div>
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
      {/* Modal para historial de ventas / anulación */}
      <ModalHistorialVentas
        isOpen={mostrarHistorial}
        onClose={() => setMostrarHistorial(false)}
        API_URL={API_URL}
      />
      {/* Al final de tu componente POS, junto a los otros modales */}
      <ModalPedidosPendientes 
        isOpen={mostrarModalPedidos}
        onClose={() => setMostrarModalPedidos(false)}
        onSeleccionar={cargarPedidoAlCarrito}
        API_URL={API_URL}
        setCarrito={setCarrito}
        setCliente={setCliente}
        setEsCredito={setEsCredito}
        setMostrarModalPedidos={setMostrarModalPedidos}
        setPedidoIdOrigen={setPedidoIdOrigen}
        tasa={tasa}
        CLIENTE_DEFECTO={CLIENTE_DEFECTO}
      />
    </>
  );
  
  
  
};

const ModalHistorialVentas = ({ isOpen, onClose, API_URL }) => {
    const [ventas, setVentas] = useState([]);
    const [busqueda, setBusqueda] = useState("");

    useEffect(() => {
        if (isOpen) cargarVentas();
    }, [isOpen]);

    const cargarVentas = async () => {
        try {
            const res = await fetch(`${API_URL}/Ventas`, { headers: getAuthHeaders() });
            if (res.ok) setVentas(await res.json());
        } catch (err) { console.error("Error cargando historial:", err); }
    };

    const handleAnular = async (id, numero) => {
        const clave = prompt(`⚠️ SEGURIDAD: Ingrese clave de ADMINISTRADOR para anular la factura #${numero}:`);
        
        if (!clave) return;

        if (!window.confirm(`¿Confirmar anulación de la factura ${numero}? El stock será revertido.`)) return;

        try {
            const res = await fetch(`${API_URL}/Ventas/anular/${id}`, { 
                method: 'POST', 
                headers: {
                    ...getAuthHeaders(),
                    'X-Admin-Key': clave
                }
            });
            if (res.ok) {
                notificar("Factura anulada y stock actualizado.", "success");
                cargarVentas();
            } else {
                const msg = await res.text();
                notificar("Error: " + msg, "error");
            }
        } catch (err) { notificar("Error de conexión al intentar anular.", "error"); }
    };

    if (!isOpen) return null;
    const filtradas = Array.isArray(ventas) ? ventas.filter(v => v.numeroFactura?.toLowerCase().includes(busqueda.toLowerCase())) : [];

    return (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[200] flex items-center justify-center p-4">
            <div className="bg-white w-full max-w-4xl rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
                <div className="p-6 border-b flex justify-between items-center bg-gray-50">
                    <h2 className="text-2xl font-black text-gray-800 uppercase flex items-center gap-2">📝 Historial de Ventas</h2>
                    <button onClick={onClose} className="text-gray-400 hover:text-red-500 text-3xl font-bold">&times;</button>
                </div>
                <div className="p-4 bg-gray-100">
                    <input 
                        type="text" placeholder="Buscar por número de factura..." 
                        className="w-full p-3 rounded-xl border-2 border-gray-200 outline-none focus:border-blue-500 transition-all font-bold"
                        value={busqueda} onChange={(e) => setBusqueda(e.target.value)}
                    />
                </div>
                <div className="flex-1 overflow-y-auto p-4">
                    <table className="w-full text-left">
                        <thead className="bg-gray-50 sticky top-0">
                            <tr className="text-gray-400 uppercase text-[10px] font-black">
                                <th className="p-4">Factura</th>
                                <th className="p-4">Fecha</th>
                                <th className="p-4">Total ($)</th>
                                <th className="p-4">Estado</th>
                                <th className="p-4 text-center">Acción</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {filtradas.map(v => (
                                <tr key={v.ventaId} className={v.isAnulada ? "bg-red-50/30 opacity-60" : "hover:bg-blue-50/50"}>
                                    <td className="p-4 font-bold text-gray-700">#{v.numeroFactura}</td>
                                    <td className="p-4 text-xs text-gray-500">{new Date(v.fechaVenta).toLocaleString()}</td>
                                    <td className="p-4 font-mono font-black text-blue-600">${v.totalMonedaBase.toFixed(2)}</td>
                                    <td className="p-4">
                                        {v.isAnulada ? <span className="bg-red-100 text-red-600 px-2 py-1 rounded text-[10px] font-black">ANULADA</span> : <span className="bg-green-100 text-green-600 px-2 py-1 rounded text-[10px] font-black">ACTIVA</span>}
                                    </td>
                                    <td className="p-4 text-center">
                                        {!v.isAnulada && <button onClick={() => handleAnular(v.ventaId, v.numeroFactura)} className="bg-red-600 text-white px-3 py-1.5 rounded-lg text-[10px] font-black hover:bg-red-700 shadow-sm">ANULAR</button>}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

const ModalPedidosPendientes = ({ 
    isOpen, 
    onClose, 
    API_URL, 
    setCarrito, 
    setCliente, 
    setPedidoIdOrigen, 
    setEsCredito, 
    setMostrarModalPedidos,
    tasa,
    CLIENTE_DEFECTO 
}) => {
    const [pedidos, setPedidos] = useState([]);
    const [busqueda, setBusqueda] = useState("");
    const [procesando, setProcesando] = useState(false);

    

// REEMPLÁZALO POR ESTO:
useEffect(() => {
    const cargarLista = async () => {
        try {
            const res = await fetch(`${API_URL}/Pedidos`, {
                headers: getAuthHeaders() // Ahora sí incluye el token
            });

            if (!res.ok) {
                if (res.status === 401) console.error("❌ No autorizado. Revisa el token.");
                return;
            }

            const data = await res.json();
            setPedidos(data);
        } catch (err) {
            console.error("❌ Error cargando lista:", err);
        }
    };

    if (isOpen) {
        cargarLista();
    }
}, [isOpen, API_URL]);

    // Función de importación con la lógica de IVA corregida
    const manejarSeleccion = async (id) => {
        try {
            setProcesando(true);
            const response = await fetch(`${API_URL}/Pedidos/${id}`, {
                headers: getAuthHeaders() // Asegúrate de incluir el token
            });
            
            if (response.ok) {
                const pedido = await response.json();
                
                const itemsParaCarrito = pedido.detalles.map((d) => {
                    const infoRaiz = d.productoUnidadNavigation?.producto;
                    
                    // --- LÓGICA DE IVA UNIFICADA (Evita el null de la DB) ---
                    const idTasa = infoRaiz?.idTasaIVA || d.idTasaIVA;
                    let porcentaje = 0;
                    if (idTasa === 2 || idTasa === 4) porcentaje = 16;
                    else if (idTasa === 3) porcentaje = 8;

                    const precio = Number(d.precioUnitarioUSD) || 0;

                    return {
                        idProductoUnidad: d.idProductoUnidad,
                        codigoProd: d.codigoProd || infoRaiz?.codigoProd || 'S/C',
                        descripcion: infoRaiz?.descripcion || d.descripcion || "PRODUCTO",
                        precio: precio,
                        porcentajeIva: porcentaje,
                        precioVES: precio * (tasa || 1),
                        esExento: porcentaje === 0,
                        cantidad: Number(d.cantidad) || 0,
                        unidad: d.nombreUnidad || d.productoUnidadNavigation?.nombreUnidad || "UND",
                        impuesto: precio * (porcentaje / 100),
                        esPesado: infoRaiz?.tipoArt === 'Peso' || d.tipoArt === 'Peso'
                    };
                });

                // 1. Actualizar Carrito
                setCarrito(itemsParaCarrito);
                
                // 2. Actualizar Cliente y Crédito
                if (pedido.cliente) {
                    const tieneCredito = pedido.cliente.permitirCredito === true || pedido.cliente.permitirCredito === 1;
                    setCliente({
                        id: pedido.clienteId || pedido.cliente.id,
                        nombre: pedido.cliente.nombre,
                        rif: pedido.cliente.rif,
                        permitirCredito: tieneCredito
                    });
                    if (typeof setEsCredito === 'function') setEsCredito(tieneCredito);
                } else {
                    setCliente(CLIENTE_DEFECTO);
                }

                // 3. Control de Estado del POS
                if (typeof setPedidoIdOrigen === 'function') setPedidoIdOrigen(id);
                if (typeof setVista === 'function') setVista('nuevo'); 
                if (typeof setMostrarModalPedidos === 'function') setMostrarModalPedidos(false);
                
                notificar("Pedido importado con éxito", "success");
            }
        } catch (error) {
            console.error("❌ Error al importar:", error);
            notificar("Error crítico al cargar el pedido", "error");
        } finally {
            setProcesando(false);
        }
    };

    if (!isOpen) return null;

    const pedidosFiltrados = Array.isArray(pedidos) 
        ? pedidos.filter(p => 
            p.id.toString().includes(busqueda) || 
            p.cliente?.nombre?.toLowerCase().includes(busqueda.toLowerCase())
          )
        : [];

    return (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
            <div className="bg-white w-full max-w-3xl rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
                {/* Cabecera */}
                <div className="p-6 border-b flex justify-between items-center bg-gray-50">
                    <div className="flex items-center gap-3">
                        <span className="text-3xl">📋</span>
                        <h2 className="text-2xl font-black text-gray-800 uppercase">Pedidos Pendientes</h2>
                    </div>
                    <button onClick={onClose} className="text-gray-400 hover:text-red-500 text-3xl font-bold">&times;</button>
                </div>
                
                {/* Buscador */}
                <div className="p-4 bg-white">
                    <input 
                        type="text"
                        placeholder="🔍 Buscar por ID o Nombre de cliente..."
                        className="w-full p-4 border-2 border-blue-100 rounded-2xl focus:border-blue-500 outline-none transition-all text-lg"
                        value={busqueda}
                        onChange={(e) => setBusqueda(e.target.value)}
                        autoFocus
                    />
                </div>

                {/* Tabla */}
                <div className="flex-1 overflow-y-auto p-4">
                    <table className="w-full text-left border-separate border-spacing-y-2">
                        <thead>
                            <tr className="text-gray-400 uppercase text-xs">
                                <th className="px-4 py-2">ID</th>
                                <th className="px-4 py-2">Cliente</th>
                                <th className="px-4 py-2 text-right">Total</th>
                                <th className="px-4 py-2 text-center">Acción</th>
                            </tr>
                        </thead>
                        <tbody>
                            {pedidosFiltrados.map(p => (
                                <tr key={p.id} className="bg-gray-50 hover:bg-blue-50 transition-colors rounded-xl">
                                    <td className="px-4 py-4 font-bold text-blue-600 rounded-l-xl">#{p.id}</td>
                                    <td className="px-4 py-4">
                                        <div className="font-bold text-gray-700 uppercase">{p.cliente?.nombre}</div>
                                        <div className="text-xs text-gray-400">{p.cliente?.rif}</div>
                                    </td>
                                    <td className="px-4 py-4 text-right font-mono font-bold text-green-600">
                                        ${p.montoTotalUSD?.toFixed(2)}
                                    </td>
                                    <td className="px-4 py-4 text-center rounded-r-xl">
                                        <button 
                                            disabled={procesando}
                                            onClick={() => manejarSeleccion(p.id)}
                                            className={`${
                                                procesando ? 'bg-gray-300' : 'bg-blue-600 hover:bg-blue-700 shadow-md'
                                            } text-white px-6 py-2 rounded-xl font-black text-sm transition-all uppercase`}
                                        >
                                            {procesando ? 'Procesando...' : 'Importar'}
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    {pedidosFiltrados.length === 0 && (
                        <div className="text-center py-10 text-gray-400 font-bold">No hay pedidos pendientes.</div>
                    )}
                </div>
            </div>
        </div>
    );
};


export default POS;