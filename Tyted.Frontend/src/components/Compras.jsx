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
    const [tasaCompra, setTasaCompra] = useState(tasa || 0); 
    const [monedaFactura, setMonedaFactura] = useState('USD');
    const [guardando, setGuardando] = useState(false);

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
    }, []);

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
            const res = await fetch(`${API_URL}/TasaDeCambio/comparativa-compras`);
            if (res.ok) {
                const data = await res.json();
                setTasasReferencia(data);
            }
        } catch (e) { console.error("Error tasas:", e); }
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

    // --- PROCESAMIENTO CON AJUSTE DE TASA ---
    const procesarCompra = async () => {
        if (!compra.idProveedor || compra.detalles.length === 0) {
            return alert("Complete el proveedor y añada productos.");
        }

        const infoTasaUSDT = tasasReferencia.find(t => t.nombreTasa === "USDT");
        const valorTasaUSDT = infoTasaUSDT ? infoTasaUSDT.tasa : tasa;

        const detallesCalculados = [];
        const listaPropuestas = [];

        compra.detalles.forEach(d => {
            const infoProd = productosMaster.find(p => p.idProductoUnidad == d.idProductoUnidad);
            const costoIngresado = parseFloat(d.costoUnitario || 0);
            const cantidad = parseFloat(d.cantidad || 0);

            let costoRealMonedaBase;
            let costoEnBolivares;

            if (monedaFactura === 'BS') {
                costoEnBolivares = costoIngresado;
                costoRealMonedaBase = costoEnBolivares / valorTasaUSDT;
            } else {
                // Factura en USD (se usa la tasaCompra elegida para llevar a Bs y luego a USDT base)
                costoEnBolivares = costoIngresado * tasaCompra;
                costoRealMonedaBase = costoEnBolivares / valorTasaUSDT;
            }

            detallesCalculados.push({
                IdProductoUnidad: parseInt(d.idProductoUnidad),
                CodigoProd: infoProd?.codigoProdOriginal || "",
                UnidadCompra: infoProd?.nombreUnidad || "",
                Cantidad: cantidad,
                CostoUnitarioMonedaBase: costoRealMonedaBase,
                SubtotalLineaMonedaBase: costoRealMonedaBase * cantidad,
                TotalLineaMonedaBase: costoRealMonedaBase * cantidad,
                CostoUnitarioMonedaExt: costoEnBolivares, 
                TotalLineaMonedaExt: costoEnBolivares * cantidad,
                TasaIVA: 0 
            });

            listaPropuestas.push({
                idProductoUnidad: parseInt(d.idProductoUnidad),
                descripcion: infoProd?.nombreMostrar || "Producto",
                costoAnterior: infoProd?.costoActual || 0,
                costoFacturaOriginal: costoIngresado,
                precio1Anterior: infoProd?.precioVentaActual || 0,
                precio2Anterior: infoProd?.precio2Actual || 0,
                precio3Anterior: infoProd?.precio3Actual || 0,
                nuevoCostoBase: costoRealMonedaBase,
                nuevoPrecioBase: (infoProd?.precioVentaActual > costoRealMonedaBase) ? infoProd.precioVentaActual : (costoRealMonedaBase * 1.30),
                nuevoPrecio2Base: (infoProd?.precio2Actual > costoRealMonedaBase) ? infoProd.precio2Actual : (costoRealMonedaBase * 1.20),
                nuevoPrecio3Base: (infoProd?.precio3Actual > costoRealMonedaBase) ? infoProd.precio3Actual : (costoRealMonedaBase * 1.15),
            });
        });

        const compraParaEnviar = {
            CodigoProv: parseInt(compra.idProveedor),
            NumeroFactura: compra.numeroFactura,
            FechaCompra: new Date().toISOString(),
            TipoMoneda: monedaFactura,
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
                setPropuestas(listaPropuestas);
                setPaso(2);
            } else {
                const data = await res.json();
                alert("Error: " + (data.message || "Revise los datos"));
            }
        } catch (error) {
            alert("Error de conexión.");
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
                alert("✅ Inventario y precios actualizados en base a USDT.");
                reiniciarFormulario();
            }
        } catch (e) { alert("Error de servidor"); } 
        finally { setGuardando(false); }
    };
    // Cálculo de totales en tiempo real para el resumen
    const totalesFactura = compra.detalles.reduce((acc, det) => {
        const infoProd = productosMaster.find(p => p.idProductoUnidad == det.idProductoUnidad);
        const subtotalLinea = det.cantidad * det.costoUnitario;
    
        // Si el producto no tiene IVA (es 0 o exento), suma a exento, si no, a base imponible
        const tasaIvaProd = infoProd?.porcentajeIva || 0;
    
        if (tasaIvaProd === 0) {
            acc.exento += subtotalLinea;
        } else {
            acc.baseImponible += subtotalLinea;
            acc.iva += (subtotalLinea * (tasaIvaProd / 100));
        }
    
        acc.totalGeneral += (subtotalLinea + (subtotalLinea * (tasaIvaProd / 100)));
    
        return acc;
    }, { exento: 0, baseImponible: 0, iva: 0, totalGeneral: 0 });

    // Si quieres calcular un IVA del 16% sobre la base:
    totalesFactura.iva = totalesFactura.baseImponible * 0.16;
    totalesFactura.total = totalesFactura.baseImponible + totalesFactura.iva;

    return (
        <div className="modulo-container" style={{ padding: '20px', maxWidth: '1200px', margin: '0 auto', fontFamily: 'sans-serif' }}>
            <h2>{paso === 1 ? "📦 Registro de Factura" : "⚖️ Análisis de Precios (Base USDT)"}</h2>
    
            {paso === 1 ? (
                <div className="registro-compra" style={{ display: 'flex', gap: '20px', alignItems: 'flex-start' }}>
                    
                    {/* COLUMNA IZQUIERDA: CARGA DE DATOS (70%) */}
                    <div style={{ flex: 7 }}>
                        {/* SECCIÓN DE TASA Y PROVEEDOR */}
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
    
                        {/* FORMULARIO DE ENTRADA RÁPIDA */}
                        <div style={{ backgroundColor: '#fff', padding: '15px', border: '2px solid #2563eb', borderRadius: '8px', marginBottom: '20px' }}>
                            <h4 style={{ margin: '0 0 10px 0', color: '#2563eb' }}>Agregar Producto</h4>
                            <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-end' }}>
                                <div style={{ flex: 3 }}>
                                    <select 
                                        value={productoEdicion.idProductoUnidad} 
                                        onChange={(e) => setProductoEdicion({...productoEdicion, idProductoUnidad: e.target.value})}
                                        style={{ width: '100%', padding: '8px' }}
                                    >
                                        <option value="">-- Buscar producto --</option>
                                        {productosMaster.map(p => <option key={p.idProductoUnidad} value={p.idProductoUnidad}>{p.nombreMostrar}</option>)}
                                    </select>
                                </div>
                                <div style={{ flex: 1 }}>
                                    <input type="number" placeholder="Cant" value={productoEdicion.cantidad} onChange={(e) => setProductoEdicion({...productoEdicion, cantidad: e.target.value})} style={{ width: '100%', padding: '8px' }} />
                                </div>
                                <div style={{ flex: 1 }}>
                                    <input type="number" placeholder="Costo" value={productoEdicion.costoUnitario} onChange={(e) => setProductoEdicion({...productoEdicion, costoUnitario: e.target.value})} style={{ width: '100%', padding: '8px' }} />
                                </div>
                                <button onClick={agregarProductoALista} style={{ padding: '10px 20px', backgroundColor: '#2563eb', color: 'white', border: 'none', borderRadius: '5px', cursor: 'pointer' }}>
                                    +
                                </button>
                            </div>
                        </div>

                        {/* TABLA DE PRODUCTOS */}
                        <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '20px' }}>
                            <thead>
                                <tr style={{ background: '#334155', color: 'white' }}>
                                    <th style={{ padding: '10px', textAlign: 'left' }}>Producto</th>
                                    <th>Cant.</th>
                                    <th>Total {monedaFactura}</th>
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
                                            <td style={{ textAlign: 'center' }}><button onClick={() => eliminarLinea(index)}>🗑️</button></td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>

                        <button onClick={procesarCompra} style={{ width: '100%', padding: '15px', backgroundColor: '#059669', color: 'white', fontWeight: 'bold', border: 'none', borderRadius: '5px', cursor: 'pointer' }}>
                            PROCESAR COMPRA Y ANALIZAR PRECIOS
                        </button>
                    </div>

                    {/* COLUMNA DERECHA: RESUMEN (30%) */}
                    <div style={{ flex: 3, background: '#f8fafc', padding: '20px', borderRadius: '12px', border: '1px solid #e2e8f0', position: 'sticky', top: '20px' }}>
                        <h4 style={{ marginTop: 0 }}>Parámetros</h4>
                    
                        <label style={{ fontSize: '0.8rem', fontWeight: 'bold' }}>Moneda Factura</label>
                        <select value={monedaFactura} onChange={(e) => setMonedaFactura(e.target.value)} style={{ width: '100%', padding: '10px', marginBottom: '15px' }}>
                            <option value="USD">Dólares ($)</option>
                            <option value="BS">Bolívares (Bs)</option>
                        </select>

                        <label style={{ fontSize: '0.8rem', fontWeight: 'bold' }}>Tasa (Ref: {tasa})</label>
                        <input 
                            type="number" 
                            value={tasaCompra} 
                            onChange={(e) => setTasaCompra(parseFloat(e.target.value))} 
                            style={{ width: '100%', padding: '10px', marginBottom: '20px', fontWeight: 'bold', border: '1px solid #cbd5e1' }} 
                        />

                        <div style={{ background: 'white', padding: '15px', borderRadius: '8px', border: '1px solid #cbd5e1' }}>
                            <h5 style={{ margin: '0 0 10px 0', color: '#64748b', fontSize: '0.75rem' }}>RESUMEN FISCO</h5>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px' }}>
                                <span>Exento:</span> <span>{totalesFactura.exento.toFixed(2)} {monedaFactura}</span>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px' }}>
                                <span>Base Imponible:</span> <span>{totalesFactura.baseImponible.toFixed(2)} {monedaFactura}</span>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px' }}>
                                <span>IVA:</span> <span>{totalesFactura.iva.toFixed(2)} {monedaFactura}</span>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold', borderTop: '1px solid #eee', paddingTop: '10px' }}>
                                <span>TOTAL:</span> <span>{totalesFactura.totalGeneral.toFixed(2)} {monedaFactura}</span>
                            </div>
                        </div>
                        <p style={{ fontSize: '0.7rem', color: '#94a3b8', marginTop: '15px', fontStyle: 'italic' }}>
                            * Verifique que el TOTAL coincida con su factura física antes de procesar.
                        </p>
                    </div>

                </div>
            ) : (
                <div className="confirmar-precios">
                    <div style={{ backgroundColor: '#fff7ed', padding: '10px', borderRadius: '5px', marginBottom: '15px', fontSize: '0.9rem' }}>
                        ℹ️ Los costos han sido convertidos a la tasa base <strong>USDT</strong> para proteger su margen.
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
                                ].map((input) => (
                                    <div key={input.key} style={{ flex: 1 }}>
                                        <label style={{ fontSize: '0.7rem', color: input.color, fontWeight: 'bold' }}>{input.label}</label>
                                        <input 
                                            type="number" 
                                            value={p[input.key]} 
                                            onChange={(e) => {
                                                const nuevas = [...propuestas];
                                                nuevas[i][input.key] = parseFloat(e.target.value) || 0;
                                                setPropuestas(nuevas);
                                            }}
                                            style={{ width: '100%', padding: '5px' }}
                                        />
                                        <small style={{ color: 'green' }}>Ganancia: {(((p[input.key] / p.nuevoCostoBase) - 1) * 100).toFixed(1)}%</small>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))}

                    <div style={{ display: 'flex', gap: '10px' }}>
                        <button onClick={() => setPaso(1)} style={{ flex: 1, padding: '10px' }}>Atrás</button>
                        <button onClick={enviarNuevosPrecios} disabled={guardando} style={{ flex: 2, padding: '15px', backgroundColor: '#f59e0b', color: 'white', fontWeight: 'bold', border: 'none', borderRadius: '5px' }}>
                            {guardando ? "GUARDANDO..." : "CONFIRMAR PRECIOS Y FINALIZAR"}
                        </button>
                    </div>
                </div>
            )}
        </div>

    );
};

export default Compras;