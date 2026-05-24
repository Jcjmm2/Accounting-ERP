import React, { useState } from 'react';
import { ConfigContext } from '../Context/ConfigContext';

const ModalCliente = ({ isOpen, onClose, onSelectCliente, API_URL }) => {
    const [tab, setTab] = useState('buscar'); // 'buscar' o 'nuevo'
    const [busqueda, setBusqueda] = useState('');
    const [resultados, setResultados] = useState([]);
    const [nuevoCliente, setNuevoCliente] = useState({
        rif: '', nombre: '', telefono: '', direccion: '', permitirCredito: false
    });

    const getAuthHeaders = () => ({
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem("token")}`
    });

    if (!isOpen) return null;

    const buscarCliente = async (valor) => {
        setBusqueda(valor);
        if (valor.length < 3) return;
        try {
            const res = await fetch(`${API_URL}/Clientes/buscar/${valor}`, {
                method: 'GET',
                headers: getAuthHeaders()
            });
                if (res.ok) {
                const data = await res.json();
                setResultados(data);
            }
        } catch (error) { console.error("Error al buscar cliente:", error); }
    };

    const guardarNuevo = async (e) => {
        e.preventDefault();
        try {
            const res = await fetch(`${API_URL}/Clientes`, {
                method: 'POST',
                headers: getAutohHeaders(),
                body: JSON.stringify(nuevoCliente)
            });
            if (res.ok) {
                const creado = await res.json();
                onSelectCliente(creado);
                onClose();
            } else {
                alert("Error al crear cliente (el RIF podría estar duplicado)");
            }
        } catch (error) { console.error(error); }
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl w-full max-w-md overflow-hidden shadow-2xl">
                {/* Tabs */}
                <div className="flex border-b">
                    <button 
                        className={`flex-1 p-4 font-bold ${tab === 'buscar' ? 'border-b-4 border-blue-600 text-blue-600' : 'bg-gray-50'}`}
                        onClick={() => setTab('buscar')}
                    >
                        BUSCAR
                    </button>
                    <button 
                        className={`flex-1 p-4 font-bold ${tab === 'nuevo' ? 'border-b-4 border-blue-600 text-blue-600' : 'bg-gray-50'}`}
                        onClick={() => setTab('nuevo')}
                    >
                        + NUEVO
                    </button>
                </div>

                <div className="p-6">
                    {tab === 'buscar' ? (
                        <div className="space-y-4">
                            <input 
                                type="text"
                                placeholder="Escribe RIF o Nombre..."
                                className="w-full p-3 border rounded-xl outline-none focus:ring-2 focus:ring-blue-400"
                                value={busqueda}
                                onChange={(e) => buscarCliente(e.target.value)}
                                autoFocus
                            />
                            <div className="max-h-60 overflow-y-auto space-y-2">
                                {resultados.map(c => (
                                    <button 
                                        key={c.id}
                                        onClick={() => { onSelectCliente(c); onClose(); }}
                                        className="w-full text-left p-3 hover:bg-blue-50 border rounded-lg transition"
                                    >
                                        <div className="font-bold">{c.nombre}</div>
                                        <div className="text-xs text-gray-500">{c.rif}</div>
                                    </button>
                                ))}
                            </div>
                        </div>
                    ) : (
                        <form onSubmit={guardarNuevo} className="space-y-3">
                            <input required placeholder="RIF (Ej: V12345678)" className="w-full p-2 border rounded-lg" 
                                onChange={e => setNuevoCliente({...nuevoCliente, rif: e.target.value})}/>
                            <input required placeholder="Nombre o Razón Social" className="w-full p-2 border rounded-lg" 
                                onChange={e => setNuevoCliente({...nuevoCliente, nombre: e.target.value})}/>
                            <input placeholder="Teléfono" className="w-full p-2 border rounded-lg" 
                                onChange={e => setNuevoCliente({...nuevoCliente, telefono: e.target.value})}/>
                            <textarea placeholder="Dirección" className="w-full p-2 border rounded-lg" 
                                onChange={e => setNuevoCliente({...nuevoCliente, direccion: e.target.value})}/>
                            
                            <button type="submit" className="w-full bg-blue-600 text-white py-3 rounded-xl font-bold shadow-lg">
                                GUARDAR Y SELECCIONAR
                            </button>
                        </form>
                    )}
                </div>
                <button onClick={onClose} className="w-full p-4 text-gray-400 hover:text-gray-600 text-sm">CANCELAR</button>
            </div>
        </div>
    );
};

export default ModalCliente;