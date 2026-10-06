import React, { useState, useEffect, useContext } from 'react';
import { ConfigContext } from '../Context/ConfigContext';

const Productos = () => {
    const { API_URL, tasa } = useContext(ConfigContext);
    const getAuthHeaders = () => ({
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem("token")}`
    });
    const [productos, setProductos] = useState([]);
    const [loading, setLoading] = useState(true);
    const [busqueda, setBusqueda] = useState("");
    const [tasasIva, setTasasIva] = useState([]);
    const [guardando, setGuardando] = useState(false);
    const [modalAbierto, setModalAbierto] = useState(false);
    const [categorias, setCategorias] = useState([]);
    const [modalCategoriasOpen, setModalCategoriasOpen] = useState(false);
    const [categoriaForm, setCategoriaForm] = useState({ idCategoria: 0, nombreCategoria: '' });
    const [loadingCategoria, setLoadingCategoria] = useState(false);
    const [modalUnidadesOpen, setModalUnidadesOpen] = useState(false);
    const [unidadesMedida, setUnidadesMedida] = useState([]);
    const [unidadForm, setUnidadForm] = useState({ idUnidad: 0, nombreUnidad: '' });
    const [loadingUnidad, setLoadingUnidad] = useState(false);
    const [productoForm, setProductoForm] = useState({
        codigoProd: '',
        descripcion: '',
        idTasaIVA: '',
        idCategoria: '',
        idUnidad: '',
        nombreUnidad: '',
        tipoArt: 'Bien',
        stockMinimo: 0,
        codigoBarras: '', 
        manejaImpuestoLicor: false,
        impuestoLicorPorcentaje: 0,
        permiteDesglose: false,
        unidades: [], // Para enviar al backend
        isNew: true
    });

    // Asegúrate de llamarlo en el useEffect inicial
    useEffect(() => {
        const cargarTodo = async () => {
            await Promise.all([
                cargarProductos(),
                cargarTasasIva(),
                cargarUnidadesMedida(),
                cargarCategorias()
            ]);
        };
        cargarTodo();
    }, []);


    const cargarProductos = async () => {
        try {
            setLoading(true);
            const res = await fetch(`${API_URL}/Productos`, { headers: getAuthHeaders() });
            if (res.ok) {
                const data = await res.json();
                setProductos(data);
            }
        } catch (error) {
            console.error("Error al cargar productos:", error);
        } finally {
            setLoading(false);
        }
    };

    const cargarUnidadesMedida = async () => {
        try {
            const res = await fetch(`${API_URL}/UnidadesMedida`, { headers: getAuthHeaders() }); // Verifica que esta ruta sea correcta
            if (res.ok) {
                const data = await res.json();
                setUnidadesMedida(data);
            }
        } catch (error) {
            console.error("Error cargando unidades de medida:", error);
        }
    };
    const cargarCategorias = async () => {
        try {
            const res = await fetch(`${API_URL}/Categorias`, { headers: getAuthHeaders() }); // Verifica que tu endpoint sea este
            if (res.ok) {
                const data = await res.json();
                setCategorias(data);
            }
        } catch (error) {
            console.error("Error cargando categorías", error);
        }
    };
    const cargarTasasIva = async () => {
        try {
            // Nota: Se usa /TasasIVA según la ruta estándar de tu controlador
            const res = await fetch(`${API_URL}/TasasIVA`, { headers: getAuthHeaders() });
            if (res.ok) {
                const data = await res.json();
                setTasasIva(data);
            }
        } catch (error) {
            console.error("Error al cargar tasas de IVA:", error);
        }
    };
    const guardarUnidadCatalogo = async () => {
        if (!unidadForm.nombreUnidad.trim()) return alert("⚠️ Escriba un nombre para la unidad.");

        try {
            setLoadingUnidad(true);
            const metodo = unidadForm.idUnidad === 0 ? 'POST' : 'PUT';
            const url = unidadForm.idUnidad === 0 
                ? `${API_URL}/UnidadesMedida` 
                : `${API_URL}/UnidadesMedida/${unidadForm.idUnidad}`;

            const res = await fetch(url, {
                method: metodo,
                headers: getAuthHeaders(),
                body: JSON.stringify({ 
                    idUnidad: unidadForm.idUnidad,
                    nombreUnidad: unidadForm.nombreUnidad.toUpperCase(),
                    // Si tu backend requiere CantidadEquivalente, enviamos 1 por defecto
                    cantidadEquivalente: 1 
                })
            });

            if (res.ok) {
                await cargarUnidadesMedida(); // Recargar la lista para los dropdowns
                setUnidadForm({ idUnidad: 0, nombreUnidad: '' }); // Limpiar formulario
                if (unidadForm.idUnidad !== 0) alert("✅ Unidad actualizada");
            } else {
                alert("❌ Error al guardar unidad");
            }
        } catch (error) {
            console.error(error);
            alert("Error de conexión");
        } finally {
            setLoadingUnidad(false);
        }
    };

    const borrarUnidadCatalogo = async (id) => {
        if(!window.confirm("¿Seguro de eliminar esta unidad del sistema?")) return;
        try {
            const res = await fetch(`${API_URL}/UnidadesMedida/${id}`, {
                method: 'DELETE',
                headers: getAuthHeaders()
            });
            if(res.ok) {
                cargarUnidadesMedida();
            } else {
                alert("⚠️ No se puede eliminar (probablemente esté en uso en algún producto).");
            }
        } catch(e) { console.error(e); }
    };

    const editarUnidadCatalogo = (u) => {
        setUnidadForm({
            idUnidad: u.idUnidad || u.IdUnidad,
            nombreUnidad: u.nombreUnidad || u.nombre || u.NombreUnidad
        });
    };

    const abrirEditar = (p) => {
        const unidadPrincipal = p.unidadesDeVenta?.[0] || {};
        setProductoForm({
            codigoProd: p.codigoProd,
            descripcion: p.descripcion,
            idTasaIVA: p.idTasaIVA,
            idCategoria: p.idCategoria,
            idUnidad: unidadPrincipal.idUnidad || unidadPrincipal.IdUnidad  || '',
            nombreUnidad: unidadPrincipal.nombreUnidad || unidadPrincipal.NombreUnidadb || '',
            tipoArt: p.tipoArt || 'Bien',
            stockMinimo: p.stockMinimo,
            codigoBarras: p.codigoBarras || '',
            manejaImpuestoLicor: p.manejaImpuestoLicor || false,
            impuestoLicorPorcentaje: p.impuestoLicorPorcentaje || 0,
            permiteDesglose: p.permiteDesglose || false,
            isNew: false,
            // Mapeamos lo que viene del server a la estructura del formulario
            unidades: p.unidadesDeVenta.map(u => ({
                idProductoUnidad: u.idProductoUnidad,
                idUnidad: u.idUnidad || u.IdUnidad,
                nombreUnidad: u.nombreUnidad,
                CodigoBarras: u.CodigoBarras || u.codigoBarras || '',
                cantidadEquivalente: u.cantidadEquivalente,
                precio1: u.precioMonedaBase || u.PrecioMonedaBase || 0,
                precio2: u.precio2MonedaBase || u.Precio2MonedaBase || 0,
                precio3: u.precio3MonedaBase || u.Precio3MonedaBase || 0
            }))
        });
        setModalAbierto(true);
    };

    const agregarUnidadVenta = () => {
        // Al agregar una nueva presentación, por defecto selecciona la primera unidad del catálogo si existe
        const unidadDefault = unidadesMedida[0] || { idUnidad: '', nombreUnidad: '' };
        setProductoForm({
            ...productoForm,
            unidades: [
                ...productoForm.unidades,
                {
                    idUnidad: unidadDefault.idUnidad,
                    nombreUnidad: unidadDefault.nombreUnidad,
                    ProductoUnidadCodigoBarras: unidadDefault.CodigoBarras || '',
                    cantidadEquivalente: 1,
                    precio1: 0,
                    precio2: 0,
                    precio3: 0
                }
            ]
        });
    };
    // Corregido: Ahora acepta exactamente los parámetros que envías desde el onChange
    const handleUnidadChange = (index, campo, valor) => {
        const nuevasUnidades = [...productoForm.unidades];
        let valorFinal = valor;

        if (campo === 'cantidadEquivalente' || campo.startsWith('precio') || campo === 'idUnidad') {
            valorFinal = valor === "" ? "" : parseFloat(valor);
        } 
        nuevasUnidades[index] = {
            ...nuevasUnidades[index],
            [campo]: valorFinal
        };
        setProductoForm({ ...productoForm, unidades: nuevasUnidades });
    };

    // Elimina la presentación (fila de unidades) en la posición indicada
    const eliminarUnidadVenta = (index) => {
        if (!window.confirm('¿Eliminar esta presentación del producto?')) return;
        setProductoForm(prev => ({
            ...prev,
            unidades: prev.unidades.filter((_, i) => i !== index)
        }));
    };

    const guardarCambios = async () => {
        // Validación básica
        if (!productoForm.idCategoria || productoForm.idCategoria === "0") {
            alert("❌ Debe seleccionar una categoría válida");
            return;
        }

        try {
            setGuardando(true);

            // Preparamos el objeto EXACTAMENTE como lo espera el DTO del Backend
            const payload = {
                codigoProd: productoForm.codigoProd,
                descripcion: productoForm.descripcion,
                tipoArt: productoForm.tipoArt || "Bien",
                idCategoria: parseInt(productoForm.idCategoria),
                idTasaIVA: parseInt(productoForm.idTasaIVA),
                stockMinimo: parseFloat(productoForm.stockMinimo || 0),
                codigoBarras: productoForm.ProductoUnidadCodigoBarras || "",
                manejaImpuestoLicor: !!productoForm.manejaImpuestoLicor,
                impuestoLicorPorcentaje: parseFloat(productoForm.impuestoLicorPorcentaje || 0),
                permiteDesglose: !!productoForm.permiteDesglose,
                // Importante: El backend necesita el ID de la unidad para saber QUÉ fila actualizar
                unidades: productoForm.unidades.map(u => ({
                    idProductoUnidad: parseInt(u.idProductoUnidad || 0),
                    idUnidad: parseInt(u.idUnidad), // <--- Vital para saber si es Caja, Bulto, etc.
                    nombreUnidad: u.nombreUnidad || u.NombreUnidad, // <--- Para actualizar el nombre
                    cantidadEquivalente: parseFloat(u.cantidadEquivalente || 1), // <--- Para cálculos 
                    CodigoBarras: u.CodigoBarras || '',
                    precio1: parseFloat(u.precio1 || 0),
                    precio2: parseFloat(u.precio2 || 0),
                    precio3: parseFloat(u.precio3 || 0)
                }))
            };

            const url = productoForm.isNew 
                ? `${API_URL}/Productos` 
                : `${API_URL}/Productos/ActualizarProductoCompleto`;
        
            const metodo = productoForm.isNew ? 'POST' : 'PUT';

            const res = await fetch(url, {
                method: metodo,
                headers: getAuthHeaders(),
                body: JSON.stringify(payload)
            });

            // Verificamos si la respuesta tiene contenido antes de intentar parsear JSON
            const text = await res.text();
            const data = text ? JSON.parse(text) : {};
            console.log("Respuesta bruta del servidor:", text);

            if (res.ok) {
                alert("✅ " + (data.message || "Guardado exitosamente"));
                setModalAbierto(false);
                await cargarProductos(); // Refrescar la tabla
            } else {
                alert("❌ Error del servidor: " + (data.message || "Error desconocido"));
            }

        } catch (error) {
            console.error("Error al guardar el producto:", error.message);
            alert("❌ Falló la conexión o el servidor envió una respuesta inválida.");
        } finally {
            setGuardando(false);
        }
    };
    const eliminarProducto = async (codigoProd) => {
        if (!window.confirm(`¿Estás seguro de eliminar el producto ${codigoProd}? Esta acción no se puede deshacer.`)) return;

        try {
            setLoading(true);
            const res = await fetch(`${API_URL}/Productos/${codigoProd}`, {
                method: 'DELETE'
            });

            if (res.ok) {
                alert("🗑️ Producto eliminado correctamente");
                cargarProductos(); // Recargar la tabla
            } else {
                const data = await res.json();
                alert("⚠️ No se pudo eliminar: " + (data.message || "El producto tiene movimientos asociados."));
            }
        } catch (error) {
            console.error(error);
            alert("Error de conexión");
        } finally {
            setLoading(false);
        }
    };

    const productosFiltrados = productos.filter(p => {
        const termino = busqueda.toLowerCase();
        return (
            p.descripcion.toLowerCase().includes(termino) || 
            p.codigoProd.toLowerCase().includes(termino)
        );
    });

    const formatearStock = (p) => {
        if (p.tipoArt === 'Servicio' || p.tipoArt === 'S') return 'N/A';

        const unidad = p.unidadesDeVenta?.[0];
        const factor = unidad?.cantidadEquivalente || 1;
        const stockCalculado = p.stockActual / factor;

        if (factor === 1000) {
            return `${stockCalculado.toFixed(3)} Kg`;
        }

        return Number.isInteger(stockCalculado) 
            ? stockCalculado.toString() 
            : stockCalculado.toFixed(2);
    };

    
    const actualizarUnidadFila = (index, campo, valor) => {
        setProductoForm(prev => {
            const nuevas = [...prev.unidades];
            nuevas[index] = { ...nuevas[index], [campo]: valor };
            return { ...prev, unidades: nuevas };
        });
    };
    const guardarCategoriaCatalogo = async () => {
        if (!categoriaForm.nombreCategoria.trim()) return alert("⚠️ Escriba un nombre para la categoría.");

        try {
            setLoadingCategoria(true);
            const metodo = categoriaForm.idCategoria === 0 ? 'POST' : 'PUT';
            const url = categoriaForm.idCategoria === 0 
                ? `${API_URL}/Categorias` 
                : `${API_URL}/Categorias/${categoriaForm.idCategoria}`;

            const res = await fetch(url, {
                method: metodo,
                headers: getAuthHeaders(),
                body: JSON.stringify({ 
                    idCategoria: categoriaForm.idCategoria,
                    nombre: categoriaForm.nombreCategoria.toUpperCase()
                })
            });

            if (res.ok) {
                await cargarCategorias(); // Recargar el dropdown principal
                setCategoriaForm({ idCategoria: 0, nombreCategoria: '' }); // Limpiar form
                alert("✅ Categoría guardada correctamente");
            } else {
                alert("❌ Error al guardar categoría");
            }
        } catch (error) {
            console.error(error);
            alert("Error de conexión");
        } finally {
            setLoadingCategoria(false);
        }
    };

    const borrarCategoriaCatalogo = async (id) => {
        if(!window.confirm("¿Seguro de eliminar esta categoría? Si tiene productos asociados, fallará.")) return;
        try {
            const res = await fetch(`${API_URL}/Categorias/${id}`, { method: 'DELETE' });
            if(res.ok) {
                cargarCategorias();
                alert("🗑️ Categoría eliminada");
            } else {
                alert("⚠️ No se puede eliminar (probablemente esté en uso).");
            }
        } catch(e) { console.error(e); }
    };

    const editarCategoriaCatalogo = (cat) => {
        setCategoriaForm({
            idCategoria: cat.idCategoria,
            nombreCategoria: cat.nombreCategoria || cat.nombre
        });
    };

    return (
        <div className="modulo-container">
            {/* CABECERA Y ACCIONES PRINCIPALES */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                <h2>🍎 Gestión de Inventario</h2>
                <div style={{ display: 'flex', gap: '10px' }}>
                    <button onClick={cargarProductos} className="btn-secondary" style={{ padding: '8px 15px' }}>
                        🔄 Refrescar
                    </button>
                    <button 
                        onClick={() => {
                            setProductoForm({ 
                                codigoProd: '', 
                                descripcion: '', 
                                idTasaIVA: '',
                                idCategoria: '', 
                                tipoArt: 'Bien', 
                                stockMinimo: 0, 
                                unidades: [], 
                                isNew: true 
                            });
                            setModalAbierto(true);
                        }}
                        className="btn-primary" 
                        style={{ background: '#10b981', fontWeight: 'bold' }}
                    >
                        + Nuevo Producto
                    </button>
                </div>
            </div>

            {/* BARRA DE BÚSQUEDA */}
            <input 
                type="text" 
                placeholder="Buscar por nombre o código..." 
                className="search-input"
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                style={{ marginBottom: '20px', width: '100%', padding: '12px' }}
            />

            {/* TABLA PRINCIPAL DE PRODUCTOS */}
            {loading ? (
                <div style={{ textAlign: 'center', padding: '40px' }}>
                    <p>⏳ Cargando catálogo de productos...</p>
                </div>
            ) : (
                <div className="table-responsive">
                    <table className="tabla-general">
                        <thead>
                            <tr>
                                <th>Código</th>
                                <th>Descripción</th>
                                <th style={{ textAlign: 'right' }}>Existencia</th>
                                <th style={{ textAlign: 'center' }}>Acciones</th>
                            </tr>
                        </thead>
                        <tbody>
                            {productosFiltrados.length > 0 ? (
                                productosFiltrados.map(p => (
                                    <tr key={p.codigoProd}>
                                        <td><code style={{ background: '#f1f5f9', padding: '2px 5px', borderRadius: '4px' }}>{p.codigoProd}</code></td>
                                        <td>{p.descripcion}</td>
                                        <td style={{ 
                                            textAlign: 'right', 
                                            fontWeight: 'bold', 
                                            color: p.stockActual <= (p.stockMinimo || 0) ? '#ef4444' : '#1e293b' 
                                        }}>
                                            {formatearStock(p)}
                                        </td>
                                        <td style={{ textAlign: 'center', whiteSpace: 'nowrap' }}>
                                            <button 
                                                onClick={() => abrirEditar(p)} 
                                                className="btn-primary" 
                                                style={{ padding: '5px 12px', fontSize: '0.8rem', backgroundColor: '#6366f1', marginRight: '5px' }}
                                            >
                                                ✏️ Gestionar
                                            </button>
                                            <button 
                                                onClick={() => eliminarProducto(p.codigoProd)} 
                                                className="btn-danger" 
                                                style={{ padding: '5px 12px', fontSize: '0.8rem', backgroundColor: '#ef4444', border: 'none', borderRadius: '4px', color: 'white', cursor: 'pointer' }}
                                                title="Eliminar producto"
                                            >
                                                🗑️
                                            </button>
                                        </td>
                                    </tr>
                                    
                                ))
                            ) : (
                                <tr>
                                    <td colSpan="4" style={{ textAlign: 'center', color: '#94a3b8', padding: '20px' }}>
                                        No se encontraron productos coincidentes.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            )}

            {/* MODAL UNIFICADO (CREACIÓN / EDICIÓN) */}
            {modalAbierto && (
                <div className="modal-overlay">
                    <div className="modulo-container" style={{ width: '850px', maxHeight: '95vh', overflowY: 'auto', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.2)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '15px' }}>
                            <h3 style={{ margin: 0 }}>
                                {productoForm.isNew ? "✨ Registro de Nuevo Producto" : `📦 Editando: ${productoForm.descripcion}`}
                            </h3>
                            <button onClick={() => setModalAbierto(false)} style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: '1.2rem' }}>✕</button>
                        </div>
                        
                        {/* DATOS BÁSICOS */}
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '15px', marginBottom: '20px' }}>
                            <div className="form-group">
                                <label style={{ fontSize: '0.8rem', fontWeight: 'bold' }}>Código de Producto</label>
                                <input 
                                    disabled={!productoForm.isNew} 
                                    value={productoForm.codigoProd} 
                                    onChange={e => setProductoForm({...productoForm, codigoProd: e.target.value.toUpperCase()})}
                                    className="form-input"
                                    placeholder="Ej: PROD-001"
                                />
                            </div>
                            <div className="form-group">
                                <label style={{ fontSize: '0.8rem', fontWeight: 'bold' }}>Descripción Comercial</label>
                                <input 
                                    value={productoForm.descripcion} 
                                    onChange={e => setProductoForm({...productoForm, descripcion: e.target.value})}
                                    className="form-input"
                                    placeholder="Nombre completo del producto..."
                                />
                            </div>
                        </div>
                        {/* CAMPOS ADICIONALES (CÓDIGO BARRAS Y OPCIONES) */}
                        <div style={{ display: 'flex', gap: '15px', marginBottom: '15px', alignItems: 'flex-end' }}>
                            <div style={{ flex: 1 }}>
                                <label style={{ fontSize: '0.8rem', fontWeight: 'bold' }}>Código de Barras</label>
                                <input 
                                    value={productoForm.CodigoBarras} 
                                    onChange={e => setProductoForm({...productoForm, CodigoBarras: e.target.value})}
                                    className="form-input"
                                    placeholder="Escanee o escriba..."
                                />
                            </div>
    
                            {/* CHECKBOXES DE CONFIGURACIÓN */}
                            <div style={{ flex: 1, display: 'flex', gap: '20px', paddingBottom: '10px' }}>
                                <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer', fontSize: '0.85rem' }}>
                                    <input 
                                        type="checkbox" 
                                        checked={productoForm.permiteDesglose} 
                                        onChange={e => setProductoForm({...productoForm, permiteDesglose: e.target.checked})}
                                        style={{ marginRight: '5px' }}
                                    />
                                    Permite Desglose
                                </label>

                                <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer', fontSize: '0.85rem' }}>
                                    <input 
                                        type="checkbox" 
                                        checked={productoForm.manejaImpuestoLicor} 
                                        onChange={e => setProductoForm({...productoForm, manejaImpuestoLicor: e.target.checked})}
                                        style={{ marginRight: '5px' }}
                                    />
                                    Impuesto Licor
                                </label>
                            </div>

                            {/* CAMPO CONDICIONAL PARA % LICOR */}
                            {productoForm.manejaImpuestoLicor && (
                                <div style={{ flex: 0.5 }}>
                                    <label style={{ fontSize: '0.8rem', fontWeight: 'bold' }}>% Licor</label>
                                    <input 
                                        type="number" 
                                        value={productoForm.impuestoLicorPorcentaje} 
                                        onChange={e => setProductoForm({...productoForm, impuestoLicorPorcentaje: parseFloat(e.target.value)})}
                                        className="form-input"
                                    />
                                </div>
                            )}
                        </div>

                        {/* CONFIGURACIÓN TÉCNICA */}
                        <div style={{ 
                            display: 'grid', 
                            gridTemplateColumns: '1fr 1fr 1fr 1fr 1fr', // 5 columnas para un diseño compacto
                            gap: '10px', 
                            padding: '15px', 
                            backgroundColor: '#f8fafc', 
                            borderRadius: '8px', 
                            border: '1px solid #e2e8f0',
                            marginBottom: '20px' 
                        }}>
                            {/* CATEGORÍA */}
                            <div className="form-group">
                                <label style={{ fontSize: '0.75rem', fontWeight: 'bold' }}>Categoría</label>
                                <select 
                                    value={productoForm.idCategoria} 
                                    onChange={e => setProductoForm({...productoForm, idCategoria: e.target.value})} 
                                    className="form-input"
                                    style={{ width: '100%' }}
                                >
                                    <option value="">Seleccione...</option>
                                    {categorias.map(cat => (
                                        <option key={cat.idCategoria} value={cat.idCategoria}>
                                            {cat.nombreCategoria || cat.nombre} 
                                        </option>
                                    ))}
                                </select>
                                {/* 🆕 AQUÍ AGREGAMOS EL BOTÓN DE CONFIGURAR UNIDADES */}
                                <div style={{display:'flex', alignItems:'center'}}>
                                    <select 
                                        value={productoForm.idUnidad || ""} 
                                        onChange={(e) => {
                                            // Lógica para unidad principal... (se mantiene igual)
                                            const idSel = parseInt(e.target.value);
                                            const uInfo = unidadesMedida.find(u => (u.idUnidad || u.IdUnidad) === idSel);
                                            setProductoForm(prev => {
                                                const nuevas = [...prev.unidades];
                                                if(nuevas.length>0) {
                                                    nuevas[0] = { ...nuevas[0], idUnidad: idSel, nombreUnidad: uInfo?.nombreUnidad || '' };
                                                }
                                                return { ...prev, idUnidad: idSel, nombreUnidad: uInfo?.nombreUnidad || '', unidades: nuevas };
                                            });
                                        }}
                                        className="form-input"
                                        style={{ flex: 1 }}
                                    >
                                        <option value="">U. Principal...</option>
                                        {unidadesMedida.map(u => <option key={u.idUnidad||u.IdUnidad} value={u.idUnidad||u.IdUnidad}>{u.nombre||u.nombreUnidad}</option>)}
                                    </select>
                                    {/* BOTÓN ENGRANAJE */}
                                    <button 
                                        onClick={() => setModalUnidadesOpen(true)}
                                        title="Gestionar lista de unidades"
                                        style={{ marginLeft:'5px', cursor:'pointer', border:'1px solid #ccc', background:'#f0f0f0', borderRadius:'4px', padding:'5px' }}
                                    >
                                        ⚙️
                                    </button>
                               </div>
                               {/* CATEGORÍA CON BOTÓN DE GESTIÓN */}
                               <div className="form-group">
                                   <label style={{ fontSize: '0.75rem', fontWeight: 'bold' }}>Categoría</label>
                                   <div style={{ display: 'flex', alignItems: 'center' }}>
                                       <select 
                                           value={productoForm.idCategoria} 
                                           onChange={e => setProductoForm({...productoForm, idCategoria: e.target.value})} 
                                           className="form-input"
                                           style={{ flex: 1 }}
                                       >
                                           <option value="">Seleccione...</option>
                                           {categorias.map(cat => (
                                               <option key={cat.idCategoria} value={cat.idCategoria}>
                                                   {cat.nombreCategoria || cat.nombre} 
                                               </option>
                                           ))}
                                       </select>
        
                                       {/* BOTÓN ENGRANAJE PARA CATEGORÍAS */}
                                       <button 
                                           onClick={() => setModalCategoriasOpen(true)}
                                           title="Gestionar lista de categorías"
                                           style={{ 
                                               marginLeft: '5px', 
                                               cursor: 'pointer', 
                                               border: '1px solid #ccc', 
                                               background: '#f0f0f0', 
                                               borderRadius: '4px', 
                                               padding: '5px' 
                                           }}
                                       >
                                           ⚙️
                                       </button>
                                   </div>
                               </div>
                            </div>

                            {/* UNIDAD DE MEDIDA PRINCIPAL */}
                            <div className="form-group">
                                <label style={{ fontSize: '0.75rem', fontWeight: 'bold' }}>Unidad Principal</label>
                                <select
                                    value={productoForm.idUnidad || ""} 
                                    onChange={(e) => {
                                        const idSel = parseInt(e.target.value);
                                        if (!idSel) return;

                                        const unidadDB = unidadesMedida.find(u => (u.idUnidad || u.IdUnidad) === idSel);
                                        const nuevoNombre = unidadDB ? (unidadDB.nombre || unidadDB.Nombre || unidadDB.nombreUnidad || "").toUpperCase() : '';

                                        setProductoForm(prev => {
                                            let nuevasUnidades = [...(prev.unidades || [])];
                
                                            // Si ya existen filas, la primera (índice 0) siempre es la base
                                            if (nuevasUnidades.length > 0) {
                                                nuevasUnidades[0] = {
                                                    ...nuevasUnidades[0],
                                                    idUnidad: idSel,
                                                    nombreUnidad: nuevoNombre,
                                                    cantidadEquivalente: 1 // La principal siempre es la base
                                                };
                                            }

                                            return {
                                                ...prev,
                                                idUnidad: idSel,
                                                nombreUnidad: nuevoNombre,
                                                unidades: nuevasUnidades
                                            };
                                        });
                                    }}
                                    className="form-input"
                                    style={{ width: '100%' }}
                                >
                                    <option value="">Seleccione...</option>
                                    {unidadesMedida.map(u => (
                                        <option key={u.idUnidad || u.IdUnidad} value={u.idUnidad || u.IdUnidad}>
                                            {u.nombre || u.Nombre || u.nombreUnidad}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            {/* TIPO DE ARTÍCULO */}
                            <div className="form-group">
                                <label style={{ fontSize: '0.75rem', fontWeight: 'bold' }}>Tipo</label>
                                <select 
                                    value={productoForm.tipoArt} 
                                    onChange={e => setProductoForm({...productoForm, tipoArt: e.target.value})} 
                                    className="form-input"
                                    style={{ width: '100%' }}
                                >
                                    <option value="Bien">Bien (Inventario)</option>
                                    <option value="Servicio">Servicio</option>
                                </select>
                            </div>

                            {/* IMPUESTO (IVA) */}
                            <div className="form-group">
                                <label style={{ fontSize: '0.75rem', fontWeight: 'bold' }}>Impuesto</label>
                                <select 
                                    value={productoForm.idTasaIVA} 
                                    onChange={e => setProductoForm({...productoForm, idTasaIVA: e.target.value})} 
                                    className="form-input"
                                    style={{ width: '100%' }}
                                >
                                    <option value="">IVA...</option>
                                    {tasasIva.map(t => (
                                        <option key={t.idTasaIVA} value={t.idTasaIVA}>
                                            {t.porcentaje}%
                                        </option>
                                    ))}
                                </select>
                            </div>

                            {/* STOCK MÍNIMO */}
                            <div className="form-group">
                                <label style={{ fontSize: '0.75rem', fontWeight: 'bold' }}>Stock Mín</label>
                                <input 
                                    type="number" 
                                    value={productoForm.stockMinimo} 
                                    onChange={e => setProductoForm({...productoForm, stockMinimo: e.target.value})} 
                                    className="form-input"
                                    style={{ width: '100%' }}
                                    disabled={productoForm.tipoArt === 'Servicio'}
                                    placeholder="0"
                                />
                            </div>
                        </div>

                        <hr style={{ margin: '25px 0', border: '0', borderTop: '1px solid #e2e8f0' }} />

                        {/* SECCIÓN DE PRECIOS */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
                            <h4 style={{ margin: 0 }}>💰 Unidades de Venta y Precios ($)</h4>
                            <button onClick={agregarUnidadVenta} className="btn-secondary" style={{ fontSize: '0.75rem', padding: '5px 10px' }}>
                                + Agregar Presentación
                            </button>
                        </div>

                        <table className="tabla-edicion-precios">
                            <thead>
                                <tr>
                                    <th>Presentación</th>
                                    <th>Equivalencia</th>
                                    <th>Codigo de Barras Unidad</th>
                                    <th>Precio 1 ($)</th>
                                    <th>Precio 2 ($)</th>
                                    <th>Precio 3 ($)</th>
                                    <th style={{ textAlign: 'right' }}>Ref. Bs (P1)</th>
                                </tr>
                            </thead>
                            <tbody>
                                {productoForm.unidades.map((u, idx) => ( // <--- Aquí definiste "idx"
                                    <tr key={idx}>
                                        <td>
                                            <select
                                                value={u.idUnidad || ""}
                                                onChange={(e) => {
                                                    const idSel = parseInt(e.target.value);
                                                    const unidadInfo = unidadesMedida.find(um => (um.idUnidad || um.IdUnidad) === idSel);
        
                                                    if (unidadInfo) {
                                                        // Actualizamos todo el objeto de la fila de un solo golpe
                                                        setProductoForm(prev => {
                                                            const nuevas = [...prev.unidades];
                                                            nuevas[idx] = { 
                                                                ...nuevas[idx], 
                                                                idUnidad: idSel,
                                                                nombreUnidad: (unidadInfo.nombreUnidad || unidadInfo.nombre || "").toUpperCase(),
                                                                // AUTO-COMPLETAR con el valor de tu tabla SQL
                                                                cantidadEquivalente: unidadInfo.cantidadEquivalente || unidadInfo.CantidadEquivalente || 1
                                                            };
                                                            return { ...prev, unidades: nuevas };
                                                        });
                                                    }
                                                }}
                                                className="form-control"
                                            >
                                                <option value="">-- Seleccione --</option>
                                                {unidadesMedida.map(um => (
                                                    <option key={um.idUnidad || um.IdUnidad} value={um.idUnidad || um.IdUnidad}>
                                                        {um.nombre || um.nombreUnidad || um.NombreUnidad}
                                                    </option>
                                                ))}
                                            </select>
                                        </td>

                                                {/* Cantidad equivalente con etiqueta de la unidad base */}
                                                <td>
                                                   <input 
                                                       type="number" 
                                                       value={u.cantidadEquivalente} 
                                                       onChange={(e) => actualizarUnidadFila(idx, 'cantidadEquivalente', e.target.value)}
                                                       
                                                   />
                                               </td>
                                        <td>
                                            <div className="form-group">
                                                {/* Corregí el label para que coincida con el dato real */}
                                                <label style={{ fontSize: '0.75rem', fontWeight: 'bold' }}>Cód. Barras</label>
        
                                                <input 
                                                    type="text" 
                                                    value={u.CodigoBarras || ''} 
                                                    onChange={(e) => {
                                                        const val = e.target.value;
                                                        setProductoForm(prev => {
                                                            const nuevas = [...prev.unidades];
                                                            nuevas[idx] = { ...nuevas[idx], CodigoBarras: val };
                                                            return { ...prev, unidades: nuevas };
                                                        });
                                                    }}
                                                    className="form-input"
                                                    style={{ width: '100%' }}
                                                    disabled={productoForm.tipoArt === 'Servicio'}
                                                    placeholder="Escanear..."
                                                />
                                            </div>
                                        </td>

                                        {/* Inputs de precios */}
                                        <td>
                                            <input type="number" value={u.precio1} onChange={e => handleUnidadChange(idx, 'precio1', e.target.value)} className="input-precio-editable" />
                                        </td>
                                        <td>
                                            <input type="number" value={u.precio2} onChange={e => handleUnidadChange(idx, 'precio2', e.target.value)} className="input-precio-editable" />
                                        </td>
                                        <td>
                                            <input type="number" value={u.precio3} onChange={e => handleUnidadChange(idx, 'precio3', e.target.value)} className="input-precio-editable" />
                                        </td>

                                        {/* Cálculo en Bolívares */}
                                        <td style={{ textAlign: 'right', fontWeight: 'bold', color: '#2563eb', fontSize: '0.85rem' }}>
                                            {(u.precio1 * tasa).toLocaleString('es-VE', { minimumFractionDigits: 2 })} Bs
                                        </td>
                                        {/* 👇 AQUÍ ESTÁ EL NUEVO BOTÓN PARA ELIMINAR LA FILA 👇 */}
                                            <td style={{ textAlign: 'center' }}>
                                                <button 
                                                    onClick={() => eliminarUnidadVenta(idx)}
                                                    style={{ 
                                                        background: '#ef4444', 
                                                        color: 'white', 
                                                        border: 'none', 
                                                        padding: '5px 10px', 
                                                        borderRadius: '4px', 
                                                        cursor: 'pointer',
                                                        fontWeight: 'bold'
                                                    }}
                                                    title="Eliminar esta presentación"
                                                >
                                                ✕
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>

                        {/* PIE DEL MODAL */}
                        <div style={{ display: 'flex', gap: '15px', marginTop: '30px', borderTop: '1px solid #e2e8f0', paddingTop: '20px' }}>
                            <button onClick={() => setModalAbierto(false)} className="btn-secondary" style={{ flex: 1 }}>
                                Cancelar
                            </button>
                            <button 
                                onClick={guardarCambios} 
                                disabled={guardando || !productoForm.codigoProd || !productoForm.descripcion} 
                                className="btn-primary" 
                                style={{ flex: 2, background: '#10b981', fontSize: '1rem' }}
                            >
                                {guardando ? "⏳ Procesando..." : "💾 Guardar Información"}
                            </button>
                        </div>
                    </div>
                </div>
            )}
            {/* ========================================================= */}
            {/* 🆕 MODAL SECUNDARIO: CRUD DE UNIDADES (CATÁLOGO) */}
            {/* ========================================================= */}
            {modalUnidadesOpen && (
                <div className="modal-overlay" style={{ zIndex: 2000 }}>
                    <div className="modulo-container" style={{ width: '500px', boxShadow: '0 0 15px rgba(0,0,0,0.5)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '15px', borderBottom: '1px solid #eee', paddingBottom: '10px' }}>
                            <h3 style={{ margin: 0 }}>⚙️ Catálogo de Unidades</h3>
                            <button onClick={() => setModalUnidadesOpen(false)} style={{border:'none', background:'none', fontSize:'1.2rem', cursor:'pointer'}}>✕</button>
                        </div>

                        {/* FORMULARIO PEQUEÑO */}
                        <div style={{ display: 'flex', gap: '10px', marginBottom: '15px' }}>
                            <input 
                                className="form-input" 
                                placeholder="Nombre (Ej: LITRO)" 
                                value={unidadForm.nombreUnidad}
                                onChange={e => setUnidadForm({...unidadForm, nombreUnidad: e.target.value})}
                                style={{ flex: 1 }}
                            />
                            <button 
                                onClick={guardarUnidadCatalogo} 
                                className="btn-primary" 
                                disabled={loadingUnidad}
                                style={{ background: unidadForm.idUnidad === 0 ? '#10b981' : '#f59e0b' }}
                            >
                                {loadingUnidad ? "..." : (unidadForm.idUnidad === 0 ? "Agregar" : "Actualizar")}
                            </button>
                            
                            {unidadForm.idUnidad !== 0 && (
                                <button onClick={() => setUnidadForm({idUnidad:0, nombreUnidad:''})} className="btn-secondary" title="Cancelar edición">✖</button>
                            )}
                        </div>

                        {/* LISTA DE UNIDADES EXISTENTES */}
                        <div style={{ maxHeight: '300px', overflowY: 'auto', border: '1px solid #e2e8f0', borderRadius: '4px' }}>
                            <table className="tabla-general" style={{ marginBottom: 0 }}>
                                <thead>
                                    <tr>
                                        <th>ID</th>
                                        <th>Nombre</th>
                                        <th style={{textAlign:'center'}}>Acción</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {unidadesMedida.map(u => (
                                        <tr key={u.idUnidad || u.IdUnidad}>
                                            <td style={{width:'50px'}}>{u.idUnidad || u.IdUnidad}</td>
                                            <td>{u.nombreUnidad || u.Nombre || u.NombreUnidad}</td>
                                            <td style={{textAlign:'center', width:'100px'}}>
                                                <button 
                                                    onClick={() => editarUnidadCatalogo(u)}
                                                    style={{border:'none', background:'transparent', cursor:'pointer', marginRight:'10px'}}
                                                    title="Editar"
                                                >✏️</button>
                                                <button 
                                                    onClick={() => borrarUnidadCatalogo(u.idUnidad || u.IdUnidad)}
                                                    style={{border:'none', background:'transparent', cursor:'pointer', color:'red'}}
                                                    title="Eliminar"
                                                >🗑️</button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}
            {/* MODAL DE GESTIÓN DE CATEGORÍAS */}
            {modalCategoriasOpen && (
                <div className="modal-overlay" style={{ zIndex: 1100 }}> {/* Z-index mayor para que quede encima */}
                    <div className="modulo-container" style={{ width: '500px', maxHeight: '80vh', overflowY: 'auto' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '15px' }}>
                            <h3>📂 Gestión de Categorías</h3>
                            <button onClick={() => setModalCategoriasOpen(false)} style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: '1.2rem' }}>✕</button>
                        </div>

                        {/* FORMULARIO PEQUEÑO */}
                        <div style={{ display: 'flex', gap: '10px', marginBottom: '20px', alignItems: 'flex-end' }}>
                            <div style={{ flex: 1 }}>
                                <label style={{ fontSize: '0.8rem' }}>Nombre Categoría</label>
                                <input 
                                    type="text" 
                                    className="form-input"
                                    value={categoriaForm.nombreCategoria}
                                    onChange={e => setCategoriaForm({...categoriaForm, nombreCategoria: e.target.value})}
                                    placeholder="Nueva categoría..."
                                />
                            </div>
                            <button 
                                onClick={guardarCategoriaCatalogo} 
                                className="btn-primary" 
                                disabled={loadingCategoria}
                            >
                                {loadingCategoria ? '...' : (categoriaForm.idCategoria === 0 ? '➕ Crear' : '💾 Actualizar')}
                            </button>
                            {categoriaForm.idCategoria !== 0 && (
                                <button 
                                    onClick={() => setCategoriaForm({ idCategoria: 0, nombreCategoria: '' })} 
                                    className="btn-secondary"
                                >
                                    Cancelar
                                </button>
                            )}
                        </div>

                        {/* LISTA EXISTENTE */}
                        <table className="tabla-general" style={{ fontSize: '0.85rem' }}>
                            <thead>
                                <tr>
                                    <th>Nombre</th>
                                    <th style={{ width: '80px', textAlign: 'center' }}>Acciones</th>
                                </tr>
                            </thead>
                            <tbody>
                                {categorias.map(cat => (
                                    <tr key={cat.idCategoria}>
                                        <td>{cat.nombreCategoria || cat.nombre}</td>
                                        <td style={{ textAlign: 'center' }}>
                                            <button 
                                                onClick={() => editarCategoriaCatalogo(cat)}
                                                style={{ border: 'none', background: 'none', cursor: 'pointer', marginRight: '5px' }}
                                                title="Editar"
                                            >
                                                ✏️
                                            </button>
                                            <button 
                                                onClick={() => borrarCategoriaCatalogo(cat.idCategoria)}
                                                style={{ border: 'none', background: 'none', cursor: 'pointer', color: 'red' }}
                                                title="Eliminar"
                                            >
                                                🗑️
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Productos;