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

// Si el token caducó (o no es válido) devolvemos al usuario al Login en lugar de
// dejar la pantalla "muda" con listados vacíos y sin empresa seleccionada.
api.interceptors.response.use(
  (response) => response,
  (error) => {
    const tieneToken = Boolean(localStorage.getItem('token') || sessionStorage.getItem('token'));
    if (error.response?.status === 401 && tieneToken) {
      localStorage.removeItem('token');
      localStorage.removeItem('usuario');
      localStorage.removeItem('rol');
      window.location.reload();
    }
    return Promise.reject(error);
  }
);

// Extrae un mensaje legible de un error de Axios
export const mensajeErrorApi = (error) => {
  const status = error?.response?.status;
  const data = error?.response?.data;
  const delBackend = typeof data === 'string' ? data : (data?.message || data?.title);

  if (status === 401) return 'Sesión expirada o no válida. Cierre sesión y vuelva a entrar.';
  if (status === 403) return 'No tiene permisos para esta operación (rol requerido: Administrador/Analista).';
  if (delBackend) return delBackend;
  return error?.message || 'No se pudo conectar con la API de contabilidad.';
};

export const contabilidadApi = {
  // Nota: este endpoint está protegido con [Authorize], por lo que SIEMPRE
  // debe llevar el Bearer token (antes usaba axios "pelado" y devolvía 401).
  // La ruta correcta es /api/Empresa/contexto (antes se quitaba el "/api" y daba 404).
  getContexto: async () => {
    const token = localStorage.getItem('token') || sessionStorage.getItem('token');
    const response = await axios.get(
      `${API_BASE_URL}/Empresa/contexto`,
      { headers: token ? { Authorization: `Bearer ${token}` } : {} }
    );
    return response.data;
  },

  getCuentas: async (empresaId) => {
    try {
      // Si se pasa empresaId, Axios genera automáticamente ?empresaId=X
      const config = empresaId ? { params: { empresaId } } : {};
      const response = await api.get('/cuentas', config);
      return response.data;
    } catch (error) {
      if (error.response?.status === 404) {
        const config = empresaId ? { params: { empresaId } } : {};
        const fallbackResponse = await api.get('/plancuentas', config);
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

  // ---------------------------------------------------------------------------
  // GESTIÓN DE ASIENTOS (COMPROBANTES)
  // ---------------------------------------------------------------------------
  
  // Ahora permite recibir el periodoId y/o el empresaId para filtrar
  getAsientos: async (periodoId, empresaId) => {
    const params = {};
    if (periodoId) params.periodoContableId = periodoId;
    if (empresaId) params.empresaId = empresaId;
    const response = await api.get('/asientos', { params });
    return response.data;
  },

  crearAsiento: async (asiento) => {
    const response = await api.post('/asientos', asiento);
    return response.data;
  },

  // NUEVO: Función para actualizar un asiento (comprobante) existente
  actualizarAsiento: async (id, asiento) => {
    const response = await api.put(`/asientos/${id}`, asiento);
    return response.data;
  },

  // ---------------------------------------------------------------------------
  // GESTIÓN DE PERIODOS
  // ---------------------------------------------------------------------------
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

  verificarMovimientosPeriodo: async (periodoId) => {
    const response = await api.get(`/periodos/${periodoId}/tiene-movimientos`);
    return response.data;
  },

  modificarPeriodo: async (periodoId, periodoData) => {
    const response = await api.put(`/periodos/${periodoId}`, periodoData);
    return response.data;
  },

  // ---------------------------------------------------------------------------
  // REPORTES CONTABLES
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
