// src/Context/ConfigContext.jsx
import React, { createContext, useState, useEffect } from 'react';

export const ConfigContext = createContext();

export const ConfigProvider = ({ children }) => {
    const [API_URL] = useState("http://localhost:5077/api");
    const [tasa, setTasa] = useState(0);

    // Efecto para cargar la tasa automáticamente al abrir la App
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
        <ConfigContext.Provider value={{ API_URL, tasa, setTasa }}>
            {children}
        </ConfigContext.Provider>
    );
};