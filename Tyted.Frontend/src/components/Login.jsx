import React, { useState, useContext } from 'react';
import { ConfigContext } from '../Context/ConfigContext';

const Login = () => {
    const { API_URL, login } = useContext(ConfigContext);
    const [credenciales, setCredenciales] = useState({ username: '', password: '' });
    const [error, setError] = useState(null);
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        try {
            const res = await fetch(`${API_URL}/Usuarios/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(credenciales)
            });

            if (res.ok) {
                const data = await res.json();
                // data trae: { token: "...", usuario: "admin", rol: "Administrador" }
                login(data); // Esto actualiza el Contexto y redirige a App
            } else {
                const textoError = await res.text();
                setError(textoError || "Credenciales incorrectas");
            }
        } catch (err) {
            setError("Error de conexión con el servidor");
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div style={{ 
            height: '100vh', 
            display: 'flex', 
            justifyContent: 'center', 
            alignItems: 'center', 
            background: '#1e293b' 
        }}>
            <div style={{ 
                background: 'white', 
                padding: '40px', 
                borderRadius: '12px', 
                width: '350px', 
                boxShadow: '0 4px 20px rgba(0,0,0,0.5)' 
            }}>
                <h2 style={{ textAlign: 'center', color: '#2563eb', marginBottom: '20px' }}>Bienvenido</h2>
                
                {error && (
                    <div style={{ 
                        background: '#fee2e2', color: '#b91c1c', 
                        padding: '10px', borderRadius: '6px', marginBottom: '15px', fontSize: '0.9rem' 
                    }}>
                        ⚠️ {error}
                    </div>
                )}

                <form onSubmit={handleSubmit}>
                    <div style={{ marginBottom: '15px' }}>
                        <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>Usuario</label>
                        <input 
                            type="text" 
                            required
                            value={credenciales.username}
                            onChange={e => setCredenciales({...credenciales, username: e.target.value})}
                            style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #ccc' }}
                        />
                    </div>
                    <div style={{ marginBottom: '20px' }}>
                        <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>Contraseña</label>
                        <input 
                            type="password" 
                            required
                            value={credenciales.password}
                            onChange={e => setCredenciales({...credenciales, password: e.target.value})}
                            style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #ccc' }}
                        />
                    </div>
                    <button 
                        type="submit" 
                        disabled={loading}
                        className="btn-primary" 
                        style={{ width: '100%', padding: '12px', fontSize: '1rem' }}
                    >
                        {loading ? 'Ingresando...' : 'Iniciar Sesión'}
                    </button>
                </form>
            </div>
        </div>
    );
};

export default Login;