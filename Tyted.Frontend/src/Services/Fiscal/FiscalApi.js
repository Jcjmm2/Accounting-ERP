import axios from 'axios';
import { mensajeErrorApi } from '../Contabilidad/ContabilidadApi';

// API del módulo FISCAL (Libros de IVA SENIAT): ventas y compras con sus
// filtros por periodo/empresa y la integración con los comprobantes contables.
const API_BASE_URL = (import.meta.env.VITE_API_URL || 'http://localhost:5077/api').replace(/\/$/, '');

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: { 'Content-Type': 'application/json' }
});

// JWT (mismo patrón que ContabilidadApi)
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token') || sessionStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
}, (error) => Promise.reject(error));

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

export { mensajeErrorApi };

export const fiscalApi = {
  // Libro de Ventas: filtra por el rango del periodo contable activo y la empresa
  getVentas: async ({ fechaInicio, fechaFin, empresaId } = {}) => {
    const params = {};
    if (fechaInicio) params.fechaInicio = fechaInicio;
    if (fechaFin) params.fechaFin = fechaFin;
    if (empresaId) params.empresaId = empresaId;
    const response = await api.get('/Ventas', { params });
    return response.data;
  },

  // Libro de Compras: mismos filtros que el de ventas
  getCompras: async ({ fechaInicio, fechaFin, empresaId } = {}) => {
    const params = {};
    if (fechaInicio) params.fechaInicio = fechaInicio;
    if (fechaFin) params.fechaFin = fechaFin;
    if (empresaId) params.empresaId = empresaId;
    const response = await api.get('/Compras', { params });
    return response.data;
  },

  // Campos fiscales del documento: tipo de transacción SENIAT (01/02/03) y N° Control
  actualizarFiscalVenta: async (id, datos) => {
    const response = await api.put(`/Ventas/${id}/fiscal`, datos);
    return response.data;
  },

  actualizarFiscalCompra: async (id, datos) => {
    const response = await api.put(`/Compras/${id}/fiscal`, datos);
    return response.data;
  },

  // Integración administrativo-contable (BE-F4): genera el comprobante de diario
  // de la operación vía motor de asientos automáticos (idempotente).
  contabilizarVenta: async (id) => {
    const response = await api.post(`/Ventas/${id}/contabilizar`);
    return response.data;
  },

  contabilizarCompra: async (id) => {
    const response = await api.post(`/Compras/${id}/contabilizar`);
    return response.data;
  },

  // -----------------------------------------------------------------------
  // F2: RETENCIONES DE IVA EMITIDAS (correlativo SENIAT AAAAMM + 8 dígitos)
  // -----------------------------------------------------------------------
  getRetencionesIva: async ({ fechaInicio, fechaFin, empresaId } = {}) => {
    const params = {};
    if (fechaInicio) params.fechaInicio = fechaInicio;
    if (fechaFin) params.fechaFin = fechaFin;
    if (empresaId) params.empresaId = empresaId;
    const response = await api.get('/retenciones-iva', { params });
    return response.data;
  },

  // porcentaje: 75 o 100 (sobre el IVA de la factura). Una sola retención
  // vigente por factura (el backend responde 400 si ya existe).
  emitirRetencionIva: async ({ compraId, empresaId, porcentaje }) => {
    const response = await api.post('/retenciones-iva', { compraId, empresaId, porcentaje });
    return response.data;
  },

  // -------------------------------------------------------------------------
  // ALTA DE DOCUMENTOS DESDE EL MÓDULO FISCAL (Origen='Fiscal'): SIN caja,
  // SIN stock y SIN kardex — no afectan el POS ni la gestión de inventario.
  // -------------------------------------------------------------------------
  crearVentaFiscal: async (venta) => {
    const response = await api.post('/Ventas/fiscal', venta);
    return response.data;
  },

  crearCompraFiscal: async (compra) => {
    const response = await api.post('/Compras/fiscal', compra);
    return response.data;
  },

  // -------------------------------------------------------------------------
  // GASTOS DEL MÓDULO FISCAL (entidad propia, sin inventario)
  // -------------------------------------------------------------------------
  getGastos: async ({ fechaInicio, fechaFin, empresaId } = {}) => {
    const params = {};
    if (fechaInicio) params.fechaInicio = fechaInicio;
    if (fechaFin) params.fechaFin = fechaFin;
    if (empresaId) params.empresaId = empresaId;
    const response = await api.get('/gastos', { params });
    return response.data;
  },

  crearGasto: async (gasto) => {
    const response = await api.post('/gastos', gasto);
    return response.data;
  },

  contabilizarGasto: async (id) => {
    const response = await api.post(`/gastos/${id}/contabilizar`);
    return response.data;
  },

  // -------------------------------------------------------------------------
  // MAESTROS para los formularios de alta fiscal (clientes, proveedores,
  // búsqueda de productos con precios e IVA del día)
  // -------------------------------------------------------------------------
  getClientes: async () => {
    const response = await api.get('/Clientes');
    return response.data;
  },

  getProveedores: async () => {
    const response = await api.get('/Proveedores');
    return response.data;
  },

  buscarProductos: async (termino, tasaDelDia = 1) => {
    const response = await api.get('/Productos/buscar', { params: { termino, tasaDelDia } });
    return response.data;
  }
};