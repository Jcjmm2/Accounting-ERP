import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';

// Recibe las nuevas props: refreshFlag (para forzar carga) y onAnnulmentSuccess (para notificar al padre)
const ListaCompras = ({ API_URL = 'http://localhost:5077/api', refreshFlag, onAnnulmentSuccess }) => {
    const [compras, setCompras] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    
    // ESTADOS PARA FILTRO
    const [searchId, setSearchId] = useState('');
    const [searchProveedor, setSearchProveedor] = useState('');
    const [searchFecha, setSearchFecha] = useState(''); 
    const [showFilters, setShowFilters] = useState(true); 

    // 🌟 ESTADO PARA DISPARAR LA BÚSQUEDA MANUALMENTE
    const [triggerSearch, setTriggerSearch] = useState(0); 

    // =========================================================================
    // FUNCIÓN 1: CARGAR DATOS CON FILTROS (fetchCompras)
    // =========================================================================
    const fetchCompras = useCallback(async () => {
        // Al inicio de la búsqueda, establecemos loading=true.
        setLoading(true);
        setError(null);
        
        try {
            // Siempre trae TODAS las compras desde el API (El filtro se aplica en el cliente)
            const response = await axios.get(`${API_URL}/Compras`);
            let data = response.data;
            
            // --- FILTRO EN CLIENTE ---
            
            // Aplicar filtro por ID
            if (searchId) {
                data = data.filter(c => c.id === parseInt(searchId, 10));
            }
            
            // Aplicar filtro por Proveedor (Nombre o RIF)
            if (searchProveedor) {
                const proveedorLower = searchProveedor.toLowerCase();
                
                data = data.filter(c => 
                    c.proveedor?.razonsocial?.toLowerCase().includes(proveedorLower) || 
                    c.proveedor?.nombre?.toLowerCase().includes(proveedorLower) ||
                    c.proveedor?.rif?.toLowerCase().includes(proveedorLower)
                );
            }

            // Aplicar filtro por Fecha
            if (searchFecha) {
                data = data.filter(c => 
                    c.fechaCompra.startsWith(searchFecha)
                );
            }
            
            setCompras(data);
        } catch (err) {
            console.error("Error al cargar las compras:", err);
            setError("No se pudieron cargar las compras. Verifique la conexión con la API.");
        } finally {
            setLoading(false);
        }
    }, [API_URL, searchId, searchProveedor, searchFecha]); 

    // =========================================================================
    // Lógica para ejecutar la búsqueda (AL HACER SUBMIT)
    // =========================================================================
    const handleSearch = (e) => {
        e.preventDefault();
        
        const isIdSearchMet = searchId.length > 0;
        const isProveedorSearchMet = searchProveedor.length >= 3; 
        const isFechaSearchMet = searchFecha.length > 0; 
        
        const isSearchCriteriaMet = isIdSearchMet || isProveedorSearchMet || isFechaSearchMet;

        if (!isSearchCriteriaMet) {
            alert("Ingrese un criterio de búsqueda (ID, Proveedor [mínimo 3 caracteres], o Fecha).");
            setCompras([]);
            setError(null); 
            setLoading(false); 
            return; 
        }

        if (searchProveedor.length > 0 && searchProveedor.length < 3) {
            alert("El filtro de Proveedor requiere un mínimo de 3 caracteres.");
            return;
        }

        // DISPARADOR MANUAL.
        setTriggerSearch(prev => prev + 1);
    };
    
    // =========================================================================
    // Lógica para limpiar los filtros (CORREGIDO el bug de recarga)
    // =========================================================================
    const handleClearSearch = () => {
        // 1. Limpiar los inputs
        setSearchId('');
        setSearchProveedor('');
        setSearchFecha(''); 
        
        // 2. Limpiar la lista de resultados directamente y el estado de carga
        setCompras([]);
        setError(null); 
        setLoading(false); 
        
        // ⭐️ CLAVE DEL ARREGLO:
        // Forzamos el triggerSearch a 0. Esto, junto con el reset de los filtros,
        // hará que el useEffect entre en el bloque 'else' (isInitialLoad = true) 
        // y NO ejecute fetchCompras.
        setTriggerSearch(0); 
    };

    // =========================================================================
    // LÓGICA DE CARGA CONDICIONAL
    // =========================================================================
    useEffect(() => {
        // Si el componente está en estado inicial (0 búsquedas y sin refresh forzado)
        const isInitialLoad = triggerSearch === 0 && !refreshFlag;
        
        if (!isInitialLoad) {
            // Se ejecuta solo si el usuario ha presionado Buscar (triggerSearch > 0) o si hay un refresh externo
            fetchCompras();
        } else {
            // Estado por defecto: no cargar nada.
            setCompras([]);
            setLoading(false);
            setError(null);
        }

    // El efecto se dispara por la recarga forzada o el triggerSearch (que cambia en handleSearch o handleClearSearch)
    // y también cuando fetchCompras se re-crea (por cambio en los filtros), pero la lógica de isInitialLoad 
    // asegura que no se ejecute la carga si se acaban de limpiar los filtros.
    }, [fetchCompras, refreshFlag, triggerSearch]); 

    // =========================================================================
    // FUNCIÓN 2: ANULAR COMPRA (Sin cambios)
    // =========================================================================
    const handleAnularCompra = async (compraId) => {
        if (!window.confirm(`¿Está seguro de que desea anular la Compra ID ${compraId}? Esta acción es irreversible y revertirá el stock.`)) {
            return; 
        }

        try {
            const response = await axios.put(`${API_URL}/Compras/anular/${compraId}`);
            
            console.log("Anulación exitosa:", response.data);
            alert(`Anulación exitosa: ${response.data}`); 

            if (onAnnulmentSuccess) {
                onAnnulmentSuccess(); 
            } else {
                 setCompras(prevCompras => 
                     prevCompras.map(compra => 
                         compra.id === compraId ? { ...compra, isAnulada: true } : compra
                     )
                 );
            }

        } catch (error) {
            let errorMessage = "Ocurrió un error desconocido al anular la compra.";
            
            if (error.response) {
                errorMessage = error.response.data.message || error.response.data || error.response.statusText;
            }

            console.error("Error al anular la compra:", errorMessage);
            alert(`Fallo en la anulación: ${errorMessage}`);
        }
    };

    // =========================================================================
    // RENDERIZADO
    // =========================================================================
    if (loading && (searchId || searchProveedor || searchFecha || triggerSearch > 0 || refreshFlag)) return <div className="text-center mt-5">Cargando resultados de la búsqueda...</div>;
    // Mostrar "Iniciando" solo en el estado inicial si el loading es true
    if (loading && triggerSearch === 0 && !refreshFlag) return <div className="text-center mt-5">Iniciando componente...</div>;
    if (error) return <div className="alert alert-danger mt-5">{error}</div>;

    return (
        <div className="container mt-5">
            <h2 className="mb-4">📋 Listado de Compras</h2>
            
            {/* Sección de Búsqueda/Filtro */}
            <form onSubmit={handleSearch} className="mb-4 p-3 border rounded shadow-sm bg-light">
                <h5 className="mb-3" onClick={() => setShowFilters(!showFilters)} style={{cursor: 'pointer'}}>
                    Filtros de Búsqueda 
                    <span className="ms-2">{showFilters ? '▲' : '▼'}</span>
                </h5>
                
                {showFilters && (
                    <div className="row g-3">
                        {/* 1. FILTRO ID de Compra */}
                        <div className="col-md-3"> 
                            <label className="form-label">ID de Compra</label>
                            <input 
                                type="number" 
                                className="form-control" 
                                value={searchId}
                                onChange={(e) => setSearchId(e.target.value)}
                            />
                        </div>

                        {/* 2. FILTRO Proveedor */}
                        <div className="col-md-3">
                            <label className="form-label">Nombre/RIF de Proveedor</label>
                            <input 
                                type="text" 
                                className="form-control" 
                                value={searchProveedor}
                                onChange={(e) => setSearchProveedor(e.target.value)}
                                placeholder="Mínimo 3 caracteres"
                            />
                            {/* Mensaje de validación para el usuario */}
                            {searchProveedor.length > 0 && searchProveedor.length < 3 && (
                                <small className="text-danger">Ingrese al menos 3 caracteres para buscar.</small>
                            )}
                        </div>

                        {/* 3. FILTRO Fecha */}
                        <div className="col-md-3">
                            <label className="form-label">Fecha de Compra</label>
                            <input 
                                type="date" 
                                className="form-control" 
                                value={searchFecha}
                                onChange={(e) => setSearchFecha(e.target.value)}
                            />
                        </div>

                        {/* 4. BOTONES */}
                        <div className="col-md-3 d-flex align-items-end">
                            <button 
                                type="submit" 
                                className="btn btn-primary w-100 me-2" 
                                disabled={loading}
                            >
                                Buscar
                            </button>
                            <button type="button" className="btn btn-secondary w-100" onClick={handleClearSearch} disabled={loading}>
                                Limpiar
                            </button>
                        </div>
                    </div>
                )}
            </form>

            {/* Este botón permite la recarga forzada de *toda* la lista si el usuario lo desea */}
            <button className="btn btn-primary mb-3" onClick={() => setTriggerSearch(prev => prev + 1)} disabled={loading}>
                 {loading ? 'Cargando...' : 'Recargar Lista Completa (Ignorar Criterios)'}
            </button>

            <div className="table-responsive">
                <table className="table table-striped table-hover proveedor-table">
                    <thead>
                        <tr>
                            <th>ID</th>
                            <th>Proveedor</th>
                            <th>Fecha</th>
                            <th className="text-end">Total Ext.</th>
                            <th className="text-end">Total Base</th>
                            <th>Moneda</th>
                            <th>Estado</th>
                            <th>Acciones</th>
                        </tr>
                    </thead>
                    <tbody>
                        {compras.map(compra => (
                            <tr key={compra.id} className={compra.isAnulada ? 'table-danger' : ''}>
                                <td>{compra.id}</td>
                                <td>{compra.proveedor?.razonsocial || compra.proveedor?.nombre || 'N/A'}</td> 
                                <td>{new Date(compra.fechaCompra).toLocaleDateString()}</td>
                                <td className="text-end">USD {compra.totalMonedaExt.toFixed(2)}</td>
                                <td className="text-end">VES {compra.totalMonedaBase.toFixed(2)}</td>
                                <td>{compra.tipoMoneda}</td>
                                <td>
                                    {compra.isAnulada ? (
                                        <span className="badge bg-danger">ANULADA</span>
                                    ) : (
                                        <span className="badge bg-success">ACTIVA</span>
                                    )}
                                </td>
                                <td>
                                    {!compra.isAnulada && (
                                        <button 
                                            className="btn btn-sm btn-warning" 
                                            onClick={() => handleAnularCompra(compra.id)}
                                        >
                                            Anular
                                        </button>
                                    )}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
            {compras.length === 0 && (triggerSearch > 0 || refreshFlag) && <div className="alert alert-info">No hay compras registradas que coincidan con los filtros.</div>}
            {compras.length === 0 && triggerSearch === 0 && !refreshFlag && <div className="alert alert-info">Utilice los filtros de búsqueda o el botón 'Recargar Lista Completa' para ver las compras.</div>}
        </div>
    );
};

export default ListaCompras;