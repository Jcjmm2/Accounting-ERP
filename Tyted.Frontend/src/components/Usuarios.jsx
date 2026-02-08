import React, { useState, useEffect, useContext } from 'react';
import { ConfigContext } from '../Context/ConfigContext';

const Usuarios = () => {
    const { API_URL } = useContext(ConfigContext);
    const [usuarios, setUsuarios] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    
    // Estado para saber si estamos editando o creando
    const [isEditing, setIsEditing] = useState(false);
    const [currentId, setCurrentId] = useState(null);

    const [formData, setFormData] = useState({
        username: '',
        password: '',
        rol: 'Cajero',
        nombreCompleto: '',
        activo: true
    });

    // Helper para obtener headers con Token
    const getAuthHeaders = () => {
        const token = localStorage.getItem('token');
        return {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        };
    };

    useEffect(() => {
        cargarUsuarios();
    }, []);

    const cargarUsuarios = async () => {
        try {
            setLoading(true);
            const res = await fetch(`${API_URL}/Usuarios`, {
                headers: getAuthHeaders() // Enviamos token
            });
            
            if (res.ok) {
                const data = await res.json();
                setUsuarios(data);
            } else {
                console.error("Error cargando usuarios:", res.status);
            }
        } catch (error) {
            console.error("Error al cargar usuarios:", error);
        } finally {
            setLoading(false);
        }
    };

    const handleGuardar = async (e) => {
        e.preventDefault();
        try {
            let url = `${API_URL}/Usuarios/registrar`;
            let method = 'POST';

            // Si estamos editando, cambiamos URL y Método
            if (isEditing) {
                url = `${API_URL}/Usuarios/${currentId}`;
                method = 'PUT';
            }

            const objetoUsuario = {
                username: formData.username,
                password: formData.password, // En DTO
                rol: formData.rol,
                nombreCompleto: formData.nombreCompleto,
                activo: formData.activo
            };

            const res = await fetch(url, {
                method: method,
                headers: getAuthHeaders(),
                body: JSON.stringify(objetoUsuario)
            });

            if (res.ok) {
                alert(isEditing ? "Usuario actualizado" : "Usuario registrado exitosamente");
                setShowModal(false);
                resetForm();
                cargarUsuarios();
            } else {
                const errorText = await res.text();
                alert("Error: " + errorText);
            }
        } catch (error) {
            console.error("Error en la operación:", error);
        }
    };

    const handleEditarClick = (usuario) => {
        setIsEditing(true);
        setCurrentId(usuario.id); // Asegúrate que tu modelo backend retorna 'id'
        setFormData({
            username: usuario.username,
            password: '', // La contraseña no se carga por seguridad
            rol: usuario.rol,
            nombreCompleto: usuario.nombreCompleto,
            activo: usuario.activo
        });
        setShowModal(true);
    };

    const handleEliminar = async (id) => {
        if(!window.confirm("¿Estás seguro de eliminar este usuario?")) return;

        try {
            const res = await fetch(`${API_URL}/Usuarios/${id}`, {
                method: 'DELETE',
                headers: getAuthHeaders()
            });

            if (res.ok) {
                alert("Usuario eliminado");
                cargarUsuarios();
            } else {
                alert("No se pudo eliminar el usuario.");
            }
        } catch (error) {
            console.error(error);
        }
    };

    const resetForm = () => {
        setFormData({ username: '', password: '', rol: 'Cajero', nombreCompleto: '', activo: true });
        setIsEditing(false);
        setCurrentId(null);
    };

    return (
        <div className="modulo-container">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                <h2>👥 Gestión de Usuarios y Accesos</h2>
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
                                <td>{u.activo ? '🟢 Activo' : '🔴 Inactivo'}</td>
                                <td>
                                    <button 
                                        className="btn-sm btn-warning" 
                                        onClick={() => handleEditarClick(u)}
                                        style={{marginRight: '5px'}}>
                                        ✏️
                                    </button>
                                    <button 
                                        className="btn-sm btn-danger" 
                                        onClick={() => handleEliminar(u.id)}>
                                        🗑️
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            )}

            {/* Modal de Registro / Edición */}
            {showModal && (
                <div className="modal-overlay">
                    <div className="modulo-container" style={{ width: '450px' }}>
                        <h3>{isEditing ? 'Editar Usuario' : 'Registrar Nuevo Usuario'}</h3>
                        <form onSubmit={handleGuardar}>
                            <div className="form-group">
                                <label>Nombre Real:</label>
                                <input 
                                    type="text" 
                                    required 
                                    value={formData.nombreCompleto}
                                    onChange={e => setFormData({...formData, nombreCompleto: e.target.value})}
                                    placeholder="Ej. Juan Pérez"
                                />
                            </div>
                            <div className="form-group">
                                <label>Nombre de Usuario (Login):</label>
                                <input 
                                    type="text" 
                                    required 
                                    disabled={isEditing} // No permitir cambiar username al editar
                                    value={formData.username}
                                    onChange={e => setFormData({...formData, username: e.target.value})}
                                    placeholder="jperez"
                                />
                            </div>
                            <div className="form-group">
                                <label>Contraseña {isEditing && <small>(Opcional)</small>}:</label>
                                <input 
                                    type="password" 
                                    required={!isEditing} // Solo requerida si es NUEVO
                                    value={formData.password}
                                    onChange={e => setFormData({...formData, password: e.target.value})}
                                    placeholder={isEditing ? "Dejar en blanco para mantener actual" : ""}
                                />
                            </div>
                            <div className="form-group">
                                <label>Rol de Sistema:</label>
                                <select 
                                    value={formData.rol} 
                                    onChange={e => setFormData({...formData, rol: e.target.value})}
                                    className="search-input"
                                >
                                    <option value="Cajero">Cajero (Solo Ventas)</option>
                                    <option value="Administrador">Administrador (Inventario y Reportes)</option>
                                    <option value="AdministradorSistema">Admin. Sistema (Control Total)</option>
                                </select>
                            </div>
                            
                            {isEditing && (
                                <div className="form-group" style={{marginTop: '10px'}}>
                                    <label>
                                        <input 
                                            type="checkbox"
                                            checked={formData.activo}
                                            onChange={e => setFormData({...formData, activo: e.target.checked})}
                                        /> Usuario Activo
                                    </label>
                                </div>
                            )}
                            
                            <div style={{ marginTop: '20px', display: 'flex', gap: '10px' }}>
                                <button type="submit" className="btn-primary" style={{ flex: 1 }}>
                                    {isEditing ? 'Actualizar' : 'Guardar Usuario'}
                                </button>
                                <button type="button" onClick={() => setShowModal(false)} className="btn-secondary" style={{ flex: 1 }}>Cancelar</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Usuarios;