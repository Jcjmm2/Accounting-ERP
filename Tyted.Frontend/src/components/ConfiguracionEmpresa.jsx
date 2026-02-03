import React, { useState, useEffect, useContext } from 'react';
import { ConfigContext } from '../Context/ConfigContext';

const ConfiguracionEmpresa = () => {
    const { API_URL } = useContext(ConfigContext);
    
    // Estado para datos básicos (Endpoint /configuracion)
    const [empresa, setEmpresa] = useState({
        id: 1,
        razonSocial: '', // <--- Antes decia 'nombre'
        rif: '',
        direccion: '',
        telefono: '',
        email: ''        // <--- Agregamos email que estaba en tu BD
    });

    // Estado para ajustes técnicos (Endpoint /ajustes)
    const [ajustes, setAjustes] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        cargarDatos();
    }, []);

    const cargarDatos = async () => {
        try {
            setLoading(true);
            const [resEmpresa, resAjustes] = await Promise.all([
                fetch(`${API_URL}/Empresa/configuracion`),
                fetch(`${API_URL}/Empresa/ajustes`)
            ]);

            if (resEmpresa.ok) {
                const data = await resEmpresa.json();
                console.log("Datos cargados:", data); // Para verificar en consola
                setEmpresa(data);
            }
            if (resAjustes.ok) setAjustes(await resAjustes.json());
        } catch (error) {
            console.error("Error al cargar configuración:", error);
        } finally {
            setLoading(false);
        }
    };

    // Actualizar datos de la empresa (PUT /configuracion)
    const guardarDatosEmpresa = async (e) => {
        e.preventDefault();
        try {
            const res = await fetch(`${API_URL}/Empresa/configuracion`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(empresa)
            });
            if (res.ok) alert("Datos de la empresa actualizados");
        } catch (error) {
            alert("Error al guardar datos");
        }
    };

    // Actualizar un ajuste específico (PUT /ajustes/{clave})
    const guardarAjuste = async (clave, nuevoValor) => {
        try {
            const res = await fetch(`${API_URL}/Empresa/ajustes/${clave}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(nuevoValor)
            });
            if (res.ok) {
                cargarDatos(); // Recargar para confirmar el cambio
            } else {
                const err = await res.text();
                alert(err);
            }
        } catch (error) {
            alert("Error al actualizar ajuste");
        }
    };

    if (loading) return <p>Cargando configuración...</p>;

    return (
        <div style={{ padding: '20px', maxWidth: '900px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '30px' }}>
            
            {/* Sección 1: Datos de Identidad */}
            <div style={{ background: 'white', padding: '20px', borderRadius: '10px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
                <h3>🏢 Identidad de la Empresa</h3>
                <form onSubmit={guardarDatosEmpresa} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    <label>Nombre / Razón Social:</label>
                    <input 
                        type="text" 
                        value={empresa.razonSocial || ''} 
                        onChange={e => setEmpresa({...empresa, razonSocial: e.target.value})} 
                        placeholder="Ej: Inversiones Tyted, C.A."
                    />
                    
                    <label>RIF / NIT:</label>
                    <input type="text" value={empresa.rif} onChange={e => setEmpresa({...empresa, rif: e.target.value})} />
                    
                    <label>Dirección Fiscal:</label>
                    <textarea value={empresa.direccion} onChange={e => setEmpresa({...empresa, direccion: e.target.value})} />
                    
                    <label>Teléfono:</label>
                    <input type="text" value={empresa.telefono} onChange={e => setEmpresa({...empresa, telefono: e.target.value})} />

                    <button type="submit" style={{ marginTop: '10px', padding: '10px', background: '#2563eb', color: 'white', border: 'none', borderRadius: '5px', cursor: 'pointer' }}>
                        Guardar Cambios Identidad
                    </button>
                </form>
            </div>

            {/* Sección 2: Ajustes del Sistema (Controlador Dinámico) */}
            <div style={{ background: 'white', padding: '20px', borderRadius: '10px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
                <h3>⚙️ Ajustes del Sistema</h3>
                <p style={{ fontSize: '0.8rem', color: '#64748b' }}>Configuración técnica de módulos y periféricos.</p>
                
                <div style={{ marginTop: '20px' }}>
                    {ajustes.map(adj => (
                        <div key={adj.clave} style={{ marginBottom: '20px', borderBottom: '1px solid #f1f5f9', paddingBottom: '10px' }}>
                            <label style={{ fontWeight: 'bold', display: 'block' }}>{adj.clave}</label>
                            
                            {adj.clave === "ModoImpresionFactura" ? (
                                <select 
                                    value={adj.valor} 
                                    onChange={(e) => guardarAjuste(adj.clave, e.target.value)}
                                    style={{ width: '100%', padding: '8px', marginTop: '5px' }}
                                >
                                    <option value="AMBAS">Mostrar USD y BS (Ambas)</option>
                                    <option value="SOLO_BASE">Solo Moneda Base (USD)</option>
                                    <option value="SOLO_EXT">Solo Moneda Local (BS)</option>
                                </select>
                            ) : (
                                <div style={{ display: 'flex', gap: '5px', marginTop: '5px' }}>
                                    <input 
                                        type="text" 
                                        defaultValue={adj.valor} 
                                        onBlur={(e) => guardarAjuste(adj.clave, e.target.value)}
                                        style={{ flex: 1, padding: '8px' }}
                                    />
                                </div>
                            )}
                            <small style={{ color: '#94a3b8' }}>Valor actual en DB: {adj.valor}</small>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default ConfiguracionEmpresa;