import React, { useState, useEffect, useCallback, useRef } from 'react';
import axios from 'axios';

const API_URL = 'http://localhost:5077/api'; 
const FIXED_ROWS_COUNT = 5; // Constante para el número de líneas fijas

// Mapeo para mostrar el % de IVA en la tabla
const IVA_RATES_MAP = {
    0.00: '0% (Exento)',
    0.08: '8%',
    0.16: '16%',
    0.31: '31%'
};

// Estado inicial para una línea de la tabla (vacía)
const initialRowState = (id) => ({
    // Campos de control
    id: id,
    isFilled: false, // Indica si la línea tiene un producto seleccionado
    
    // Campos de búsqueda y selección (solo se usan en la UI)
    searchQuery: '',
    searchResults: [],
    selectedProductData: null, // Datos completos del producto seleccionado
    searchTimeout: null, // Agregamos el timeout al estado de la línea
    
    // Campos del Detalle de Compra (finales)
    codigoProd: '',
    descripcion: '',
    codigoBarras: '', 
    idProductoUnidad: '',
    nombreUnidad: '',
    tasaIVA: 0,
    cantidadComprada: 1,
    
    // Costos ingresados (Controlados en el input)
    costoUnitarioIngresado: 0.00,
    tipoCostoIngresado: 'VES',
    
    // Costos calculados (se envían al backend)
    costoUnitarioMonedaBase: 0,
    costoUnitarioMonedaExt: 0,
    
    // Totales calculados (se envían al backend)
    subtotalLineaMonedaBase: 0, 
    ivaLineaMonedaBase: 0,
    totalLineaMonedaBase: 0,
    subtotalLineaMonedaExt: 0, 
    ivaLineaMonedaExt: 0,
    totalLineaMonedaExt: 0,
});

