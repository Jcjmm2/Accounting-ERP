import React, { useState } from 'react';
import axios from 'axios';

const API_URL = 'http://localhost:5077/api'; 

const DetalleCompra = ({ detalles, tasaCambio, onDetallesChange }) => {
    
    const [busqueda, setBusqueda] = useState('');
    const [productoSeleccionado, setProductoSeleccionado] = useState(null);
    const [errorBusqueda, setErrorBusqueda] = useState(null);

    // ==========================================================
    // 1. Manejo de Búsqueda de Producto por CodigoProd
    // ==========================================================
    const handleSearch = async (e) => {
        // ... (handleSearch se mantiene igual)
        setErrorBusqueda(null);
        setProductoSeleccionado(null);

        if (!busqueda) {
            setErrorBusqueda("Ingrese un código de producto.");
            return;
        }

        try {
            // Asumiendo que tienes un GET por código de producto en tu API
            const response = await axios.get(`${API_URL}/Productos/${busqueda}`); 
            const producto = response.data;
            
            if (producto && producto.unidadesDeVenta && producto.unidadesDeVenta.length > 0) {
                const unidadBase = producto.unidadesDeVenta[0]; 
                
                setProductoSeleccionado({
                    codigoProd: producto.codigoProd,
                    descripcion: producto.descripcion,
                    idProductoUnidad: unidadBase.idProductoUnidad,
                    nombreUnidad: unidadBase.nombreUnidad,
                    costoSugerido: unidadBase.costoUnitarioMonedaBase 
                });
                
            } else {
                setErrorBusqueda("Producto encontrado, pero no tiene unidades de venta definidas.");
            }

        } catch (err) {
            console.error("Error al buscar producto:", err);
            setErrorBusqueda(`Producto con código ${busqueda} no encontrado.`);
        }
    };

    // ==========================================================
    // 2. Añadir Producto a la Tabla de Detalles
    // ==========================================================
    const handleAddProduct = () => {
        // ... (handleAddProduct se mantiene igual)
        if (!productoSeleccionado) return;

        if (detalles.some(d => d.codigoProd === productoSeleccionado.codigoProd)) {
            setErrorBusqueda("Este producto ya está en la lista.");
            return;
        }

        const nuevoDetalle = {
            id: Date.now(),
            codigoProd: productoSeleccionado.codigoProd,
            descripcion: productoSeleccionado.descripcion,
            idProductoUnidad: productoSeleccionado.idProductoUnidad,
            nombreUnidad: productoSeleccionado.nombreUnidad,
            
            cantidadComprada: 1, 
            costoUnitarioMonedaBase: productoSeleccionado.costoSugerido || 0,
            costoUnitarioMonedaExt: 0,
            totalLineaMonedaBase: productoSeleccionado.costoSugerido || 0,
        };

        const nuevosDetalles = [...detalles, nuevoDetalle];
        onDetallesChange(nuevosDetalles);
        setProductoSeleccionado(null);
        setBusqueda('');
        setErrorBusqueda(null);
    };

    // ==========================================================
    // 3. Manejar cambios en las líneas de detalle (Cantidad/Costo)
    // ==========================================================
    const handleLineChange = (id, field, value) => {
        // ... (handleLineChange se mantiene igual)
        const nuevosDetalles = detalles.map(detalle => {
            if (detalle.id === id) {
                const updatedDetalle = { ...detalle, [field]: parseFloat(value) || 0 };
                
                const base = updatedDetalle.costoUnitarioMonedaBase;
                const qty = updatedDetalle.cantidadComprada;
                const rate = tasaCambio > 0 ? tasaCambio : 1;

                updatedDetalle.totalLineaMonedaBase = (base * qty).toFixed(2);
                updatedDetalle.costoUnitarioMonedaExt = (base / rate).toFixed(4); 
                
                return updatedDetalle;
            }
            return detalle;
        });

        onDetallesChange(nuevosDetalles);
    };

    // ==========================================================
    // 4. Eliminar una línea de detalle
    // ==========================================================
    const handleRemoveLine = (id) => {
        // ... (handleRemoveLine se mantiene igual)
        const nuevosDetalles = detalles.filter(detalle => detalle.id !== id);
        onDetallesChange(nuevosDetalles);
    };

    // ==========================================================
    // 5. Renderizado
    // ==========================================================
    return (
        <div className="card mt-4 p-3">
            <h5 className="card-title">Detalle de Artículos</h5>

            {/* BÚSQUEDA (CORRECCIÓN DE ACCESIBILIDAD MANTENIDA) */}
            <label htmlFor="detalleBusqueda" className="visually-hidden">Buscar Producto por Código</label>
            
            <div className="input-group mb-3"> 
                <input
                    type="text"
                    className="form-control"
                    placeholder="Buscar producto por Código (ej: 100)"
                    id="detalleBusqueda"
                    value={busqueda}
                    onChange={(e) => setBusqueda(e.target.value)}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                            e.preventDefault();
                            handleSearch(e);
                        }
                    }}
                />
                <button 
                    type="button" 
                    className="btn btn-primary"
                    onClick={handleSearch}
                >
                    Buscar
                </button>
            </div>

            {errorBusqueda && <div className="alert alert-warning p-2">{errorBusqueda}</div>}

            {productoSeleccionado && (
                <div className="alert alert-info d-flex justify-content-between align-items-center p-2">
                    <span>
                        **Producto encontrado:** {productoSeleccionado.descripcion} ({productoSeleccionado.nombreUnidad}) 
                        - Costo Sugerido: {productoSeleccionado.costoSugerido}
                    </span>
                    <button 
                        type="button" 
                        className="btn btn-sm btn-success" 
                        onClick={handleAddProduct}
                    >
                        + Añadir
                    </button>
                </div>
            )}

            {/* TABLA DE ARTÍCULOS (CORRECCIONES DE ACCESIBILIDAD APLICADAS AQUÍ) */}
            <div className="table-responsive">
                <table className="table table-striped table-sm mt-3">
                    <thead>
                        <tr>
                            <th>Código</th>
                            <th>Descripción</th>
                            <th style={{ width: '100px' }}>Cantidad</th>
                            <th style={{ width: '150px' }}>Costo Base</th>
                            <th>Total Base</th>
                            <th>Acción</th>
                        </tr>
                    </thead>
                    <tbody>
                        {detalles.length === 0 ? (
                            <tr>
                                <td colSpan="6" className="text-center">Agregue artículos a la compra</td>
                            </tr>
                        ) : (
                            detalles.map(detalle => (
                                <tr key={detalle.id}>
                                    <td>{detalle.codigoProd}</td>
                                    <td>{detalle.descripcion} ({detalle.nombreUnidad})</td>
                                    <td>
                                        {/* CORRECCIÓN 1: Cantidad - ID dinámico, name y label para accesibilidad */}
                                        <label htmlFor={`qty-${detalle.id}`} className="visually-hidden">Cantidad de {detalle.descripcion}</label>
                                        <input
                                            type="number"
                                            step="0.01"
                                            className="form-control form-control-sm"
                                            name="cantidadComprada" // <-- Name agregado
                                            id={`qty-${detalle.id}`} // <-- ID Dinámico
                                            value={detalle.cantidadComprada}
                                            onChange={(e) => handleLineChange(detalle.id, 'cantidadComprada', e.target.value)}
                                        />
                                    </td>
                                    <td>
                                        {/* CORRECCIÓN 2: Costo Base - ID dinámico, name y label para accesibilidad */}
                                        <label htmlFor={`cost-${detalle.id}`} className="visually-hidden">Costo Base de {detalle.descripcion}</label>
                                        <input
                                            type="number"
                                            step="0.0001"
                                            className="form-control form-control-sm"
                                            name="costoUnitarioMonedaBase" // <-- Name agregado
                                            id={`cost-${detalle.id}`} // <-- ID Dinámico
                                            value={detalle.costoUnitarioMonedaBase}
                                            onChange={(e) => handleLineChange(detalle.id, 'costoUnitarioMonedaBase', e.target.value)}
                                        />
                                    </td>
                                    <td>{detalle.totalLineaMonedaBase}</td>
                                    <td>
                                        <button 
                                            type="button" 
                                            className="btn btn-danger btn-sm"
                                            onClick={() => handleRemoveLine(detalle.id)}
                                        >
                                            X
                                        </button>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default DetalleCompra;