import React, { useState, useEffect, useContext } from 'react';
import { ConfigContext } from '../Context/ConfigContext';

const Compras = () => {
    // 1. Contexto y Configuración
    const { API_URL, tasa } = useContext(ConfigContext);

    // 2. Estados de Datos
    const [proveedores, setProveedores] = useState([]);
    const [productosMaster, setProductosMaster] = useState([]);
    const [tasasReferencia, setTasasReferencia] = useState([]);
    
    // 3. Estados de la Compra y Formulario
    const [paso, setPaso] = useState(1);
    const [tasaCompra, setTasaCompra] = useState(tasa || 0); // Inicializa con la tasa del contexto
    const [guardando, setGuardando] = useState(false);
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
    }, []);

    // Actualizar tasaCompra si la tasa del contexto cambia (opcional)
    useEffect(() => {
        if (!tasaCompra && tasa) setTasaCompra(tasa);
    }, [tasa]);

    const cargarDatosIniciales = async () => {
        try {
            const [resProv, resProd] = await Promise.all([
                fetch(`${API_URL}/Proveedores`),
                fetch(`${API_URL}/Productos`)
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
                        precio3Actual: u.precio3MonedaBase || 0
                    }))
                );
                setProductosMaster(listaAplanada);
            }
        } catch (error) {
            console.error("Error cargando datos iniciales", error);
        }
    };

    const cargarTasasReferencia = async () => {
        try {
            const res = await fetch(`${API_URL}/TasaDeCambio/comparativa-compras`);
            if (res.ok) {
                const data = await res.json();
                setTasasReferencia(data);
            }
        } catch (e) { console.error("Error tasas:", e); }
    };

    // --- LÓGICA DE DETALLES ---
    const agregarLinea = () => {
        setCompra({ 
            ...compra, 
            detalles: [...compra.detalles, { idProductoUnidad: '', cantidad: 1, costoUnitarioMonedaBase: 0 }] 
        });
    };

    const manejarCambioDetalle = (index, campo, valor) => {
        const nuevosDetalles = [...compra.detalles];
        nuevosDetalles[index][campo] = valor;
        setCompra({ ...compra, detalles: nuevosDetalles });
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

    // --- PROCESAMIENTO ---
    const procesarCompra = async () => {
        if (!compra.idProveedor || compra.detalles.length === 0) {
            return alert("Complete el proveedor y añada productos.");
        }

        const detallesCalculados = compra.detalles.map(d => {
            const infoProd = productosMaster.find(p => p.idProductoUnidad == d.idProductoUnidad);
            const costoBase = parseFloat(d.costoUnitarioMonedaBase || 0);
            const cantidad = parseFloat(d.cantidad || 0);

            return {
                IdProductoUnidad: parseInt(d.idProductoUnidad),
                CodigoProd: infoProd?.codigoProdOriginal || "",
                UnidadCompra: infoProd?.nombreUnidad || "",
                Cantidad: cantidad,
                CostoUnitarioMonedaBase: costoBase,
                SubtotalLineaMonedaBase: costoBase * cantidad,
                TotalLineaMonedaBase: costoBase * cantidad,
                CostoUnitarioMonedaExt: costoBase * tasaCompra,
                TotalLineaMonedaExt: (costoBase * cantidad) * tasaCompra,
                TasaIVA: 0 
            };
        });

        const compraParaEnviar = {
            CodigoProv: parseInt(compra.idProveedor),
            NumeroFactura: compra.numeroFactura,
            FechaCompra: new Date().toISOString(),
            TipoMoneda: "USD",
            TasaDeCambio: tasaCompra,
            Detalles: detallesCalculados,
            TotalMonedaBase: detallesCalculados.reduce((acc, cur) => acc + cur.TotalLineaMonedaBase, 0),
            TotalMonedaExt: detallesCalculados.reduce((acc, cur) => acc + cur.TotalLineaMonedaExt, 0),
            SubtotalMonedaBase: detallesCalculados.reduce((acc, cur) => acc + cur.SubtotalLineaMonedaBase, 0),
            IvaMonedaBase: 0
        };

        try {
            const res = await fetch(`${API_URL}/Compras`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(compraParaEnviar)
            });

            if (res.ok) {
                const listaPropuestas = compra.detalles.map(d => {
                    const info = productosMaster.find(p => p.idProductoUnidad == d.idProductoUnidad);
                    const costoFactura = parseFloat(d.costoUnitarioMonedaBase) || 0;

                    return {
                        idProductoUnidad: parseInt(d.idProductoUnidad),
                        descripcion: info?.nombreMostrar || "Producto",
                        costoAnterior: info?.costoActual || 0,
                        precio1Anterior: info?.precioVentaActual || 0,
                        precio2Anterior: info?.precio2Actual || 0,
                        precio3Anterior: info?.precio3Actual || 0,
                        nuevoCostoBase: costoFactura,
                        nuevoPrecioBase: (info?.precioVentaActual > costoFactura) ? info.precioVentaActual : (costoFactura * 1.20),
                        nuevoPrecio2Base: (info?.precio2Actual > costoFactura) ? info.precio2Actual : (costoFactura * 1.15),
                        nuevoPrecio3Base: (info?.precio3Actual > costoFactura) ? info.precio3Actual : (costoFactura * 1.10),
                    };
                });
                setPropuestas(listaPropuestas);
                setPaso(2);
            } else {
                const data = await res.json();
                alert("Error al registrar: " + (data.message || "Revise los datos"));
            }
        } catch (error) {
            console.error("Error:", error);
            alert("Error de conexión al procesar la compra.");
        }
    };

    const enviarNuevosPrecios = async () => {
        if (guardando) return;
        try {
            setGuardando(true);
            const res = await fetch(`${API_URL}/Compras/confirmar-precios`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(propuestas) 
            });
            
            if (res.ok) {
                alert("✅ Compra finalizada e Inventario/Precios actualizados.");
                reiniciarFormulario();
            } else {
                const err = await res.json();
                alert("❌ Error: " + err.message);
            }
        } catch (e) { 
            alert("❌ Error de conexión al servidor");
        } finally {
            setGuardando(false);
        }
    };

    // --- RENDER ---
    return (
        <div className="modulo-container" style={{ padding: '20px', maxWidth: '900px', margin: '0 auto', fontFamily: 'sans-serif' }}>
            <h2 style={{ borderBottom: '2px solid #eee', paddingBottom: '10px' }}>
                        {paso === 1 ? "📦 Registro de Factura" : "⚖️ Paso 2: Ajuste de Precios"}
                    </h2>

                    {paso === 1 ? (
                        <div className="registro-compra">
                    {/* --- Selector de Tasa Histórico y Manual --- */}
                    <div style={{ 
                        backgroundColor: '#f0f9ff', 
                        padding: '20px', 
                        borderRadius: '10px', 
                        marginBottom: '25px',
                        border: '1px solid #bae6fd' 
                    }}>
                        <label style={{ display: 'block', marginBottom: '10px', fontWeight: 'bold', color: '#0369a1' }}>
                            📅 Tasa de Cambio para esta Factura:
                        </label>
    
                        <div style={{ display: 'flex', gap: '15px', alignItems: 'center', flexWrap: 'wrap' }}>
                            {/* SELECTOR DESPLEGABLE CON HISTORIAL */}
                            <select 
                                value={tasasReferencia.some(t => t.tasa === tasaCompra) ? tasaCompra : ""} 
                                onChange={(e) => {
                                    const val = parseFloat(e.target.value);
                                    if (val > 0) setTasaCompra(val);
                                }}
                                style={{ 
                                    flex: '2', // Le damos más espacio al nombre y fecha
                                    padding: '10px', 
                                    borderRadius: '6px', 
                                    border: '1px solid #0ea5e9',
                                    fontSize: '0.95rem',
                                    backgroundColor: 'white',
                                    cursor: 'pointer'
                                }}
                            >
                                <option value="">-- Seleccionar del Historial (Nombre - Tasa - Fecha) --</option>
                                {tasasReferencia.map((t) => (
                                    <option key={t.idTasa} value={t.tasa}>
                                        {t.nombreTasa} ({t.tasa.toFixed(2)} VES) — {t.fecha}
                                    </option>
                                ))}
                            </select>

                            {/* INPUT MANUAL PARA AJUSTE FINO */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: '1' }}>
                                <span style={{ fontWeight: 'bold', color: '#64748b' }}>Valor:</span>
                                <input 
                                    type="number" 
                                    step="0.01"
                                    value={tasaCompra} 
                                    onChange={(e) => setTasaCompra(parseFloat(e.target.value) || 0)}
                                    style={{ 
                                        width: '100%', 
                                        padding: '10px', 
                                        fontWeight: 'bold', 
                                        color: '#2563eb',
                                        border: '2px solid #0ea5e9',
                                        borderRadius: '6px',
                                        textAlign: 'center',
                                        backgroundColor: '#fff'
                                    }}
                                />
                            </div>
                        </div>

                        <div style={{ marginTop: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <small style={{ color: '#0369a1', fontStyle: 'italic' }}>
                                * Tip: Puedes buscar una tasa vieja por su fecha o escribir una nueva directamente.
                            </small>
                            <span style={{ 
                                fontSize: '0.85rem', 
                                backgroundColor: '#e0f2fe', 
                                padding: '4px 10px', 
                                borderRadius: '15px', 
                                color: '#0369a1',
                                fontWeight: '600'
                            }}>
                                Cálculo: 1 USD = {tasaCompra.toFixed(2)} VES
                            </span>
                        </div>
                    </div>

                    {/* Datos Factura */}
                    <div style={{ display: 'flex', gap: '20px', marginBottom: '20px' }}>
                        <div style={{ flex: 1 }}>
                            <label>Proveedor</label>
                            <select 
                                value={compra.idProveedor} 
                                onChange={(e) => setCompra({...compra, idProveedor: e.target.value})}
                                style={{ width: '100%', padding: '10px', marginTop: '5px' }}
                            >
                                <option value="">Seleccione...</option>
                                {proveedores.map(p => (
                                    <option key={p.codigoProv} value={p.codigoProv}>{p.razonsocial}</option>
                                ))}
                            </select>
                        </div>
                        <div style={{ flex: 1 }}>
                            <label>N° Factura</label>
                            <input 
                                type="text" 
                                value={compra.numeroFactura}
                                onChange={(e) => setCompra({...compra, numeroFactura: e.target.value})}
                                style={{ width: '100%', padding: '10px', marginTop: '5px' }}
                            />
                        </div>
                    </div>

                    <table style={{ width: '100%', textAlign: 'left', marginBottom: '15px' }}>
                        <thead>
                            <tr style={{ background: '#f4f4f4' }}>
                                <th style={{ padding: '10px' }}>Producto</th>
                                <th>Cant.</th>
                                <th>Costo Unit. ($)</th>
                                <th>Acción</th>
                            </tr>
                        </thead>
                        <tbody>
                            {compra.detalles.map((det, index) => (
                                <tr key={index}>
                                    <td style={{ padding: '5px' }}>
                                        <select 
                                            style={{ width: '100%', padding: '5px' }}
                                            value={det.idProductoUnidad}
                                            onChange={(e) => manejarCambioDetalle(index, 'idProductoUnidad', e.target.value)}
                                        >
                                            <option value="">-- Seleccionar --</option>
                                            {productosMaster.map(p => (
                                                <option key={p.idProductoUnidad} value={p.idProductoUnidad}>{p.nombreMostrar}</option>
                                            ))}
                                        </select>
                                    </td>
                                    <td><input type="number" value={det.cantidad} onChange={(e) => manejarCambioDetalle(index, 'cantidad', e.target.value)} style={{ width: '60px' }} /></td>
                                    <td><input type="number" step="0.01" value={det.costoUnitarioMonedaBase} onChange={(e) => manejarCambioDetalle(index, 'costoUnitarioMonedaBase', e.target.value)} style={{ width: '80px' }} /></td>
                                    <td><button onClick={() => eliminarLinea(index)}>🗑️</button></td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    
                    <button onClick={agregarLinea} style={{ padding: '8px 15px', cursor: 'pointer' }}>+ Agregar Producto</button>
                    
                    <button onClick={procesarCompra} style={{ width: '100%', marginTop: '20px', padding: '15px', backgroundColor: '#2563eb', color: 'white', border: 'none', borderRadius: '5px', cursor: 'pointer', fontWeight: 'bold' }}>
                        SIGUIENTE: REVISAR PRECIOS
                    </button>
                </div>
            ) : (
                <div className="confirmar-precios" style={{ backgroundColor: '#fff7ed', padding: '20px', borderRadius: '8px', border: '1px solid #ffedd5' }}>
                    <p style={{ marginBottom: '15px' }}>Compare costos y ajuste márgenes de ganancia:</p>

                    {propuestas.map((p, i) => (
                        <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: '10px', padding: '15px', borderBottom: '2px solid #fed7aa', marginBottom: '15px', backgroundColor: 'white', borderRadius: '8px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #eee', paddingBottom: '10px' }}>
                                <div>
                                    <strong>{p.descripcion}</strong><br/>
                                    <small>Costo Base: ${p.nuevoCostoBase.toFixed(2)}</small>
                                </div>
                                <div style={{ textAlign: 'right' }}>
                                    <small style={{ color: '#64748b' }}>Costo Ant: ${p.costoAnterior.toFixed(2)}</small>
                                    <div style={{ fontWeight: 'bold', color: p.nuevoCostoBase > p.costoAnterior ? 'red' : 'green' }}>
                                        {p.nuevoCostoBase > p.costoAnterior ? '🔺 Subió' : '🔻 Bajó/Igual'}
                                    </div>
                                </div>
                            </div>

                            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                                {/* Inputs de Precios */}
                                {[
                                    { label: 'Precio 1', key: 'nuevoPrecioBase', color: '#f59e0b', ant: p.precio1Anterior },
                                    { label: 'Precio 2', key: 'nuevoPrecio2Base', color: '#3b82f6', ant: p.precio2Anterior },
                                    { label: 'Precio 3', key: 'nuevoPrecio3Base', color: '#10b981', ant: p.precio3Anterior }
                                ].map((input) => (
                                    <div key={input.key} style={{ flex: '1 1 150px' }}>
                                        <label style={{ fontSize: '0.75rem', fontWeight: 'bold', color: input.color }}>{input.label}</label>
                                        <div style={{ fontSize: '0.7rem' }}>Actual: ${input.ant.toFixed(2)}</div>
                                        <input 
                                            type="number" 
                                            value={p[input.key]} 
                                            onChange={(e) => {
                                                const nuevas = [...propuestas];
                                                nuevas[i][input.key] = parseFloat(e.target.value) || 0;
                                                setPropuestas(nuevas);
                                            }}
                                            style={{ width: '100%', padding: '5px', border: `1px solid ${input.color}` }}
                                        />
                                        <small style={{ color: 'green' }}>
                                            Margen: {(((p[input.key] / p.nuevoCostoBase) - 1) * 100).toFixed(1)}%
                                        </small>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))}

                    <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
                        <button onClick={() => setPaso(1)} style={{ flex: 1, padding: '12px' }}>Atrás</button>
                        <button onClick={enviarNuevosPrecios} disabled={guardando} style={{ flex: 2, padding: '15px', backgroundColor: '#f59e0b', color: 'white', border: 'none', borderRadius: '5px', fontWeight: 'bold', cursor: 'pointer' }}>
                            {guardando ? "PROCESANDO..." : "CONFIRMAR Y FINALIZAR"}
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Compras;