import axios from 'axios';

// Obtiene la URL del backend desde .env o usa la dirección local por defecto del proyecto ASP.NET.
// Los .env en este proyecto definen `VITE_API_URL` incluyendo el sufijo `/api`,
// por eso normalizamos y sólo añadimos la parte `/contabilidad`.
const API_BASE_URL = (import.meta.env.VITE_API_URL || 'http://localhost:5077/api').replace(/\/$/, '');

// Instancia de Axios configurada
const api = axios.create({
  baseURL: `${API_BASE_URL}/contabilidad`,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Interceptor para inyectar automáticamente el Token JWT si el usuario inició sesión
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token') || sessionStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
}, (error) => Promise.reject(error));

export const contabilidadApi = {
  // El backend expone /api/contabilidad/cuentas
  getCuentas: async () => {
    try {
      const response = await api.get('/cuentas');
      return response.data;
    } catch (error) {
      if (error.response?.status === 404) {
        const fallbackResponse = await api.get('/plancuentas');
        return fallbackResponse.data;
      }
      throw error;
    }
  },

  crearCuenta: async (cuenta) => {
    try {
      const response = await api.post('/cuentas', cuenta);
      return response.data;
    } catch (error) {
      if (error.response?.status === 404) {
        const fallbackResponse = await api.post('/plancuentas', cuenta);
        return fallbackResponse.data;
      }
      throw error;
    }
  },

  // Asientos Contables
  getAsientos: async () => {
    const response = await api.get('/asientos');
    return response.data;
  },

  crearAsiento: async (asiento) => {
    const response = await api.post('/asientos', asiento);
    return response.data;
  },

  // Periodos Fiscales
  getPeriodos: async () => {
    const response = await api.get('/periodoscontables');
    return response.data;
  },

  // Resumen / Dashboard Contable
  getResumen: async () => {
    const response = await api.get('/reportescontables/resumen');
    return response.data;
  }
};
