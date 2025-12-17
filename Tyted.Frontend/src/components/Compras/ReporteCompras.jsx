import React from 'react';

const ReporteCompras = ({ API_URL }) => {
    
    // NOTA: API_URL se recibe como prop, aunque no se usa en el placeholder.

    return (
        <div className="container mt-4">
            <h3 className="mb-4">📊 Generar Reporte de Compras</h3>
            
            <div className="alert alert-warning">
                Esta sección está en desarrollo. Aquí se implementará la lógica para filtrar y generar reportes analíticos de compras (por proveedor, por período, por artículo, etc.).
            </div>

            {/* Placeholder para la interfaz de filtros */}
            <div className="card p-4 shadow-sm">
                <h5>Filtros de Reporte</h5>
                <p>Próximamente: Campos para definir rango de fechas, proveedor, estado (Anulada/Activa) y botón de exportar/generar.</p>
                <button className="btn btn-secondary mt-3" disabled>Generar Reporte (Deshabilitado)</button>
            </div>
        </div>
    );
};

export default ReporteCompras;