import React, { useState } from 'react';
import axios from 'axios';

const API_URL = import.meta.env.VITE_API_BASE_URL;

// Estado inicial en camelCase para coincidir con el JSON de la API
const initialFormState = {
    razonsocial: '',
    rif: '',
    personaISLR: false, // Inicializado como booleano
    telefono: '',
    direccion: '',
    cuentaasociadaconta: '',
    contacto: '',
    email: ''
};

const ProveedorForm = ({ proveedorToEdit, onSave, onCancel }) => {
    
    // Inicialización del estado: si editando, usa los datos existentes; si no, el estado inicial vacío.
    const [formData, setFormData] = useState(proveedorToEdit || initialFormState);
    
    // VARIABLE CLAVE: Determina si estamos editando
    const isEditMode = !!proveedorToEdit; 
    
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [message, setMessage] = useState('');

    const title = isEditMode ? `Editar Proveedor #${proveedorToEdit.codigoProv}` : 'Crear Nuevo Proveedor';


    const handleChange = (e) => {
        const { name, value, type, checked } = e.target;
        
        // Si es un checkbox, usa el valor 'checked' (booleano); si no, usa el 'value'
        const finalValue = type === 'checkbox' ? checked : value;
        
        setFormData({
            ...formData,
            [name]: finalValue
        });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setIsSubmitting(true);
        setMessage('');

        try {
            let response;
            
            // 1. Prepara los datos a enviar (en camelCase, como está el estado)
            const dataToSend = Object.fromEntries(
                Object.entries(formData).filter(([_, value]) => value !== null && value !== '')
            );

            if (isEditMode) {
                const id = proveedorToEdit.codigoProv;
                
                // 2. Prepara el objeto para el Backend (usando PascalCase para los nombres de las columnas C#)
                const dataForBackend = {
                    CodigoProv: id, // ID es necesario para el PUT
                    Razonsocial: dataToSend.razonsocial,
                    RIF: dataToSend.rif,
                    PersonaISLR: dataToSend.personaISLR,
                    Telefono: dataToSend.telefono,
                    Direccion: dataToSend.direccion,
                    Cuentaasociadaconta: dataToSend.cuentaasociadaconta,
                    Contacto: dataToSend.contacto,
                    Email: dataToSend.email
                };

                // Envía la petición PUT
                response = await axios.put(`${API_URL}/Proveedores/${id}`, dataForBackend);
                setMessage(`¡Proveedor #${id} actualizado con éxito!`);
                
            } else {
                // MODO CREACIÓN (POST): Envía los datos en camelCase
                response = await axios.post(`${API_URL}/Proveedores`, dataToSend);
                setMessage(`¡Proveedor creado con éxito! Código: ${response.data.codigoProv}`);
            }
            
            if (onSave) {
                const savedData = isEditMode ? { ...dataToSend, codigoProv: proveedorToEdit.codigoProv } : response.data;
                onSave(savedData, isEditMode);
            }

        } catch (error) {
            console.error('Error al guardar proveedor:', error.response ? error.response.data : error.message);
            const errorMessage = isEditMode ? 'Error al actualizar el proveedor.' : 'Error al crear el proveedor.';
            setMessage(`${errorMessage} Verifique la conexión y los datos.`);
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="form-container">
            <h2>{title}</h2>
            
            {message && (
                <p style={{ color: message.includes('éxito') ? 'green' : 'red', fontWeight: 'bold' }}>
                    {message}
                </p>
            )}

            <form onSubmit={handleSubmit}>
    
                {/* Campos del formulario (se mantienen igual) */}
                <label>Razón Social:</label>
                <input type="text" name="razonsocial" value={formData.razonsocial || ''} onChange={handleChange} required/> 
                
                <label>RIF:</label>
                <input type="text" name="rif" value={formData.rif || ''} onChange={handleChange} required/>

                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
                    <input 
                        type="checkbox" 
                        id="personaISLR"
                        name="personaISLR" 
                        checked={!!formData.personaISLR} 
                        onChange={handleChange} 
                    />
                    <label htmlFor="personaISLR">Sujeto a Retención ISLR</label>
                </div>
                
                <label>Teléfono:</label>
                <input type="text" name="telefono" value={formData.telefono || ''} onChange={handleChange} required/>
                
                <label>Dirección:</label>
                <input type="text" name="direccion" value={formData.direccion || ''} onChange={handleChange} required/>
                
                <label>Cuenta Contable Asociada:</label>
                <input type="text" name="cuentaasociadaconta" value={formData.cuentaasociadaconta || ''} onChange={handleChange} required/>
                
                <label>Contacto:</label>
                <input type="text" name="contacto" value={formData.contacto || ''} onChange={handleChange}/>
                
                <label>Email:</label>
                <input type="email" name="email" value={formData.email || ''} onChange={handleChange}/>
                
                {/* --- AÑADIR ESTE BLOQUE DE BOTONES --- */}
                <div style={{ marginTop: '20px', display: 'flex', gap: '10px' }}>
                    <button 
                        type="submit" 
                        // Cambia la clase (color) y el texto según el modo
                        className={isEditMode ? "btn btn-warning" : "btn btn-success"}
                        disabled={isSubmitting}
                    >
                        {isSubmitting 
                            ? (isEditMode ? 'Actualizando...' : 'Creando...')
                            : (isEditMode ? 'Actualizar Proveedor' : 'Crear Nuevo Proveedor')
                        }
                    </button>
                    
                    <button 
                        type="button" 
                        onClick={onCancel} 
                        className="btn btn-secondary"
                        disabled={isSubmitting}
                    >
                        Cancelar
                    </button>
                </div>
                {/* ------------------------------------- */}

            </form> 
        </div>
    );
};

export default ProveedorForm;