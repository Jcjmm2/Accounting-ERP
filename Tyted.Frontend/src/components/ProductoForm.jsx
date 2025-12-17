import React, { useState, useEffect } from 'react';
import axios from 'axios';

// --- SE ELIMINA LA DEFINICIÓN DE IVA_RATES, ahora viene por props ---

// Se actualiza la destructuración de props para incluir 'categorias' y 'tasasIVA'
const ProductoForm = ({ API_URL, onSave, onCancel, productoToEdit, categorias, tasasIVA }) => {
    
    // --- ESTADO INICIAL ---
    const initialProductState = {
        codigoProd: 0, 
        descripcion: '',
        stockActual: 0,
        codigoBarras: '',
        fechaAdquisicion: '',
        fechaVencimiento: '',
        codigoProv: '', // FK de Proveedor (string para el select)
        idCategoria: '', // FK de Categoria (string for controlled select)
        tipoArt: 'Inventario', 
        // Keep idTasaIVA as a string in the form state to avoid NaN when the select is cleared
        idTasaIVA: '0', // default as string (maps to backend IdTasaIVA)
        unidadesDeVenta: [], 
    };

    // 1. Estado principal del formulario: Usa el producto a editar si existe, o el estado inicial
    const [formData, setFormData] = useState(
        // Si hay productoToEdit, se inicializa con sus datos (incluyendo idCategoria si viene del backend)
        productoToEdit || initialProductState
    );

    // 2. Estados de soporte
    const [proveedores, setProveedores] = useState([]);
    const [unidadesMaestras, setUnidadesMaestras] = useState([]);
    const [message, setMessage] = useState('');
    const [loading, setLoading] = useState(false);
    
    // --- EFFECTS ---

    // Este efecto es crucial para la EDICIÓN. Recarga el formulario si el objeto a editar cambia.
    useEffect(() => {
        // Al montar o si 'productoToEdit' cambia, inicializa el estado con ese producto
        // Se añade una pequeña corrección para asegurar que las FKs sean string para los selects.
        // Safely derive possible backend property names (camelCase or PascalCase)
        const provVal = productoToEdit?.codigoProv ?? productoToEdit?.CodigoProv ?? productoToEdit?.ProveedorCodigoProv ?? productoToEdit?.proveedorCodigoProv;
        const catVal = productoToEdit?.idCategoria ?? productoToEdit?.IdCategoria ?? productoToEdit?.categoriaIdCategoria ?? productoToEdit?.CategoriaIdCategoria;
        const tasaVal = productoToEdit?.idTasaIVA ?? productoToEdit?.IdTasaIVA ?? productoToEdit?.tasaIVA ?? productoToEdit?.TasaIVA ?? productoToEdit?.porcentaje ?? productoToEdit?.Porcentaje;

        const codigoProdVal = productoToEdit?.codigoProd ?? productoToEdit?.CodigoProd ?? productoToEdit?.Codigo_Prod ?? productoToEdit?.CodigoProd;

        setFormData({
            ...(productoToEdit || initialProductState),
            codigoProd: codigoProdVal ?? initialProductState.codigoProd,
            codigoProv: provVal != null ? String(provVal) : '',
            idCategoria: catVal != null ? String(catVal) : '',
            idTasaIVA: tasaVal != null ? String(tasaVal) : initialProductState.idTasaIVA,
        });
        setMessage(''); // Limpiar mensajes al cambiar de modo/producto

        // Debug: imprimir las listas maestras y el producto a editar para validar shape
        // Busca "ProductoForm:init" en la consola del navegador
        // eslint-disable-next-line no-console
        console.log('ProductoForm:init categorias=', categorias, 'productoToEdit=', productoToEdit);
    }, [productoToEdit, categorias]); 

    // Cargar listas maestras (Proveedores y Unidades de Medida)
    // Nota: Las listas de Categorías y TasasIVA ya vienen por props y no se recargan aquí.
    useEffect(() => {
        const fetchMasters = async () => {
            try {
                // Solo cargamos Proveedores y Unidades de Medida localmente.
                const [provResponse, unidadResponse] = await Promise.all([
                    axios.get(`${API_URL}/Proveedores`),
                    axios.get(`${API_URL}/UnidadesMedida`),
                ]);
                setProveedores(provResponse.data);
                setUnidadesMaestras(unidadResponse.data);
            } catch (error) {
                setMessage('Error al cargar listas maestras (Proveedores/Unidades).');
                console.error('Error fetching masters:', error);
            }
        };
        fetchMasters();
    }, [API_URL]); 

    // --- MANEJADORES DE CAMBIOS ---

    const handleChange = (e) => {
        const { name, value, type, checked } = e.target;
        let newValue = value;

        // Keep tasaIVA as a string while editing to avoid NaN warnings when user clears selection
        // Parse to number later on submit.
        // El resto de la lógica de tipo se mantiene igual
        setFormData({
            ...formData,
            [name]: type === 'checkbox' ? checked : newValue,
        });
    };

    // Maneja los cambios en los campos de las unidades de venta (la lista anidada)
    const handleUnidadChange = (index, e) => {
        const { name, value } = e.target;
        const newUnidades = [...formData.unidadesDeVenta];
        
        if (name === 'IdUnidad') {
            const id = parseInt(value);
            newUnidades[index][name] = id;
            
            const unidadMaestra = unidadesMaestras.find(u => u.idUnidad === id);
            if (unidadMaestra) {
                newUnidades[index].nombreUnidad = unidadMaestra.nombreUnidad;
            } else {
                newUnidades[index].nombreUnidad = 'N/A';
            }
        } else {
            newUnidades[index][name] = value;
        }

        setFormData({
            ...formData,
            unidadesDeVenta: newUnidades,
        });
    };

    const handleAddUnidad = () => {
        setFormData({
            ...formData,
            unidadesDeVenta: [
                ...formData.unidadesDeVenta,
                {
                    idProductoUnidad: 0, 
                    idUnidad: 0, 
                    nombreUnidad: '', 
                    cantidadEquivalente: 1.0,
                    costoUnitarioMonedaBase: 0,
                    precioMonedaBase: 0,
                    costoUnitarioMonedaExt: 0,
                    precioMonedaExt: 0,
                },
            ],
        });
    };

    const handleRemoveUnidad = (index) => {
        const newUnidades = formData.unidadesDeVenta.filter((_, i) => i !== index);
        setFormData({
            ...formData,
            unidadesDeVenta: newUnidades,
        });
    };
    
    // --- MANEJADOR DE ENVÍO (POST / PUT) ---

    const handleSubmit = async (e) => {
        e.preventDefault();
        setMessage('');
        setLoading(true);

        // Preparación de los datos para asegurar tipos correctos para C#
        const dataToSend = {
            ...formData,
            // Convertir strings de fecha vacíos a null para el modelo C#
            fechaAdquisicion: formData.fechaAdquisicion || null,
            fechaVencimiento: formData.fechaVencimiento || null,
            
            // Asegurar que los campos numéricos y FKs sean del tipo correcto
            stockActual: parseFloat(formData.stockActual) || 0,
            idTasaIVA: parseInt(formData.idTasaIVA) || 0,
            codigoProv: parseInt(formData.codigoProv) || null, // Asegurar que es un int o null
            idCategoria: parseInt(formData.idCategoria) || null, // ✅ NUEVO: Asegurar que es un int o null
            
            // Asegurar que las unidades tienen valores numéricos 
            unidadesDeVenta: formData.unidadesDeVenta.map(u => ({
                ...u,
                cantidadEquivalente: parseFloat(u.cantidadEquivalente) || 0,
                costoUnitarioMonedaBase: parseFloat(u.costoUnitarioMonedaBase) || 0,
                precioMonedaBase: parseFloat(u.precioMonedaBase) || 0,
                costoUnitarioMonedaExt: parseFloat(u.costoUnitarioMonedaExt) || 0,
                precioMonedaExt: parseFloat(u.precioMonedaExt) || 0,
                idUnidad: parseInt(u.idUnidad) || 0,
                idProductoUnidad: parseInt(u.idProductoUnidad) || 0,
            })),
        };

        try {
            const isEditing = (dataToSend.codigoProd ?? 0) !== 0;
            const endpoint = `${API_URL}/Productos${isEditing ? `/${dataToSend.codigoProd}` : ''}`;
            const method = isEditing ? axios.put : axios.post;

            // Preparar payload final: eliminar propiedades de navegación que confunden al binder
            const payload = { ...dataToSend };
            delete payload.tasaIVA;
            delete payload.categoria;
            delete payload.proveedor;

            // Debug: mostrar qué se va a llamar (payload final)
            // eslint-disable-next-line no-console
            console.log('ProductoForm:submit', { isEditing, endpoint, payload });

            await method(endpoint, payload);

            setMessage(`✅ Artículo ${isEditing ? 'actualizado' : 'creado'} con éxito.`);
            setTimeout(() => onSave(), 500); 

        } catch (error) {
            console.error("Error al guardar el artículo:", error.response || error);
            const errorMessage = error.response?.data?.errors?.['$']?.[0] || error.response?.data?.title || error.message || 'Error desconocido al guardar.';
            setMessage(`❌ Error al guardar el artículo: ${errorMessage}`);
        } finally {
            setLoading(false);
        }
    };
    
    // --- RENDERIZADO ---

    const title = formData.codigoProd === 0 ? 'Crear Nuevo Artículo' : `Editar Artículo #${formData.codigoProd}`;

    return (
        <div style={{ padding: '20px', border: '1px solid #ccc', borderRadius: '8px', maxWidth: '95%', margin: '20px auto' }}>
            <h2>{title}</h2>
            {message && <div className={`alert ${message.includes('✅') ? 'alert-success' : 'alert-danger'}`}>{message}</div>}

            <form onSubmit={handleSubmit}>
                {/* --------------------- DATOS PRINCIPALES --------------------- */}
                <fieldset style={{ marginBottom: '20px', padding: '15px', border: '1px solid #ddd' }}>
                    <legend>Detalles Principales</legend>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
                        
                        {/* CAMPO DE DESCRIPCIÓN */}
                        <div>
                            <label htmlFor="descripcionInput">Descripción:</label>
                            <input 
                                type="text"
                                name="descripcion" 
                                id="descripcionInput" 
                                value={formData.descripcion} 
                                onChange={handleChange} 
                                required 
                            />
                        </div>

                        {/* CAMPO: STOCK ACTUAL */}
                        <div>
                            <label>Stock Actual</label>
                            <input type="number" name="stockActual" value={formData.stockActual} onChange={handleChange} min="0" required />
                        </div>
                        
                        {/* CAMPO: CÓDIGO DE BARRAS */}
                        <div>
                            <label>Código de Barras</label>
                            <input type="text" name="codigoBarras" value={formData.codigoBarras} onChange={handleChange} />
                        </div>

                        {/* ✅ NUEVO CAMPO: CATEGORÍA (Usando props) */}
                        <div>
                            <label>Categoría:</label>
                            <select
                                name="idCategoria"
                                value={(formData.idCategoria === '0' || formData.idCategoria === 0) ? '' : (formData.idCategoria ?? '')}
                                onChange={handleChange}
                                required
                            >
                                <option value="">Seleccione Categoría</option>
                                {categorias.map(cat => (
                                    <option key={(cat.idCategoria ?? cat.IdCategoria ?? cat.id ?? cat.Id)} value={String(cat.idCategoria ?? cat.IdCategoria ?? cat.id ?? cat.Id)}>
                                        {cat.nombreCategoria ?? cat.Nombre ?? cat.nombre}
                                    </option>
                                ))}
                            </select>
                        </div>
                        
                        {/* CAMPO: TASA IVA APLICABLE (Usando props) */}
                        <div>
                            <label htmlFor="idTasaIVAInput">Tasa IVA Aplicable:</label>
                            <select 
                                name="idTasaIVA" 
                                id="idTasaIVAInput" 
                                value={formData.idTasaIVA ?? ''} 
                                onChange={handleChange} 
                                required
                            >
                                <option value="">Seleccione Tasa</option>
                                {tasasIVA.map(rate => {
                                    const raw = rate.tasa ?? rate.Porcentaje ?? rate.porcentaje ?? rate.valor ?? 0;
                                    const tasaNumber = parseFloat(raw) || 0;
                                    // Normalize: if value > 1 assume it's already a percent (e.g., 8),
                                    // otherwise treat as decimal (e.g., 0.08) and convert to percent.
                                    const percent = tasaNumber > 1 ? tasaNumber : tasaNumber * 100;
                                    const label = rate.descripcion ?? rate.Nombre ?? rate.nombre ?? '';
                                    const key = rate.idTasaIVA ?? rate.IdTasaIVA ?? rate.id ?? rate.Id ?? Math.random();
                                    const val = rate.idTasaIVA ?? rate.IdTasaIVA ?? rate.id ?? rate.Id ?? '';
                                    return (
                                        <option key={key} value={String(val)}>
                                            {`${label} (${percent.toFixed(0)}%)`}
                                        </option>
                                    );
                                })}
                            </select>
                        </div>
                        {/* --- FIN CAMPO TASA IVA --- */}
                        
                        {/* CAMPO: TIPO DE ARTÍCULO */}
                        <div>
                            <label>Tipo de Artículo</label>
                            <select name="tipoArt" value={formData.tipoArt} onChange={handleChange}>
                                <option value="Inventario">Inventario</option>
                                <option value="Servicio">Servicio</option>
                                <option value="Activo Fijo">Activo Fijo</option>
                            </select>
                        </div>
                        
                        {/* CAMPO: FECHA DE ADQUISICIÓN */}
                        <div>
                            <label>Fecha de Adquisición</label>
                            <input type="date" name="fechaAdquisicion" value={formData.fechaAdquisicion?.substring(0, 10) || ''} onChange={handleChange} />
                        </div>
                        
                        {/* CAMPO: FECHA DE VENCIMIENTO */}
                        <div>
                            <label>Fecha de Vencimiento</label>
                            <input type="date" name="fechaVencimiento" value={formData.fechaVencimiento?.substring(0, 10) || ''} onChange={handleChange} />
                        </div>
                        
                        {/* CAMPO: PROVEEDOR */}
                        <div>
                            <label>Proveedor</label>
                            <select name="codigoProv" value={formData.codigoProv ?? ''} onChange={handleChange} required>
                                <option value="">Seleccione Proveedor</option>
                                {proveedores.map(prov => (
                                    <option key={prov.codigoProv} value={String(prov.codigoProv)}>
                                        {prov.razonsocial}
                                    </option>
                                ))}
                            </select>
                        </div>
                    </div>
                </fieldset>

                {/* --------------------- UNIDADES DE VENTA Y PRECIOS --------------------- */}
                <fieldset style={{ marginBottom: '20px', padding: '15px', border: '1px solid #ddd' }}>
                    <legend>Unidades de Venta y Precios</legend>
                    <button type="button" onClick={handleAddUnidad} className="btn btn-sm btn-info" style={{ marginBottom: '10px' }}>
                        Añadir Unidad / Variante
                    </button>

                    <div style={{ overflowX: 'auto' }}>
                        <table style={{ minWidth: '850px', width: '100%', borderCollapse: 'collapse', fontSize: '0.85em' }}>
                            <thead>
                                <tr>
                                    <th>Unidad Maestra</th>
                                    <th>Nombre (Ej: Caja)</th>
                                    <th>Equivalente Base</th>
                                    <th>Costo Base (VES)</th>
                                    <th>Precio Venta Base (VES)</th>
                                    <th>Costo Ext. (USD)</th>
                                    <th>Precio Venta Ext. (USD)</th>
                                    <th>Acción</th>
                                </tr>
                            </thead>
                            <tbody>
                                {formData.unidadesDeVenta.map((unidad, index) => (
                                    <tr key={index}>
                                        <td>
                                            <select 
                                                name="IdUnidad" 
                                                value={unidad.idUnidad ?? 0} 
                                                onChange={(e) => handleUnidadChange(index, e)} 
                                                required
                                            >
                                                <option value="0">Seleccionar...</option>
                                                {unidadesMaestras.map(u => (
                                                    <option key={u.idUnidad} value={u.idUnidad}>
                                                        {u.nombreUnidad}
                                                    </option>
                                                ))}
                                            </select>
                                        </td>
                                        <td>
                                            <input type="text" name="nombreUnidad" value={unidad.nombreUnidad} onChange={(e) => handleUnidadChange(index, e)} required />
                                        </td>
                                        <td>
                                            <input type="number" step="0.01" name="cantidadEquivalente" value={unidad.cantidadEquivalente ?? ''} onChange={(e) => handleUnidadChange(index, e)} required />
                                        </td>
                                        <td>
                                            <input type="number" step="0.0001" name="costoUnitarioMonedaBase" value={unidad.costoUnitarioMonedaBase ?? ''} onChange={(e) => handleUnidadChange(index, e)} required />
                                        </td>
                                        <td>
                                            <input type="number" step="0.0001" name="precioMonedaBase" value={unidad.precioMonedaBase ?? ''} onChange={(e) => handleUnidadChange(index, e)} required />
                                        </td>
                                        <td>
                                            <input type="number" step="0.0001" name="costoUnitarioMonedaExt" value={unidad.costoUnitarioMonedaExt ?? ''} onChange={(e) => handleUnidadChange(index, e)} required />
                                        </td>
                                        <td>
                                            <input type="number" step="0.0001" name="precioMonedaExt" value={unidad.precioMonedaExt ?? ''} onChange={(e) => handleUnidadChange(index, e)} required />
                                        </td>
                                        <td>
                                            <button type="button" onClick={() => handleRemoveUnidad(index)} className="btn btn-sm btn-danger">
                                                Quitar
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </fieldset>

                {/* --------------------- BOTONES DE ACCIÓN --------------------- */}
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                    <button type="button" onClick={onCancel} className="btn btn-secondary">
                        Cancelar
                    </button>
                    <button type="submit" className="btn btn-primary" disabled={loading}>
                        {loading ? 'Guardando...' : 'Guardar Artículo'}
                    </button>
                </div>
            </form>
        </div>
    );
};

export default ProductoForm;