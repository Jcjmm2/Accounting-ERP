// src/Context/ConfigContext.jsx
import React, { createContext, useState, useEffect, useCallback } from 'react';

// eslint-disable-next-line react-refresh/only-export-components -- Convención del proyecto: contexto y provider se exportan juntos
export const ConfigContext = createContext();

const buildDefaultEmpresa = () => ({
  id: 1,
  nombre: 'Empresa principal',
  razonSocial: 'Empresa principal',
  rif: '',
  direccion: '',
  telefono: '',
  email: ''
});

const buildDefaultPeriodo = () => {
  const hoy = new Date();
  const mes = hoy.getMonth() + 1;
  const anio = hoy.getFullYear();
  const fechaInicio = `${anio}-${String(mes).padStart(2, '0')}-01`;
  const fechaFin = `${anio}-${String(mes).padStart(2, '0')}-${String(new Date(anio, mes, 0).getDate()).padStart(2, '0')}`;

  return {
    id: 1,
    nombre: 'Periodo actual',
    mes,
    anio,
    fechaInicio,
    fechaFin,
    estado: 'Abierto',
    cerrado: false
  };
};

const normalizarEmpresa = (empresa = {}) => ({
  id: Number(empresa.id ?? 1),
  nombre: empresa.nombre || empresa.razonSocial || 'Empresa principal',
  razonSocial: empresa.razonSocial || empresa.nombre || 'Empresa principal',
  rif: empresa.rif || '',
  direccion: empresa.direccion || '',
  telefono: empresa.telefono || '',
  email: empresa.email || ''
});

const normalizarPeriodo = (periodo = {}) => {
  const hoy = new Date();
  const mes = periodo.mes !== null && periodo.mes !== undefined ? Number(periodo.mes) : hoy.getMonth() + 1;
  const anio = Number(periodo.anio ?? hoy.getFullYear());
  const fechaInicio = periodo.fechaInicio || `${anio}-${String(mes).padStart(2, '0')}-01`;
  const fechaFin = periodo.fechaFin || `${anio}-${String(mes).padStart(2, '0')}-${String(new Date(anio, mes, 0).getDate()).padStart(2, '0')}`;

  return {
    id: Number(periodo.id ?? 1),
    nombre: periodo.nombre || `Periodo ${mes}/${anio}`,
    tipoPeriodo: periodo.tipoPeriodo || (periodo.mes ? 'Mensual' : 'Anual'),
    periodoPadreId: periodo.periodoPadreId ? Number(periodo.periodoPadreId) : null,
    mes,
    anio,
    fechaInicio,
    fechaFin,
    estado: periodo.estado || 'Abierto',
    cerrado: Boolean(periodo.cerrado)
  };
};

