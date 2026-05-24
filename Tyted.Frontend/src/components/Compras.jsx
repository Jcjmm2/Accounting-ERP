import React, { useState, useEffect, useContext } from 'react';
import { ConfigContext } from '../Context/ConfigContext';

const getAuthHeaders = () => ({
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${localStorage.getItem("token")}`
});
const Compras = () => {
    // 1. Contexto y Configuración
    const { API_URL, tasa } = useContext(ConfigContext);
    
    // 2. Estados de Datos
    const [proveedores, setProveedores] = useState([]);
    const [productosMaster, setProductosMaster] = useState([]);
    const [tasasReferencia, setTasasReferencia] = useState([]);
    
    // 3. Estados de la Compra y Formulario
    const [paso, setPaso] = useState(1);
    const [tasaCompra, setTasaCompra] = useState(tasa || 0); 
    const [monedaFactura, setMonedaFactura] = useState('USD');
    const [guardando, setGuardando] = useState(false);

    const [listaCompras, setListaCompras] = useState([]);
    const [verHistorial, setVerHistorial] = useState(false);

    // Estado para el producto que se está escribiendo actualmente (Entrada Rápida)
    const [productoEdicion, setProductoEdicion] = useState({
        idProductoUnidad: '',
        cantidad: 1,
        costoUnitario: 0
    });

    const [compra, setCompra] = useState({
        idProveedor: '',
        numeroFactura: '',
        detalles: []
    });

    // 4. Estado de propuestas para el Paso 2
    const [propuestas, setPropuestas] = useState([]);

    // 5. Carga de datos inicial
    useEffect(() => {
        cargarDatosIniciales();
        cargarTasasReferencia();
        cargarHistorialCompras();
    }, []);
    useEffect(() => {
        if (verHistorial) {
            cargarHistorialCompras();
        }
    }, [verHistorial]);

    const cargarHistorialCompras = async () => {
        try {
            const res = await fetch(`${API_URL}/Compras`, { headers: getAuthHeaders() });
            if (res.ok) setListaCompras(await res.json());
        } catch (error) {
            console.error("Error cargando historial:", error);
        }
    };

    const cargarDatosIniciales = async () => {
        try {
            const [resProv, resProd] = await Promise.all([
                fetch(`${API_URL}/Proveedores`, { headers: getAuthHeaders() }),
                fetch(`${API_URL}/Productos`, { headers: getAuthHeaders()})
            ]);
            
            if (resProv.ok) setProveedores(await resProv.json());
            
            if (resProd.ok) {
                const data = await resProd.json();
                const listaAplanada = data.flatMap(prod => 
                    prod.unidadesDeVenta.map(u => ({
                        idProductoUnidad: u.idProductoUnidad,
                        codigoProdOriginal: prod.codigoProd,
                        nombreUnidad: u.nombreUnidad,
                        nombreMostrar: `${prod.descripcion} (${u.nombreUnidad})`,
                        costoActual: u.costoUnitarioMonedaBase || 0,
                        precioVentaActual: u.precioMonedaBase || 0,
                        precio2Actual: u.precio2MonedaBase || 0, 
                        precio3Actual: u.precio3MonedaBase || 0,
                        porcentajeIva: prod.tasaIVA ? prod.tasaIVA.porcentaje : 0
                    }))
                );
                setProductosMaster(listaAplanada);
            }
        } catch (error) {
            console.error("Error cargando datos:", error);
        }
    };

    const cargarTasasReferencia = async () => {
        try {
            const res = await fetch(`${API_URL}/TasaDeCambio/comparativa-compras}`, {
                headers: getAuthHeaders() });
                if (res.ok) {
                const data = await res.json(); 
                setTasasReferencia(data);
            
                // Opcional: Si existe una tasa llamada "BCV", ponerla por defecto al cargar
                const bcv = data.find(t => t.nombreTasa === "BCV");
                if (bcv && tasaCompra === 0) {
                    setTasaCompra(bcv.tasa);
                }
            }
            } catch (error) {
                console.error("Error tasas:", error);
            }
    };

    // --- FUNCIONES DE MANEJO ---

    const handleAnularCompra = async (id) => {
        if (!window.confirm("¿Está seguro de anular esta compra? Se revertirá el stock y los costos promedio.")) return;
        try {
            setGuardando(true);
            const res = await fetch(`${API_URL}/Compras/anular/${id}`, { 
                method: 'POST',
                headers: getAuthHeaders()
            });
            const data = await res.json();
            if (res.ok) {
                alert(data.message);
                cargarHistorialCompras();
            } else {
                alert("Error: " + data.message);
            }
        } catch (error) { alert("Error de conexión"); } 
        finally { setGuardando(false); }
    };

    // Funciones de manejo de lista
    const agregarProductoALista = () => {
        if (!productoEdicion.idProductoUnidad || productoEdicion.cantidad <= 0) {
            return alert("Seleccione un producto y cantidad válida");
        }
        setCompra({ 
            ...compra, 
            detalles: [...compra.detalles, { ...productoEdicion }] 
        });
        setProductoEdicion({ idProductoUnidad: '', cantidad: 1, costoUnitario: 0 });
    };

    const eliminarLinea = (index) => {
        const d = [...compra.detalles];
        d.splice(index, 1);
        setCompra({...compra, detalles: d});
    };

    const reiniciarFormulario = () => {
        setCompra({ idProveedor: '', numeroFactura: '', detalles: [] });
        setPropuestas([]);
        setPaso(1);
    };

    const procesarCompra = async () => {
        // 1. VALIDACIONES INICIALES
        if (!compra.idProveedor || compra.detalles.length === 0) {
            return alert("Complete el proveedor y añada productos.");
        }

        const tasaFactura = parseFloat(tasaCompra); // La tasa que ingresó el usuario (ej: 285 BCV)
        
        if (!tasaFactura || tasaFactura <= 0) {
            return alert("La tasa de cambio de la factura debe ser mayor a 0.");
        }

        // --- LÓGICA DE REFERENCIA USDT ---
        // Buscamos la tasa USDT en tu lista de tasas cargadas (asumiendo que tienes una variable 'tasas' o 'tasasDb')
        // Si no encuentra USDT, usa la tasa de la factura como respaldo de seguridad.
        const tasaObjUSDT = tasasReferencia.find(t => t.nombreTasa === 'USDT' || t.monedaDestino === 'USDT'); 
        const tasaReferenciaUSDT = tasaObjUSDT ? parseFloat(tasaObjUSDT.tasa) : tasaFactura;

        const detallesCalculados = [];
        const listaPropuestas = [];

        console.log("--- INICIO PROCESAMIENTO INTELIGENTE ---");
        console.log("Moneda Documento:", monedaFactura);
        console.log("Tasa Documento (Contable):", tasaFactura);
        console.log("Tasa Mercado (Costo Base USDT):", tasaReferenciaUSDT);

        // 2. PROCESAMIENTO POR LÍNEA
        compra.detalles.forEach(d => {
            const infoProd = productosMaster.find(p => p.idProductoUnidad == d.idProductoUnidad);
            const costoIngresado = parseFloat(d.costoUnitario || 0);
            const cantidad = parseFloat(d.cantidad || 0);
            const porcentajeIva = infoProd?.porcentajeIva || 0;

            let costoBS = 0;   // Moneda Extendida (Local)
            let costoUSDT = 0; // Moneda Base (Sistema)

            // --- PASO A: NORMALIZACIÓN A BOLÍVARES ---
            // Primero convertimos lo que sea que haya entrado a Bolívares usando la tasa del documento.
            if (monedaFactura === 'VES' || monedaFactura === 'BS') {
                costoBS = costoIngresado;
            } else {
                // Si es USD, Efectivo USD, Zelle, etc., multiplicamos por la tasa de la factura
                costoBS = costoIngresado * tasaFactura; 
            }

            // --- PASO B: CÁLCULO DEL COSTO REAL (BASE USDT) ---
            // Dividimos los Bolívares entre la tasa de mercado (USDT 450)
            // Esto "encarece" o ajusta el costo en dólares a la realidad del mercado, no del BCV.
            costoUSDT = costoBS / tasaReferenciaUSDT;

            console.log(`Producto: ${infoProd?.nombreMostrar}`);
            console.log(`- Facturado: ${costoIngresado} (${monedaFactura})`);
            console.log(`- Contable BS: ${costoBS.toFixed(2)}`);
            console.log(`- Costo Real USDT: ${costoUSDT.toFixed(4)}`);

            // Cálculos de Totales por Línea
            const subtotalBase = costoUSDT * cantidad;
            const impuestolBase = subtotalBase * (porcentajeIva / 100);
            
            const subtotalExt = costoBS * cantidad;
            const impuestolExt = subtotalExt * (porcentajeIva / 100);

            // Estructura para el Backend (Tabla ComprasDetalle)
            detallesCalculados.push({
                IdProductoUnidad: parseInt(d.idProductoUnidad),
                CodigoProd: infoProd?.codigoProdOriginal || "",
                UnidadCompra: infoProd?.nombreUnidad || "",
                Cantidad: cantidad,
                
                // MONEDA BASE (USDT - Calculado con Tasa Mercado)
                CostoUnitarioMonedaBase: costoUSDT, 
                SubtotalLineaMonedaBase: subtotalBase,
                // El total base incluye el IVA
                TotalLineaMonedaBase: subtotalBase + impuestolBase,
                
                // MONEDA EXT (BS - Calculado con Tasa Factura)
                CostoUnitarioMonedaExt: costoBS, 
                SubtotalLineaMonedaExt: subtotalExt,
                TotalLineaMonedaExt: subtotalExt + impuestolExt,
                IvaLineaMonedaExt: impuestolExt, // Tu DTO pedía este campo específico

                TasaIVA: porcentajeIva
            });

            // Estructura para el Paso 2 (Propuestas de Precio)
            listaPropuestas.push({
                idProductoUnidad: parseInt(d.idProductoUnidad),
                descripcion: infoProd?.nombreMostrar || "Producto",
                costoAnterior: infoProd?.costoActual || 0,
                costoFacturaOriginal: costoIngresado, 
                monedaOriginal: monedaFactura,
                
                precio1Anterior: infoProd?.precioVentaActual || 0,
                precio2Anterior: infoProd?.precio2Actual || 0,
                precio3Anterior: infoProd?.precio3Actual || 0,
                
                // Aquí usamos el costo USDT inteligente
                nuevoCostoBase: costoUSDT, 
                
                // Sugerencias de precios: Mantienen margen sobre el costo USDT
                nuevoPrecioBase: Math.max(infoProd?.precioVentaActual || 0, costoUSDT * 1.30),
                nuevoPrecio2Base: Math.max(infoProd?.precio2Actual || 0, costoUSDT * 1.20),
                nuevoPrecio3Base: Math.max(infoProd?.precio3Actual || 0, costoUSDT * 1.15),
            });
        });

        // 3. OBJETO FINAL (ENCABEZADO COMPRA)
        const compraParaEnviar = {
            CodigoProv: parseInt(compra.idProveedor),
            NumeroFactura: compra.numeroFactura,
            NumeroControl: compra.numeroControl || "", // Agregado por seguridad si existe en el form
            FechaCompra: new Date().toISOString(),
            TipoMoneda: monedaFactura,
            TasaDeCambio: tasaFactura, // Se guarda la tasa de la factura para cuadrar con el proveedor
            
            Detalles: detallesCalculados,
            
            // Totales sumados (Backend los recalcula, pero es bueno enviarlos)
            // Totales en Moneda Base (USDT)
            SubtotalMonedaBase: detallesCalculados.reduce((acc, cur) => acc + cur.SubtotalLineaMonedaBase, 0),
            IvaMonedaBase: detallesCalculados.reduce((acc, cur) => acc + (cur.SubtotalLineaMonedaBase * (cur.TasaIVA / 100)), 0),
            TotalMonedaBase: detallesCalculados.reduce((acc, cur) => acc + cur.TotalLineaMonedaBase, 0),

            // Totales en Moneda Ext (BS)
            SubtotalMonedaExt: detallesCalculados.reduce((acc, cur) => acc + cur.SubtotalLineaMonedaExt, 0),
            IvaMonedaExt: detallesCalculados.reduce((acc, cur) => acc + cur.IvaLineaMonedaExt, 0),
            TotalMonedaExt: detallesCalculados.reduce((acc, cur) => acc + cur.TotalLineaMonedaExt, 0),
            
            AplicaLibroCompras: true // O el valor que venga del checkbox
        };

        console.log("Objeto Final a enviar:", compraParaEnviar);

        // 4. ENVÍO AL SERVIDOR
        try {
            setGuardando(true);
            const res = await fetch(`${API_URL}/Compras`,{
                headers: getAuthHeaders(),
                method: 'POST',
                body: JSON.stringify(compraParaEnviar)
            });

            if (res.ok) {
                // Si todo sale bien, pasamos al paso 2 con las propuestas calculadas en USDT
                setPropuestas(listaPropuestas);
                setPaso(2);
            } else {
                const data = await res.json();
                alert("Error: " + (data.message || "Revise los datos de la factura"));
            }
        } catch (error) {
            console.error("Error en procesarCompra:", error);
            alert("Error de conexión al registrar la compra.");
        } finally {
            setGuardando(false);
        }
    };

    const enviarNuevosPrecios = async () => {
        if (guardando) return;
        try {
            setGuardando(true);
            const res = await fetch(`${API_URL}/Compras/confirmar-precios`,{
                headers: getAuthHeaders(),
                method: 'POST',
                body: JSON.stringify(propuestas) 
            });
            
            if (res.ok) {
                alert("✅ Inventario y precios actualizados en base a USDT.");
                await cargarHistorialCompras();
                reiniciarFormulario();
            }
        } catch (e) { alert("Error de servidor"); } 
        finally { setGuardando(false); }
    };
    // Cálculo de totales en tiempo real para el resumen
    const totalesFactura = compra.detalles.reduce((acc, det) => {
        const infoProd = productosMaster.find(p => p.idProductoUnidad == det.idProductoUnidad);
        const costoLimpio = parseFloat(det.costoUnitario || 0);
        const cantidad = parseFloat(det.cantidad || 0);
        const subtotalLinea = cantidad * costoLimpio;

        // Obtenemos la tasa desde el producto (por defecto 0 si no existe)
        const tasaIvaProd = infoProd?.porcentajeIva || 0;

        if (tasaIvaProd === 0) {
            acc.exento += subtotalLinea;
        } else {
            const montoIvaLinea = subtotalLinea * (tasaIvaProd / 100);
            acc.baseImponible += subtotalLinea;
            acc.iva += montoIvaLinea;
        }

        return acc;
    }, { exento: 0, baseImponible: 0, iva: 0 });

    // Calculamos el Total General sumando los tres pilares
    const totalGeneralCalculado = totalesFactura.exento + totalesFactura.baseImponible + totalesFactura.iva;

    // Estados para el buscador de productos
    const [busquedaTexto, setBusquedaTexto] = useState("");
    const [sugerencias, setSugerencias] = useState([]);
    const [mostrarLista, setMostrarLista] = useState(false);

    // Función que detecta lo que escribes
    const handleBusquedaChange = (texto) => {
        setBusquedaTexto(texto);
        
        // Regla: Solo buscar si hay 3 o más letras
        if (texto.length >= 3) {
            const filtrados = productosMaster.filter(p => 
                p.nombreMostrar.toLowerCase().includes(texto.toLowerCase())
            );
            setSugerencias(filtrados);
            setMostrarLista(true);
        } else {
            setSugerencias([]);
            setMostrarLista(false);
        }
    };

    // Función al hacer clic en una sugerencia
    const seleccionarProductoBusqueda = (prod) => {
        setProductoEdicion({
            ...productoEdicion, 
            idProductoUnidad: prod.idProductoUnidad
        });
        setBusquedaTexto(prod.nombreMostrar); // Pone el nombre en el input
        setMostrarLista(false); // Oculta la lista
    };

    return (
        <div className="modulo-container" style={{ padding: '20px', maxWidth: '1200px', margin: '0 auto', fontFamily: 'sans-serif' }}>
            
            {/* ENCABEZADO DINÁMICO */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                <h2 style={{ margin: 0 }}>
                    {verHistorial 
                        ? "📜 Historial de Compras" 
                        : (paso === 1 ? "📦 Registro de Factura" : "⚖️ Análisis de Precios (Base USDT)")
                    }
                </h2>
                <button 
                    onClick={() => setVerHistorial(!verHistorial)}
                    style={{ 
                        padding: '10px 20px', 
                        cursor: 'pointer', 
                        backgroundColor: verHistorial ? '#64748b' : '#2563eb', 
                        color: 'white', 
                        border: 'none', 
                        borderRadius: '5px',
                        fontWeight: 'bold'
                    }}
                >
                    {verHistorial ? "← Volver al Formulario" : "Ver Historial / Anular"}
                </button>
            </div>

            {verHistorial ? (
                /* SECCIÓN: HISTORIAL DE COMPRAS */
                <div style={{ backgroundColor: 'white', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', overflow: 'hidden' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead>
                            <tr style={{ backgroundColor: '#f1f5f9', textAlign: 'left' }}>
                                <th style={{ padding: '12px' }}>Fecha</th>
                                <th>Factura</th>
                                <th>Proveedor</th>
                                <th style={{ textAlign: 'right', paddingRight: '20px' }}>Total ($)</th>
                                <th style={{ textAlign: 'center' }}>Acciones</th>
                            </tr>
                        </thead>
                        <tbody>
                            {listaCompras.length > 0 ? listaCompras.map(c => (
                                <tr key={c.id} style={{ borderBottom: '1px solid #e2e8f0' }}>
                                    <td style={{ padding: '12px' }}>{new Date(c.fechaCompra).toLocaleDateString()}</td>
                                    <td>{c.numeroFactura}</td>
                                    <td>{c.proveedor?.razonsocial}</td>
                                    <td style={{ textAlign: 'right', paddingRight: '20px', fontWeight: 'bold' }}>
                                        {c.totalMonedaBase?.toFixed(2)}
                                    </td>
                                    <td style={{ textAlign: 'center' }}>
                                        <button 
                                            onClick={() => handleAnularCompra(c.id)}
                                            style={{ color: '#ef4444', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 'bold' }}
                                        >
                                            Anular
                                        </button>
                                    </td>
                                </tr>
                            )) : (
                                <tr><td colSpan="5" style={{ padding: '20px', textAlign: 'center' }}>No hay compras registradas.</td></tr>
                            )}
                        </tbody>
                    </table>
                </div>
            ) : (
                /* SECCIÓN: FLUJO DE REGISTRO (PASO 1 Y 2) */
                <>
                {paso === 1 ? (
                    <div className="registro-compra" style={{ display: 'flex', gap: '20px', alignItems: 'flex-start' }}>
                        
                        {/* COLUMNA IZQUIERDA: CARGA DE DATOS (70%) */}
                        <div style={{ flex: 7 }}>
                            <div style={{ display: 'flex', gap: '15px', marginBottom: '20px' }}>
                                <div style={{ flex: 2 }}>
                                    <label style={{ display: 'block', fontWeight: 'bold', fontSize: '0.9rem' }}>Proveedor</label>
                                    <select 
                                        value={compra.idProveedor} 
                                        onChange={(e) => setCompra({...compra, idProveedor: e.target.value})} 
                                        style={{ width: '100%', padding: '10px', borderRadius: '5px', border: '1px solid #cbd5e1' }}
                                    >
                                        <option value="">Seleccione...</option>
                                        {proveedores.map(p => <option key={p.codigoProv} value={p.codigoProv}>{p.razonsocial}</option>)}
                                    </select>
                                </div>
                                <div style={{ flex: 1 }}>
                                    <label style={{ display: 'block', fontWeight: 'bold', fontSize: '0.9rem' }}>N° Factura</label>
                                    <input 
                                        type="text" 
                                        value={compra.numeroFactura} 
                                        onChange={(e) => setCompra({...compra, numeroFactura: e.target.value})} 
                                        style={{ width: '100%', padding: '10px', borderRadius: '5px', border: '1px solid #cbd5e1' }} 
                                    />
                                </div>
                            </div>

                            <div style={{ backgroundColor: '#fff', padding: '15px', border: '2px solid #2563eb', borderRadius: '8px', marginBottom: '20px' }}>
                                <h4 style={{ margin: '0 0 10px 0', color: '#2563eb' }}>Agregar Producto - Cantidad  - Costo</h4>
    
                                <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-end' }}>
        
                                    {/* --- INICIO DEL AUTOCOMPLETE (Reemplaza al Select) --- */}
                                    <div style={{ flex: 3, position: 'relative' }}> {/* Importante: position relative para anclar la lista */}
            
                                        {/* EL INPUT DE BÚSQUEDA */}
                                        <input 
                                            type="text" 
                                            placeholder="🔍 Escriba 3 letras para buscar..." 
                                            value={busquedaTexto}
                                            onChange={(e) => handleBusquedaChange(e.target.value)}
                                            onFocus={() => {
                                                // Si ya hay algo seleccionado, borramos para buscar de nuevo
                                                if(productoEdicion.idProductoUnidad) {
                                                    setBusquedaTexto("");
                                                    setProductoEdicion({...productoEdicion, idProductoUnidad: ""});
                                                }
                                            }}
                                            style={{ 
                                                width: '100%', 
                                                padding: '8px', 
                                                borderRadius: '4px',
                                                border: '1px solid #ccc' 
                                            }}
                                        />

                                        {/* LA LISTA FLOTANTE DE RESULTADOS */}
                                        {mostrarLista && sugerencias.length > 0 && (
                                            <ul style={{
                                                position: 'absolute',
                                                top: '100%', // Justo debajo del input
                                                left: 0,
                                                right: 0,
                                                backgroundColor: 'white',
                                                border: '1px solid #ccc',
                                                borderRadius: '0 0 4px 4px',
                                                maxHeight: '200px', // Altura máxima con scroll
                                                overflowY: 'auto',
                                                zIndex: 1000, // Para que flote encima de todo
                                                listStyle: 'none',
                                                padding: 0,
                                                margin: 0,
                                                boxShadow: '0 4px 6px rgba(0,0,0,0.1)'
                                            }}>
                                                {sugerencias.map(p => (
                                                    <li 
                                                        key={p.idProductoUnidad}
                                                        onClick={() => seleccionarProductoBusqueda(p)}
                                                        style={{
                                                            padding: '8px 12px',
                                                            cursor: 'pointer',
                                                            borderBottom: '1px solid #eee',
                                                            fontSize: '0.9rem'
                                                        }}
                                                        onMouseEnter={(e) => e.target.style.backgroundColor = '#f1f5f9'}
                                                        onMouseLeave={(e) => e.target.style.backgroundColor = 'white'}
                                                    >
                                                        {p.nombreMostrar}
                                                    </li>
                                                ))}
                                            </ul>
                                        )}

                                        {/* Mensaje si no hay resultados */}
                                        {mostrarLista && sugerencias.length === 0 && busquedaTexto.length >= 3 && (
                                            <div style={{
                                                position: 'absolute',
                                                top: '100%',
                                                left: 0,
                                                width: '100%',
                                                backgroundColor: 'white',
                                                border: '1px solid #ef4444',
                                                color: '#ef4444',
                                                padding: '8px',
                                                zIndex: 1000,
                                                fontSize: '0.8rem'
                                            }}>
                                                No se encontraron productos.
                                            </div>
                                        )}
                                    </div>
                                    {/* --- FIN DEL AUTOCOMPLETE --- */}

                                    {/* INPUT CANTIDAD (Se mantiene igual) */}
                                    <div style={{ flex: 1 }}>
                                        <input 
                                            type="number" 
                                            placeholder="Cant" 
                                            value={productoEdicion.cantidad} 
                                            onChange={(e) => setProductoEdicion({...productoEdicion, cantidad: e.target.value})} 
                                            style={{ width: '100%', padding: '8px' }} 
                                        />
                                    </div>

                                    {/* INPUT COSTO (Se mantiene igual) */}
                                    <div style={{ flex: 1 }}>
                                        <input 
                                            type="number" 
                                            placeholder="Costo" 
                                            value={productoEdicion.costoUnitario} 
                                            onChange={(e) => setProductoEdicion({...productoEdicion, costoUnitario: e.target.value})} 
                                            style={{ width: '100%', padding: '8px' }} 
                                        />
                                    </div>

                                    {/* BOTÓN AGREGAR (Se mantiene igual) */}
                                    <button 
                                        onClick={agregarProductoALista} 
                                        style={{ 
                                            padding: '10px 20px', 
                                            backgroundColor: '#2563eb', 
                                            color: 'white', 
                                            border: 'none', 
                                            borderRadius: '5px', 
                                            cursor: 'pointer' 
                                        }}
                                    >
                                        +
                                    </button>
                                </div>
                            </div>

                            <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '20px' }}>
                                <thead>
                                    <tr style={{ background: '#334155', color: 'white' }}>
                                        <th style={{ padding: '10px', textAlign: 'left' }}>Producto</th>
                                        <th>Cant.</th>
                                        <th>Total {monedaFactura}</th>
                                        <th>Costo Unit. ($)</th>
                                        <th></th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {compra.detalles.map((det, index) => {
                                        const p = productosMaster.find(pm => pm.idProductoUnidad == det.idProductoUnidad);
                                        return (
                                            <tr key={index} style={{ borderBottom: '1px solid #ddd' }}>
                                                <td style={{ padding: '10px' }}>{p?.nombreMostrar}</td>
                                                <td style={{ textAlign: 'center' }}>{det.cantidad}</td>
                                                <td style={{ textAlign: 'center' }}>{(det.cantidad * det.costoUnitario).toFixed(2)}</td>
                                                <td style={{ textAlign: 'center' }}>{monedaFactura === 'BS' ? (det.costoUnitario / tasaCompra).toFixed(2) : det.costoUnitario} $</td>
                                                <td style={{ textAlign: 'center' }}><button onClick={() => eliminarLinea(index)}>🗑️</button></td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>

                            <button onClick={procesarCompra} disabled={guardando} style={{ width: '100%', padding: '15px', backgroundColor: '#059669', color: 'white', fontWeight: 'bold', border: 'none', borderRadius: '5px', cursor: 'pointer' }}>
                                {guardando ? "PROCESANDO..." : "REGISTRAR COMPRA Y ANALIZAR PRECIOS"}
                            </button>
                        </div>

                        {/* COLUMNA DERECHA: PARÁMETROS (30%) */}
                        <div style={{ flex: 3, background: '#f8fafc', padding: '20px', borderRadius: '12px', border: '1px solid #e2e8f0', position: 'sticky', top: '20px' }}>
                            <h4 style={{ marginTop: 0 }}>Resumen y Tasas</h4>
                            <label style={{ fontSize: '0.8rem', fontWeight: 'bold' }}>Moneda Factura</label>
                            <select value={monedaFactura} onChange={(e) => setMonedaFactura(e.target.value)} style={{ width: '100%', padding: '10px', marginBottom: '15px' }}>
                                <option value="USD">Dólares ($)</option>
                                <option value="BS">Bolívares (Bs)</option>
                            </select>

                            {/* ... dentro de la Columna Derecha ... */}

                            <label style={{ fontSize: '0.8rem', fontWeight: 'bold' }}>Tasa de Referencia</label>

                            {/* INICIO DEL CAMBIO */}
                            <select 
                                value={tasaCompra} 
                                onChange={(e) => {
                                    // Convertimos el valor seleccionado a número
                                    const valorSeleccionado = parseFloat(e.target.value);
                                    setTasaCompra(valorSeleccionado || 0);
                                }}
                                style={{ 
                                    width: '100%', 
                                    padding: '10px', 
                                    marginBottom: '20px', 
                                    fontWeight: 'bold', 
                                    border: '2px solid #2563eb', 
                                    borderRadius: '5px', 
                                    backgroundColor: '#eff6ff',
                                    cursor: 'pointer'
                                }}
                            >
                                <option value={0}>-- Seleccione una tasa --</option>
    
                                {/* Mapeamos las tasas traídas de la base de datos */}
                                {tasasReferencia.map((t, index) => (
                                    <option key={index} value={t.tasa}>
                                        {/* Mostramos: Nombre (ej: BCV) - Valor (ej: 36.50) */}
                                        {t.nombreTasa || t.nombre} - {t.tasa} 
                                    </option>
                                ))}
                            </select>
                            {/* FIN DEL CAMBIO */}

                            {/* Opcional: Mostrar el valor seleccionado numéricamente abajo solo como referencia visual */}
                            {tasaCompra > 0 && (
                                <div style={{ fontSize: '0.8rem', color: '#64748b', marginBottom: '15px' }}>
                                    Valor aplicado para cálculos: <strong>{tasaCompra}</strong>
                                </div>
                            )}

                            <div style={{ borderTop: '2px solid #eee', paddingTop: '10px' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px' }}>
                                    <span>Exento:</span> <span>{totalesFactura.exento.toFixed(2)} {monedaFactura}</span>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px' }}>
                                    <span>Base Imponible:</span> <span>{totalesFactura.baseImponible.toFixed(2)} {monedaFactura}</span>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px' }}>
                                    <span>IVA:</span> <span>{totalesFactura.iva.toFixed(2)} {monedaFactura}</span>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold', marginTop: '10px', color: '#1e293b', fontSize: '1.1rem' }}>
                                    <span>TOTAL:</span> <span>{(totalesFactura.exento + totalesFactura.baseImponible + totalesFactura.iva).toFixed(2)} {monedaFactura}</span>
                                </div>
                            </div>
                        </div>
                    </div>
                ) : (
                    /* PASO 2: ANÁLISIS DE PRECIOS */
                    <div className="confirmar-precios">
                        <div style={{ backgroundColor: '#fff7ed', padding: '10px', borderRadius: '5px', marginBottom: '15px', fontSize: '0.9rem', border: '1px solid #fed7aa' }}>
                            ℹ️ Los costos han sido convertidos a la tasa base <strong>USDT</strong>. Ajuste los precios de venta y verifique su margen.
                        </div>

                        {propuestas.map((p, i) => (
                            <div key={i} style={{ backgroundColor: 'white', padding: '15px', borderRadius: '8px', marginBottom: '15px', border: '1px solid #fed7aa' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
                                    <strong>{p.descripcion}</strong>
                                    <div style={{ textAlign: 'right' }}>
                                        <div style={{ fontSize: '0.8rem', color: '#64748b' }}>Costo Factura: {p.costoFacturaOriginal.toFixed(2)} {monedaFactura}</div>
                                        <div style={{ fontWeight: 'bold', color: '#2563eb' }}>Costo Base USDT: ${p.nuevoCostoBase.toFixed(2)}</div>
                                    </div>
                                </div>

                                <div style={{ display: 'flex', gap: '10px' }}>
                                    {[
                                        { label: 'Precio 1', key: 'nuevoPrecioBase', color: '#f59e0b' },
                                        { label: 'Precio 2', key: 'nuevoPrecio2Base', color: '#3b82f6' },
                                        { label: 'Precio 3', key: 'nuevoPrecio3Base', color: '#10b981' }
                                    ].map((input) => {
                                        const tasaReferenciaUSDT = tasasReferencia.find(t => t.nombreTasa === "USDT")?.tasa || tasaCompra;
                                        const gananciaPorcentaje = p.nuevoCostoBase > 0 
                                            ? (((p[input.key] / p.nuevoCostoBase) - 1) * 100).toFixed(1) 
                                            : 0;

                                        return (
                                            <div key={input.key} style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                                                <label style={{ fontSize: '0.7rem', color: input.color, fontWeight: 'bold' }}>{input.label} (USDT)</label>
                                                <input 
                                                    type="number" 
                                                    step="0.01"
                                                    value={p[input.key]} 
                                                    onChange={(e) => {
                                                        const nuevas = [...propuestas];
                                                        nuevas[i][input.key] = parseFloat(e.target.value) || 0;
                                                        setPropuestas(nuevas);
                                                    }}
                                                    style={{ width: '100%', padding: '5px', border: '1px solid #2563eb', borderRadius: '4px', fontWeight: 'bold' }}
                                                />
                                                <small style={{ color: 'green', fontWeight: '600', marginTop: '2px' }}>Margen: {gananciaPorcentaje}%</small>
                                                <div style={{ marginTop: '4px', padding: '4px', backgroundColor: '#fff7ed', border: '1px dashed #f97316', borderRadius: '4px' }}>
                                                    <span style={{ fontSize: '0.6rem', color: '#7c2d12', display: 'block', fontWeight: 'bold' }}>VES @ USDT:</span>
                                                    <strong style={{ color: '#c2410c', fontSize: '0.8rem' }}>
                                                        {(p[input.key] * tasaReferenciaUSDT).toLocaleString('es-VE', { minimumFractionDigits: 2 })}
                                                    </strong>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        ))}

                        <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
                            <button onClick={() => setPaso(1)} style={{ flex: 1, padding: '10px' }}>Atrás</button>
                            <button onClick={enviarNuevosPrecios} disabled={guardando} style={{ flex: 2, padding: '15px', backgroundColor: '#f59e0b', color: 'white', fontWeight: 'bold', border: 'none', borderRadius: '5px', cursor: 'pointer' }}>
                                {guardando ? "GUARDANDO..." : "CONFIRMAR PRECIOS Y FINALIZAR"}
                            </button>
                        </div>
                    </div>
                )}
                </>
            )}
        </div>
    );
};

export default Compras;