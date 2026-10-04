import axios from 'axios';

const API_BASE = '/api/contabilidad';

export const contabilidadApi = {
  getCuentas: async () => {
    const response = await axios.get(`${API_BASE}/cuentas`);
    return response.data;
  },

  getAsientos: async () => {
    const response = await axios.get(`${API_BASE}/asientos`);
    return response.data;
  },

  getPeriodos: async () => {
    const response = await axios.get(`${API_BASE}/periodos`);
    return response.data;
  },

  getResumen: async () => {
    const response = await axios.get(`${API_BASE}/resumen`);
    return response.data;
  },

  crearCuenta: async (cuenta) => {
    const response = await axios.post(`${API_BASE}/cuentas`, cuenta);
    return response.data;
  },

  crearAsiento: async (asiento) => {
    const response = await axios.post(`${API_BASE}/asientos`, asiento);
    return response.data;
  }
};
