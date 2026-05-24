import React, { useState, useEffect, useContext } from 'react';
import { ConfigContext } from '../Context/ConfigContext';

const Proveedores = () => {
    const { API_URL } = useContext(ConfigContext);
    const getAuthHeaders = () => ({
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem("token")}`
    });
    const [proveedores, setProveedores] = useState([]);
    const [loading, setLoading] = useState(true);
    const [busqueda, setBusqueda] = useState("");
    
    // Estados para el formulario (Crear/Editar)
    const [showModal, setShowModal] = useState(false);
    const [editando, setEditando] = useState(false);
    const [formData, setFormData] = useState({
        codigoProv: 0,
        rif: '',
        razonsocial: '',
        direccion: '',
        telefono: '',
        contacto: ''
    });

    useEffect(() => {
        cargarProveedores();
    }, []);

    const cargarProveedores = async (termino = "") => {
        try {
            setLoading(true);
            // INTEGRACIÓN: Usa los Query Parameters del controlador (?razonsocial=...)
            const url = termino 
                ? `${API_URL}/Proveedores?razonsocial=${termino}` 
                : `${API_URL}/Proveedores`;
            
            const res = await fetch(url, {
                headers: getAuthHeaders()
            });
            if (res.ok) {
                const data = await res.json();
                setProveedores(data);
            }
        } catch (error) {
            console.error("Error al cargar proveedores:", error);
        } finally {
            setLoading(false);
        }
    };

    const handleGuardar = async (e) => {
        e.preventDefault();
        const metodo = editando ? 'PUT' : 'POST';
        const url = editando 
            ? `${API_URL}/Proveedores/${formData.codigoProv}` 
            : `${API_URL}/Proveedores`;

        try {
            const res = await fetch(url, {
                method: metodo,
                headers: getAuthHeaders(),
                body: JSON.stringify(formData)
            });

            if (res.ok) {
                setShowModal(false);
                resetForm();
                cargarProveedores();
                alert(editando ? "Proveedor actualizado" : "Proveedor creado con éxito");
            } else {
                const error = await res.text();
                alert("Error: " + error);
            }
        } catch (error) {
            console.error("Error en la operación:", error);
        }
    };

    const abrirEditar = (p) => {
        setFormData(p);
        setEditando(true);
        setShowModal(true);
    };

    const resetForm = () => {
        setFormData({ codigoProv: 0, rif: '', razonsocial: '', direccion: '', telefono: '', contacto: '' });
        setEditando(false);
    };

    return (
        <div className="modulo-container">
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px' }}>
                <h2>🤝 Gestión de Proveedores</h2>
                <button className="btn-primary" onClick={() => { resetForm(); setShowModal(true); }}>
                    + Nuevo Proveedor
                </button>
            </div>

            <div style={{ marginBottom: '20px' }}>
                <input 
                    type="text" 
                    placeholder="Buscar por Razón Social..." 
                    value={busqueda}
                    onChange={(e) => {
                        setBusqueda(e.target.value);
                        cargarProveedores(e.target.value);
                    }}
                    className="search-input"
                />
            </div>

            {loading ? <p>Cargando proveedores...</p> : (
                <table>
                    <thead>
                        <tr>
                            <th>RIF</th>
                            <th>Razón Social</th>
                            <th>Teléfono</th>
                            <th>Contacto</th>
                            <th>Acciones</th>
                        </tr>
                    </thead>
                    <tbody>
                        {proveedores.map(p => (
                            <tr key={p.codigoProv}>
                                <td>{p.rif}</td>
                                <td><strong>{p.razonsocial}</strong></td>
                                <td>{p.telefono || 'N/A'}</td>
                                <td>{p.contacto || 'N/A'}</td>
                                <td>
                                    <button onClick={() => abrirEditar(p)} className="btn-secondary" style={{ padding: '4px 8px' }}>
                                        ✏️ Editar
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            )}

            {/* Modal de Registro/Edición */}
            {showModal && (
                <div className="modal-overlay">
                    <div className="modulo-container" style={{ width: '500px' }}>
                        <h3>{editando ? 'Editar Proveedor' : 'Nuevo Proveedor'}</h3>
                        <form onSubmit={handleGuardar}>
                            <div className="form-group">
                                <label>RIF:</label>
                                <input 
                                    type="text" 
                                    required 
                                    value={formData.rif} 
                                    onChange={e => setFormData({...formData, rif: e.target.value})}
                                    disabled={editando} // El RIF no suele cambiarse
                                />
                            </div>
                            <div className="form-group">
                                <label>Razón Social:</label>
                                <input 
                                    type="text" 
                                    required 
                                    value={formData.razonsocial} 
                                    onChange={e => setFormData({...formData, razonsocial: e.target.value})}
                                />
                            </div>
                            <div className="form-group">
                                <label>Dirección:</label>
                                <input 
                                    type="text" 
                                    value={formData.direccion} 
                                    onChange={e => setFormData({...formData, direccion: e.target.value})}
                                />
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                                <div className="form-group">
                                    <label>Teléfono:</label>
                                    <input 
                                        type="text" 
                                        value={formData.telefono} 
                                        onChange={e => setFormData({...formData, telefono: e.target.value})}
                                    />
                                </div>
                                <div className="form-group">
                                    <label>Persona de Contacto:</label>
                                    <input 
                                        type="text" 
                                        value={formData.contacto} 
                                        onChange={e => setFormData({...formData, contacto: e.target.value})}
                                    />
                                </div>
                            </div>
                            <div style={{ marginTop: '20px', display: 'flex', gap: '10px' }}>
                                <button type="submit" className="btn-primary" style={{ flex: 1 }}>
                                    {editando ? 'Actualizar' : 'Guardar'}
                                </button>
                                <button type="button" onClick={() => setShowModal(false)} className="btn-secondary" style={{ flex: 1 }}>
                                    Cancelar
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Proveedores;