import React, { useState, useEffect, useContext } from 'react';
import { ConfigContext } from '../Context/ConfigContext';

const Clientes = () => {
    const { API_URL } = useContext(ConfigContext);
    const [clientes, setClientes] = useState([]);
    const [busqueda, setBusqueda] = useState('');
    const [_loading, setLoading] = useState(false);
    const [mostrarModal, setMostrarModal] = useState(false);
    const [editandoId, setEditandoId] = useState(null); // Para saber si creamos o editamos

    const [nuevoCliente, setNuevoCliente] = useState({
        rif: '',
        nombre: '',
        telefono: '',
        direccion: '',
        permitirCredito: false
    });
// --- FUNCIÓN PARA HEADERS CON TOKEN ---
    const getAuthHeaders = (incluirJson = true) => {
        const token = localStorage.getItem('token');
        const headers = {
            'Authorization': `Bearer ${token}`
        };
        if (incluirJson) {
            headers['Content-Type'] = 'application/json';
        }
        return headers;
    };

    // 1. CARGA INICIAL Y BÚSQUEDA
    useEffect(() => {
        const delayDebounce = setTimeout(() => {
            listarClientes();
        }, 300);
        return () => clearTimeout(delayDebounce);
    }, [busqueda]);

    const listarClientes = async () => {
        try {
            setLoading(true);
            // Si no hay búsqueda, podrías tener un endpoint GET /api/Clientes o usar la búsqueda vacía si el back lo permite
            const url = busqueda.length > 0 
                ? `${API_URL}/Clientes/buscar/${busqueda}` 
                : `${API_URL}/Clientes`; // Asegúrate de tener un GET general o usa uno por defecto
            
            const res = await fetch(url, {
                method: 'GET',
                headers: getAuthHeaders(false) 
            });
            if (res.ok) {
                const data = await res.json();
                setClientes(data);
            } else if (res.status === 401) {
                console.error("No autorizado. Redirigir al login si es necesario.");
            }
        } catch (error) {
            console.error("Error:", error);
        } finally {
            setLoading(false);
        }
    };

    // 2. PREPARAR EDICIÓN
    const abrirEdicion = (cliente) => {
        setEditandoId(cliente.id);
        setNuevoCliente({
            rif: cliente.rif,
            nombre: cliente.nombre,
            telefono: cliente.telefono || '',
            direccion: cliente.direccion || '',
            permitirCredito: cliente.permitirCredito || false
        });
        setMostrarModal(true);
    };

    const cerrarModal = () => {
        setMostrarModal(false);
        setEditandoId(null);
        setNuevoCliente({ rif: '', nombre: '', telefono: '', direccion: '', permitirCredito: false });
    };

    // 3. GUARDAR (CREAR O EDITAR)
    const handleGuardar = async (e) => {
        e.preventDefault();
    
        // VERIFICACIÓN CRÍTICA:
        if (editandoId === null) {
            console.log("Creando nuevo...");
        } else {
            console.log("Editando ID:", editandoId);
        }

        const metodo = editandoId ? 'PUT' : 'POST';
        // Si editandoId existe, la URL debe ser .../api/Clientes/5
        const url = editandoId ? `${API_URL}/Clientes/${editandoId}` : `${API_URL}/Clientes`;

        try {
            const res = await fetch(url, {
                method: metodo,
                headers: getAuthHeaders(true),
                body: JSON.stringify({ 
                    ...nuevoCliente, 
                    id: editandoId || 0 // El ID debe ir dentro del cuerpo también
                })
            });

            if (res.ok) {
                alert("✅ Operación exitosa");
                cerrarModal();
                listarClientes();
            } else {
                const errorTexto = await res.text();
                alert("❌ Error del servidor: " + errorTexto);
            }
        } catch (error) {
            console.error("Error de red:", error);
            alert("❌ Error de conexión con el servidor.");
        }
    };
    const eliminarCliente = async (id) => {
    // 1. Confirmación de seguridad
    if (!window.confirm("¿Estás seguro de eliminar este cliente? Esta acción no se puede deshacer.")) return;

    try {
        const res = await fetch(`${API_URL}/Clientes/${id}`, {
            method: 'DELETE',
            headers: getAuthHeaders(false)
        });

        if (res.ok) {
            alert("✅ Cliente eliminado correctamente");
            listarClientes(); // Refresca la lista automáticamente
        } else {
            const errorMsg = await res.text();
            alert("❌ Error al eliminar: " + (errorMsg || "No se pudo completar la acción"));
        }
    } catch (error) {
        console.error("Error de red:", error);
        alert("❌ Error de conexión al intentar eliminar");
    }
};

    return (
        <div className="modulo-container">
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h2 className="text-2xl font-bold text-slate-800">Gestión de Clientes</h2>
                    <p className="text-slate-500 text-sm">Administra la base de datos y permisos de crédito</p>
                </div>
                <button 
                    onClick={() => setMostrarModal(true)}
                    className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg font-bold shadow-lg transition-all"
                >
                    + NUEVO CLIENTE
                </button>
            </div>

            <div className="mb-6">
                <input 
                    type="text"
                    placeholder="Buscar por nombre o RIF..."
                    className="w-full p-3 border rounded-xl shadow-sm focus:ring-2 focus:ring-blue-500 outline-none"
                    value={busqueda}
                    onChange={(e) => setBusqueda(e.target.value)}
                />
            </div>

            <div className="overflow-x-auto bg-white rounded-xl border">
                <table className="w-full text-left border-collapse">
                    <thead>
                        <tr className="bg-slate-50 border-b">
                            <th className="p-4 font-bold text-slate-600">RIF / CI</th>
                            <th className="p-4 font-bold text-slate-600">Nombre / Razón Social</th>
                            <th className="p-4 font-bold text-slate-600">Teléfono</th>
                            <th className="p-4 font-bold text-slate-600">Crédito</th>
                            <th className="p-4 font-bold text-slate-600 text-center">Acciones</th>
                        </tr>
                    </thead>
                    <tbody>
                        {clientes.map(c => (
                            <tr key={c.id} className="border-b hover:bg-slate-50 transition-colors">
                                <td className="p-4 font-mono text-sm">{c.rif}</td>
                                <td className="p-4 font-bold text-slate-700">{c.nombre}</td>
                                <td className="p-4 text-slate-600">{c.telefono || 'N/A'}</td>
                                <td className="p-4 text-center">
                                    <span className={`px-3 py-1 rounded-full text-[10px] font-black ${c.permitirCredito ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-400'}`}>
                                        {c.permitirCredito ? '✅ APTO' : '❌ NO'}
                                    </span>
                                </td>
                                <td className="p-4 text-center">
                                    <button 
                                        onClick={() => abrirEdicion(c)}
                                        className="text-blue-600 hover:text-blue-800 font-bold text-sm bg-blue-50 px-3 py-1 rounded"
                                    >
                                        EDITAR
                                    </button>
                                </td>
                                <td className="p-4 text-center">
                                 <div className="flex gap-2 justify-center">
                                 <button 
                                    onClick={() => abrirEdicion(c)}
                                    className="text-blue-600 hover:text-blue-800 font-bold text-xs bg-blue-50 px-3 py-1.5 rounded transition-colors"
                                      >
                                          EDITAR
                                      </button>
                                      <button 
                                          onClick={() => eliminarCliente(c.id)}
                                          className="text-red-600 hover:text-red-800 font-bold text-xs bg-red-50 px-3 py-1.5 rounded transition-colors"
                                      >
                                          ELIMINAR
                                      </button>
                                  </div>
                              </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* MODAL ÚNICO PARA CREAR/EDITAR */}
            {mostrarModal && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[1000] p-4">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
                        <div className={`${editandoId ? 'bg-orange-500' : 'bg-blue-600'} p-4 text-white`}>
                            <h3 className="text-lg font-bold text-center">
                                {editandoId ? 'MODIFICAR CLIENTE' : 'REGISTRAR NUEVO CLIENTE'}
                            </h3>
                        </div>
                        
                        <form onSubmit={handleGuardar} className="p-6 space-y-4">
                            <div>
                                <label className="text-[10px] font-black text-slate-500 uppercase">RIF / CI</label>
                                <input required type="text" className="w-full p-2 border rounded-lg"
                                    disabled={editandoId} // Normalmente el RIF no se edita por integridad
                                    value={nuevoCliente.rif}
                                    onChange={e => setNuevoCliente({...nuevoCliente, rif: e.target.value.toUpperCase()})}/>
                            </div>
                            
                            <div>
                                <label className="text-[10px] font-black text-slate-500 uppercase">Nombre</label>
                                <input required type="text" className="w-full p-2 border rounded-lg"
                                    value={nuevoCliente.nombre}
                                    onChange={e => setNuevoCliente({...nuevoCliente, nombre: e.target.value.toUpperCase()})}/>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-[10px] font-black text-slate-500 uppercase">Teléfono</label>
                                    <input type="text" className="w-full p-2 border rounded-lg"
                                        value={nuevoCliente.telefono}
                                        onChange={e => setNuevoCliente({...nuevoCliente, telefono: e.target.value})}/>
                                </div>
                                <div className="flex items-end pb-2">
                                    <label className="flex items-center gap-2 cursor-pointer">
                                        <input type="checkbox" className="w-4 h-4"
                                            checked={nuevoCliente.permitirCredito}
                                            onChange={e => setNuevoCliente({...nuevoCliente, permitirCredito: e.target.checked})}/>
                                        <span className="text-sm font-bold text-slate-700">Apto Crédito</span>
                                    </label>
                                </div>
                            </div>

                            <div>
                                <label className="text-[10px] font-black text-slate-500 uppercase">Dirección</label>
                                <textarea className="w-full p-2 border rounded-lg h-20"
                                    value={nuevoCliente.direccion}
                                    onChange={e => setNuevoCliente({...nuevoCliente, direccion: e.target.value})}/>
                            </div>

                            <div className="flex gap-3 pt-2">
                                <button type="button" onClick={cerrarModal} 
                                    className="flex-1 py-3 bg-slate-100 text-slate-600 rounded-xl font-bold">CANCELAR</button>
                                <button type="submit" 
                                    className={`flex-1 py-3 text-white rounded-xl font-bold shadow-lg ${editandoId ? 'bg-orange-500' : 'bg-blue-600'}`}>
                                    {editandoId ? 'ACTUALIZAR' : 'GUARDAR'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Clientes;