export const ConfigProvider = ({ children }) => {
  const baseApiUrl = (import.meta.env.VITE_API_URL || 'http://localhost:5077/api').replace(/\/+$/, '');
  const [API_URL] = useState(baseApiUrl);
  const [tasa, setTasa] = useState(0);
  const [user, setUser] = useState(null);
  const [empresas, setEmpresas] = useState([]);
  const [periodos, setPeriodos] = useState([]);
  const [empresaActiva, setEmpresaActiva] = useState(buildDefaultEmpresa());
  const [periodoActivo, setPeriodoActivo] = useState(buildDefaultPeriodo());
  const [contextoCargado, setContextoCargado] = useState(false);

  const guardarSeleccionLocal = useCallback((empresaId, periodoId) => {
    if (empresaId) localStorage.setItem('empresaActivaId', String(empresaId));
    if (periodoId) localStorage.setItem('periodoActivoId', String(periodoId));
  }, []);

  const seleccionarEmpresa = useCallback(async (empresaId) => {
    const id = Number(empresaId);
    const empresa = empresas.find((e) => Number(e.id) === id) || buildDefaultEmpresa();

    setEmpresaActiva(normalizarEmpresa(empresa));
    guardarSeleccionLocal(id, null);

    try {
      const res = await fetch(`${API_URL}/contabilidad/periodos?empresaId=${id}`);
      const data = await res.json();
      const lista = Array.isArray(data) ? data : (data?.$values || []);
      const listaAplanada = lista.flatMap((p) => {
        const hijos = p.subPeriodos?.$values || p.subPeriodos || [];
        return [p, ...hijos];
      });
      setPeriodos(listaAplanada);

      const periodoElegido = listaAplanada.find((p) => Number(p.id) === Number(localStorage.getItem('periodoActivoId'))) ?? listaAplanada[0] ?? buildDefaultPeriodo();
      if (periodoElegido) {
        setPeriodoActivo(normalizarPeriodo(periodoElegido));
        guardarSeleccionLocal(id, periodoElegido.id);
      }
    } catch (error) {
      console.error('Error seleccionando empresa:', error);
    }
  }, [API_URL, empresas, guardarSeleccionLocal]);

  const seleccionarPeriodo = useCallback((periodoId) => {
    const periodo = periodos.find((p) => Number(p.id) === Number(periodoId));
    if (!periodo) return;

    setPeriodoActivo(normalizarPeriodo(periodo));
    guardarSeleccionLocal(Number(empresaActiva?.id ?? 1), Number(periodo.id));
  }, [empresaActiva, periodos, guardarSeleccionLocal]);

  useEffect(() => {
    const tokenGuardado = localStorage.getItem('token');
    const usuarioGuardado = localStorage.getItem('usuario');
    const rolGuardado = localStorage.getItem('rol');

    if (tokenGuardado && usuarioGuardado) {
      setUser({
        username: usuarioGuardado,
        token: tokenGuardado,
        rol: rolGuardado
      });
    }
  }, []);

  const cargarContextoContable = useCallback(async () => {
    setContextoCargado(false);

    try {
      const empresasRes = await fetch(`${API_URL}/Empresa`);
      const empresasData = empresasRes.ok ? await empresasRes.json() : [];
      const listaEmpresas = Array.isArray(empresasData) ? empresasData : (empresasData?.$values || []);
      setEmpresas(listaEmpresas);

      const empresaSeleccionadaId = Number(localStorage.getItem('empresaActivaId') || listaEmpresas[0]?.id || 1);
      const empresaSeleccionada = listaEmpresas.find((e) => Number(e.id) === empresaSeleccionadaId) || listaEmpresas[0] || buildDefaultEmpresa();

      if (empresaSeleccionada) {
        setEmpresaActiva(normalizarEmpresa(empresaSeleccionada));
        guardarSeleccionLocal(Number(empresaSeleccionada.id), null);
      } else {
        setEmpresaActiva(buildDefaultEmpresa());
      }

      const periodosRes = await fetch(`${API_URL}/contabilidad/periodos?empresaId=${Number(empresaSeleccionada?.id ?? 1)}`);
      const periodosData = periodosRes.ok ? await periodosRes.json() : [];
      const listaPeriodos = Array.isArray(periodosData) ? periodosData : (periodosData?.$values || []);
      const listaAplanada = listaPeriodos.flatMap((p) => {
        const hijos = p.subPeriodos?.$values || p.subPeriodos || [];
        return [p, ...hijos];
      });
      setPeriodos(listaAplanada);

      const periodoSeleccionadoId = Number(localStorage.getItem('periodoActivoId') || listaAplanada[0]?.id || 1);
      const periodoSeleccionado = listaAplanada.find((p) => Number(p.id) === periodoSeleccionadoId) || listaAplanada[0] || buildDefaultPeriodo();

      if (periodoSeleccionado) {
        setPeriodoActivo(normalizarPeriodo(periodoSeleccionado));
        guardarSeleccionLocal(Number(empresaSeleccionada?.id ?? 1), Number(periodoSeleccionado.id));
      } else {
        setPeriodoActivo(buildDefaultPeriodo());
      }
    } catch (error) {
      console.error('Error cargando contexto contable:', error.message);
      setEmpresaActiva(buildDefaultEmpresa());
      setPeriodoActivo(buildDefaultPeriodo());
    } finally {
      setContextoCargado(true);
    }
  }, [API_URL, guardarSeleccionLocal]);

  useEffect(() => {
    cargarContextoContable();
  }, [cargarContextoContable]);

  useEffect(() => {
    const cargarTasaActual = async () => {
      try {
        const res = await fetch(`${API_URL}/TasaDeCambio/ultima`);
        if (res.ok) {
          const data = await res.json();
          setTasa(data.valor ?? 0);
        }
      } catch (error) {
        console.error('No se pudo conectar con el servidor para obtener la tasa.', error.message);
      }
    };

    cargarTasaActual();
  }, [API_URL]);

  const login = (userData) => {
    localStorage.setItem('token', userData.token);
    localStorage.setItem('usuario', userData.usuario);
    localStorage.setItem('rol', userData.rol);
    setUser({
      username: userData.usuario,
      token: userData.token,
      rol: userData.rol
    });
  };

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('usuario');
    localStorage.removeItem('rol');
    setUser(null);
  };

  return (
    <ConfigContext.Provider value={{
      API_URL,
      tasa,
      setTasa,
      user,
      login,
      logout,
      empresas,
      periodos,
      empresaActiva,
      setEmpresaActiva,
      periodoActivo,
      setPeriodoActivo,
      contextoCargado,
      seleccionarEmpresa,
      seleccionarPeriodo,
      refrescarContextoContable: cargarContextoContable
    }}>
      {children}
    </ConfigContext.Provider>
  );
};