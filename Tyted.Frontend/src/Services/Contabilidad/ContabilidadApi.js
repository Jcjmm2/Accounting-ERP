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
  getContexto: async () => {
    const response = await axios.get(`${API_BASE_URL.replace(/\/api$/, '')}/Empresa/contexto`);
    return response.data;
  },

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

  getAsientos: async () => {
    const response = await api.get('/asientos');
    return response.data;
  },

  crearAsiento: async (asiento) => {
    const response = await api.post('/asientos', asiento);
    return response.data;
  },

  getPeriodos: async () => {
    const response = await api.get('/periodos');
    return response.data;
  },

  crearPeriodo: async (periodo) => {
    const response = await api.post('/periodos', periodo);
    return response.data;
  },

  cerrarPeriodo: async (periodoId, usuario = 'Sistema') => {
    const response = await api.post(`/periodos/${periodoId}/cerrar`, { usuario });
    return response.data;
  },

  // ---------------------------------------------------------------------------
  // NUEVAS FUNCIONES DE MODIFICACIÓN Y VALIDACIÓN DE PERIODOS
  // ---------------------------------------------------------------------------
  verificarMovimientosPeriodo: async (periodoId) => {
    const response = await api.get(`/periodos/${periodoId}/tiene-movimientos`);
    return response.data;
  },

  modificarPeriodo: async (periodoId, periodoData) => {
    const response = await api.put(`/periodos/${periodoId}`, periodoData);
    return response.data;
  },
  // ---------------------------------------------------------------------------

  getResumen: async () => {
    const response = await api.get('/reportescontables/resumen');
    return response.data;
  },

  getBalanceComprobacion: async (periodoId) => {
    const response = await api.get('/reportescontables/balance-comprobacion', {
      params: { periodoId }
    });
    return response.data;
  },

  getLibroMayor: async (cuentaId, fechaInicio, fechaFin) => {
    const response = await api.get('/reportescontables/libro-mayor', {
      params: { cuentaId, fechaInicio, fechaFin }
    });
    return response.data;
  },

  crearAperturaSaldosIniciales: async (empresaId, periodoId, saldosIniciales, usuarioId = 1) => {
    const response = await api.post('/reportescontables/apertura-saldos-iniciales', {
      empresaId,
      periodoId,
      usuarioId,
      saldosIniciales
    });
    return response.data;
  },

  getBalanceGeneral: async (periodoId) => {
    const response = await api.get('/reportescontables/balance-general', {
      params: { periodoId }
    });
    return response.data;
  },

  getEstadoResultados: async (periodoId) => {
    const response = await api.get('/reportescontables/estado-resultados', {
      params: { periodoId }
    });
    return response.data;
  },

  getFlujoEfectivo: async (periodoId) => {
    const response = await api.get('/reportescontables/flujo-efectivo', {
      params: { periodoId }
    });
    return response.data;
  },

  getCierrePeriodo: async (periodoId) => {
    const response = await api.get('/reportescontables/cierre-periodo', {
      params: { periodoId }
    });
    return response.data;
  }
};
