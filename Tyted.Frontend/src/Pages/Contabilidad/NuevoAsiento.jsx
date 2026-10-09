import { useState, useEffect, useContext } from 'react';
import { ConfigContext } from '../../Context/ConfigContext';
import { contabilidadApi, mensajeErrorApi } from '../../Services/Contabilidad/ContabilidadApi';

export default function NuevoAsiento({ empresaActiva: empresaActivaProp, periodoActivo: periodoActivoProp }) {
  const { empresaActiva: empresaActivaContext, periodoActivo: periodoActivoContext, user } = useContext(ConfigContext);
  const empresaActiva = empresaActivaProp ?? empresaActivaContext;
  const periodoActivo = periodoActivoProp ?? periodoActivoContext;

  // --- ESTADOS DE CONTROL DE VISTA ---
  const [vista, setVista] = useState('formulario'); // 'formulario' | 'listado'
  const [modo, setModo] = useState('crear'); // 'crear' | 'editar'
  const [asientoIdEditando, setAsientoIdEditando] = useState(null);

  // --- ESTADOS DE DATOS (FORMULARIO) ---
  const [fecha, setFecha] = useState(new Date().toISOString().split('T')[0]);
  const [concepto, setConcepto] = useState('');
  const [tipoComprobante, setTipoComprobante] = useState('Diario');
  const [numeroComprobante, setNumeroComprobante] = useState(''); 
  
  const [lineas, setLineas] = useState([
    { cuentaId: '', codigoManual: '', debe: '', haber: '' },
    { cuentaId: '', codigoManual: '', debe: '', haber: '' }
  ]);
  
  // --- ESTADOS AUXILIARES ---
  const [cuentasDisponibles, setCuentasDisponibles] = useState([]);
  const [asientosRegistrados, setAsientosRegistrados] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [errorCuentas, setErrorCuentas] = useState(null);

  // 1. CARGA DE CUENTAS DE LA EMPRESA ACTIVA (selector único): se recargan
  // al cambiar de empresa para no mostrar cuentas de otra compañía.
  useEffect(() => {
    const cargarCuentas = async () => {
      try {
        const data = await contabilidadApi.getCuentas(empresaActiva?.id);
        const lista = Array.isArray(data) ? data : (data?.$values || []);
        setCuentasDisponibles(lista);
        setErrorCuentas(lista.length === 0
          ? 'El plan de cuentas está vacío. Cree las cuentas en "Plan de Cuentas" antes de registrar asientos.'
          : null);
      } catch (err) {
        console.error("Error cargando cuentas:", err);
        setCuentasDisponibles([]);
        setErrorCuentas(mensajeErrorApi(err));
      } finally {
        setCargando(false);
      }
    };
    cargarCuentas();
  }, [empresaActiva?.id]);

  // 2. SINCRONIZAR FECHA CON EL PERIODO ACTIVO
  useEffect(() => {
    if (periodoActivo?.fechaInicio && periodoActivo?.fechaFin) {
      const inicio = periodoActivo.fechaInicio.split('T')[0];
      const fin = periodoActivo.fechaFin.split('T')[0];
      const hoy = new Date().toISOString().split('T')[0];

      if (hoy >= inicio && hoy <= fin) {
        setFecha(hoy);
      } else {
        setFecha(inicio);
      }
    }
  }, [periodoActivo]);

  // 3. CARGA DE ASIENTOS AL CAMBIAR A "LISTADO"
  useEffect(() => {
    if (vista === 'listado') {
      cargarAsientosDelPeriodo();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vista, periodoActivo]);

  const cargarAsientosDelPeriodo = async () => {
    if (!periodoActivo?.id) return;
    try {
      setCargando(true);
      const data = await contabilidadApi.getAsientos(periodoActivo.id, empresaActiva?.id);
      setAsientosRegistrados(Array.isArray(data) ? data : (data?.$values || []));
    } catch (error) {
      console.error("Error al cargar asientos:", error);
      setAsientosRegistrados([]);
      alert(`❌ No se pudieron cargar los asientos:\n${mensajeErrorApi(error)}`);
    } finally {
      setCargando(false);
    }
  };

  // --- CÁLCULOS EN TIEMPO REAL ---
  const totalDebe = lineas.reduce((sum, l) => sum + (parseFloat(l.debe) || 0), 0);
  const totalHaber = lineas.reduce((sum, l) => sum + (parseFloat(l.haber) || 0), 0);
  const diferencia = Math.abs(totalDebe - totalHaber);
  const cuadrado = diferencia === 0 && totalDebe > 0;

  // --- MANEJO DE LÍNEAS DEL ASIENTO ---
  const agregarLinea = () => setLineas([...lineas, { cuentaId: '', codigoManual: '', debe: '', haber: '' }]);

  const eliminarLinea = (index) => {
    if (lineas.length > 2) setLineas(lineas.filter((_, i) => i !== index));
  };

  // Búsqueda dual: Tipear código sin puntos (Ej. 111101 -> 1.1.1.1.01)
  const handleCodigoManual = (index, valor) => {
    const nuevasLineas = [...lineas];
    nuevasLineas[index].codigoManual = valor;
    
    const valorLimpio = valor.replace(/\./g, '').trim();

    if (valorLimpio === '') {
      nuevasLineas[index].cuentaId = '';
      setLineas(nuevasLineas);
      return;
    }

    const match = cuentasDisponibles.find(c => {
      const codigoBD = c.codigoCuenta || c.codigo || '';
      return codigoBD.replace(/\./g, '').trim() === valorLimpio;
    });

    if (match) {
      nuevasLineas[index].cuentaId = match.id ?? match.cuentaId;
    } else {
      nuevasLineas[index].cuentaId = '';
    }

    setLineas(nuevasLineas);
  };

  const actualizarLinea = (index, campo, valor) => {
    const nuevasLineas = [...lineas];
    nuevasLineas[index][campo] = valor;
    
    if (campo === 'debe' && valor) nuevasLineas[index].haber = '';
    if (campo === 'haber' && valor) nuevasLineas[index].debe = '';
    
    if (campo === 'cuentaId') {
      if (valor) {
        const match = cuentasDisponibles.find(c => (c.id ?? c.cuentaId).toString() === valor.toString());
        if (match) {
          nuevasLineas[index].codigoManual = match.codigoCuenta || match.codigo || '';
        }
      } else {
        nuevasLineas[index].codigoManual = '';
      }
    }
    
    setLineas(nuevasLineas);
  };

  const limpiarFormulario = () => {
    if (periodoActivo?.fechaInicio) {
      const inicio = periodoActivo.fechaInicio.split('T')[0];
      const fin = periodoActivo.fechaFin ? periodoActivo.fechaFin.split('T')[0] : inicio;
      const hoy = new Date().toISOString().split('T')[0];
      setFecha(hoy >= inicio && hoy <= fin ? hoy : inicio);
    } else {
      setFecha(new Date().toISOString().split('T')[0]);
    }
    setConcepto('');
    setTipoComprobante('Diario');
    setNumeroComprobante('');
    setLineas([{ cuentaId: '', codigoManual: '', debe: '', haber: '' }, { cuentaId: '', codigoManual: '', debe: '', haber: '' }]);
    setModo('crear');
    setAsientoIdEditando(null);
  };

  // --- FUNCIONES DE GUARDADO ---
  const guardar = async (e) => {
    e.preventDefault();
    if (!cuadrado) return alert('⚠️ El asiento no está cuadrado. El Debe debe ser igual al Haber.');

    const lineasInvalidas = lineas.some(l => (l.debe || l.haber) && !l.cuentaId);
    if (lineasInvalidas) return alert('⚠️ Una o más líneas tienen montos pero no tienen una cuenta contable válida asociada.');

    const empId = Number(empresaActiva?.id ?? 1);
    const perId = Number(periodoActivo?.id ?? 1);
    const usuarioId = Number(user?.id ?? 1);

    if (!empresaActiva?.id || !periodoActivo?.id) {
      return alert('⚠️ No hay un contexto contable activo. Seleccione la empresa y el periodo antes de guardar.');
    }

    const payload = {
      // IMPORTANTE: 'id' solo viaja al editar. En modo crear se envía 0, porque
      // "id": null rompía la deserialización del backend (HTTP 400) y el asiento
      // nunca llegaba a guardarse.
      id: modo === 'editar' ? Number(asientoIdEditando) : 0,
      concepto,
      // Corrección de zona horaria: Se envía la cadena con formato local limpio sin 'Z'
      fechaComprobante: `${fecha}T00:00:00`,
      estado: 'Aprobado',
      periodoContableId: perId, 
      empresaId: empId,         
      usuarioId,
      tipoComprobante: tipoComprobante,
      numeroComprobante: modo === 'editar' ? numeroComprobante : '', // El backend autogenera si viene vacío
      detalles: lineas
        .filter(l => l.cuentaId && (l.debe || l.haber))
        .map(l => ({
          cuentaContableId: Number(l.cuentaId),
          debe: parseFloat(l.debe) || 0,
          haber: parseFloat(l.haber) || 0,
          // AsientoDetalle.Referencia admite máximo 100 caracteres en la BD
          referencia: (concepto || '').substring(0, 100)
        }))
    };

    try {
      setCargando(true);
      if (modo === 'editar') {
        await contabilidadApi.actualizarAsiento(asientoIdEditando, payload);
        alert('✅ Asiento actualizado correctamente');
      } else {
        await contabilidadApi.crearAsiento(payload);
        alert('✅ Asiento registrado correctamente');
      }
      limpiarFormulario();
      setVista('listado');
    } catch (error) {
      console.error("Error al guardar asiento:", error);
      alert(`❌ No se pudo guardar el asiento:\n${mensajeErrorApi(error)}`);
    } finally {
      setCargando(false);
    }
  };

  const prepararEdicion = (asiento) => {
    setFecha(asiento.fechaComprobante ? asiento.fechaComprobante.split('T')[0] : '');
    setConcepto(asiento.concepto || '');
    setTipoComprobante(asiento.tipoComprobante || 'Diario');
    setNumeroComprobante(asiento.numeroComprobante || `ID-${asiento.id}`);
    
    const lineasFormateadas = (asiento.detalles?.$values || asiento.detalles || []).map(d => {
      const cta = cuentasDisponibles.find(c => (c.id ?? c.cuentaId) === d.cuentaContableId);
      return {
        cuentaId: d.cuentaContableId || '',
        codigoManual: cta ? (cta.codigoCuenta || cta.codigo || '') : '',
        debe: d.debe > 0 ? d.debe : '',
        haber: d.haber > 0 ? d.haber : ''
      };
    });

    while (lineasFormateadas.length < 2) {
      lineasFormateadas.push({ cuentaId: '', codigoManual: '', debe: '', haber: '' });
    }

    setLineas(lineasFormateadas);
    setAsientoIdEditando(asiento.id);
    setModo('editar');
    setVista('formulario');
  };

  return (
    <div style={{ padding: '24px', color: '#e2e8f0', maxWidth: '1100px', margin: '0 auto' }}>
      
      <div style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
        <button 
          onClick={() => { limpiarFormulario(); setVista('formulario'); }}
          style={{ ...btnStyle, background: vista === 'formulario' ? '#2563eb' : '#1e293b' }}
        >
          ✍️ {modo === 'editar' ? 'Editando Asiento' : 'Nuevo Asiento'}
        </button>
        <button 
          onClick={() => setVista('listado')}
          style={{ ...btnStyle, background: vista === 'listado' ? '#2563eb' : '#1e293b' }}
        >
          🔍 Consultar y Editar Comprobantes
        </button>
      </div>

      {vista === 'formulario' && (
        <>
          <div style={{ background: '#1e293b', padding: '16px', borderRadius: '10px', marginBottom: '20px', border: `1px solid ${modo === 'editar' ? '#f59e0b' : '#334155'}` }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
              <h2 style={{ margin: 0, color: modo === 'editar' ? '#fbbf24' : '#fff' }}>
                {modo === 'editar' ? `✏️ Modificar Asiento (N°: ${numeroComprobante})` : '✍️ Comprobante Contable'}
              </h2>
              <div style={{ fontSize: '0.85rem', color: '#94a3b8', textAlign: 'right' }}>
                <div>🏢 {empresaActiva?.nombre || 'Empresa por defecto'}</div>
                <div>📅 {periodoActivo?.nombre || 'Periodo por defecto'}</div>
              </div>
            </div>
          </div>

          {errorCuentas && (
            <div style={{
              background: '#7f1d1d', border: '1px solid #dc2626', color: '#fecaca',
              padding: '12px 16px', borderRadius: '10px', marginBottom: '20px', fontSize: '0.9rem'
            }}>
              ⚠️ {errorCuentas}
            </div>
          )}

          <form onSubmit={guardar}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 2fr', gap: '16px', marginBottom: '20px' }}>
              <div>
                <label style={labelStyle}>N° Comprobante</label>
                <input type="text" value={modo === 'crear' ? 'Autogenerado (formato YYMM0000001)' : numeroComprobante} disabled style={{...inputStyle, background: '#0f172a', color: '#64748b', fontStyle: 'italic'}} />
              </div>
              <div>
                <label style={labelStyle}>Fecha</label>
                <input type="date" value={fecha} onChange={e => setFecha(e.target.value)} style={inputStyle} required />
              </div>
              <div>
                <label style={labelStyle}>Tipo de Asiento</label>
                <select value={tipoComprobante} onChange={e => setTipoComprobante(e.target.value)} style={inputStyle}>
                  <option value="Diario">Diario (Registro Normal)</option>
                  <option value="Apertura">Apertura de Ejercicio</option>
                  <option value="Cierre">Cierre de Ejercicio</option>
                  <option value="Ajuste">Ajuste / Reclasificación</option>
                </select>
              </div>
              <div>
                <label style={labelStyle}>Concepto / Glosa</label>
                <input type="text" value={concepto} onChange={e => setConcepto(e.target.value)} placeholder="Ej. Registro de nómina..." style={inputStyle} required />
              </div>
            </div>

            <div style={{ background: '#0f172a', borderRadius: '10px', border: '1px solid #334155', overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: '#1e293b', textAlign: 'left' }}>
                    <th style={{ padding: '12px', width: '55%' }}>Cuenta Contable (Tipee el código o seleccione del listado)</th>
                    <th style={{ padding: '12px', width: '18%', textAlign: 'right' }}>DEBE</th>
                    <th style={{ padding: '12px', width: '18%', textAlign: 'right' }}>HABER</th>
                    <th style={{ padding: '12px', width: '9%' }}></th>
                  </tr>
                </thead>
                <tbody>
                  {lineas.map((linea, index) => (
                    <tr key={index} style={{ borderBottom: '1px solid #334155' }}>
                      <td style={{ padding: '8px' }}>
                        <div style={{ display: 'flex', gap: '8px' }}>
                          <input 
                            type="text"
                            placeholder="Ej. 111101"
                            value={linea.codigoManual}
                            onChange={e => handleCodigoManual(index, e.target.value)}
                            style={{ ...inputStyle, width: '140px', fontFamily: 'monospace' }}
                            disabled={cargando}
                          />
                          <select 
                            value={linea.cuentaId} 
                            onChange={e => actualizarLinea(index, 'cuentaId', e.target.value)}
                            style={{ ...inputStyle, flex: 1, textOverflow: 'ellipsis' }}
                            required
                            disabled={cargando}
                          >
                            <option value="">{cargando ? 'Cargando...' : 'Seleccionar...'}</option>
                            {cuentasDisponibles.map(c => {
                              const cId = c.id ?? c.cuentaId;
                              const cCod = c.codigoCuenta || c.codigo;
                              const cNom = c.nombreCuenta || c.nombre;
                              return (
                                <option key={cId} value={cId}>
                                  {cCod} - {cNom}
                                </option>
                              );
                            })}
                          </select>
                        </div>
                      </td>
                      <td style={{ padding: '8px' }}>
                        <input type="number" step="0.01" value={linea.debe} onChange={e => actualizarLinea(index, 'debe', e.target.value)} placeholder="0.00" style={{ ...inputStyle, textAlign: 'right' }} />
                      </td>
                      <td style={{ padding: '8px' }}>
                        <input type="number" step="0.01" value={linea.haber} onChange={e => actualizarLinea(index, 'haber', e.target.value)} placeholder="0.00" style={{ ...inputStyle, textAlign: 'right' }} />
                      </td>
                      <td style={{ padding: '8px', textAlign: 'center' }}>
                        <button type="button" onClick={() => eliminarLinea(index)} style={{ background: '#dc2626', color: '#fff', border: 'none', borderRadius: '6px', padding: '6px 10px', cursor: 'pointer' }}>✕</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr style={{ background: '#1e293b', fontWeight: 'bold', fontSize: '1.1rem' }}>
                    <td style={{ padding: '12px', textAlign: 'right' }}>TOTALES:</td>
                    <td style={{ padding: '12px', textAlign: 'right', color: '#60a5fa' }}>{totalDebe.toFixed(2)}</td>
                    <td style={{ padding: '12px', textAlign: 'right', color: '#f87171' }}>{totalHaber.toFixed(2)}</td>
                    <td></td>
                  </tr>
                </tfoot>
              </table>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '20px', flexWrap: 'wrap', gap: '10px' }}>
              <button type="button" onClick={agregarLinea} style={{ background: '#334155', color: '#fff', border: 'none', borderRadius: '8px', padding: '10px 16px', cursor: 'pointer' }}>
                + Agregar Línea
              </button>
              
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                {!cuadrado && totalDebe > 0 && (
                  <span style={{ color: '#f87171', fontSize: '0.9rem', fontWeight: 'bold' }}>
                    ⚠️ Diferencia: {diferencia.toFixed(2)}
                  </span>
                )}
                {modo === 'editar' && (
                  <button type="button" onClick={limpiarFormulario} style={{ background: '#475569', color: '#fff', border: 'none', borderRadius: '8px', padding: '12px 24px', cursor: 'pointer', fontWeight: 'bold' }}>
                    Cancelar Edición
                  </button>
                )}
                <button type="submit" disabled={!cuadrado || !concepto || cargando} style={{ 
                  background: cuadrado ? (modo === 'editar' ? '#f59e0b' : '#16a34a') : '#475569', 
                  color: '#fff', border: 'none', borderRadius: '8px', padding: '12px 24px', 
                  cursor: cuadrado ? 'pointer' : 'not-allowed', fontWeight: 'bold', fontSize: '1rem'
                }}>
                  {cargando ? 'Procesando...' : modo === 'editar' ? '💾 Actualizar Asiento' : '💾 Guardar Asiento'}
                </button>
              </div>
            </div>
          </form>
        </>
      )}

      {vista === 'listado' && (
        <div style={{ background: '#0f172a', borderRadius: '12px', border: '1px solid #334155', overflow: 'hidden' }}>
          <div style={{ padding: '16px', background: '#1e293b', borderBottom: '1px solid #334155', display: 'flex', justifyContent: 'space-between' }}>
            <h3 style={{ margin: 0, color: '#60a5fa' }}>📋 Comprobantes del Periodo: {periodoActivo?.nombre}</h3>
            <span style={{color: '#94a3b8', fontSize: '0.85rem'}}>Total: {asientosRegistrados.length} asientos</span>
          </div>
          
          {cargando ? (
            <p style={{ padding: '24px', textAlign: 'center', color: '#94a3b8' }}>Cargando asientos de la base de datos...</p>
          ) : asientosRegistrados.length === 0 ? (
            <p style={{ padding: '24px', textAlign: 'center', color: '#94a3b8' }}>No hay asientos registrados en este periodo fiscal.</p>
          ) : (
            <div style={{ maxHeight: '500px', overflowY: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: '#111827', color: '#93c5fd', textAlign: 'left', position: 'sticky', top: 0 }}>
                    <th style={{ padding: '12px' }}>Fecha</th>
                    <th style={{ padding: '12px' }}>N° Comprobante</th>
                    <th style={{ padding: '12px' }}>Tipo</th>
                    <th style={{ padding: '12px' }}>Concepto</th>
                    <th style={{ padding: '12px', textAlign: 'center' }}>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {asientosRegistrados.map((asiento) => (
                    <tr key={asiento.id} style={{ borderTop: '1px solid #1f2937', transition: 'background 0.2s' }}
                        onMouseEnter={(e) => e.currentTarget.style.background = '#1e293b'}
                        onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                    >
                      <td style={{ padding: '12px' }}>{new Date(asiento.fechaComprobante).toLocaleDateString()}</td>
                      <td style={{ padding: '12px', fontFamily: 'monospace', color: '#fbbf24', fontWeight: 'bold' }}>
                        {asiento.numeroComprobante || `ID-${asiento.id}`}
                      </td>
                      <td style={{ padding: '12px' }}>
                        <span style={{ 
                          background: asiento.tipoComprobante === 'Apertura' ? '#064e3b' : asiento.tipoComprobante === 'Cierre' ? '#7f1d1d' : '#1e3a8a', 
                          padding: '4px 8px', borderRadius: '6px', fontSize: '0.75rem', color: '#fff', fontWeight: 'bold' 
                        }}>
                          {asiento.tipoComprobante || 'Diario'}
                        </span>
                      </td>
                      <td style={{ padding: '12px', color: '#e2e8f0' }}>{asiento.concepto}</td>
                      <td style={{ padding: '12px', textAlign: 'center' }}>
                        <button 
                          onClick={() => prepararEdicion(asiento)}
                          style={{ background: '#f59e0b', color: '#000', border: 'none', borderRadius: '6px', padding: '6px 14px', cursor: 'pointer', fontWeight: 'bold', fontSize: '0.85rem' }}
                        >
                          ✏️️ Editar
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

    </div>
  );
}

const inputStyle = {
  padding: '10px 12px', borderRadius: '8px', border: '1px solid #334155',
  background: '#1e293b', color: '#fff', width: '100%', boxSizing: 'border-box'
};

const labelStyle = { 
  fontSize: '0.85rem', color: '#94a3b8', marginBottom: '6px', display: 'block', fontWeight: 'bold' 
};

const btnStyle = {
  color: '#fff', border: 'none', borderRadius: '8px', padding: '10px 16px', 
  cursor: 'pointer', fontWeight: 'bold', transition: 'all 0.2s'
};