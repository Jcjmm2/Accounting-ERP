// Tyted.Frontend/src/components/ProveedorList.jsx (¡CREAR O MODIFICAR ESTE ARCHIVO!)

// Tyted.Frontend/src/components/ProveedorList.jsx

import React, { useState, useEffect } from 'react';
import axios from 'axios';
import BusquedaProveedores from './BusquedaProveedores';
import ListaProveedores from './ListaProveedores';

// Este componente recibe API_URL, onEdit, y onNew desde App.jsx
const ProveedorList = ({ API_URL, onEdit, onNew }) => {
    // Estado para guardar la lista de proveedores
    const [proveedores, setProveedores] = useState([]);
    const [loading, setLoading] = useState(true);

    // =========================================================================
    // FUNCIÓN CENTRAL: OBTENER PROVEEDORES CON FILTROS
    // =========================================================================
    const fetchProveedores = async (filters = {}) => {
        setLoading(true);
        const params = new URLSearchParams(); 

        // 1. Añadir Razón Social
        if (filters.razonsocial) {
            params.append('razonsocial', filters.razonsocial); 
        }

        // 2. Añadir RIF
        if (filters.rif) {
            params.append('rif', filters.rif); 
        }

        const url = `${API_URL}/Proveedores?${params.toString()}`;
        
        // CORRECCIÓN: Línea de diagnóstico de la URL
        console.log("URL de la API construida:", url); 

        try {
            const response = await axios.get(url);
            setProveedores(response.data);
        } catch (error) {
            console.error("Error al obtener proveedores:", error);
            setProveedores([]);
        } finally {
            setLoading(false);
        }
    };

    // Handler que se pasa al componente BusquedaProveedores
    const handleSearch = (filters) => {
        // CORRECCIÓN: Línea de diagnóstico de los filtros recibidos
        console.log("Filtros recibidos al buscar:", filters); 
        
        // Cuando se presiona "Ejecutar Búsqueda", se llama a fetchProveedores con los nuevos filtros
        fetchProveedores(filters);
    };

    // Carga inicial de datos al montar el componente (sin filtros)
    useEffect(() => {
        fetchProveedores();
    }, []);

    // Placeholder para la eliminación (deberías implementarla)
    const handleDelete = async (id) => {
        if (window.confirm(`¿Está seguro de eliminar el proveedor con Código ${id}?`)) {
            try {
                await axios.delete(`${API_URL}/Proveedores/${id}`);
                // Recargar la lista después de eliminar
                fetchProveedores();
            } catch (error) {
                console.error("Error al eliminar proveedor:", error);
            }
        }
    };
    
    return (
        <div className="gestion-proveedores">
            <h2>Gestión de Proveedores</h2>
            
            {/* 1. Componente de Búsqueda */}
            <BusquedaProveedores 
                onSearch={handleSearch} 
                onNew={onNew} 
            />

            {/* 2. Lista de Resultados */}
            {loading ? (
                <p>Cargando proveedores...</p>
            ) : proveedores.length === 0 ? (
                <p>No se encontraron proveedores.</p>
            ) : (
                <ListaProveedores 
                    proveedores={proveedores} 
                    onEdit={onEdit} 
                    onDelete={handleDelete}
                    onNew={onNew} 
                />
            )}
        </div>
    );
};

export default ProveedorList;