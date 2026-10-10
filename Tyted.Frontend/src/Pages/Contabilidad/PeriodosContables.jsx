import { useEffect, useState, useContext } from 'react';
import { contabilidadApi, mensajeErrorApi } from '../../Services/Contabilidad/ContabilidadApi';
import { ConfigContext } from '../../Context/ConfigContext';

export default function PeriodosContables() {
  // 1. Extraemos la empresa activa y la función de refresco del contexto global
  const { empresaActiva, refrescarContextoContable, user } = useContext(ConfigContext);

  const [periodosAnuales, setPeriodosAnuales] = useState([]);
  const [anioNuevo, setAnioNuevo] = useState(new Date().getFullYear());
  const [expandidos, setExpandidos] = useState({});
  const [cargando, setCargando] = useState(false);
  // Id del periodo que está generando su asiento de cierre de resultados (spinner)
  const [generandoCierreId, setGenerandoCierreId] = useState(null);

  const cargarPeriodos = async () => {
    if (!empresaActiva?.id) return;
    setCargando(true);
    
    try {
      const data = await contabilidadApi.getPeriodos(empresaActiva.id);
      const lista = Array.isArray(data) ? data : (data?.$values || []);
      
      // 2. CORRECCIÓN: Filtramos estrictamente los periodos para que coincidan con la empresa seleccionada
      const periodosEmpresa = lista.filter(p => Number(p.empresaId) === Number(empresaActiva.id));
      
      setPeriodosAnuales(periodosEmpresa);
      
      // Expandir el primer año por defecto si hay datos
      if (periodosEmpresa.length > 0) {
        setExpandidos({ [periodosEmpresa[0].id]: true });
      } else {
        setExpandidos({});
      }
    } catch (error) {
      console.error('Error cargando ejercicios fiscales:', error);
    } finally {
      setCargando(false);
    }
  };

  // 3. CORRECCIÓN: Recargar la tabla automáticamente si el usuario cambia de empresa en el selector global
  useEffect(() => {
    cargarPeriodos();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [empresaActiva]);

  // --- PERIODO DE APERTURA DE LA EMPRESA ---
  // El periodo más antiguo (menor fecha de inicio) ES la apertura: no se
  // pueden crear ejercicios anteriores a él. El backend también lo valida
  // (fuente de verdad); aquí sólo se limita y se avisa en la interfaz.
  const fechasPeriodos = periodosAnuales
    .map(p => p.fechaInicio)
    .filter(Boolean)
    .sort();
  const fechaApertura = fechasPeriodos[0] || null;
  const anioApertura = fechaApertura ? new Date(fechaApertura).getFullYear() : null;

  const toggleExpandir = (id) => {
    setExpandidos(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const crearEjercicioCompleto = async (e) => {
    e.preventDefault();
    
    // Validación de UI para no crear años duplicados en la misma empresa
    const anioExiste = periodosAnuales.some(p => Number(p.anio) === Number(anioNuevo));
    if (anioExiste) {
      alert(`⚠️ El Ejercicio Fiscal ${anioNuevo} ya existe para ${empresaActiva.nombre}.`);
      return;
    }

    // Seguridad financiera: no se permiten ejercicios anteriores al periodo
    // de apertura de la empresa (la contabilidad arranca en ese periodo).
    if (anioApertura !== null && Number(anioNuevo) < anioApertura) {
      alert(`⚠️ No se permiten ejercicios anteriores al periodo de apertura (${anioApertura}).\nLa contabilidad de ${empresaActiva.nombre} arranca en ese periodo.`);
      return;
    }

    try {
      await contabilidadApi.crearPeriodo({
        empresaId: empresaActiva.id, // 4. CORRECCIÓN: Usar el ID real en lugar del "1" fijo
        anio: Number(anioNuevo),
        tipoPeriodo: 'Anual'
      });
      alert(`✅ Ejercicio Fiscal ${anioNuevo} generado con éxito para ${empresaActiva.nombre}.`);
      
      await cargarPeriodos();
      if (refrescarContextoContable) await refrescarContextoContable(); // Actualiza el selector global
    } catch (error) {
      console.error('Error creando el ejercicio fiscal:', error);
      alert('❌ Error al crear el ejercicio fiscal.');
    }
  };

  // Genera el asiento de cierre de resultados del periodo seleccionado: el
  // resultado (utilidad o pérdida) se traslada a la cuenta de patrimonio
  // "RESULTADOS DEL EJERCICIO" y queda registrado en el libro mayor, de modo
  // que el estado de situación financiera cumple ACTIVO = PASIVO + PATRIMONIO.
  const generarCierre = async (periodo) => {
    const nombrePeriodo = periodo?.nombre || `ID ${periodo?.id}`;
    const confirmado = window.confirm(
      `Se generará el asiento de cierre de resultados del periodo «${nombrePeriodo}».\n\n` +
      'El resultado del periodo (utilidad o pérdida) se transferirá a la cuenta de patrimonio ' +
      '"RESULTADOS DEL EJERCICIO" y las cuentas de ingresos y egresos quedarán en cero.\n\n' +
      'Si el periodo ya tiene un cierre del sistema, será reemplazado por el nuevo. ¿Continuar?'
    );
    if (!confirmado) return;

    setGenerandoCierreId(periodo.id);
    try {
      // regenerar: true porque la confirmación del usuario ya autoriza
      // reemplazar el cierre previo del sistema (si existía).
      const r = await contabilidadApi.generarCierreResultados({
        periodoId: periodo.id,
        empresaId: empresaActiva?.id,
        usuarioId: Number(user?.id ?? 1),
        usuario: user?.username || user?.nombre || 'Sistema',
        regenerar: true
      });

      const monto = Math.abs(Number(r.resultado ?? 0)).toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      alert(
        `✅ Asiento de cierre generado: ${r.numeroComprobante}\n\n` +
        `Periodo: ${nombrePeriodo}\n` +
        `Cuenta destino: ${r.cuentaResultadosCodigo} - ${r.cuentaResultadosNombre}` +
        `${r.cuentaResultadosCreada ? ' (creada automáticamente)' : ''}\n` +
        `${r.esUtilidad ? '💰 Utilidad' : '📉 Pérdida'} del periodo: ${monto}\n` +
        `Líneas del asiento: ${r.cantidadDetalles}`
      );

      await cargarPeriodos();
    } catch (error) {
      console.error('Error generando el asiento de cierre:', error);
      alert(`❌ No se pudo generar el asiento de cierre:\n${mensajeErrorApi(error)}`);
    } finally {
      setGenerandoCierreId(null);
    }
  };

  // Paso 2 del flujo: ejecuta el cierre con traslado y muestra el resultado.
  const ejecutarCierrePeriodo = async (periodo, nombrePeriodo) => {
    const r = await contabilidadApi.cerrarPeriodo(
      periodo.id,
      user?.username || user?.nombre || 'Sistema',
      Number(user?.id ?? 1),
      true
    );

    const fmt = (v) => Number(v ?? 0).toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    if (r.trasladoGenerado) {
      alert(
        `✅ Periodo cerrado y saldos trasladados\n\n` +
        `Periodo cerrado: ${nombrePeriodo}\n` +
        `Comprobante de apertura: ${r.numeroComprobante}\n` +
        `Destino: ${r.periodoDestinoNombre}\n` +
        `Cuentas trasladadas: ${r.cuentasTrasladadas}\n` +
        `Debe: ${fmt(r.totalDebe)} | Haber: ${fmt(r.totalHaber)}`
      );
    } else {
      alert(`✅ Periodo cerrado.\n\n${r.mensaje || 'Sin cuentas con saldo: no se generó el asiento de apertura.'}`);
    }

    await cargarPeriodos();
    if (refrescarContextoContable) await refrescarContextoContable();
    return r;
  };

  // FLUJO DE CIERRE RECOMENDADO: 📉 Cierre de Resultados → 🔒 Cerrar y Trasladar.
  // Si el usuario llega al paso 2 sin el Cierre de Resultados, el backend lo
  // rechaza y aquí se ofrece GENERARLO AUTOMÁTICAMENTE y reintentar el
  // cierre+traslado en un solo paso (sin perder el contexto del periodo).
  const cerrarYTrasladar = async (periodo) => {
    const nombrePeriodo = periodo?.nombre || `ID ${periodo?.id}`;
    const confirmado = window.confirm(
      `Se cerrará el periodo «${nombrePeriodo}» y se trasladarán sus saldos.\n\n` +
      'Flujo de cierre:\n' +
      '1) 📉 Cierre de Resultados (si falta, el sistema ofrecerá generarlo automáticamente).\n' +
      '2) 🔒 Cerrar y Trasladar: asiento «APERTURA DE BALANCE» con los saldos de ACTIVO, PASIVO y PATRIMONIO en el periodo siguiente.\n' +
      '3) El periodo y sus subperiodos quedarán CERRADOS: no se aceptarán más asientos.\n\n¿Continuar?'
    );
    if (!confirmado) return;

    setGenerandoCierreId(periodo.id);
    try {
      await ejecutarCierrePeriodo(periodo, nombrePeriodo);
    } catch (error) {
      const mensaje = mensajeErrorApi(error);

      // PASO 1 DEL FLUJO: faltaba el Cierre de Resultados → se ofrece hacerlo ya
      if (mensaje.includes('Cierre de Resultados')) {
        const generarAhora = window.confirm(
          `⏳ Paso 1 del flujo de cierre: «${nombrePeriodo}» todavía tiene ingresos y egresos sin cerrar.\n\n` +
          'Para cerrar y trasladar saldos primero debe generarse el «📉 Cierre de Resultados» ' +
          '(las cuentas de ingreso/egreso quedarán en cero y el resultado se transferirá a patrimonio).\n\n' +
          '¿Generarlo ahora automáticamente y continuar con «🔒 Cerrar y Trasladar»?'
        );
        if (!generarAhora) return;

        try {
          await contabilidadApi.generarCierreResultados({
            periodoId: periodo.id,
            empresaId: empresaActiva?.id,
            usuarioId: Number(user?.id ?? 1),
            usuario: user?.username || user?.nombre || 'Sistema',
            regenerar: true
          });
          // Paso 2: reintentar el cierre con traslado
          await ejecutarCierrePeriodo(periodo, nombrePeriodo);
        } catch (error2) {
          console.error('Error completando el flujo de cierre:', error2);
          alert(`❌ No se pudo completar el flujo de cierre:\n${mensajeErrorApi(error2)}`);
        }
        return;
      }

      console.error('Error cerrando el periodo:', error);
      alert(`❌ No se pudo cerrar el periodo:\n${mensaje}`);
    } finally {
      setGenerandoCierreId(null);
    }
  };

  // ELIMINACIÓN DE PERIODOS VACÍOS: corrige en la aplicación periodos
  // antiguos erróneos (p. ej. un mal periodo de apertura) sin tocar la BD.
  // El backend sólo acepta periodos sin asientos; los ejercicios anuales
  // vacíos se eliminan en cascada con sus subperiodos.
  const eliminarPeriodo = async (periodo, esSubperiodo = false) => {
    const nombrePeriodo = periodo?.nombre || `ID ${periodo?.id}`;

    // Periodos de la empresa (padres + subperiodos) para calcular el nuevo
    // periodo de apertura tras la eliminación (menor fecha entre los restantes)
    const todos = periodosAnuales.flatMap(p => {
      const subs = p.subPeriodos?.$values || p.subPeriodos || [];
      return [p, ...subs];
    });
    const aEliminar = new Set([Number(periodo.id)]);
    if (!esSubperiodo) {
      (periodo.subPeriodos?.$values || periodo.subPeriodos || []).forEach(s => aEliminar.add(Number(s.id)));
    }
    const nuevoApertura = todos
      .filter(p => !aEliminar.has(Number(p.id)))
      .slice()
      .sort((a, b) => new Date(a.fechaInicio).getTime() - new Date(b.fechaInicio).getTime())[0];

    const confirmado = window.confirm(
      `¿Eliminar el periodo «${nombrePeriodo}»?\n\n` +
      '- Sólo se pueden eliminar periodos VACÍOS (sin asientos contables; el backend lo valida).\n' +
      (esSubperiodo ? '' : '- Si es un ejercicio anual, sus subperiodos vacíos se eliminarán en cascada.\n') +
      `- Al eliminarlo, el nuevo periodo de apertura será: ${nuevoApertura ? `«${nuevoApertura.nombre}»` : 'ninguno (el próximo periodo creado será la apertura)'}.\n\n` +
      'Esta acción no se puede deshacer. ¿Continuar?'
    );
    if (!confirmado) return;

    try {
      const r = await contabilidadApi.eliminarPeriodo(periodo.id, user?.username || user?.nombre || 'Sistema');
      alert(
        `✅ Periodo eliminado: ${nombrePeriodo}` +
        (r.subperiodosEliminados > 0 ? `\nSubperiodos eliminados en cascada: ${r.subperiodosEliminados}` : '') +
        `\nNuevo periodo de apertura: ${r.nuevoPeriodoAperturaNombre || 'ninguno (el próximo periodo creado será la apertura)'}`
      );
      await cargarPeriodos();
      if (refrescarContextoContable) await refrescarContextoContable();
    } catch (error) {
      console.error('Error eliminando el periodo:', error);
      alert(`❌ No se pudo eliminar el periodo:\n${mensajeErrorApi(error)}`);
    }
  };

  return (
    <div style={{ padding: '24px', color: '#e2e8f0' }}>
      
      {/* Cabecera mejorada con indicación de la empresa */}
      <div style={{ marginBottom: '24px', borderBottom: '1px solid #334155', paddingBottom: '16px' }}>
        <h2 style={{ margin: '0 0 8px 0', color: '#fff' }}>Gestión de Ejercicios Fiscales</h2>
        <p style={{ margin: 0, color: '#94a3b8', fontSize: '0.9rem' }}>
          Administrando periodos para la entidad: <strong style={{ color: '#60a5fa' }}>{empresaActiva?.nombre}</strong>
        </p>
      </div>

      {/* Formulario de apertura de año completo */}
      <div style={{ background: '#1e293b', padding: '20px', borderRadius: '12px', border: '1px solid #334155', marginBottom: '28px' }}>
        <h3 style={{ margin: '0 0 12px 0', fontSize: '1rem', color: '#fbbf24' }}>🚀 Aperturar Nuevo Ejercicio</h3>
        <form onSubmit={crearEjercicioCompleto} style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <label style={{ fontSize: '0.75rem', color: '#94a3b8', marginBottom: '4px' }}>Año Fiscal</label>
            <input
              type="number"
              value={anioNuevo}
              onChange={(e) => setAnioNuevo(e.target.value)}
              min={anioApertura ?? undefined}
              title={anioApertura !== null ? `No se permiten años anteriores al periodo de apertura (${anioApertura})` : undefined}
              style={{ padding: '10px 12px', borderRadius: '8px', border: '1px solid #475569', background: '#0f172a', color: '#fff', width: '140px', fontSize: '1rem' }}
            />
          </div>
          <button type="submit" style={{ background: '#2563eb', color: '#fff', border: 'none', borderRadius: '8px', padding: '10px 20px', cursor: 'pointer', fontWeight: 'bold', marginTop: '18px' }}>
            ➕ Crear Año Calendario
          </button>
        </form>
      </div>

      {/* Estructura Jerárquica */}
      <div style={{ display: 'grid', gap: '16px' }}>
        {cargando ? (
          <p style={{ color: '#94a3b8', textAlign: 'center', padding: '20px' }}>Cargando ejercicios fiscales...</p>
        ) : periodosAnuales.length === 0 ? (
          <div style={{ background: '#0f172a', border: '1px dashed #475569', padding: '30px', textAlign: 'center', borderRadius: '12px' }}>
            <p style={{ color: '#94a3b8', margin: 0 }}>No hay ejercicios fiscales registrados para esta empresa.</p>
          </div>
        ) : (
          periodosAnuales.map((padre) => {
            const subperiodos = padre.subPeriodos?.$values || padre.subPeriodos || [];
            const estaExpandido = expandidos[padre.id];

            return (
              <div key={padre.id} style={{ background: '#111827', borderRadius: '12px', border: '1px solid #1f2937', overflow: 'hidden', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }}>
                {/* Cabecera del Ejercicio Anual */}
                <div 
                  onClick={() => toggleExpandir(padre.id)}
                  style={{ padding: '16px 20px', background: '#1e293b', display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', transition: 'background 0.2s' }}
                  onMouseEnter={(e) => e.currentTarget.style.background = '#334155'}
                  onMouseLeave={(e) => e.currentTarget.style.background = '#1e293b'}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                    <span style={{ fontSize: '1.5rem' }}>{estaExpandido ? '📂' : '📁'}</span>
                    <div>
                      <strong style={{ fontSize: '1.15rem', color: '#60a5fa' }}>{padre.nombre || `Ejercicio Fiscal ${padre.anio}`}</strong>
                      {fechaApertura && new Date(padre.fechaInicio).getTime() === new Date(fechaApertura).getTime() && (
                        <span style={{
                          marginLeft: '10px', padding: '3px 10px', borderRadius: '12px',
                          background: '#3b2f0b', border: '1px solid #f59e0b', color: '#fbbf24',
                          fontSize: '0.7rem', fontWeight: 'bold', verticalAlign: 'middle'
                        }}>
                          🏁 Periodo de Apertura
                        </span>
                      )}
                      <span style={{ display: 'block', fontSize: '0.8rem', color: '#94a3b8', marginTop: '2px' }}>
                        1 Enero al 31 Diciembre ({padre.anio})
                      </span>
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); eliminarPeriodo(padre, false); }}
                      disabled={generandoCierreId !== null}
                      title="Eliminar el ejercicio: sólo si está vacío (sin asientos). Sus subperiodos vacíos se eliminan en cascada."
                      style={{
                        background: '#7f1d1d', color: '#fff', border: 'none', borderRadius: '6px', padding: '6px 10px',
                        fontSize: '0.75rem', fontWeight: 'bold',
                        cursor: generandoCierreId === null ? 'pointer' : 'not-allowed',
                        opacity: generandoCierreId === null ? 1 : 0.5
                      }}
                    >
                      🗑️
                    </button>
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); cerrarYTrasladar(padre); }}
                      disabled={padre.estado !== 'Abierto' || generandoCierreId !== null}
                      title={padre.estado !== 'Abierto' ? 'El ejercicio está cerrado' : 'Cerrar el ejercicio y trasladar los saldos de activo, pasivo y patrimonio al periodo siguiente (asiento «APERTURA DE BALANCE»). Exige el Cierre de Resultados previo'}
                      style={{
                        background: padre.estado === 'Abierto' ? '#059669' : '#334155',
                        color: '#fff', border: 'none', borderRadius: '6px', padding: '6px 12px',
                        fontSize: '0.75rem', fontWeight: 'bold',
                        cursor: padre.estado === 'Abierto' && generandoCierreId === null ? 'pointer' : 'not-allowed',
                        opacity: padre.estado === 'Abierto' && generandoCierreId === null ? 1 : 0.5
                      }}
                    >
                      {generandoCierreId === padre.id ? '⏳ Cerrando...' : '🔒 Cerrar y Trasladar'}
                    </button>
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); generarCierre(padre); }}
                      disabled={padre.estado !== 'Abierto' || generandoCierreId !== null}
                      title={padre.estado !== 'Abierto' ? 'El ejercicio está cerrado: no se pueden generar asientos de cierre' : 'Generar el asiento que traslada el resultado del ejercicio a la cuenta de patrimonio "Resultados del ejercicio"'}
                      style={{
                        background: padre.estado === 'Abierto' ? '#7c3aed' : '#334155',
                        color: '#fff', border: 'none', borderRadius: '6px', padding: '6px 12px',
                        fontSize: '0.75rem', fontWeight: 'bold',
                        cursor: padre.estado === 'Abierto' && generandoCierreId === null ? 'pointer' : 'not-allowed',
                        opacity: padre.estado === 'Abierto' && generandoCierreId === null ? 1 : 0.5
                      }}
                    >
                      {generandoCierreId === padre.id ? '⏳ Generando...' : '📉 Cierre de Resultados'}
                    </button>
                    <span style={{ padding: '6px 14px', borderRadius: '20px', fontSize: '0.75rem', fontWeight: 'bold', background: padre.estado === 'Abierto' ? '#064e3b' : '#7f1d1d', color: padre.estado === 'Abierto' ? '#34d399' : '#fca5a5' }}>
                      {padre.estado}
                    </span>
                    <span style={{ color: '#94a3b8', fontSize: '1.2rem' }}>{estaExpandido ? '▲' : '▼'}</span>
                  </div>
                </div>

                {/* Subperiodos Mensuales */}
                {estaExpandido && (
                  <div style={{ padding: '20px', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '14px', background: '#0f172a' }}>
                    {subperiodos.length === 0 ? (
                      <p style={{ color: '#64748b', fontSize: '0.9rem', gridColumn: '1 / -1' }}>No hay subperiodos mensuales vinculados.</p>
                    ) : (
                      subperiodos.map((sub) => (
                        <div key={sub.id} style={{ background: '#1e293b', padding: '14px', borderRadius: '8px', border: '1px solid #334155', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                          <div>
                            <strong style={{ color: '#fbbf24', display: 'block', marginBottom: '6px', fontSize: '0.95rem' }}>{sub.nombre}</strong>
                            <span style={{ fontSize: '0.75rem', color: '#94a3b8', display: 'block', marginBottom: '12px' }}>
                              {new Date(sub.fechaInicio).toLocaleDateString()} - {new Date(sub.fechaFin).toLocaleDateString()}
                            </span>
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' }}>
                            <span style={{ padding: '4px 10px', borderRadius: '6px', fontSize: '0.7rem', fontWeight: 'bold', background: sub.estado === 'Abierto' ? '#064e3b' : '#7f1d1d', color: sub.estado === 'Abierto' ? '#34d399' : '#fca5a5' }}>
                              {sub.estado}
                            </span>
                            <button
                              type="button"
                              onClick={() => cerrarYTrasladar(sub)}
                              disabled={sub.estado !== 'Abierto' || generandoCierreId !== null}
                              title={sub.estado !== 'Abierto' ? 'El periodo está cerrado' : 'Cerrar el periodo y trasladar los saldos de activo, pasivo y patrimonio al periodo siguiente (asiento «APERTURA DE BALANCE»). Exige el Cierre de Resultados previo'}
                              style={{
                                background: sub.estado === 'Abierto' ? '#059669' : '#334155',
                                color: '#fff', border: 'none', borderRadius: '6px', padding: '4px 10px',
                                fontSize: '0.7rem', fontWeight: 'bold',
                                cursor: sub.estado === 'Abierto' && generandoCierreId === null ? 'pointer' : 'not-allowed',
                                opacity: sub.estado === 'Abierto' && generandoCierreId === null ? 1 : 0.5
                              }}
                            >
                              {generandoCierreId === sub.id ? '⏳' : '🔒 Cerrar'}
                            </button>
                            <button
                              type="button"
                              onClick={() => generarCierre(sub)}
                              disabled={sub.estado !== 'Abierto' || generandoCierreId !== null}
                              title={sub.estado !== 'Abierto' ? 'El periodo está cerrado: no se pueden generar asientos de cierre' : 'Generar el asiento que traslada el resultado del periodo a la cuenta de patrimonio "Resultados del ejercicio"'}
                              style={{
                                background: sub.estado === 'Abierto' ? '#7c3aed' : '#334155',
                                color: '#fff', border: 'none', borderRadius: '6px', padding: '4px 10px',
                                fontSize: '0.7rem', fontWeight: 'bold',
                                cursor: sub.estado === 'Abierto' && generandoCierreId === null ? 'pointer' : 'not-allowed',
                                opacity: sub.estado === 'Abierto' && generandoCierreId === null ? 1 : 0.5
                              }}
                            >
                              {generandoCierreId === sub.id ? '⏳' : '📉 Cierre'}
                            </button>
                            <button
                              type="button"
                              onClick={() => eliminarPeriodo(sub, true)}
                              disabled={generandoCierreId !== null}
                              title="Eliminar el subperiodo: sólo si está vacío (sin asientos)"
                              style={{
                                background: '#7f1d1d', color: '#fff', border: 'none', borderRadius: '6px', padding: '4px 8px',
                                fontSize: '0.7rem', fontWeight: 'bold',
                                cursor: generandoCierreId === null ? 'pointer' : 'not-allowed',
                                opacity: generandoCierreId === null ? 1 : 0.5
                              }}
                            >
                              🗑️
                            </button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
