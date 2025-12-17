import React, { useState, useEffect } from 'react';

// Este componente recibe la función onSearch y la función onNew desde PanelGestionProductos
function BusquedaProductos({ onSearch, onNew }) {
    
    // Estado local para capturar los filtros (Código y Descripción)
    const [filters, setFilters] = useState({
        codigo: '',
        descripcion: ''
    });

    // Handler para actualizar el estado cuando el usuario escribe
    const handleInputChange = (e) => {
        const { name, value } = e.target;
        setFilters(prevFilters => ({
            ...prevFilters,
            [name]: value
        }));
    };

    // Handler que se dispara al hacer clic en "Ejecutar Búsqueda"
    const handleSearchClick = () => {
        // Llama a la función onSearch pasada desde el componente padre
        onSearch(filters); 
    };

    // Búsqueda manual: la ejecución sólo ocurre cuando el usuario presiona
    // el botón "Ejecutar Búsqueda" que llama a `handleSearchClick`.

    return (
        // Uso de clases de Bootstrap para estilos de contenedor y espaciado (card, mb-4, p-3)
        <div className="card mb-4 p-3">
            <h4 className="card-title">Panel de Consulta de Artículos</h4>
            <div className="d-flex align-items-end gap-3"> {/* d-flex, align-items-end, gap-3 de Bootstrap */}
                
                {/* Campo Descripción */}
                <div className="form-group flex-grow-1">
                    {/* CORRECCIÓN 1: Anidación del input dentro del label para accesibilidad */}
                    <label>
                        Descripción:
                        <input 
                            type="text"
                            id="descripcion"
                            name="descripcion" 
                            value={filters.descripcion}
                            onChange={handleInputChange}
                            className="form-control" // Clase Bootstrap para input
                            // style={{ width: '300px' }} // Se puede manejar con clases de columna si es necesario
                        />
                    </label>
                </div>

                {/* Campo Código */}
                <div className="form-group">
                    {/* CORRECCIÓN 2: Anidación del input dentro del label para accesibilidad */}
                    <label>
                        Código:
                        <input 
                            type="text"
                            id="codigo"
                            name="codigo" 
                            value={filters.codigo}
                            onChange={handleInputChange}
                            className="form-control" // Clase Bootstrap para input
                            style={{ width: '150px' }} // Mantener estilo de ancho si es fijo
                        />
                    </label>
                </div>
                
                {/* Botón de Búsqueda */}
                <button 
                    type="button" // Es importante para evitar el envío de formularios si estuviera anidado
                    className="btn btn-primary" 
                    onClick={handleSearchClick}
                >
                    Ejecutar Búsqueda
                </button>
                
                {/* Botón de Crear Nuevo Artículo */}
                <button 
                    type="button"
                    className="btn btn-success" 
                    onClick={onNew}
                >
                    Crear Nuevo Artículo
                </button>
            </div>
        </div>
    );
}

export default BusquedaProductos;