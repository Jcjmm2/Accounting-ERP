// src/Context/ConfigContext.jsx
import React, { createContext, useState, useEffect } from 'react';

export const ConfigContext = createContext();

export const ConfigProvider = ({ children }) => {
    // Leemos la URL desde el archivo .env y usamos localhost como base local por defecto.
    const [API_URL] = useState(import.meta.env.VITE_API_URL || "http://localhost:5077/api");
    const [tasa, setTasa] = useState(0);
    const [user, setUser] = useState(null);

    // Efecto para cargar la tasa automáticamente al abrir la App
    useEffect(() => {
        const tokenGuardado = localStorage.getItem('token');
        const usuarioGuardado = localStorage.getItem('usuario');
        const rolGuardado = localStorage.getItem('rol');

        if (tokenGuardado && usuarioGuardado) {
            setUser({
                username: usuarioGuardado,
                token: tokenGuardado,
                rol: rolGuardado
            });
        }
    }, []);

    // 2. Función para Iniciar Sesión
    const login = (userData) => {
        // userData debe venir del backend: { token, usuario, rol }
        localStorage.setItem('token', userData.token);
        localStorage.setItem('usuario', userData.usuario);
        localStorage.setItem('rol', userData.rol);
        
        setUser({
            username: userData.usuario,
            token: userData.token,
            rol: userData.rol
        });
    };

    // 3. Función para Cerrar Sesión
    const logout = () => {
        localStorage.removeItem('token');
        localStorage.removeItem('usuario');
        localStorage.removeItem('rol');
        setUser(null);
    };
    // 4. Cargar Tasa (existente)
    useEffect(() => {
        const cargarTasaActual = async () => {
            try {
                const res = await fetch(`${API_URL}/TasaDeCambio/ultima`);
                if (res.ok) {
                    const data = await res.json();
                    setTasa(data.valor);
                }
            } catch (error) {
                console.error("No se pudo conectar con el servidor para obtener la tasa.");
            }
        };
        cargarTasaActual();
    }, [API_URL]);

    return (
        <ConfigContext.Provider value={{ API_URL, tasa, setTasa, user, login, logout }}>
            {children}
        </ConfigContext.Provider>
    );
};