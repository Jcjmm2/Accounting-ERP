import React, { useState, useEffect, useContext } from 'react';
import { ConfigContext } from '../Context/ConfigContext';

const Usuarios = () => {
    const { API_URL } = useContext(ConfigContext);
    const [usuarios, setUsuarios] = useState([]);
    const [empresas, setEmpresas] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);

    const [isEditing, setIsEditing] = useState(false);
    const [currentId, setCurrentId] = useState(null);

    const [formData, setFormData] = useState({
        username: '',
        password: '',
        rol: 'Cajero',
        nombreCompleto: '',
        activo: true,
        empresasPermitidas: [],
        empresaPredeterminadaId: ''
    });

    const getAuthHeaders = () => {
        const token = localStorage.getItem('token');
        return {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        };
    };

    useEffect(() => {
        cargarUsuarios();
        cargarEmpresas();
    }, []);

    const cargarEmpresas = async () => {
        try {
            const res = await fetch(`${API_URL}/Empresa/todas`, { headers: getAuthHeaders() });
            if (res.ok) {
                const data = await res.json();
                setEmpresas(Array.isArray(data) ? data : (data?.$values || []));
            }
        } catch (error) {
            console.error('Error cargando empresas:', error);
        }
    };

    const cargarUsuarios = async () => {
        try {
            setLoading(true);
            const res = await fetch(`${API_URL}/Usuarios`, { headers: getAuthHeaders() });

            if (res.ok) {
                const data = await res.json();
                setUsuarios(Array.isArray(data) ? data : (data?.$values || []));
            } else {
                console.error('Error cargando usuarios:', res.status);
            }
        } catch (error) {
            console.error('Error al cargar usuarios:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleGuardar = async (e) => {
        e.preventDefault();

        if (formData.empresasPermitidas.length === 0) {
            return alert('Debes asignarle al menos una empresa al usuario.');
        }
        if (!formData.empresaPredeterminadaId) {
            return alert('Debes seleccionar una empresa predeterminada.');
        }

        try {
            let url = `${API_URL}/Usuarios/Registrar`;
            let method = 'POST';

            if (isEditing) {
                url = `${API_URL}/Usuarios/${currentId}`;
                method = 'PUT';
            }

            const objetoUsuario = {
                username: formData.username,
                password: formData.password,
                rol: formData.rol,
                nombreCompleto: formData.nombreCompleto,
                activo: formData.activo,
                empresasPermitidas: formData.empresasPermitidas,
                empresaPredeterminadaId: Number(formData.empresaPredeterminadaId)
            };

            const res = await fetch(url, {
                method: method,
                headers: getAuthHeaders(),
                body: JSON.stringify(objetoUsuario)
            });

            if (res.ok) {
                alert(isEditing ? 'Usuario actualizado' : 'Usuario registrado exitosamente');
                setShowModal(false);
                resetForm();
                cargarUsuarios();
            } else {
                const errorText = await res.text();
                alert('Error: ' + errorText);
            }
        } catch (error) {
            console.error('Error en la operación:', error);
        }
    };

    const handleEditarClick = (usuario) => {
        setIsEditing(true);
        setCurrentId(usuario.id);
        setFormData({
            username: usuario.username,
            password: '',
            rol: usuario.rol,
            nombreCompleto: usuario.nombreCompleto,
            activo: usuario.activo,
            empresasPermitidas: usuario.empresasPermitidas || [],
            empresaPredeterminadaId: usuario.empresaPredeterminadaId || ''
        });
        setShowModal(true);
    };

    const handleEliminar = async (id) => {
        if (!window.confirm('¿Estás seguro de eliminar este usuario?')) return;
        try {
            const res = await fetch(`${API_URL}/Usuarios/${id}`, { method: 'DELETE', headers: getAuthHeaders() });
            if (res.ok) {
                alert('Usuario eliminado');
                cargarUsuarios();
            }
        } catch (error) {
            console.error(error);
        }
    };

    const resetForm = () => {
        setFormData({
            username: '', password: '', rol: 'Cajero', nombreCompleto: '', activo: true,
            empresasPermitidas: [], empresaPredeterminadaId: ''
        });
        setIsEditing(false);
        setCurrentId(null);
    };

    const handleCheckboxEmpresa = (empresaId) => {
        const id = Number(empresaId);
        setFormData(prev => {
            const permitidas = prev.empresasPermitidas.includes(id)
                ? prev.empresasPermitidas.filter(e => e !== id)
                : [...prev.empresasPermitidas, id];

            let predeterminada = prev.empresaPredeterminadaId;
            if (predeterminada === id && !permitidas.includes(id)) {
                predeterminada = permitidas.length > 0 ? permitidas[0] : '';
            }
            if (permitidas.length === 1) {
                predeterminada = permitidas[0];
            }

            return { ...prev, empresasPermitidas: permitidas, empresaPredeterminadaId: predeterminada };
        });
    };

    return (
        <div className="modulo-container">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                <h2>Gestión de Usuarios y Accesos</h2>
                <button className="btn-primary" onClick={() => { resetForm(); setShowModal(true); }}>
                    + Nuevo Usuario
                </button>
            </div>

            {loading ? <p>Cargando personal...</p> : (
                <table className="tabla-usuarios">
                    <thead>
                        <tr>
                            <th>Usuario</th>
                            <th>Nombre Completo</th>
                            <th>Rol / Permisos</th>
                            <th>Empresas</th>
                            <th>Estado</th>
                            <th>Acciones</th>
                        </tr>
                    </thead>
                    <tbody>
                        {usuarios.map(u => (
                            <tr key={u.id}>
                                <td><strong>{u.username}</strong></td>
                                <td>{u.nombreCompleto}</td>
                                <td>
                                    <span className={`badge ${u.rol === 'AdministradorSistema' ? 'badge-primary' : 'badge-secondary'}`}>
                                        {u.rol}
                                    </span>
                                </td>
                                <td>{(u.empresasPermitidas || []).length}</td>
                                <td>{u.activo ? 'Activo' : 'Inactivo'}</td>
                                <td>
                                    <button className="btn-sm btn-warning" onClick={() => handleEditarClick(u)} style={{ marginRight: '5px' }}>Editar</button>
                                    <button className="btn-sm btn-danger" onClick={() => handleEliminar(u.id)}>Eliminar</button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            )}

            {showModal && (
                <div className="modal-overlay" style={{ display: 'flex', zIndex: 1000, position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' }}>
                    <div className="modulo-container" style={{ width: '600px', maxHeight: '90vh', overflowY: 'auto', background: '#fff', padding: '20px', borderRadius: '8px' }}>
                        <h3>{isEditing ? 'Editar Usuario' : 'Registrar Nuevo Usuario'}</h3>
                        <form onSubmit={handleGuardar}>

                            <h4 style={{ borderBottom: '1px solid #eee', paddingBottom: '5px', marginTop: '15px' }}>1. Datos del Usuario</h4>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                                <div className="form-group">
                                    <label>Nombre Real:</label>
                                    <input type="text" required value={formData.nombreCompleto} onChange={e => setFormData({ ...formData, nombreCompleto: e.target.value })} placeholder="Ej. Juan Perez" className="search-input" />
                                </div>
                                <div className="form-group">
                                    <label>Nombre de Usuario (Login):</label>
                                    <input type="text" required disabled={isEditing} value={formData.username} onChange={e => setFormData({ ...formData, username: e.target.value })} placeholder="jperez" className="search-input" />
                                </div>
                                <div className="form-group">
                                    <label>Contraseña {isEditing && <small>(Opcional)</small>}:</label>
                                    <input type="password" required={!isEditing} value={formData.password} onChange={e => setFormData({ ...formData, password: e.target.value })} placeholder={isEditing ? "Dejar en blanco para mantener" : ""} className="search-input" />
                                </div>
                                <div className="form-group">
                                    <label>Rol de Sistema:</label>
                                    <select value={formData.rol} onChange={e => setFormData({ ...formData, rol: e.target.value })} className="search-input">
                                        <option value="Cajero">Cajero (Solo Ventas)</option>
                                        <option value="Analista">Analista (Consultas)</option>
                                        <option value="Comprador">Comprador</option>
                                        <option value="Administrador">Administrador (Inventario y Reportes)</option>
                                        <option value="AdministradorSistema">Admin. Sistema (Control Total)</option>
                                    </select>
                                </div>
                            </div>

                            <h4 style={{ borderBottom: '1px solid #eee', paddingBottom: '5px', marginTop: '20px', color: '#2563eb' }}>
                                2. Acceso Multi-Empresa
                            </h4>

                            <div className="form-group" style={{ background: '#f8fafc', padding: '10px', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
                                <label style={{ fontWeight: 'bold', marginBottom: '10px', display: 'block' }}>Seleccione las empresas permitidas:</label>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', maxHeight: '150px', overflowY: 'auto' }}>
                                    {empresas.map(emp => (
                                        <label key={emp.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.9rem', cursor: 'pointer' }}>
                                            <input
                                                type="checkbox"
                                                checked={formData.empresasPermitidas.includes(emp.id)}
                                                onChange={() => handleCheckboxEmpresa(emp.id)}
                                            />
                                            {emp.razonSocial || emp.nombre}
                                        </label>
                                    ))}
                                </div>
                            </div>

                            <div className="form-group" style={{ marginTop: '10px' }}>
                                <label style={{ fontWeight: 'bold', color: '#b45309' }}>Empresa Predeterminada (Por Defecto):</label>
                                <select
                                    required
                                    value={formData.empresaPredeterminadaId}
                                    onChange={e => setFormData({ ...formData, empresaPredeterminadaId: e.target.value })}
                                    className="search-input"
                                    disabled={formData.empresasPermitidas.length === 0}
                                    style={{ border: '1px solid #b45309' }}
                                >
                                    <option value="">Seleccione la empresa principal...</option>
                                    {empresas.filter(emp => formData.empresasPermitidas.includes(emp.id)).map(emp => (
                                        <option key={emp.id} value={emp.id}>
                                            {emp.razonSocial || emp.nombre}
                                        </option>
                                    ))}
                                </select>
                                <small style={{ color: '#64748b' }}>Esta empresa se cargará automáticamente al iniciar sesión.</small>
                            </div>

                            {isEditing && (
                                <div className="form-group" style={{ marginTop: '15px' }}>
                                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 'bold' }}>
                                        <input type="checkbox" checked={formData.activo} onChange={e => setFormData({ ...formData, activo: e.target.checked })} />
                                        Usuario Activo en el Sistema
                                    </label>
                                </div>
                            )}

                            <div style={{ marginTop: '25px', display: 'flex', gap: '10px' }}>
                                <button type="button" onClick={() => setShowModal(false)} className="btn-secondary" style={{ flex: 1, padding: '10px' }}>Cancelar</button>
                                <button type="submit" className="btn-primary" style={{ flex: 2, padding: '10px' }}>
                                    {isEditing ? 'Guardar Cambios' : 'Registrar Usuario'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Usuarios;
