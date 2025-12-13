import React, { useState } from 'react';

// Este componente recibe la función onSearch y la función onNew desde App.jsx
function BusquedaProveedores({ onSearch, onNew }) {
    
    // 1. Estado local para capturar los filtros
    const [filters, setFilters] = useState({
        rif: '',
        razonsocial: ''
    });

    // 2. Handler para actualizar el estado cuando el usuario escribe
    const handleInputChange = (e) => {
        const { name, value } = e.target;
        setFilters(prevFilters => ({
            ...prevFilters,
            [name]: value
        }));
    };

    // 3. Handler que se dispara al hacer clic en "Ejecutar Búsqueda"
    const handleSearchClick = () => {
        // CORRECCIÓN/DEPURACIÓN: Muestra el estado actual de los filtros
        console.log("Filtros al hacer click:", filters); 

        // Llama a la función onSearch pasada desde App.jsx
        // Pasamos el objeto 'filters' completo
        onSearch(filters); 
    };

    return (
        <div className="panel-consulta" style={{ border: '1px solid #ccc', padding: '15px', marginBottom: '20px', borderRadius: '4px' }}>
            <h4>Panel de Consulta de Proveedores</h4>
            <div style={{ display: 'flex', gap: '20px', alignItems: 'flex-end' }}>
                
                {/* Campo Razón Social */}
                <div>
                    <label htmlFor="razonsocial">Razón Social:</label>
                    <input 
                        type="text"
                        id="razonsocial"
                        name="razonsocial" // ¡CRUCIAL! Debe coincidir con el estado
                        value={filters.razonsocial}
                        onChange={handleInputChange}
                        style={{ padding: '8px', border: '1px solid #ddd', borderRadius: '4px', width: '250px' }}
                    />
                </div>

                {/* Campo RIF */}
                <div>
                    <label htmlFor="rif">RIF:</label>
                    <input 
                        type="text"
                        id="rif"
                        name="rif" // ¡CRUCIAL! Debe coincidir con el estado
                        value={filters.rif}
                        onChange={handleInputChange}
                        style={{ padding: '8px', border: '1px solid #ddd', borderRadius: '4px', width: '200px' }}
                    />
                </div>
                
                {/* Botón de Búsqueda */}
                <button 
                    className="btn btn-primary" 
                    onClick={handleSearchClick} // Llama a la función que tiene el console.log
                    style={{ padding: '10px 15px', minWidth: '150px' }}
                >
                    Ejecutar Búsqueda
                </button>
                
                {/* Botón de Crear Nuevo Proveedor (Reutiliza onNew) */}
                <button 
                    className="btn btn-success" 
                    onClick={onNew}
                    style={{ padding: '10px 15px', minWidth: '150px' }}
                >
                    Crear Nuevo Proveedor
                </button>
            </div>
        </div>
    );
}

export default BusquedaProveedores;