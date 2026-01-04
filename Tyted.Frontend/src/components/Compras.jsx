import React, { useState, useEffect, useContext } from 'react';
import { ConfigContext } from '../Context/ConfigContext';

const Compras = () => {
    const { API_URL } = useContext(ConfigContext);
    
    const [proveedores, setProveedores] = useState([]);
    const [productosMaster, setProductosMaster] = useState([]);
    
    const [compra, setCompra] = useState({
        idProveedor: '',
        numeroFactura: '',
        detalles: []
    });

    const [propuestas, setPropuestas] = useState([]);
    const [paso, setPaso] = useState(1); 

    useEffect(() => {
        cargarDatosIniciales();
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
                // CORRECCIÓN: Guardamos CodigoProd y nombreUnidad para el POST posterior
                const listaAplanada = data.flatMap(prod => 
                    prod.unidadesDeVenta.map(u => ({
                        idProductoUnidad: u.idProductoUnidad,
                        codigoProdOriginal: prod.codigoProd, // REQUERIDO POR BACKEND
                        nombreUnidad: u.nombreUnidad,        // REQUERIDO POR BACKEND
                        nombreMostrar: `${prod.descripcion} (${u.nombreUnidad})`,
                        codigoBarras: u.codigoBarras || prod.codigoBarras || 'N/A',
                        costoActual: u.costoUnitarioMonedaBase || 0
                    }))
                );
                setProductosMaster(listaAplanada);
            }
        } catch (error) {
            console.error("Error cargando datos iniciales", error);
        }
    };

    const agregarLinea = () => {
        const nuevoDetalle = {
            idProductoUnidad: '', 
            cantidad: 1,
            costoUnitarioMonedaBase: 0 
        };
        setCompra({ ...compra, detalles: [...compra.detalles, nuevoDetalle] });
    };

    const seleccionarProducto = (index, producto) => {
        const nuevosDetalles = [...compra.detalles];
        nuevosDetalles[index] = {
            ...nuevosDetalles[index],
            idProductoUnidad: producto.idProductoUnidad,
            // Guardamos temporalmente datos para mostrar en la tabla si es necesario
            nombreMostrar: producto.nombreMostrar,
            codigoBarras: producto.codigoBarras,
            costoUnitarioMonedaBase: producto.costoActual 
        };
        setCompra({ ...compra, detalles: nuevosDetalles });
    };

    const manejarCambioDetalle = (index, campo, valor) => {
        const nuevosDetalles = [...compra.detalles];
        nuevosDetalles[index][campo] = valor;
        setCompra({ ...compra, detalles: nuevosDetalles });
    };

    const reiniciarFormulario = () => {
        setCompra({ idProveedor: '', numeroFactura: '', detalles: [] });
        setPropuestas([]);
        setPaso(1);
    };

    const procesarCompra = async () => {
        if (!compra.idProveedor || compra.detalles.length === 0) {
            alert("Complete el proveedor y añada productos.");
            return;
        }

        // CORRECCIÓN: Construcción del objeto según los errores del ModelState de C#
        const compraParaEnviar = {
            CodigoProv: parseInt(compra.idProveedor), // Nombre exacto pedido por el error
            NumeroFactura: compra.numeroFactura,
            FechaCompra: new Date().toISOString(),
            TipoMoneda: "USD", // Campo requerido según tu error 400
            Detalles: compra.detalles.map(d => {
                const infoProd = productosMaster.find(p => p.idProductoUnidad == d.idProductoUnidad);
                return {
                    IdProductoUnidad: parseInt(d.idProductoUnidad),
                    CodigoProd: infoProd?.codigoProdOriginal || "", // Requerido por el error
                    UnidadCompra: infoProd?.nombreUnidad || "",     // Requerido por el error
                    Cantidad: parseFloat(d.cantidad || 0),
                    CostoUnitarioMonedaBase: parseFloat(d.costoUnitarioMonedaBase || 0)
                };
            })
        };

        try {
            const res = await fetch(`${API_URL}/Compras`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(compraParaEnviar)
            });

            const data = await res.json();
            if (res.ok) {
                if (data.propuestasPrecios && data.propuestasPrecios.length > 0) {
                    setPropuestas(data.propuestasPrecios);
                    setPaso(2);
                } else {
                    alert("Compra registrada exitosamente.");
                    reiniciarFormulario();
                }
            } else {
                // Si vuelve a dar error, lo vemos detallado en consola
                console.error("Error 400 del servidor:", data.errors || data);
                alert("Error de validación. Revisa los campos obligatorios.");
            }
        } catch (error) {
            console.error("Error en la petición:", error);
        }
    };

    const enviarNuevosPrecios = async () => {
        // ... (Se mantiene igual, enviando el array de propuestas)
        try {
            const res = await fetch(`${API_URL}/Compras/confirmar-precios`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(propuestas) 
            });
            if (res.ok) {
                alert("Inventario y precios actualizados.");
                reiniciarFormulario();
            }
        } catch (e) { console.error(e); }
    };

    return (
        <div className="modulo-container" style={{ padding: '20px', fontFamily: 'sans-serif' }}>
            <h2>{paso === 1 ? "📦 Registro de Compra" : "⚖️ Ajuste de Precios de Venta"}</h2>

            {paso === 1 ? (
                <div className="registro-compra">
                    <div style={{ display: 'flex', gap: '20px', marginBottom: '20px', backgroundColor: '#f8fafc', padding: '15px', borderRadius: '8px' }}>
                        <div style={{ flex: 1 }}>
                            <label style={{ fontWeight: 'bold' }}>Proveedor:</label>
                            <select 
                                value={compra.idProveedor} 
                                onChange={(e) => setCompra({...compra, idProveedor: e.target.value})}
                                style={{ width: '100%', padding: '8px' }}
                            >
                                <option value="">Seleccione...</option>
                                {proveedores.map(p => (
                                    <option key={`p-${p.codigoProv || p.id}`} value={p.codigoProv || p.id}>
                                        {p.razonsocial || p.nombre}
                                    </option>
                                ))}
                            </select>
                        </div>
                        <div style={{ flex: 1 }}>
                            <label style={{ fontWeight: 'bold' }}>N° Factura:</label>
                            <input 
                                type="text" 
                                value={compra.numeroFactura}
                                onChange={(e) => setCompra({...compra, numeroFactura: e.target.value})}
                                style={{ width: '100%', padding: '8px' }}
                            />
                        </div>
                    </div>

                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead>
                            <tr style={{ background: '#f1f5f9' }}>
                                <th style={{ padding: '10px', textAlign: 'left' }}>Producto/Unidad</th>
                                <th>Cant.</th>
                                <th>Costo ($)</th>
                                <th></th>
                            </tr>
                        </thead>
                        <tbody>
                            {compra.detalles.map((det, index) => (
                                <tr key={`row-${index}`} style={{ borderBottom: '1px solid #eee' }}>
                                    <td style={{ padding: '10px' }}>
                                        <select 
                                            style={{ width: '100%' }}
                                            value={det.idProductoUnidad}
                                            onChange={(e) => {
                                                const p = productosMaster.find(x => x.idProductoUnidad == e.target.value);
                                                if (p) seleccionarProducto(index, p);
                                            }}
                                        >
                                            <option value="">-- Seleccionar --</option>
                                            {productosMaster.map(p => (
                                                <option key={`opt-${p.idProductoUnidad}`} value={p.idProductoUnidad}>
                                                    {p.nombreMostrar}
                                                </option>
                                            ))}
                                        </select>
                                    </td>
                                    <td>
                                        <input type="number" value={det.cantidad} onChange={(e) => manejarCambioDetalle(index, 'cantidad', e.target.value)} style={{ width: '50px' }} />
                                    </td>
                                    <td>
                                        <input type="number" step="0.01" value={det.costoUnitarioMonedaBase} onChange={(e) => manejarCambioDetalle(index, 'costoUnitarioMonedaBase', e.target.value)} style={{ width: '80px' }} />
                                    </td>
                                    <td>
                                        <button onClick={() => {
                                            const d = [...compra.detalles]; d.splice(index, 1); setCompra({...compra, detalles: d});
                                        }}>❌</button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>

                    <button onClick={agregarLinea} style={{ marginTop: '10px', padding: '10px', backgroundColor: '#10b981', color: 'white', border: 'none', borderRadius: '5px' }}>
                        + Añadir Fila
                    </button>

                    <button onClick={procesarCompra} style={{ width: '100%', marginTop: '20px', padding: '15px', backgroundColor: '#2563eb', color: 'white', fontWeight: 'bold', border: 'none', borderRadius: '5px' }}>
                        GUARDAR COMPRA
                    </button>
                </div>
            ) : (
                <div className="confirmar-precios">
                    <p style={{ color: 'orange', fontWeight: 'bold' }}>Variación de costos detectada. Ajuste precios de venta:</p>
                    {propuestas.map((p, i) => (
                        <div key={`prop-${i}`} style={{ display: 'flex', gap: '10px', marginBottom: '10px', alignItems: 'center', borderBottom: '1px solid #eee', padding: '10px' }}>
                           <span style={{ flex: 1 }}>Unidad ID: {p.idProductoUnidad}</span>
                           <span style={{ flex: 1 }}>Costo Nuevo: <strong>${p.nuevoCostoBase.toFixed(2)}</strong></span>
                           <div style={{ flex: 1 }}>
                               <label>Precio Venta ($): </label>
                               <input 
                                    type="number" 
                                    value={p.nuevoPrecioBase} 
                                    onChange={(e) => {
                                        const nuevas = [...propuestas];
                                        nuevas[i].nuevoPrecioBase = parseFloat(e.target.value);
                                        setPropuestas(nuevas);
                                    }}
                                    style={{ padding: '5px', border: '1px solid #2563eb' }}
                               />
                           </div>
                        </div>
                    ))}
                    <button onClick={enviarNuevosPrecios} style={{ backgroundColor: '#f59e0b', color: 'white', padding: '15px', width: '100%', border: 'none', borderRadius: '5px', fontWeight: 'bold' }}>
                        CONFIRMAR Y ACTUALIZAR INVENTARIO
                    </button>
                </div>
            )}
        </div>
    );
};

export default Compras;