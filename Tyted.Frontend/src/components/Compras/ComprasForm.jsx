import React, { useState, useEffect, useCallback, useRef } from 'react'; 
import DetalleCompra from './DetalleCompra'; 
import axios from 'axios';

// ==========================================================
// ACEPTAR PROPS: Se añaden 'onSaveSuccess' y 'onCancel'
// ==========================================================
const ComprasForm = ({ API_URL = 'http://localhost:5077/api', onSaveSuccess, onCancel }) => { 
    
    // ==========================================================
    // 1. ESTADO INICIAL ACTUALIZADO
    // ==========================================================
    const [compra, setCompra] = useState({
        idProveedor: '',
        fechaCompra: new Date().toISOString().split('T')[0],
        tipoMoneda: 'VES', 
        tasaDeCambio: 1.00, 
        
        // --- CAMPOS PARA DESGLOSE DE TOTALES ---
        subtotalMonedaBase: 0, 
        ivaMonedaBase: 0,    
        totalMonedaBase: 0, 
        subtotalMonedaExt: 0, 
        ivaMonedaExt: 0,    
        totalMonedaExt: 0, 
        
        detalles: []
    });

    // ESTADOS PARA LA BÚSQUEDA DE PROVEEDORES
    const [proveedoresSearchResults, setProveedoresSearchResults] = useState([]);
    const [proveedorSearchQuery, setProveedorSearchQuery] = useState('');
    
    // USAMOS useRef PARA EL TIMEOUT
    const proveedorSearchTimeoutRef = useRef(null); 
    
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    // ==========================================================
    // FUNCIÓN PARA OBTENER LA TASA VIGENTE 
    // ==========================================================
    const fetchTasaVigente = async () => {
        try {
            const response = await axios.get(`${API_URL}/TasaDeCambio/vigente`);
            const tasaVigente = response.data.tasa; 
            
            if (tasaVigente) {
                setCompra(prevCompra => ({
                    ...prevCompra,
                    tasaDeCambio: parseFloat(tasaVigente) 
                }));
            }
        } catch (err) {
            console.error("Error al cargar la tasa de cambio vigente:", err);
            // No se establece error, ya que no es crítico para iniciar el formulario.
        }
    };

    useEffect(() => {
        fetchTasaVigente(); 

        // LIMPIAR EL TIMEOUT USANDO LA REFERENCIA EN EL DESMONTAJE
        return () => {
            if (proveedorSearchTimeoutRef.current) clearTimeout(proveedorSearchTimeoutRef.current);
        };
    }, [API_URL]); // <-- Añadido API_URL como dependencia
    
    // ==========================================================
    // LÓGICA DE BÚSQUEDA DE PROVEEDOR (con Debouncing)
    // ==========================================================

    const searchProveedores = useCallback(async (query) => {
        // 1. Normalizar el término de búsqueda
        const term = query.trim().toLowerCase(); 

        // Condición para buscar solo si hay 3 o más caracteres
        if (term.length < 3) {
            setProveedoresSearchResults([]);
            return;
        }
        
        try {
            // 2. Usar el término normalizado en la URL
            const res = await axios.get(`${API_URL}/Proveedores/Buscar?q=${encodeURIComponent(term)}`);
            setProveedoresSearchResults(res.data);
        } catch (error) {
            console.error("Error buscando proveedores:", error);
            setProveedoresSearchResults([]);
        }
    }, [API_URL]); // <-- Añadido API_URL como dependencia

    const handleProveedorSearchChange = (value) => {
        // 4. LIMPIAR EL TIMEOUT ANTERIOR USANDO REF.CURRENT
        if (proveedorSearchTimeoutRef.current) clearTimeout(proveedorSearchTimeoutRef.current);
        
        setProveedorSearchQuery(value);
        setProveedoresSearchResults([]); 

        // 2. Si el input queda vacío, también reseteamos el ID del proveedor en la compra.
        if (!value) {
            setCompra(prevCompra => ({
                ...prevCompra,
                idProveedor: '',
            }));
            return;
        }
        
        // 3. Crear el nuevo timeout (debounce: espera 300ms)
        const newTimeout = setTimeout(() => {
            searchProveedores(value);
        }, 300); 
        
        // 4. ALMACENAR EL ID DEL NUEVO TIMEOUT EN REF.CURRENT
        proveedorSearchTimeoutRef.current = newTimeout;
    };

    const handleProveedorSelect = (proveedor) => {
        // 1. Establecer el nombre/razón social en el input de búsqueda y limpiar resultados
        setProveedorSearchQuery(proveedor.razonsocial || ''); 
        setProveedoresSearchResults([]);
        
        // 2. Actualizar el estado 'compra' con el idProveedor
        setCompra(prevCompra => ({
            ...prevCompra,
            idProveedor: proveedor.codigoProv, 
        }));
    };
    
    const handleInputChange = (e) => {
        const { name, value } = e.target;
        const newValue = (name === 'tasaDeCambio') ? (parseFloat(value) || 0) : value; 

        setCompra(prev => {
            if (name === 'tasaDeCambio') {
                return handleRecalculateTotals({ ...prev, [name]: newValue });
            }
            return {
                ...prev,
                [name]: newValue
            };
        });
    };

    /**
     * Función interna para recalcular todos los totales de la cabecera
     */
    const handleRecalculateTotals = (currentCompra, newDetalles = currentCompra.detalles) => {
        let subtotalBase = 0;
        let ivaBase = 0;
        let totalBase = 0;

        // Nota: Asegurarse de que los detalles tengan valores de string para 'SubtotalLineaMonedaBase', etc.
        newDetalles.forEach(detalle => {
            // Se debe acceder a las propiedades calculadas que vienen de DetalleCompra.jsx
            // Se asume que DetalleCompra.jsx usa nombres en camelCase: 
            subtotalBase += parseFloat(detalle.subtotalLineaMonedaBase) || 0;
            ivaBase += parseFloat(detalle.ivaLineaMonedaBase) || 0;
            totalBase += parseFloat(detalle.totalLineaMonedaBase) || 0;
        });

        const tasaCambio = parseFloat(currentCompra.tasaDeCambio) || 1.00; 
        
        // Si la tasa es cero o nula, evitamos la división por cero
        const subtotalExt = tasaCambio > 0 ? subtotalBase / tasaCambio : 0;
        const ivaExt = tasaCambio > 0 ? ivaBase / tasaCambio : 0;
        const totalExt = tasaCambio > 0 ? totalBase / tasaCambio : 0;
        
        return {
            ...currentCompra,
            detalles: newDetalles,
            subtotalMonedaBase: subtotalBase.toFixed(2),
            ivaMonedaBase: ivaBase.toFixed(2), 
            totalMonedaBase: totalBase.toFixed(2),
            subtotalMonedaExt: subtotalExt.toFixed(2), 
            ivaMonedaExt: ivaExt.toFixed(2),
            totalMonedaExt: totalExt.toFixed(2),
        };
    };

    /**
     * Manejador de cambio para el componente DetalleCompra
     */
    const handleDetallesChange = useCallback((newDetalles) => {
        setCompra(prev => handleRecalculateTotals(prev, newDetalles));
    }, []); 

    // ==========================================================
    // FUNCIÓN MODIFICADA: Ahora usa 'onSaveSuccess'
    // ==========================================================
    const handleSubmit = async (e) => {
        e.preventDefault(); 
    
        // 1. Validación básica
        if (!compra.Codigo) {
            setError("Debe seleccionar un proveedor antes de registrar la compra.");
            setLoading(false); 
            return;
        }
        
        // Filtra los detalles que realmente tienen un producto
        const detallesConProductos = compra.detalles.filter(d => d.isFilled);
        
        if (detallesConProductos.length === 0) {
            setError("Debe agregar al menos un artículo a la compra.");
            setLoading(false); 
            return;
        }
        
        setLoading(true);
        setError(null);
        
        // 🛑 PASO CLAVE 1: Mapeo manual de detalles a PascalCase y tipado.
        const detallesPascalCase = detallesConProductos.map(detalle => ({
            
            // IDs y códigos 
            CodigoProd: detalle.codigoProd,
            Descripcion: detalle.descripcion,
            CodigoBarras: detalle.codigoBarras,
            IdProductoUnidad: parseInt(detalle.idProductoUnidad, 10), 
            NombreUnidad: detalle.nombreUnidad,
            
            // Números: Conversión a float
            TasaIVA: parseFloat(detalle.tasaIVA),
            Cantidad: parseFloat(detalle.cantidadComprada), 
            CostoUnitarioMonedaBase: parseFloat(detalle.costoUnitarioMonedaBase),
            CostoUnitarioMonedaExt: parseFloat(detalle.costoUnitarioMonedaExt),
            
            // Totales de Línea
            SubtotalLineaMonedaBase: parseFloat(detalle.subtotalLineaMonedaBase),
            IvaLineaMonedaBase: parseFloat(detalle.ivaLineaMonedaBase),
            TotalLineaMonedaBase: parseFloat(detalle.totalLineaMonedaBase),
            SubtotalLineaMonedaExt: parseFloat(detalle.subtotalLineaMonedaExt),
            IvaLineaMonedaExt: parseFloat(detalle.ivaLineaMonedaExt),
            TotalLineaMonedaExt: parseFloat(detalle.totalLineaMonedaExt),
        }));

        // 🛑 PASO CLAVE 2: Mapeo de la Cabecera a PascalCase y tipado.
        const compraAEnviar = { 
            CodigoProv: parseInt(compra.CodigoProv), 
            
            FechaCompra: compra.fechaCompra,
            TipoMoneda: compra.tipoMoneda,
            TasaDeCambio: parseFloat(compra.tasaDeCambio),
            
            // Totales (PascalCase y Números Flotantes)
            SubtotalMonedaBase: parseFloat(compra.subtotalMonedaBase),
            IvaMonedaBase: parseFloat(compra.ivaMonedaBase),
            TotalMonedaBase: parseFloat(compra.totalMonedaBase),
            SubtotalMonedaExt: parseFloat(compra.subtotalMonedaExt),
            IvaMonedaExt: parseFloat(compra.ivaMonedaExt),
            TotalMonedaExt: parseFloat(compra.totalMonedaExt),
            
            // Detalles corregidos y tipados
            Detalles: detallesPascalCase 
        };
        
        console.log("Objeto de Compra a Enviar (PascalCase):", compraAEnviar);

        try {
            // 3. Realizar la llamada POST a la API
            const response = await axios.post(`${API_URL}/Compras`, compraAEnviar);

            // 4. Manejo de éxito
            alert(`Compra registrada con éxito! ID: ${response.data.idCompra || response.data.id}`);

            // 🌟 NUEVA LÍNEA CLAVE: Llama al callback de éxito para notificar al padre
            if (onSaveSuccess) {
                onSaveSuccess(); 
            }
            
            // 5. Resetear el formulario a su estado inicial
            setCompra({
                idProveedor: '',
                fechaCompra: new Date().toISOString().split('T')[0],
                tipoMoneda: 'VES', 
                tasaDeCambio: 1.00, 
                subtotalMonedaBase: 0, 
                ivaMonedaBase: 0,    
                totalMonedaBase: 0, 
                subtotalMonedaExt: 0, 
                ivaMonedaExt: 0,    
                totalMonedaExt: 0, 
                detalles: []
            });
            setProveedorSearchQuery('');
            

        } catch (err) {
            // 6. Manejo de errores (Mejorado para capturar el detalle del error 400)
            console.error("Error al registrar la compra:", err.response || err);
            
            const errorData = err.response?.data;
            let errorMessage = 'Error desconocido al intentar registrar la compra. Revise la consola para el detalle del error.';

            if (err.response?.status === 500 && typeof errorData === 'string') {
                errorMessage = errorData; 
            } else if (errorData) {
                if (errorData.errors) {
                    errorMessage = "Error de Validación del Servidor:\n" + 
                                        Object.keys(errorData.errors).map(key => `${key}: ${errorData.errors[key].join(', ')}`).join('\n');
                } 
                else if (typeof errorData === 'string') {
                    errorMessage = errorData;
                }
            }
            
            setError(`Error ${err.response?.status || 'de Conexión'}: ${errorMessage}`);

        } finally {
            // 7. Finalizar el estado de carga
            setLoading(false);
        }
    }
    // ==========================================================

    // ==========================================================
    // RENDERIZADO: Se añade el botón de Cancelar.
    // ==========================================================
    return (
        <div className="container mt-4">
            <h2>Registro de Nueva Compra</h2>
            {error && <div className="alert alert-danger">{error}</div>}
            
            <form onSubmit={handleSubmit}>
                {/* Cabecera de la Compra */}
                <div className="card mb-4 p-3">
                    <h5 className="card-title">Datos de la Cabecera</h5>
                    <div className="row g-3">
                        
                        {/* 1. SELECCIÓN DE PROVEEDOR (BÚSQUEDA) */}
                        <div className="col-md-6 position-relative">
                            <label className="form-label" htmlFor="idProveedor">Buscar Proveedor *</label>
                            <input
                                type="text"
                                className="form-control"
                                id="proveedorSearch"
                                placeholder="Escriba nombre o RIF (mín. 3 caracteres)"
                                value={proveedorSearchQuery}
                                onChange={(e) => handleProveedorSearchChange(e.target.value)}
                                required 
                            />
                            
                            {/* Muestra el ID del proveedor seleccionado */}
                            {compra.idProveedor && (
                                    <small className='text-success'>Proveedor ID: **{compra.idProveedor}**</small>
                            )}

                            {/* Lista de resultados de la búsqueda */}
                            {proveedoresSearchResults.length > 0 && (
                                <ul className="list-group position-absolute w-100" style={{ zIndex: 1000, maxHeight: '200px', overflowY: 'auto' }}>
                                    {proveedoresSearchResults.map((proveedor) => (
                                        <li 
                                            key={proveedor.codigoProv} 
                                            className={`list-group-item list-group-item-action p-2 ${String(compra.idProveedor) === String(proveedor.codigoProv) ? 'active' : ''}`}
                                            onClick={() => handleProveedorSelect(proveedor)}
                                        >
                                            <strong>{proveedor.razonsocial}</strong> (RIF: {proveedor.rif}) 
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </div>

                        <div className="col-md-3">
                            <label className="form-label" htmlFor="fechaCompra">Fecha de Compra</label>
                            <input 
                                type="date" 
                                className="form-control" 
                                name="fechaCompra" 
                                id="fechaCompra" 
                                value={compra.fechaCompra} 
                                onChange={handleInputChange} 
                                required
                            />
                        </div>

                        {/* 3. TASA DE CAMBIO */}
                        <div className="col-md-3">
                            <label className="form-label" htmlFor="tasaDeCambio">Tasa de Cambio (VES/USD)</label>
                            <input 
                                type="number"
                                step="0.0001"
                                className="form-control"
                                name="tasaDeCambio" 
                                id="tasaDeCambio" 
                                value={compra.tasaDeCambio} 
                                onChange={handleInputChange}
                                required
                                readOnly={compra.tasaDeCambio > 1.00} 
                                disabled={compra.tipoMoneda === 'VES' && compra.tasaDeCambio === 1.00}
                            />
                        </div>
                    </div>
                </div>

                {/* Componente de Detalles (Tabla de Productos) */}
                <DetalleCompra 
                    detalles={compra.detalles} 
                    tasaDeCambio={parseFloat(compra.tasaDeCambio)} 
                    onDetallesChange={handleDetallesChange} 
                />
                
                {/* Botones de Acción */}
                <div className="d-flex justify-content-end gap-2 mt-3">
                    <button
                        type="button" // Tipo button para evitar submit
                        className="btn btn-secondary"
                        onClick={onCancel} // Llama al callback de cancelación
                        disabled={loading}
                    >
                        Cancelar
                    </button>
                    <button 
                        type="submit" 
                        className="btn btn-success"
                        // Deshabilita si no hay proveedor o si no hay detalles llenos
                        disabled={loading || !compra.idProveedor || compra.detalles.filter(d => d.isFilled).length === 0} 
                    >
                        {loading ? 'Registrando...' : 'Registrar Compra'}
                    </button>
                </div>
            </form>
        </div>
    );
};

export default ComprasForm;