import React, { useState, useEffect, useContext, useMemo } from 'react';
import { ConfigContext } from '../Context/ConfigContext';
import { contabilidadApi } from '../Services/Contabilidad/ContabilidadApi';

const ConfiguracionEmpresa = () => {
    // 1. Extraemos el contexto global para gobernar toda la app
    const { 
        API_URL, 
        refrescarContextoContable,
        empresas, 
        periodos, 
        empresaActiva, 
        periodoActivo, 
        seleccionarEmpresa, 
        seleccionarPeriodo 
    } = useContext(ConfigContext);

    const getAuthHeaders = () => ({
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('token')}`
    });

    // Estado de edición de la empresa seleccionada
    const [empresaEdit, setEmpresaEdit] = useState({
        id: 1, razonSocial: '', rif: '', direccion: '', telefono: '', email: ''
    });

    // Estado para crear una NUEVA Empresa
    const [nuevaEmpresa, setNuevaEmpresa] = useState({
        razonSocial: '', rif: '', direccion: '', telefono: '', email: ''
    });

    const [ajustes, setAjustes] = useState([]);
    const [loading, setLoading] = useState(true);

    // Estado de Edición de Periodos
    const [periodoEdicion, setPeriodoEdicion] = useState(null);

    // Estados para Creación de Periodos (Padre / Hijo)
    const [tipoNuevoPeriodo, setTipoNuevoPeriodo] = useState('Anual'); // 'Anual' (Padre) o 'Mensual' (Hijo)
    const [anioFiscal, setAnioFiscal] = useState(new Date().getFullYear());
    const [mesSubPeriodo, setMesSubPeriodo] = useState(1);
    const [periodoPadreIdSeleccionado, setPeriodoPadreIdSeleccionado] = useState('');
    const [nombrePeriodoCustom, setNombrePeriodoCustom] = useState('');
    const [fechaInicio, setFechaInicio] = useState(`${new Date().getFullYear()}-01-01`);
    const [fechaFin, setFechaFin] = useState(`${new Date().getFullYear()}-12-31`);
    const [guardandoPeriodo, setGuardandoPeriodo] = useState(false);

    // Sincronizar el formulario con la empresa activa global
    useEffect(() => {
        if (empresaActiva) {
            setEmpresaEdit({
                id: empresaActiva.id,
                razonSocial: empresaActiva.razonSocial || empresaActiva.nombre || '',
                rif: empresaActiva.rif || '',
                direccion: empresaActiva.direccion || '',
                telefono: empresaActiva.telefono || '',
                email: empresaActiva.email || ''
            });
        }
    }, [empresaActiva]);

    useEffect(() => {
        cargarAjustesSistemas();
    }, []);

    const handleAnioChange = (e) => {
        const anio = e.target.value;
        setAnioFiscal(anio);
        if (anio) {
            setFechaInicio(`${anio}-01-01`);
            setFechaFin(`${anio}-12-31`);
        }
    };

    const cargarAjustesSistemas = async () => {
        try {
            setLoading(true);
            const resAjustes = await fetch(`${API_URL}/Empresa/ajustes`, { headers: getAuthHeaders() });
            if (resAjustes.ok) setAjustes(await resAjustes.json());
        } catch (error) {
            console.error("Error al cargar ajustes:", error);
        } finally {
            setLoading(false);
        }
    };

    // Filtrar únicamente los periodos Anuales (Padres) disponibles para asociar subperiodos
    const periodosPadresDisponibles = useMemo(() => {
        return periodos.filter(p => p.tipoPeriodo === 'Anual' || !p.periodoPadreId);
    }, [periodos]);

    // Jerarquía visual para el selector y listado de periodos
    const listaPeriodosJerarquia = useMemo(() => {
        return periodos.map(p => ({
            ...p,
            label: p.tipoPeriodo === 'Anual' ? `📁 [AÑO COMPLETO] ${p.nombre || p.anio}` : `   └ 📄 ${p.nombre}`
        }));
    }, [periodos]);

    // Guardar modificaciones de la empresa activa
    const guardarDatosEmpresa = async (e) => {
        e.preventDefault();
        try {
            const res = await fetch(`${API_URL}/Empresa/configuracion`, {
                method: 'PUT',
                headers: getAuthHeaders(),
                body: JSON.stringify(empresaEdit)
            });
            if (res.ok) {
                alert("✅ Datos de la empresa actualizados correctamente.");
                await refrescarContextoContable();
            } else {
                alert("❌ No fue posible actualizar la empresa.");
            }
        } catch (error) {
            console.error("Error al guardar empresa:", error);
            alert("Error de conexión al guardar datos de la empresa.");
        }
    };

    // Registrar NUEVA Empresa en la Base de Datos
    const crearNuevaEmpresa = async (e) => {
        e.preventDefault();
        if (!nuevaEmpresa.razonSocial || !nuevaEmpresa.rif) {
            alert("⚠️ La Razón Social y el RIF son obligatorios.");
            return;
        }

        try {
            const res = await fetch(`${API_URL}/Empresa`, {
                method: 'POST',
                headers: getAuthHeaders(),
                body: JSON.stringify(nuevaEmpresa)
            });
            if (res.ok) {
                alert("✅ Nueva empresa registrada con éxito.");
                setNuevaEmpresa({ razonSocial: '', rif: '', direccion: '', telefono: '', email: '' });
                await refrescarContextoContable();
            } else {
                alert("❌ Error al registrar la nueva empresa.");
            }
        } catch (error) {
            console.error("Error al crear empresa:", error);
            alert("Error de conexión al crear la empresa.");
        }
    };

    const guardarAjuste = async (clave, nuevoValor) => {
        try {
            const res = await fetch(`${API_URL}/Empresa/ajustes/${clave}`, {
                method: 'PUT',
                headers: getAuthHeaders(),
                body: JSON.stringify(nuevoValor)
            });
            if (res.ok) cargarAjustesSistemas();
        } catch {
            alert("Error al actualizar ajuste técnico.");
        }
    };

    // Crear Nuevo Periodo (Padre o Hijo)
    const crearPeriodoFiscal = async (e) => {
        e.preventDefault();
        try {
            setGuardandoPeriodo(true);

            const payload = {
                empresaId: empresaActiva.id || 1,
                anio: Number(anioFiscal),
                nombre: nombrePeriodoCustom || (tipoNuevoPeriodo === 'Anual' ? `Ejercicio Fiscal ${anioFiscal}` : `Mes ${mesSubPeriodo}/${anioFiscal}`),
                tipoPeriodo: tipoNuevoPeriodo,
                periodoPadreId: tipoNuevoPeriodo === 'Mensual' ? Number(periodoPadreIdSeleccionado) : null,
                mes: tipoNuevoPeriodo === 'Mensual' ? Number(mesSubPeriodo) : null,
                fechaInicio: `${fechaInicio}T00:00:00`,
                fechaFin: `${fechaFin}T23:59:59`,
                estado: 'Abierto'
            };

            await contabilidadApi.crearPeriodo(payload);

            alert(`✅ Periodo ${tipoNuevoPeriodo.toLowerCase()} creado con éxito.`);
            setNombrePeriodoCustom('');
            await refrescarContextoContable(); 
        } catch (error) {
            console.error("Error creando periodo:", error);
            alert("Error al registrar el periodo contable.");
        } finally {
            setGuardandoPeriodo(false);
        }
    };

    // Validación estricta de movimientos contables antes de permitir edición de periodo[cite: 37, 41]
    const seleccionarParaEditarPeriodo = async (periodo) => {
        try {
            const { tieneMovimientos } = await contabilidadApi.verificarMovimientosPeriodo(periodo.id);
            
            if (tieneMovimientos) {
                alert(`⚠️ El periodo "${periodo.nombre || periodo.anio}" ya posee asientos contables registrados. Por integridad fiscal bajo normativa NIIF, no es posible modificar sus fechas ni estructura.`);
                return;
            }

            setPeriodoEdicion({
                ...periodo,
                fechaInicio: periodo.fechaInicio ? periodo.fechaInicio.split('T')[0] : '',
                fechaFin: periodo.fechaFin ? periodo.fechaFin.split('T')[0] : ''
            });
        } catch (error) {
            console.error("Error comprobando asientos:", error);
            alert("No se pudo verificar el estado operativo del periodo en la base de datos.");
        }
    };

    const guardarEdicionPeriodo = async (e) => {
        e.preventDefault();
        try {
            await contabilidadApi.modificarPeriodo(periodoEdicion.id, {
                ...periodoEdicion,
                fechaInicio: `${periodoEdicion.fechaInicio}T00:00:00`,
                fechaFin: `${periodoEdicion.fechaFin}T23:59:59`
            });

            alert("✅ Periodo modificado correctamente.");
            setPeriodoEdicion(null);
            await refrescarContextoContable();
        } catch (error) {
            console.error("Error modificando periodo:", error);
            alert("Error al guardar las modificaciones del periodo.");
        }
    };

    if (loading) return <div style={{ padding: '40px', color: '#e2e8f0', textAlign: 'center' }}>⏳ Cargando panel de control corporativo...</div>;

    return (
        <div style={{ padding: '24px', maxWidth: '1200px', margin: '0 auto', color: '#e2e8f0' }}>
            
            {/* =========================================================
                DASHBOARD MAESTRO: SELECTOR DE ENTORNO DE TRABAJO 
            ========================================================= */}
            <div style={{ background: '#0f172a', padding: '24px', borderRadius: '12px', border: '1px solid #3b82f6', marginBottom: '32px', boxShadow: '0 4px 15px rgba(0,0,0,0.3)' }}>
                <div style={{ marginBottom: '16px' }}>
                    <h2 style={{ margin: '0 0 8px 0', color: '#60a5fa', fontSize: '1.4rem' }}>🎛️ Panel de Control y Gobierno Global</h2>
                    <p style={{ margin: 0, color: '#94a3b8', fontSize: '0.9rem' }}>
                        Seleccione la entidad económica y el ejercicio fiscal activo. Toda la contabilidad de la aplicación operará bajo este contexto.
                    </p>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '20px' }}>
                    <div>
                        <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.85rem', color: '#cbd5e1', fontWeight: 'bold' }}>
                            🏢 Empresa / Entidad Activa
                        </label>
                        <select 
                            value={empresaActiva?.id || ''} 
                            onChange={(e) => seleccionarEmpresa(e.target.value)}
                            style={{ width: '100%', padding: '12px', borderRadius: '8px', background: '#1e293b', border: '1px solid #475569', color: '#fff', fontSize: '1rem' }}
                        >
                            {empresas.map((emp) => (
                                <option key={emp.id} value={emp.id}>
                                    🏢 {emp.nombre || emp.razonSocial} (RIF: {emp.rif || 'S/N'})
                                </option>
                            ))}
                        </select>
                    </div>

                    <div>
                        <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.85rem', color: '#cbd5e1', fontWeight: 'bold' }}>
                            📅 Ejercicio Fiscal / Subperiodo Activo
                        </label>
                        <select 
                            value={periodoActivo?.id || ''} 
                            onChange={(e) => seleccionarPeriodo(e.target.value)}
                            style={{ width: '100%', padding: '12px', borderRadius: '8px', background: '#1e293b', border: '1px solid #475569', color: '#fff', fontSize: '1rem' }}
                        >
                            {listaPeriodosJerarquia.length === 0 ? (
                                <option value="">No hay periodos registrados para esta empresa</option>
                            ) : null}
                            {listaPeriodosJerarquia.map((p) => (
                                <option key={p.id} value={p.id} style={{ fontWeight: p.tipoPeriodo === 'Anual' ? 'bold' : 'normal' }}>
                                    {p.label} [{p.estado}]
                                </option>
                            ))}
                        </select>
                    </div>
                </div>
            </div>

            {/* =========================================================
                SECCIONES DE GESTIÓN CORPORATIVA Y PERIODOS 
            ========================================================= */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: '24px' }}>
                
                {/* Sección 1A: Edición de Empresa Activa */}
                <div style={{ background: '#1e293b', padding: '20px', borderRadius: '10px', border: '1px solid #334155' }}>
                    <h3 style={{ margin: '0 0 12px 0', color: '#60a5fa', fontSize: '1.1rem' }}>🏢 Editar Empresa Seleccionada</h3>
                    <form onSubmit={guardarDatosEmpresa} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                        <label style={{ fontSize: '0.8rem', color: '#94a3b8' }}>Razón Social:</label>
                        <input 
                            type="text" 
                            value={empresaEdit.razonSocial || ''} 
                            onChange={e => setEmpresaEdit({...empresaEdit, razonSocial: e.target.value})} 
                            style={{ padding: '8px', borderRadius: '6px', background: '#0f172a', border: '1px solid #334155', color: '#fff' }}
                        />
                        
                        <label style={{ fontSize: '0.8rem', color: '#94a3b8' }}>RIF:</label>
                        <input 
                            type="text" 
                            value={empresaEdit.rif || ''} 
                            onChange={e => setEmpresaEdit({...empresaEdit, rif: e.target.value})} 
                            style={{ padding: '8px', borderRadius: '6px', background: '#0f172a', border: '1px solid #334155', color: '#fff' }}
                        />
                        
                        <label style={{ fontSize: '0.8rem', color: '#94a3b8' }}>Dirección:</label>
                        <textarea 
                            value={empresaEdit.direccion || ''} 
                            onChange={e => setEmpresaEdit({...empresaEdit, direccion: e.target.value})} 
                            style={{ padding: '8px', borderRadius: '6px', background: '#0f172a', border: '1px solid #334155', color: '#fff', minHeight: '50px' }}
                        />

                        <button type="submit" style={{ marginTop: '8px', padding: '8px', background: '#2563eb', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}>
                            💾 Actualizar Empresa Activa
                        </button>
                    </form>

                    {/* Sección 1B: Crear NUEVA Empresa */}
                    <div style={{ borderTop: '1px solid #334155', marginTop: '20px', paddingTop: '16px' }}>
                        <h4 style={{ margin: '0 0 10px 0', color: '#38bdf8', fontSize: '0.95rem' }}>➕ Registrar Nueva Empresa</h4>
                        <form onSubmit={crearNuevaEmpresa} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                            <input 
                                type="text" 
                                placeholder="Razón Social de la nueva empresa" 
                                value={nuevaEmpresa.razonSocial} 
                                onChange={e => setNuevaEmpresa({...nuevaEmpresa, razonSocial: e.target.value})} 
                                style={{ padding: '8px', borderRadius: '6px', background: '#0f172a', border: '1px solid #334155', color: '#fff' }}
                            />
                            <input 
                                type="text" 
                                placeholder="RIF (ej. J-12345678-9)" 
                                value={nuevaEmpresa.rif} 
                                onChange={e => setNuevaEmpresa({...nuevaEmpresa, rif: e.target.value})} 
                                style={{ padding: '8px', borderRadius: '6px', background: '#0f172a', border: '1px solid #334155', color: '#fff' }}
                            />
                            <button type="submit" style={{ padding: '8px', background: '#059669', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}>
                                🚀 Crear Empresa
                            </button>
                        </form>
                    </div>
                </div>

                {/* Sección 2: Gestión, Apertura y Creación de Periodos (Padre / Hijo) */}
                <div style={{ background: '#1e293b', padding: '20px', borderRadius: '10px', border: '1px solid #334155' }}>
                    <h3 style={{ margin: '0 0 8px 0', color: '#fbbf24', fontSize: '1.1rem' }}>📅 Gestión de Periodos (Padre / Hijo)</h3>
                    <p style={{ fontSize: '0.8rem', color: '#94a3b8', marginBottom: '12px' }}>
                        Cree ejercicios anuales (Padres) o subperiodos mensuales (Hijos) para <strong>{empresaActiva.razonSocial}</strong>.
                    </p>

                    {/* Formulario de Alta de Periodo */}
                    <form onSubmit={crearPeriodoFiscal} style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '16px', background: '#0f172a', padding: '12px', borderRadius: '8px', border: '1px solid #334155' }}>
                        
                        <div style={{ display: 'flex', gap: '10px' }}>
                            <div style={{ flex: 1 }}>
                                <label style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Tipo de Periodo:</label>
                                <select 
                                    value={tipoNuevoPeriodo}
                                    onChange={(e) => setTipoNuevoPeriodo(e.target.value)}
                                    style={{ width: '100%', padding: '6px', borderRadius: '6px', background: '#1e293b', border: '1px solid #475569', color: '#fff', fontSize: '0.85rem' }}
                                >
                                    <option value="Anual">📁 Anual (Padre)</option>
                                    <option value="Mensual">📄 Mensual (Hijo)</option>
                                </select>
                            </div>
                            <div style={{ flex: 1 }}>
                                <label style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Año Fiscal:</label>
                                <input 
                                    type="number" 
                                    value={anioFiscal} 
                                    onChange={handleAnioChange} 
                                    style={{ width: '100%', padding: '6px', borderRadius: '6px', background: '#1e293b', border: '1px solid #475569', color: '#fff', fontSize: '0.85rem' }}
                                />
                            </div>
                        </div>

                        {/* Si es Mensual (Hijo), solicitar selección de Periodo Padre y Mes */}
                        {tipoNuevoPeriodo === 'Mensual' && (
                            <div style={{ display: 'flex', gap: '10px' }}>
                                <div style={{ flex: 2 }}>
                                    <label style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Ejercicio Padre (Anual):</label>
                                    <select 
                                        value={periodoPadreIdSeleccionado}
                                        onChange={(e) => setPeriodoPadreIdSeleccionado(e.target.value)}
                                        style={{ width: '100%', padding: '6px', borderRadius: '6px', background: '#1e293b', border: '1px solid #475569', color: '#fff', fontSize: '0.85rem' }}
                                        required
                                    >
                                        <option value="">Seleccione el periodo padre...</option>
                                        {periodosPadresDisponibles.map(p => (
                                            <option key={p.id} value={p.id}>{p.nombre || `Año ${p.anio}`}</option>
                                        ))}
                                    </select>
                                </div>
                                <div style={{ flex: 1 }}>
                                    <label style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Nº Mes:</label>
                                    <input 
                                        type="number" 
                                        min="1" 
                                        max="12"
                                        value={mesSubPeriodo} 
                                        onChange={(e) => setMesSubPeriodo(e.target.value)} 
                                        style={{ width: '100%', padding: '6px', borderRadius: '6px', background: '#1e293b', border: '1px solid #475569', color: '#fff', fontSize: '0.85rem' }}
                                    />
                                </div>
                            </div>
                        )}

                        <div>
                            <label style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Nombre Personalizado (Opcional):</label>
                            <input 
                                type="text" 
                                placeholder={tipoNuevoPeriodo === 'Anual' ? `Ejercicio Fiscal ${anioFiscal}` : `Enero ${anioFiscal}`}
                                value={nombrePeriodoCustom} 
                                onChange={(e) => setNombrePeriodoCustom(e.target.value)} 
                                style={{ width: '100%', padding: '6px', borderRadius: '6px', background: '#1e293b', border: '1px solid #475569', color: '#fff', fontSize: '0.85rem' }}
                            />
                        </div>

                        <div style={{ display: 'flex', gap: '10px' }}>
                            <div style={{ flex: 1 }}>
                                <label style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Inicio:</label>
                                <input 
                                    type="date" 
                                    value={fechaInicio} 
                                    onChange={e => setFechaInicio(e.target.value)} 
                                    style={{ width: '100%', padding: '6px', borderRadius: '6px', background: '#1e293b', border: '1px solid #475569', color: '#fff', fontSize: '0.85rem' }}
                                />
                            </div>
                            <div style={{ flex: 1 }}>
                                <label style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Fin:</label>
                                <input 
                                    type="date" 
                                    value={fechaFin} 
                                    onChange={e => setFechaFin(e.target.value)} 
                                    style={{ width: '100%', padding: '6px', borderRadius: '6px', background: '#1e293b', border: '1px solid #475569', color: '#fff', fontSize: '0.85rem' }}
                                />
                            </div>
                        </div>

                        <button 
                            type="submit" 
                            disabled={guardandoPeriodo}
                            style={{ padding: '8px', background: '#059669', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold', fontSize: '0.85rem' }}
                        >
                            {guardandoPeriodo ? 'Guardando...' : `➕ Registrar Periodo ${tipoNuevoPeriodo}`}
                        </button>
                    </form>

                    {/* Lista / Consulta de Periodos con control de edición condicional */}
                    <h4 style={{ fontSize: '0.85rem', color: '#93c5fd', marginBottom: '6px' }}>📋 Periodos Registrados (Con validación de integridad)</h4>
                    <div style={{ maxHeight: '160px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        {listaPeriodosJerarquia.length === 0 ? (
                            <p style={{ fontSize: '0.75rem', color: '#94a3b8' }}>No hay periodos registrados para esta empresa.</p>
                        ) : (
                            listaPeriodosJerarquia.map(p => (
                                <div key={p.id} style={{ background: '#0f172a', padding: '8px 10px', borderRadius: '6px', border: '1px solid #334155', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <div>
                                        <strong style={{ fontSize: '0.8rem', color: p.tipoPeriodo === 'Anual' ? '#60a5fa' : '#fbbf24' }}>
                                            {p.label}
                                        </strong>
                                        <div style={{ fontSize: '0.7rem', color: '#94a3b8' }}>
                                            {new Date(p.fechaInicio).toLocaleDateString()} al {new Date(p.fechaFin).toLocaleDateString()}
                                        </div>
                                    </div>
                                    <button 
                                        onClick={() => seleccionarParaEditarPeriodo(p)}
                                        title="Verifica si tiene asientos antes de permitir modificar"
                                        style={{ background: '#3b82f6', color: '#fff', border: 'none', padding: '4px 8px', borderRadius: '4px', cursor: 'pointer', fontSize: '0.7rem', fontWeight: 'bold' }}
                                    >
                                        ✏️ Editar
                                    </button>
                                </div>
                            ))
                        )}
                    </div>
                </div>

                {/* Sección 3: Ajustes Técnicos del Sistema */}
                <div style={{ background: '#1e293b', padding: '20px', borderRadius: '10px', border: '1px solid #334155' }}>
                    <h3 style={{ margin: '0 0 8px 0', color: '#cbd5e1', fontSize: '1.1rem' }}>⚙️ Ajustes Técnicos del Sistema</h3>
                    <p style={{ fontSize: '0.8rem', color: '#94a3b8', marginBottom: '14px' }}>Configuración general de parámetros operativos y formatos.</p>
                    
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', maxHeight: '380px', overflowY: 'auto' }}>
                        {ajustes.map(adj => (
                            <div key={adj.clave} style={{ borderBottom: '1px solid #334155', paddingBottom: '10px' }}>
                                <label style={{ fontWeight: 'bold', display: 'block', fontSize: '0.85rem', color: '#e2e8f0' }}>{adj.clave}</label>
                                
                                {adj.clave === "ModoImpresionFactura" ? (
                                    <select 
                                        value={adj.valor} 
                                        onChange={(e) => guardarAjuste(adj.clave, e.target.value)}
                                        style={{ width: '100%', padding: '8px', marginTop: '6px', borderRadius: '6px', background: '#0f172a', border: '1px solid #334155', color: '#fff' }}
                                    >
                                        <option value="AMBAS">Mostrar USD y BS (Ambas)</option>
                                        <option value="SOLO_BASE">Solo Moneda Base (USD)</option>
                                        <option value="SOLO_EXT">Solo Moneda Local (BS)</option>
                                    </select>
                                ) : (
                                    <input 
                                        type="text" 
                                        defaultValue={adj.valor} 
                                        onBlur={(e) => guardarAjuste(adj.clave, e.target.value)}
                                        style={{ width: '100%', padding: '8px', marginTop: '6px', borderRadius: '6px', background: '#0f172a', border: '1px solid #334155', color: '#fff' }}
                                    />
                                )}
                                <small style={{ color: '#64748b', fontSize: '0.75rem' }}>Valor guardado en BD: {adj.valor}</small>
                            </div>
                        ))}
                    </div>
                </div>

            </div>

            {/* =========================================================
                MODAL DE EDICIÓN DE PERIODO (PROTEGIDO)
            ========================================================= */}
            {periodoEdicion && (
                <div style={{
                    position: 'fixed', inset: 0, background: 'rgba(0, 0, 0, 0.75)', 
                    backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', 
                    justifyContent: 'center', zIndex: 1000, padding: '16px'
                }}>
                    <div style={{ background: '#1e293b', padding: '24px', borderRadius: '12px', width: '100%', maxWidth: '420px', border: '1px solid #334155', color: '#fff' }}>
                        <h3 style={{ marginBottom: '16px', color: '#60a5fa' }}>✏️ Modificar Periodo (ID: {periodoEdicion.id})</h3>
                        <p style={{ fontSize: '0.8rem', color: '#fbbf24', marginBottom: '12px' }}>
                            ℹ️ Este periodo fue verificado y no contiene asientos registrados. Puede actualizar sus datos de forma segura.
                        </p>
                        
                        <form onSubmit={guardarEdicionPeriodo} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                            <div>
                                <label style={{ fontSize: '0.8rem', color: '#94a3b8' }}>Nombre del Periodo:</label>
                                <input 
                                    type="text" 
                                    value={periodoEdicion.nombre || ''} 
                                    onChange={e => setPeriodoEdicion({...periodoEdicion, nombre: e.target.value})} 
                                    style={{ width: '100%', padding: '8px', borderRadius: '6px', background: '#0f172a', border: '1px solid #334155', color: '#fff' }}
                                />
                            </div>

                            <div style={{ display: 'flex', gap: '10px' }}>
                                <div style={{ flex: 1 }}>
                                    <label style={{ fontSize: '0.8rem', color: '#94a3b8' }}>Año:</label>
                                    <input 
                                        type="number" 
                                        value={periodoEdicion.anio || ''} 
                                        onChange={e => setPeriodoEdicion({...periodoEdicion, anio: Number(e.target.value)})} 
                                        style={{ width: '100%', padding: '8px', borderRadius: '6px', background: '#0f172a', border: '1px solid #334155', color: '#fff' }}
                                    />
                                </div>
                                <div style={{ flex: 1 }}>
                                    <label style={{ fontSize: '0.8rem', color: '#94a3b8' }}>Mes (opcional):</label>
                                    <input 
                                        type="number" 
                                        value={periodoEdicion.mes || ''} 
                                        onChange={e => setPeriodoEdicion({...periodoEdicion, mes: e.target.value ? Number(e.target.value) : null})} 
                                        style={{ width: '100%', padding: '8px', borderRadius: '6px', background: '#0f172a', border: '1px solid #334155', color: '#fff' }}
                                    />
                                </div>
                            </div>

                            <div>
                                <label style={{ fontSize: '0.8rem', color: '#94a3b8' }}>Fecha Inicio:</label>
                                <input 
                                    type="date" 
                                    value={periodoEdicion.fechaInicio || ''} 
                                    onChange={e => setPeriodoEdicion({...periodoEdicion, fechaInicio: e.target.value})} 
                                    style={{ width: '100%', padding: '8px', borderRadius: '6px', background: '#0f172a', border: '1px solid #334155', color: '#fff' }}
                                />
                            </div>

                            <div>
                                <label style={{ fontSize: '0.8rem', color: '#94a3b8' }}>Fecha Fin:</label>
                                <input 
                                    type="date" 
                                    value={periodoEdicion.fechaFin || ''} 
                                    onChange={e => setPeriodoEdicion({...periodoEdicion, fechaFin: e.target.value})} 
                                    style={{ width: '100%', padding: '8px', borderRadius: '6px', background: '#0f172a', border: '1px solid #334155', color: '#fff' }}
                                />
                            </div>

                            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '12px' }}>
                                <button 
                                    type="button" 
                                    onClick={() => setPeriodoEdicion(null)} 
                                    style={{ background: '#475569', color: '#fff', border: 'none', padding: '8px 14px', borderRadius: '6px', cursor: 'pointer' }}
                                >
                                    Cancelar
                                </button>
                                <button 
                                    type="submit" 
                                    style={{ background: '#2563eb', color: '#fff', border: 'none', padding: '8px 14px', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}
                                >
                                    Guardar Cambios
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ConfiguracionEmpresa;