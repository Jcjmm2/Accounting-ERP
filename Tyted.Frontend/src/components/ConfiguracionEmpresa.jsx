import React, { useState, useEffect, useContext } from 'react';
import { ConfigContext } from '../Context/ConfigContext';
import { contabilidadApi } from '../Services/Contabilidad/ContabilidadApi';

const ConfiguracionEmpresa = () => {
    const { API_URL, refrescarContextoContable } = useContext(ConfigContext);

    // Los endpoints de empresa ahora exigen JWT
    const getAuthHeaders = () => ({
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('token')}`
    });

    // Identidad de Empresa
    const [empresa, setEmpresa] = useState({
        id: 1,
        razonSocial: '',
        rif: '',
        direccion: '',
        telefono: '',
        email: ''
    });

    const [ajustes, setAjustes] = useState([]);
    const [loading, setLoading] = useState(true);

    // Lista de Periodos y Estado de Edición
    const [periodosExistentes, setPeriodosExistentes] = useState([]);
    const [periodoEdicion, setPeriodoEdicion] = useState(null);
    const [cargandoPeriodos, setCargandoPeriodos] = useState(false);

    // Formulario de Alta de Periodo Fiscal
    const [anioFiscal, setAnioFiscal] = useState(new Date().getFullYear());
    const [fechaInicio, setFechaInicio] = useState(`${new Date().getFullYear()}-01-01`);
    const [fechaFin, setFechaFin] = useState(`${new Date().getFullYear()}-12-31`);
    const [guardandoPeriodo, setGuardandoPeriodo] = useState(false);

    useEffect(() => {
        cargarDatos();
        cargarPeriodos();
    }, []);

    const handleAnioChange = (e) => {
        const anio = e.target.value;
        setAnioFiscal(anio);
        if (anio) {
            setFechaInicio(`${anio}-01-01`);
            setFechaFin(`${anio}-12-31`);
        }
    };

    const cargarDatos = async () => {
        try {
            setLoading(true);
            const [resEmpresa, resAjustes] = await Promise.all([
                fetch(`${API_URL}/Empresa/configuracion`, { headers: getAuthHeaders() }),
                fetch(`${API_URL}/Empresa/ajustes`, { headers: getAuthHeaders() })
            ]);

            if (resEmpresa.ok) setEmpresa(await resEmpresa.json());
            if (resAjustes.ok) setAjustes(await resAjustes.json());
        } catch (error) {
            console.error("Error al cargar configuración:", error);
        } finally {
            setLoading(false);
        }
    };

    const cargarPeriodos = async () => {
        try {
            setCargandoPeriodos(true);
            const data = await contabilidadApi.getPeriodos();
            const lista = Array.isArray(data) ? data : (data?.$values || []);
            
            // Aplanar periodos anuales y subperiodos mensuales
            let aplanada = [];
            lista.forEach(p => {
                aplanada.push(p);
                const subs = p.subPeriodos?.$values || p.subPeriodos || [];
                subs.forEach(sub => aplanada.push(sub));
            });

            setPeriodosExistentes(aplanada);
        } catch (error) {
            console.error("Error al consultar periodos:", error);
        } finally {
            setCargandoPeriodos(false);
        }
    };

    const guardarDatosEmpresa = async (e) => {
        e.preventDefault();
        try {
            const res = await fetch(`${API_URL}/Empresa/configuracion`, {
                method: 'PUT',
                headers: getAuthHeaders(),
                body: JSON.stringify(empresa)
            });
            if (res.ok) alert("Datos de la empresa actualizados correctamente.");
        } catch {
            alert("Error al guardar datos de la empresa.");
        }
    };

    const guardarAjuste = async (clave, nuevoValor) => {
        try {
            const res = await fetch(`${API_URL}/Empresa/ajustes/${clave}`, {
                method: 'PUT',
                headers: getAuthHeaders(),
                body: JSON.stringify(nuevoValor)
            });
            if (res.ok) cargarDatos();
        } catch {
            alert("Error al actualizar ajuste técnico.");
        }
    };

    const aperturarEjercicioFiscal = async (e) => {
        e.preventDefault();
        try {
            setGuardandoPeriodo(true);
            await contabilidadApi.crearPeriodo({
                empresaId: empresa.id || 1,
                anio: Number(anioFiscal),
                nombre: `Ejercicio Fiscal ${anioFiscal}`,
                tipoPeriodo: 'Anual',
                fechaInicio: `${fechaInicio}T00:00:00`,
                fechaFin: `${fechaFin}T23:59:59`,
                estado: 'Abierto'
            });

            alert(`✅ Ejercicio Fiscal ${anioFiscal} aperturado con éxito.`);
            await cargarPeriodos();
            if (refrescarContextoContable) await refrescarContextoContable();
        } catch {
            alert("Error al aperturar el ejercicio fiscal.");
        } finally {
            setGuardandoPeriodo(false);
        }
    };

    // Validar si el periodo tiene asientos antes de permitir editar
    const seleccionarParaEditar = async (periodo) => {
        try {
            const { tieneMovimientos } = await contabilidadApi.verificarMovimientosPeriodo(periodo.id);
            
            if (tieneMovimientos) {
                alert(`⚠️ El periodo "${periodo.nombre || periodo.anio}" ya posee asientos contables registrados. Por integridad fiscal no es posible modificar sus fechas ni estructura.`);
                return;
            }

            setPeriodoEdicion({
                ...periodo,
                fechaInicio: periodo.fechaInicio ? periodo.fechaInicio.split('T')[0] : '',
                fechaFin: periodo.fechaFin ? periodo.fechaFin.split('T')[0] : ''
            });
        } catch (error) {
            console.error("Error comprobando asientos:", error);
            alert("No se pudo verificar el estado operativo del periodo.");
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
            await cargarPeriodos();
            if (refrescarContextoContable) await refrescarContextoContable();
        } catch {
            alert("Error al guardar las modificaciones del periodo.");
        }
    };

    if (loading) return <p style={{ color: '#e2e8f0', padding: '20px' }}>Cargando configuración...</p>;

    return (
        <div style={{ padding: '20px', maxWidth: '1200px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: '24px', color: '#e2e8f0' }}>
            
            {/* Sección 1: Identidad de la Empresa */}
            <div style={{ background: '#1e293b', padding: '20px', borderRadius: '10px', border: '1px solid #334155' }}>
                <h3 style={{ marginBottom: '16px', color: '#60a5fa' }}>🏢 Identidad de la Empresa</h3>
                <form onSubmit={guardarDatosEmpresa} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <label style={{ fontSize: '0.85rem', color: '#94a3b8' }}>Nombre / Razón Social:</label>
                    <input 
                        type="text" 
                        value={empresa.razonSocial || ''} 
                        onChange={e => setEmpresa({...empresa, razonSocial: e.target.value})} 
                        style={{ padding: '10px', borderRadius: '6px', background: '#0f172a', border: '1px solid #334155', color: '#fff' }}
                    />
                    
                    <label style={{ fontSize: '0.85rem', color: '#94a3b8' }}>RIF / NIT:</label>
                    <input 
                        type="text" 
                        value={empresa.rif || ''} 
                        onChange={e => setEmpresa({...empresa, rif: e.target.value})} 
                        style={{ padding: '10px', borderRadius: '6px', background: '#0f172a', border: '1px solid #334155', color: '#fff' }}
                    />
                    
                    <label style={{ fontSize: '0.85rem', color: '#94a3b8' }}>Dirección Fiscal:</label>
                    <textarea 
                        value={empresa.direccion || ''} 
                        onChange={e => setEmpresa({...empresa, direccion: e.target.value})} 
                        style={{ padding: '10px', borderRadius: '6px', background: '#0f172a', border: '1px solid #334155', color: '#fff', minHeight: '60px' }}
                    />
                    
                    <label style={{ fontSize: '0.85rem', color: '#94a3b8' }}>Teléfono:</label>
                    <input 
                        type="text" 
                        value={empresa.telefono || ''} 
                        onChange={e => setEmpresa({...empresa, telefono: e.target.value})} 
                        style={{ padding: '10px', borderRadius: '6px', background: '#0f172a', border: '1px solid #334155', color: '#fff' }}
                    />

                    <button type="submit" style={{ marginTop: '10px', padding: '10px', background: '#2563eb', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}>
                        Guardar Identidad
                    </button>
                </form>
            </div>

            {/* Sección 2: Gestión y Apertura de Periodos Fiscales */}
            <div style={{ background: '#1e293b', padding: '20px', borderRadius: '10px', border: '1px solid #334155' }}>
                <h3 style={{ marginBottom: '8px', color: '#fbbf24' }}>📅 Configuración de Periodos Fiscales</h3>
                <p style={{ fontSize: '0.8rem', color: '#94a3b8', marginBottom: '16px' }}>
                    Aperturar nuevos ejercicios o consultar y editar los periodos existentes en la base de datos.
                </p>

                {/* Formulario de Alta */}
                <form onSubmit={aperturarEjercicioFiscal} style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '24px' }}>
                    <div style={{ display: 'flex', gap: '10px' }}>
                        <div style={{ flex: 1 }}>
                            <label style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Año:</label>
                            <input 
                                type="number" 
                                value={anioFiscal} 
                                onChange={handleAnioChange} 
                                style={{ width: '100%', padding: '8px', borderRadius: '6px', background: '#0f172a', border: '1px solid #334155', color: '#fff' }}
                            />
                        </div>
                        <div style={{ flex: 1 }}>
                            <label style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Inicio:</label>
                            <input 
                                type="date" 
                                value={fechaInicio} 
                                onChange={e => setFechaInicio(e.target.value)} 
                                style={{ width: '100%', padding: '8px', borderRadius: '6px', background: '#0f172a', border: '1px solid #334155', color: '#fff' }}
                            />
                        </div>
                        <div style={{ flex: 1 }}>
                            <label style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Fin:</label>
                            <input 
                                type="date" 
                                value={fechaFin} 
                                onChange={e => setFechaFin(e.target.value)} 
                                style={{ width: '100%', padding: '8px', borderRadius: '6px', background: '#0f172a', border: '1px solid #334155', color: '#fff' }}
                            />
                        </div>
                    </div>

                    <button 
                        type="submit" 
                        disabled={guardandoPeriodo}
                        style={{ padding: '8px', background: '#059669', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}
                    >
                        {guardandoPeriodo ? 'Guardando...' : '➕ Aperturar Ejercicio'}
                    </button>
                </form>

                {/* Lista / Consulta de Periodos Existentes */}
                <h4 style={{ fontSize: '0.9rem', color: '#93c5fd', marginBottom: '10px' }}>📋 Periodos Existentes en Base de Datos</h4>
                <div style={{ maxHeight: '220px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {cargandoPeriodos ? (
                        <p style={{ fontSize: '0.8rem', color: '#94a3b8' }}>Cargando periodos...</p>
                    ) : periodosExistentes.length === 0 ? (
                        <p style={{ fontSize: '0.8rem', color: '#94a3b8' }}>No hay periodos registrados.</p>
                    ) : (
                        periodosExistentes.map(p => (
                            <div key={p.id} style={{ background: '#0f172a', padding: '10px', borderRadius: '6px', border: '1px solid #334155', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <div>
                                    <strong style={{ fontSize: '0.85rem', color: '#fbbf24' }}>
                                        {p.nombre || `Periodo ${p.mes ? p.mes + '/' : ''}${p.anio}`}
                                    </strong>
                                    <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
                                        ID: {p.id} | {new Date(p.fechaInicio).toLocaleDateString()} - {new Date(p.fechaFin).toLocaleDateString()}
                                    </div>
                                </div>
                                <button 
                                    onClick={() => seleccionarParaEditar(p)}
                                    style={{ background: '#3b82f6', color: '#fff', border: 'none', padding: '4px 8px', borderRadius: '4px', cursor: 'pointer', fontSize: '0.75rem' }}
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
                <h3 style={{ marginBottom: '8px', color: '#cbd5e1' }}>⚙️ Ajustes del Sistema</h3>
                <p style={{ fontSize: '0.8rem', color: '#94a3b8', marginBottom: '16px' }}>Configuración técnica de módulos y periféricos.</p>
                
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    {ajustes.map(adj => (
                        <div key={adj.clave} style={{ borderBottom: '1px solid #334155', paddingBottom: '12px' }}>
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
                            <small style={{ color: '#64748b', fontSize: '0.75rem' }}>Valor en BD: {adj.valor}</small>
                        </div>
                    ))}
                </div>
            </div>

            {/* Modal de Edición de Periodo (SÓLO SI NO TIENE MOVIMIENTOS) */}
            {periodoEdicion && (
                <div style={{
                    position: 'fixed', inset: 0, background: 'rgba(0, 0, 0, 0.75)', 
                    backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', 
                    justifyContent: 'center', zIndex: 1000, padding: '16px'
                }}>
                    <div style={{ background: '#1e293b', padding: '24px', borderRadius: '12px', width: '100%', maxWidth: '420px', border: '1px solid #334155', color: '#fff' }}>
                        <h3 style={{ marginBottom: '16px', color: '#60a5fa' }}>✏️ Modificar Periodo Contable (ID: {periodoEdicion.id})</h3>
                        
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