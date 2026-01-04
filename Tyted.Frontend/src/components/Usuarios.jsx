import React, { useState, useEffect, useContext } from 'react';
import { ConfigContext } from '../Context/ConfigContext';

const Usuarios = () => {
    const { API_URL } = useContext(ConfigContext);
    const [usuarios, setUsuarios] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    
    // Estado para el formulario de registro (según tu UsuariosController.cs)
    const [formData, setFormData] = useState({
        username: '',
        password: '', // Se envía como parámetro 'password' al endpoint /registrar
        rol: 'Cajero',
        nombreCompleto: '',
        activo: true
    });

    useEffect(() => {
        cargarUsuarios();
    }, []);

    const cargarUsuarios = async () => {
        try {
            setLoading(true);
            // Nota: Asegúrate de tener un GET /api/Usuarios en tu backend para listar
            const res = await fetch(`${API_URL}/Usuarios`);
            if (res.ok) {
                const data = await res.json();
                setUsuarios(data);
            }
        } catch (error) {
            console.error("Error al cargar usuarios:", error);
        } finally {
            setLoading(false);
        }
    };

    const handleRegistrar = async (e) => {
        e.preventDefault();
        try {
            // INTEGRACIÓN: Tu controlador recibe el objeto 'usuario' y un string 'password'
            // El endpoint es: /api/Usuarios/registrar?password=...
            const url = `${API_URL}/Usuarios/registrar?password=${encodeURIComponent(formData.password)}`;
            
            const objetoUsuario = {
                username: formData.username,
                rol: formData.rol,
                nombreCompleto: formData.nombreCompleto,
                activo: formData.activo
            };

            const res = await fetch(url, {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    // Si activaste el [Authorize], aquí deberías enviar el token:
                    // 'Authorization': `Bearer ${localStorage.getItem('token')}`
                },
                body: JSON.stringify(objetoUsuario)
            });

            if (res.ok) {
                alert("Usuario registrado exitosamente");
                setShowModal(false);
                resetForm();
                cargarUsuarios();
            } else {
                const errorText = await res.text();
                alert("Error: " + errorText);
            }
        } catch (error) {
            console.error("Error en el registro:", error);
        }
    };

    const resetForm = () => {
        setFormData({ username: '', password: '', rol: 'Cajero', nombreCompleto: '', activo: true });
    };

    return (
        <div className="modulo-container">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                <h2>👥 Gestión de Usuarios y Accesos</h2>
                <button className="btn-primary" onClick={() => setShowModal(true)}>
                    + Nuevo Usuario
                </button>
            </div>

            {loading ? <p>Cargando personal...</p> : (
                <table>
                    <thead>
                        <tr>
                            <th>Usuario</th>
                            <th>Nombre Completo</th>
                            <th>Rol / Permisos</th>
                            <th>Estado</th>
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
                            </tr>
                        ))}
                    </tbody>
                </table>
            )}

            {/* Modal de Registro */}
            {showModal && (
                <div className="modal-overlay">
                    <div className="modulo-container" style={{ width: '450px' }}>
                        <h3>Registrar Nuevo Usuario</h3>
                        <form onSubmit={handleRegistrar}>
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
                                    value={formData.username}
                                    onChange={e => setFormData({...formData, username: e.target.value})}
                                    placeholder="jperez"
                                />
                            </div>
                            <div className="form-group">
                                <label>Contraseña:</label>
                                <input 
                                    type="password" 
                                    required 
                                    value={formData.password}
                                    onChange={e => setFormData({...formData, password: e.target.value})}
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
                            
                            <div style={{ marginTop: '20px', display: 'flex', gap: '10px' }}>
                                <button type="submit" className="btn-primary" style={{ flex: 1 }}>Guardar Usuario</button>
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