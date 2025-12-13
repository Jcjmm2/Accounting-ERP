import React, { useState, useEffect } from 'react';
import axios from 'axios';

const ProductoForm = ({ API_URL, onSave, onCancel, productoToEdit }) => {
    
    // --- ESTADO INICIAL ---
    const initialProductState = {
        codigoProd: 0, // 0 indica que es un nuevo producto (para el POST)
        descripcion: '',
        stockActual: 0,
        codigoBarras: '',
        fechaAdquisicion: '',
        fechaVencimiento: '',
        codigoProv: '', // FK de Proveedor
        tipoArt: 'Inventario', // Valor por defecto
        unidadesDeVenta: [], // Lista de variantes ProductoUnidad
    };

    // 1. Estado principal del formulario: Usa el producto a editar si existe, o el estado inicial
    const [formData, setFormData] = useState(
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
        setFormData(productoToEdit || initialProductState);
        setMessage(''); // Limpiar mensajes al cambiar de modo/producto
    }, [productoToEdit]); 

    // Cargar listas maestras (Proveedores y Unidades de Medida)
    useEffect(() => {
        const fetchMasters = async () => {
            try {
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
    }, [API_URL]); // Se añade API_URL a las dependencias por buena práctica

    // --- MANEJADORES DE CAMBIOS ---

    const handleChange = (e) => {
        const { name, value, type, checked } = e.target;
        setFormData({
            ...formData,
            [name]: type === 'checkbox' ? checked : value,
        });
    };

    // Maneja los cambios en los campos de las unidades de venta (la lista anidada)
    const handleUnidadChange = (index, e) => {
        const { name, value } = e.target;
        const newUnidades = [...formData.unidadesDeVenta];
        
        if (name === 'IdUnidad') {
            // 1. Actualiza la clave foránea (IdUnidad)
            const id = parseInt(value);
            newUnidades[index][name] = id;
            
            // 2. Encuentra la unidad maestra y actualiza el nombre temporalmente
            const unidadMaestra = unidadesMaestras.find(u => u.idUnidad === id);
            if (unidadMaestra) {
                // El nombre de la unidad maestra es solo para mostrar en la tabla
                newUnidades[index].nombreUnidad = unidadMaestra.nombreUnidad;
            } else {
                newUnidades[index].nombreUnidad = 'N/A';
            }
        } else {
            // Actualiza cualquier otro campo (CantidadEquivalente, Precios, Costos)
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
                    idProductoUnidad: 0, // 0 indica nueva unidad
                    idUnidad: 0, // Clave foránea a UnidadMedida
                    nombreUnidad: '', // Nombre temporal para mostrar
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
            // Asegurar que el stock es un número
            stockActual: parseFloat(formData.stockActual) || 0,
            codigoProv: parseInt(formData.codigoProv) || null, // Asegurar que es un int o null
            
            // Asegurar que las unidades tienen valores numéricos (C# es estricto)
            unidadesDeVenta: formData.unidadesDeVenta.map(u => ({
                ...u,
                cantidadEquivalente: parseFloat(u.cantidadEquivalente) || 0,
                costoUnitarioMonedaBase: parseFloat(u.costoUnitarioMonedaBase) || 0,
                precioMonedaBase: parseFloat(u.precioMonedaBase) || 0,
                costoUnitarioMonedaExt: parseFloat(u.costoUnitarioMonedaExt) || 0,
                precioMonedaExt: parseFloat(u.precioMonedaExt) || 0,
                idUnidad: parseInt(u.idUnidad) || 0,
            })),
        };

        try {
            const isEditing = dataToSend.codigoProd !== 0; // Si tiene ID, está editando (PUT)
            const endpoint = `${API_URL}/Productos${isEditing ? `/${dataToSend.codigoProd}` : ''}`;
            const method = isEditing ? axios.put : axios.post;

            // EJECUCIÓN DEL POST O PUT
            await method(endpoint, dataToSend);

            setMessage(`✅ Artículo ${isEditing ? 'actualizado' : 'creado'} con éxito.`);
            
            // Llamar a la función onSave para regresar a la lista y recargar los datos
            setTimeout(() => onSave(), 500); 

        } catch (error) {
            console.error("Error al guardar el artículo:", error.response || error);
            // Intentamos obtener el error específico del servidor
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
                        
                        {/* ESTE ES EL CAMPO DE DESCRIPCIÓN CORREGIDO */}
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

                        <div>
                            <label>Stock Actual</label>
                            <input type="number" name="stockActual" value={formData.stockActual} onChange={handleChange} min="0" required />
                        </div>
                        <div>
                            <label>Código de Barras</label>
                            <input type="text" name="codigoBarras" value={formData.codigoBarras} onChange={handleChange} />
                        </div>
                        <div>
                            <label>Tipo de Artículo</label>
                            <select name="tipoArt" value={formData.tipoArt} onChange={handleChange}>
                                <option value="Inventario">Inventario</option>
                                <option value="Servicio">Servicio</option>
                                <option value="Activo Fijo">Activo Fijo</option>
                            </select>
                        </div>
                        <div>
                            <label>Fecha de Adquisición</label>
                            {/* Se usa substring(0, 10) para formatear la fecha que viene del backend */}
                            <input type="date" name="fechaAdquisicion" value={formData.fechaAdquisicion?.substring(0, 10) || ''} onChange={handleChange} />
                        </div>
                        <div>
                            <label>Fecha de Vencimiento</label>
                            <input type="date" name="fechaVencimiento" value={formData.fechaVencimiento?.substring(0, 10) || ''} onChange={handleChange} />
                        </div>
                        <div>
                            <label>Proveedor</label>
                            <select name="codigoProv" value={formData.codigoProv} onChange={handleChange} required>
                                <option value="">Seleccione Proveedor</option>
                                {proveedores.map(prov => (
                                    <option key={prov.codigoProv} value={prov.codigoProv}>
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

                    <div style={{ overflowX: 'auto' }}> {/* Permite scroll horizontal si es necesario */}
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
                                                value={unidad.idUnidad} 
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
                                            <input type="number" step="0.01" name="cantidadEquivalente" value={unidad.cantidadEquivalente} onChange={(e) => handleUnidadChange(index, e)} required />
                                        </td>
                                        <td>
                                            <input type="number" step="0.0001" name="costoUnitarioMonedaBase" value={unidad.costoUnitarioMonedaBase} onChange={(e) => handleUnidadChange(index, e)} required />
                                        </td>
                                        <td>
                                            <input type="number" step="0.0001" name="precioMonedaBase" value={unidad.precioMonedaBase} onChange={(e) => handleUnidadChange(index, e)} required />
                                        </td>
                                        <td>
                                            <input type="number" step="0.0001" name="costoUnitarioMonedaExt" value={unidad.costoUnitarioMonedaExt} onChange={(e) => handleUnidadChange(index, e)} required />
                                        </td>
                                        <td>
                                            <input type="number" step="0.0001" name="precioMonedaExt" value={unidad.precioMonedaExt} onChange={(e) => handleUnidadChange(index, e)} required />
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