const DetalleCompra = ({ detalles, onDetallesChange, tasaDeCambio }) => { 

    // ✅ CORRECCIÓN: Usamos directamente la prop pasada por el padre
    const tasaFinal = tasaDeCambio || 1.00;

    const [lineasCompra, setLineasCompra] = useState([]); 

    const [resumenTotal, setResumenTotal] = useState({
        subtotalBase: 0, ivaBase: 0, totalBase: 0,
        subtotalExt: 0, ivaExt: 0, totalExt: 0,
    });

    // Ref para evitar sincronización inicial que genera un ping-pong con el padre
    const skipSyncRef = useRef(false);

    // ==========================================================
    // FUNCIÓN AUXILIAR PARA ACTUALIZAR EL ESTADO DE UNA LÍNEA
    // ==========================================================
    const updateLineState = useCallback((index, updates) => {
        setLineasCompra(prevLines => 
            prevLines.map((line, i) => i === index ? { ...line, ...updates } : line)
        );
    }, []); 

    // ==========================================================
    // FUNCIÓN PARA CALCULAR EL RESUMEN TOTAL DE LA COMPRA
    // ==========================================================
    const calcularResumenTotal = useCallback((filledLines) => {
        const totals = filledLines.reduce((acc, line) => {
            acc.subtotalBase += parseFloat(line.subtotalLineaMonedaBase) || 0;
            acc.ivaBase += parseFloat(line.ivaLineaMonedaBase) || 0;
            acc.totalBase += parseFloat(line.totalLineaMonedaBase) || 0;
            
            acc.subtotalExt += parseFloat(line.subtotalLineaMonedaExt) || 0;
            acc.ivaExt += parseFloat(line.ivaLineaMonedaExt) || 0;
            acc.totalExt += parseFloat(line.totalLineaMonedaExt) || 0;
            return acc;
        }, {
            subtotalBase: 0, ivaBase: 0, totalBase: 0,
            subtotalExt: 0, ivaExt: 0, totalExt: 0,
        });

        // Solo actualizamos el estado si los totales han cambiado para evitar re-renders innecesarios.
        setResumenTotal(prevTotals => {
            // Comparamos los valores a 2 decimales para evitar que cambios minúsculos generen re-renders
            if (prevTotals.totalBase.toFixed(2) !== totals.totalBase.toFixed(2) ||
                prevTotals.totalExt.toFixed(2) !== totals.totalExt.toFixed(2)) {
                return totals;
            }
            return prevTotals;
        });

    }, []); 


// ==========================================================
    // INICIALIZACIÓN DE LÍNEAS (SETUP)
    // ==========================================================
    useEffect(() => {
        // Evitamos que la sincronización posterior con el padre se dispare
        skipSyncRef.current = true;

        const existingLines = detalles.map(d => ({ 
            ...initialRowState(d.id), 
            ...d, 
            isFilled: true,
        }));
        
        const filledIdsFromProps = existingLines.map(l => String(l.id));

        setLineasCompra(prev => {
            // 1. Filtrar las líneas vacías del estado anterior (prev) para reusar su contenido
            const previousEmptyLines = prev.filter(line => 
                !line.isFilled && !filledIdsFromProps.includes(String(line.id))
            );
            
            const emptyLinesCount = FIXED_ROWS_COUNT - existingLines.length;
            
            let finalEmptyLines = [];
            
            if (emptyLinesCount > 0) {
                // 2. Reutilizar las líneas vacías existentes para mantener el searchQuery
                const linesToReuse = previousEmptyLines.slice(0, emptyLinesCount);
                finalEmptyLines.push(...linesToReuse);

                // 3. Crear nuevas líneas si es necesario
                const newEmptyLinesCount = emptyLinesCount - linesToReuse.length;
                if (newEmptyLinesCount > 0) {
                     const newLines = Array.from({ length: newEmptyLinesCount }, 
                         (_, i) => initialRowState(`temp-${Date.now() + i + Math.random()}`) // ID temporal
                     );
                     finalEmptyLines.push(...newLines);
                }
            } else {
                // Si la cantidad de líneas llenas es mayor a la fija, mantener cualquier línea vacía extra
                 finalEmptyLines.push(...previousEmptyLines);
            }
            
            const desiredLines = [...existingLines, ...finalEmptyLines];

            // Evitar re-renders innecesarios
            if (prev.length === desiredLines.length && prev.every((p, i) => String(p.id) === String(desiredLines[i].id))) {
                return prev;
            }
            
            return desiredLines;
        });
    }, [detalles]); 

    // ==========================================================
    // Hook 1 (Sincronización con el padre) - No hay bucle infinito aquí
    // ==========================================================
    useEffect(() => {
        // Si acabamos de inicializar las líneas, evitamos sincronizar inmediatamente
        if (skipSyncRef.current) {
            skipSyncRef.current = false;
            return;
        }

        // Filtramos las líneas que han sido llenadas
        const filledLines = lineasCompra.filter(line => line.isFilled);

        // Sincronizar con el padre
        onDetallesChange(filledLines);
        
    }, [lineasCompra, onDetallesChange]); 

    // ==========================================================
    // Hook 2 (Cálculo del Resumen Total) - No hay bucle infinito aquí
    // ==========================================================
    useEffect(() => {
        const filledLines = lineasCompra.filter(line => line.isFilled);
        
        // Función de cálculo que llama a setResumenTotal
        calcularResumenTotal(filledLines); 
        
    }, [lineasCompra, calcularResumenTotal]); 

    
    // ==========================================================
    // LÓGICA DE CÁLCULO
    // ==========================================================
    const calcularTotales = (cantidad, costoBase, costoExt, tasaIVA) => {
        const qty = parseFloat(cantidad) || 0;
        const cb = parseFloat(costoBase) || 0;
        const ce = parseFloat(costoExt) || 0;
        const ivaRate = parseFloat(tasaIVA) || 0;

        const subtotalBase = qty * cb;
        const subtotalExt = qty * ce;

        const ivaBase = subtotalBase * ivaRate;
        const ivaExt = subtotalExt * ivaRate;

        const totalLineaBase = subtotalBase + ivaBase;
        const totalLineaExt = subtotalExt + ivaExt;

        // Devolvemos números (no strings) para evitar problemas de parseo en otros lugares
        return {
            subtotalLineaMonedaBase: Number(subtotalBase.toFixed(4)),
            ivaLineaMonedaBase: Number(ivaBase.toFixed(4)),
            totalLineaMonedaBase: Number(totalLineaBase.toFixed(4)),
            subtotalLineaMonedaExt: Number(subtotalExt.toFixed(4)),
            ivaLineaMonedaExt: Number(ivaExt.toFixed(4)),
            totalLineaMonedaExt: Number(totalLineaExt.toFixed(4)),
        };
    };

    // ==========================================================
    // LÓGICA DE BÚSQUEDA INTEGRADA POR LÍNEA (con Debouncing)
    // ==========================================================
    
    const handleSearchChange = (index, value) => {
        // 1. Limpiar el timeout anterior si existe
        const line = lineasCompra[index];
        if (line.searchTimeout) clearTimeout(line.searchTimeout);
        
        // 2. Crear el nuevo timeout
        const newTimeout = setTimeout(() => {
            searchProducts(index, value);
        }, 300);

        // 3. Actualizar searchQuery y searchTimeout en una sola llamada al estado
        updateLineState(index, { 
            searchQuery: value, 
            searchTimeout: newTimeout,
            searchResults: [] // Opcional: limpiar resultados inmediatamente al escribir
        });
    };

    // Estabilizamos la función de búsqueda para evitar que el linter se queje
    const searchProducts = useCallback(async (index, query) => {
        if (query.length < 3) { // 👈 REQUIERE MÍNIMO 3 CARACTERES
            updateLineState(index, { searchResults: [] });
            return;
        }
        
        try {
            const res = await axios.get(`${API_URL}/Productos/Buscar?q=${query}`);
            updateLineState(index, { searchResults: res.data, searchQuery: query });
        } catch (error) {
            console.error("Error buscando productos:", error);
            // Mostrar un error más claro al usuario si es necesario
            updateLineState(index, { searchResults: [], searchQuery: query });
        }
    }, [updateLineState]); // Depende de la función estable updateLineState


    // ==========================================================
    // 3. FUNCIÓN DE SELECCIÓN DE PRODUCTO POR LÍNEA
    // ==========================================================
    const handleProductSelect = (index, product) => {
        // 1. Determinar unidad por defecto (Caja o la primera disponible)
        const defaultUnit = product.unidadesDeVenta.find(u => u.nombreUnidad.toUpperCase() === 'CAJA') 
                        || (product.unidadesDeVenta.length > 0 ? product.unidadesDeVenta[0] : null);

        if (!defaultUnit) {
        alert("Error: El producto seleccionado no tiene unidades de venta definidas.");
        return;
    }

    // 2. EXTRAER LA ALICUOTA CORRECTAMENTE (Desde el objeto relacionado del Backend)
    // El backend envía: product.tasaIVA { alicuota: 0.16 }
    const alicuota = product.tasaIVA?.alicuota !== undefined ? product.tasaIVA.alicuota : 0;

    // 3. Configuración de costos iniciales
    const rawCost = parseFloat(defaultUnit.costoUnitarioMonedaBase) || 0;
    const currentTasa = tasaFinal; // Viene de las props
    
    let costoBase = rawCost;
    let costoExt = currentTasa > 0 ? rawCost / currentTasa : 0;
    
    const newCantidad = 1;

    // 4. CALCULAR TOTALES (Usando la variable 'alicuota' que definimos arriba)
    const totales = calcularTotales(newCantidad, costoBase, costoExt, alicuota);

    // 5. Construir el objeto de la línea
    const newDetalleData = {
        isFilled: true,
        searchQuery: product.descripcion,
        searchResults: [],
        selectedProductData: product,
        searchTimeout: null,
        
        codigoProd: product.codigoProd,
        descripcion: product.descripcion,
        codigoBarras: product.codigoBarras || 'N/A', 
        idProductoUnidad: defaultUnit.idProductoUnidad,
        nombreUnidad: defaultUnit.nombreUnidad,
        tasaIVA: alicuota, // <--- Usamos tasaIVA (en mayúsculas) para ser consistentes con initialRowState
        cantidadComprada: newCantidad,
        
        costoUnitarioIngresado: Number(rawCost.toFixed(4)),
        tipoCostoIngresado: 'VES', 

        costoUnitarioMonedaBase: Number(costoBase.toFixed(4)),
        costoUnitarioMonedaExt: Number(costoExt.toFixed(4)),
        
        ...totales
    };

    // 6. Actualizar el estado
    setLineasCompra(prevLines => 
        prevLines.map((line, i) => i === index ? { ...line, ...newDetalleData } : line)
    );
    };

    // ==========================================================
    // 4. Manejo de Cambios en una Línea (Cantidad, Costo, Moneda, Unidad)
    // ==========================================================
    const handleLineChange = (index, fieldName, value) => {
        const currentTasa = tasaFinal; // ✅ Usamos la tasa del padre
        let updatedDetalle = { ...lineasCompra[index], [fieldName]: value };
        
        let costoBase = parseFloat(updatedDetalle.costoUnitarioMonedaBase) || 0;
        let costoExt = parseFloat(updatedDetalle.costoUnitarioMonedaExt) || 0;
        
        if (fieldName === 'costoUnitarioIngresado' || fieldName === 'tipoCostoIngresado') {
            
            const rawCost = parseFloat(updatedDetalle.costoUnitarioIngresado) || 0;
            const inputCurrency = updatedDetalle.tipoCostoIngresado;

            if (inputCurrency === 'VES') {
                costoBase = rawCost;
                costoExt = currentTasa > 0 ? rawCost / currentTasa : 0;
            } else if (inputCurrency === 'USD') {
                if (currentTasa === 0) {
                    // El botón USD debería estar deshabilitado en el UI si currentTasa es 0, 
                    // pero esta lógica es una doble verificación de seguridad
                    alert("Advertencia: No hay tasa de cambio registrada. No se puede usar USD.");
                    updatedDetalle.tipoCostoIngresado = 'VES';
                    costoBase = parseFloat(lineasCompra[index].costoUnitarioMonedaBase) || 0;
                    costoExt = parseFloat(lineasCompra[index].costoUnitarioMonedaExt) || 0;
                } else {
                    costoExt = rawCost;
                    costoBase = rawCost * currentTasa;
                }
            }
            
            updatedDetalle.costoUnitarioMonedaBase = Number(costoBase.toFixed(4));
            updatedDetalle.costoUnitarioMonedaExt = Number(costoExt.toFixed(4));

        } else if (fieldName === 'idProductoUnidad') {
            const product = updatedDetalle.selectedProductData;
            const unitData = product.unidadesDeVenta.find(u => String(u.idProductoUnidad) === String(value));
            
            if (unitData) {
                const rawCost = parseFloat(unitData.costoUnitarioMonedaBase) || 0;
                const inputCurrency = 'VES'; 
                
                let newCostoBase = rawCost;
                let newCostoExt = currentTasa > 0 ? rawCost / currentTasa : 0;
                
                updatedDetalle.costoUnitarioIngresado = Number(rawCost.toFixed(4));
                updatedDetalle.tipoCostoIngresado = inputCurrency;
                updatedDetalle.nombreUnidad = unitData.nombreUnidad; 
                updatedDetalle.costoUnitarioMonedaBase = Number(newCostoBase.toFixed(4));
                updatedDetalle.costoUnitarioMonedaExt = Number(newCostoExt.toFixed(4));
                
                costoBase = newCostoBase;
                costoExt = newCostoExt;
            }
        }
        
        // Recálculo de totales
        const newCantidad = parseFloat(updatedDetalle.cantidadComprada) || 0;
        const newTasaIVA = parseFloat(updatedDetalle.tasaIVA) || 0;
        
        const totales = calcularTotales(newCantidad, costoBase, costoExt, newTasaIVA);

        const finalUpdatedDetalle = { 
            ...updatedDetalle, 
            ...totales,
        };

        // Actualizar el estado con el detalle final
        setLineasCompra(prevLines => 
            prevLines.map((line, i) => i === index ? finalUpdatedDetalle : line)
        );
    };
    
    // Función para limpiar o eliminar la línea (la deja vacía si está en las 5 fijas)
    const handleRemoveLine = (index) => {
        const line = lineasCompra[index];
        if (line.searchTimeout) clearTimeout(line.searchTimeout); // Limpiar timeout al remover
        
        if (lineasCompra.length > FIXED_ROWS_COUNT) {
            setLineasCompra(prevLines => prevLines.filter((_, i) => i !== index));
        } else {
            // Resetear la línea a su estado inicial
            setLineasCompra(prevLines => prevLines.map((line, i) => 
                i === index ? initialRowState(line.id) : line
            ));
        }
    };
    
    // Función para añadir una nueva línea si las 5 están llenas
    const handleAddEmptyLine = () => {
        if (lineasCompra.every(line => line.isFilled)) {
            setLineasCompra(prevLines => [
                ...prevLines, 
                initialRowState(`temp-${Date.now()}`)
            ]);
        } else {
            alert("Por favor, llena las líneas vacías existentes antes de añadir una nueva.");
        }
    };

    // ==========================================================
    // 5. Renderizado
    // ==========================================================
    return (
        <div className="card mt-4 p-3">
            <h5 className="card-title">Detalle de Artículos</h5>

            {/* Botón para añadir línea extra si las 5 ya están llenas o se requiere */}
            <div className='mb-3 text-end'>
                <button 
                    type="button" 
                    className="btn btn-sm btn-info"
                    onClick={handleAddEmptyLine}
                >
                    Añadir Línea Extra
                </button>
            </div>


            {/* TABLA DE DETALLES CON INPUTS INTEGRADOS */}
            <div className="table-responsive mt-3">
                <table className="table table-striped table-sm">
                    <thead>
                        <tr>
                            <th style={{ width: '10%' }}>Cód. Prod</th>
                            <th style={{ width: '30%' }}>Buscar Artículo / Descripción / Cód. Barras</th>
                            <th style={{ width: '10%' }}>Unidad</th>
                            <th style={{ width: '8%' }}>Cantidad</th>
                            <th style={{ width: '18%' }}>Costo Unit.</th> 
                            <th>Total Línea (VES)</th> 
                            <th style={{ width: '5%' }}>Acciones</th>
                        </tr>
                    </thead>
                    <tbody>
                        {lineasCompra.map((detalle, index) => (
                            <tr key={detalle.id} className={detalle.isFilled ? '' : 'table-light'}>
                                {/* 1. CÓDIGO DE PRODUCTO (Lectura) */}
                                <td>{detalle.codigoProd}</td>

                                {/* 2. DESCRIPCIÓN Y BÚSQUEDA */}
                                <td className="position-relative">
                                    {detalle.isFilled ? (
                                        <>
                                            <strong>{detalle.descripcion}</strong>
                                            <div className="small text-muted">
                                                Cód. Barras: {detalle.codigoBarras || 'N/A'} 
                                                <br/>
                                                IVA: {IVA_RATES_MAP[detalle.tasaIVA] || `${(detalle.tasaIVA * 100).toFixed(0)}%`}
                                            </div>
                                        </>
                                    ) : (
                                        <>
                                            <input
                                                type="text"
                                                id={`search-${detalle.id}`}
                                                name={`search-${detalle.id}`}
                                                className="form-control form-control-sm"
                                                placeholder="Buscar producto..."
                                                value={detalle.searchQuery}
                                                onChange={(e) => handleSearchChange(index, e.target.value)}
                                            />
                                            {detalle.searchResults.length > 0 && (
                                                <ul className="list-group position-absolute w-100" style={{ zIndex: 1000, maxHeight: '200px', overflowY: 'auto' }}>
                                                    {detalle.searchResults.map((product) => (
                                                        <li 
                                                            key={product.codigoProd} 
                                                            className="list-group-item list-group-item-action p-2"
                                                            onClick={() => handleProductSelect(index, product)}
                                                        >
                                                            <strong>{product.descripcion}</strong> (Cód. {product.codigoProd})
                                                        </li>
                                                    ))}
                                                </ul>
                                            )}
                                        </>
                                    )}
                                </td>
                                
                                {/* 3. UNIDAD DE COMPRA */}
                                <td>
                                    {detalle.isFilled && detalle.selectedProductData ? (
                                        <select 
                                            className="form-select form-select-sm"
                                            name={`idProductoUnidad-${detalle.id}`}
                                            id={`idProductoUnidad-${detalle.id}`}
                                            value={String(detalle.idProductoUnidad)} 
                                            onChange={(e) => handleLineChange(index, 'idProductoUnidad', e.target.value)}
                                        >
                                            {detalle.selectedProductData.unidadesDeVenta.map((unidad) => (
                                                <option key={unidad.idProductoUnidad} value={unidad.idProductoUnidad}>
                                                    {unidad.nombreUnidad}
                                                </option>
                                            ))}
                                        </select>
                                    ) : (
                                        <span className='text-muted small'>N/A</span>
                                    )}
                                </td>
                                
                                {/* 4. CANTIDAD COMPRADA */}
                                <td>
                                    <input 
                                        type="number"
                                        step="1"
                                        min="1"
                                        className="form-control form-control-sm"
                                        name="cantidadComprada"
                                        value={detalle.cantidadComprada}
                                        onChange={(e) => handleLineChange(index, 'cantidadComprada', e.target.value)}
                                        disabled={!detalle.isFilled}
                                    />
                                </td>
                                
                                {/* 5. COSTO UNITARIO Y MONEDA */}
                                <td>
                                    <div className="input-group input-group-sm">
                                        <select 
                                            className="form-select"
                                            name="tipoCostoIngresado"
                                            value={detalle.tipoCostoIngresado}
                                            onChange={(e) => handleLineChange(index, 'tipoCostoIngresado', e.target.value)}
                                            style={{ maxWidth: '70px' }}
                                            disabled={!detalle.isFilled}
                                        >
                                            <option value="VES">VES</option>
                                            {/* El select USD se deshabilita si la tasa del padre es 0 */}
                                            <option value="USD" disabled={tasaFinal === 0}>USD</option> 
                                        </select>
                                        <input
                                            type="number"
                                            step="0.0001"
                                            className="form-control"
                                            name="costoUnitarioIngresado"
                                            value={detalle.costoUnitarioIngresado}
                                            onChange={(e) => handleLineChange(index, 'costoUnitarioIngresado', e.target.value)}
                                            disabled={!detalle.isFilled}
                                        />
                                    </div>
                                    {detalle.isFilled && (
                                        <small className='text-muted'>
                                            {detalle.tipoCostoIngresado === 'VES' 
                                                ? `(${parseFloat(detalle.costoUnitarioMonedaExt).toFixed(4)} USD)` 
                                                : `(${parseFloat(detalle.costoUnitarioMonedaBase).toFixed(4)} VES)`}
                                        </small>
                                    )}
                                </td>
                                
                                {/* 6. TOTAL LÍNEA (VES - Moneda Base) */}
                                <td>
                                    {detalle.isFilled ? 
                                        <>
                                            <strong className='text-success'>{parseFloat(detalle.totalLineaMonedaBase).toFixed(2)} VES</strong>
                                            <br/>
                                            <small className='text-muted'>({parseFloat(detalle.totalLineaMonedaExt).toFixed(2)} USD)</small>
                                        </>
                                        : '-'
                                    }
                                </td> 
                                
                                {/* 7. ACCIONES */}
                                <td>
                                    {detalle.isFilled ? (
                                        <button 
                                            type="button" 
                                            className="btn btn-danger btn-sm"
                                            onClick={() => handleRemoveLine(index)}
                                            aria-label={`Eliminar producto ${detalle.descripcion}`}
                                        >
                                            X
                                        </button>
                                    ) : (
                                        <span className='text-muted small'>Línea vacía</span>
                                    )}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* -------------------------------------------------------- */}
            {/* RESUMEN TOTAL DE LA COMPRA */}
            {/* -------------------------------------------------------- */}
            <div className="row mt-4 justify-content-end">
                <div className="col-md-6 col-lg-4">
                    <h5 className="mb-2">💰 Resumen de la Compra</h5>
                    <table className="table table-sm table-borderless small">
                        <tbody>
                            <tr className="table-secondary">
                                <td>**Concepto**</td>
                                <td className="text-end">**VES (Base)**</td>
                                <td className="text-end">**USD (Ext.)**</td>
                            </tr>
                            <tr>
                                <td>Subtotal:</td>
                                <td className="text-end">{resumenTotal.subtotalBase.toFixed(2)}</td>
                                <td className="text-end">{resumenTotal.subtotalExt.toFixed(2)}</td>
                            </tr>
                            <tr>
                                <td>IVA Total:</td>
                                <td className="text-end">{resumenTotal.ivaBase.toFixed(2)}</td>
                                <td className="text-end">{resumenTotal.ivaExt.toFixed(2)}</td>
                            </tr>
                            <tr className="fw-bold table-success">
                                <td>TOTAL GENERAL:</td>
                                <td className="text-end">{resumenTotal.totalBase.toFixed(2)} VES</td>
                                <td className="text-end">{resumenTotal.totalExt.toFixed(2)} USD</td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default DetalleCompra;