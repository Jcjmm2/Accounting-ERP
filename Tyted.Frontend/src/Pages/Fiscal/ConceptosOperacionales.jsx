import { useState, useContext, useEffect, useCallback } from 'react';
import { ConfigContext } from '../../Context/ConfigContext';
import { fiscalApi, mensajeErrorApi } from '../../Services/Fiscal/FiscalApi';
import { contabilidadApi } from '../../Services/Contabilidad/ContabilidadApi';

// ---------------------------------------------------------------------------
// PANEL DE CONTROL DE CONCEPTOS DE OPERACIÓN (INGRESOS / GASTOS / COMPRAS)
//
// Catálogo por empresa que puentea los formularios del módulo fiscal con el
// plan de cuentas: cada concepto tiene una CuentaContable que el motor de
// asientos usa para generar el Debe (gastos) o el Haber (ventas) del comprobante.
// Si esa cuenta apunta a una cuenta PADRE/TÍTULO (EsMovimiento = false), el
// asiento automático falla; por eso el selector de cuenta SÓLO permite cuentas
// de MOVIMIENTO (hoja) y marca el resto como no aptas.
// ---------------------------------------------------------------------------

const TIPOS_OPERACION = [
  { valor: 'VENTA', etiqueta: '💰 Ingresos (VENTA)', color: '#34d399' },
  { valor: 'GASTO', etiqueta: '💸 Gastos (GASTO)', color: '#fbbf24' },
  { valor: 'COMPRA', etiqueta: '🛒 Compras (COMPRA)', color: '#60a5fa' }
];

const inputChico = {
  background: '#0f172a', color: '#fff', border: '1px solid #475569',
  borderRadius: '6px', padding: '8px 10px', fontSize: '0.85rem'
};

// Normaliza una cuenta del backend a los campos usados por el panel.
const normalizarCuenta = (c) => ({
  id: Number(c.id ?? c.Id ?? 0),
  codigo: String(c.codigoCuenta ?? c.CodigoCuenta ?? c.codigo ?? '').trim(),
  nombre: String(c.nombreCuenta ?? c.NombreCuenta ?? c.nombre ?? '').trim(),
  esMovimiento: Boolean(c.esMovimiento ?? c.EsMovimiento ?? true),
  activa: Boolean(c.activa ?? c.Activa ?? true),
  nivel: Number(c.nivel ?? c.Nivel ?? 0)
});

export default function ConceptosOperacionales() {
  const { empresaActiva } = useContext(ConfigContext);
  const empresaId = Number(empresaActiva?.id ?? 0);

  const [tipoActivo, setTipoActivo] = useState('VENTA');
  const [conceptos, setConceptos] = useState([]);
  const [cuentas, setCuentas] = useState([]);
  const [cargando, setCargando] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [busquedaCuenta, setBusquedaCuenta] = useState('');

  // Formulario crear/editar (editandoId null = alta)
  const [editandoId, setEditandoId] = useState(null);
  const [form, setForm] = useState({ nombreConcepto: '', tipoOperacion: 'VENTA', cuentaContable: '' });

  const cargarConceptos = useCallback(async (tipo) => {
    if (!empresaId || !tipo) { setConceptos([]); return; }
    setCargando(true);
    try {
      const data = await fiscalApi.getConceptos({ empresaId, tipo });
      setConceptos(Array.isArray(data) ? data : (data?.$values || []));
    } catch (error) {
      console.error('Error cargando conceptos de operación:', error);
      alert(`❌ No se pudieron cargar los conceptos:\n${mensajeErrorApi(error)}`);
    } finally {
      setCargando(false);
    }
  }, [empresaId]);

  // Plan de cuentas de la empresa (una sola vez) para el selector de cuenta.
  useEffect(() => {
    if (!empresaId) { setCuentas([]); return; }
    contabilidadApi.getCuentas(empresaId)
      .then((data) => setCuentas((Array.isArray(data) ? data : (data?.$values || [])).map(normalizarCuenta)))
      .catch((error) => {
        console.warn('Error cargando el plan de cuentas:', error);
        setCuentas([]);
      });
  }, [empresaId]);

  // Recarga al cambiar de tipo de operación
  useEffect(() => { cargarConceptos(tipoActivo); }, [cargarConceptos, tipoActivo]);

  // Cuentas aptas para asientos: activas y de MOVIMIENTO (no padres/títulos).
  const cuentasAptas = cuentas.filter((c) => c.activa && c.esMovimiento);
  const cuentasInactivas = cuentas.filter((c) => !c.activa);

  const cuentasFiltradas = (() => {
    const termino = busquedaCuenta.trim().toLowerCase();
    let base = cuentasAptas;
    if (termino) {
      base = base.filter((c) =>
        c.codigo.toLowerCase().includes(termino) || c.nombre.toLowerCase().includes(termino));
    }
    // Se incluye la cuenta actualmente asignada aunque sea padre, para que el
    // usuario visualice por qué el asiento automático falla.
    const asignada = cuentas.find((c) => c.codigo === form.cuentaContable.trim());
    if (asignada && !base.some((c) => c.id === asignada.id)) {
      return [asignada, ...base];
    }
    return base;
  })();

  const cuentaAsignada = cuentas.find((c) => c.codigo === form.cuentaContable.trim());
  const cuentaEsPadre = Boolean(cuentaAsignada && !cuentaAsignada.esMovimiento);

  const nombreCuentaDe = (codigo) => {
    const cta = cuentas.find((c) => c.codigo === String(codigo || '').trim());
    return cta ? cta.nombre : null;
  };

  const abrirAlta = () => {
    setEditandoId(null);
    setForm({ nombreConcepto: '', tipoOperacion: tipoActivo, cuentaContable: '' });
    setBusquedaCuenta('');
  };

  const abrirEdicion = (concepto) => {
    setEditandoId(concepto.id);
    setForm({
      nombreConcepto: concepto.nombreConcepto || '',
      tipoOperacion: concepto.tipoOperacion || tipoActivo,
      cuentaContable: concepto.cuentaContable || ''
    });
    setBusquedaCuenta(concepto.cuentaContable || '');
  };

  const cancelar = () => {
    setEditandoId(null);
    setForm({ nombreConcepto: '', tipoOperacion: tipoActivo, cuentaContable: '' });
    setBusquedaCuenta('');
  };

  const guardar = async () => {
    const nombre = form.nombreConcepto.trim();
    const cuenta = form.cuentaContable.trim();
    if (!nombre) { alert('⚠️ Indique el nombre del concepto.'); return; }
    if (!cuenta) { alert('⚠️ Asigne la cuenta contable del concepto.'); return; }
    if (cuentaEsPadre) {
      alert(
        '⚠️ La cuenta seleccionada es una cuenta PADRE/TÍTULO y no admite movimientos.\n\n' +
        'Elija una cuenta HIJA de movimiento para que el asiento automático pueda generar la partida doble.'
      );
      return;
    }

    const confirmado = window.confirm(
      `${editandoId ? 'Actualizar' : 'Crear'} el concepto «${nombre}» (${form.tipoOperacion}) con la cuenta ${cuenta}?\n\n` +
      'Esta cuenta será la que use el motor de asientos automáticos al contabilizar.'
    );
    if (!confirmado) return;

    setGuardando(true);
    try {
      if (editandoId) {
        await fiscalApi.actualizarConcepto(editandoId, {
          nombreConcepto: nombre,
          tipoOperacion: form.tipoOperacion,
          cuentaContable: cuenta
        });
      } else {
        await fiscalApi.crearConcepto({
          empresaId,
          nombreConcepto: nombre,
          tipoOperacion: form.tipoOperacion,
          cuentaContable: cuenta
        });
      }
      alert('✅ Concepto guardado.');
      cancelar();
      await cargarConceptos(tipoActivo);
    } catch (error) {
      console.error('Error guardando el concepto:', error);
      alert(`❌ No se pudo guardar el concepto:\n${mensajeErrorApi(error)}`);
    } finally {
      setGuardando(false);
    }
  };

  const eliminar = async (concepto) => {
    const confirmado = window.confirm(
      `¿Eliminar el concepto «${concepto.nombreConcepto}»?\n\n` +
      'El backend bloquea la eliminación si el concepto ya está en uso por ventas o gastos.'
    );
    if (!confirmado) return;
    try {
      await fiscalApi.eliminarConcepto(concepto.id);
      alert('✅ Concepto eliminado.');
      await cargarConceptos(tipoActivo);
    } catch (error) {
      console.error('Error eliminando el concepto:', error);
      alert(`❌ No se pudo eliminar el concepto:\n${mensajeErrorApi(error)}`);
    }
  };


  const hayContexto = Boolean(empresaId);

  return (
    <div style={{ padding: '24px', color: '#e2e8f0', minHeight: '80vh' }}>
      {/* Cabecera */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px',
        background: '#1e293b', padding: '16px 20px', borderRadius: '12px', border: '1px solid #334155', marginBottom: '20px'
      }}>
        <div>
          <h2 style={{ margin: '0 0 4px 0', color: '#f87171', fontSize: '1.2rem' }}>🧮 Conceptos de Ingresos y Gastos</h2>
          <span style={{ color: '#94a3b8', fontSize: '0.85rem' }}>
            🏢 <b style={{ color: '#60a5fa' }}>{empresaActiva?.razonSocial || empresaActiva?.nombre || '—'}</b>
            {' · '}Asignación de cuentas contables para los asientos automáticos del módulo fiscal
          </span>
        </div>
        <button
          onClick={abrirAlta}
          disabled={!hayContexto}
          style={{
            background: '#059669', color: '#fff', border: 'none', borderRadius: '8px',
            padding: '10px 16px', cursor: hayContexto ? 'pointer' : 'not-allowed',
            fontWeight: 'bold', opacity: hayContexto ? 1 : 0.5
          }}
          title="Crear un concepto nuevo para el tipo seleccionado"
        >
          ➕ Nuevo concepto
        </button>
      </div>

      {/* Nota metodológica */}
      <div style={{ background: '#0f172a', border: '1px solid #334155', color: '#94a3b8', padding: '12px 16px', borderRadius: '10px', fontSize: '0.82rem', marginBottom: '18px', lineHeight: '1.5' }}>
        📎 Cada concepto enlaza un nombre de operación con una <b>cuenta contable de MOVIMIENTO</b> de la empresa.
        Al registrar ventas o gastos en el módulo fiscal, el motor usa esa cuenta para generar el asiento
        (Haber en ingresos / Debe en gastos). Si la cuenta asignada es una <b>cuenta padre o título</b>, el
        comprobante automático falla: aquí puede corregirlo reasignando una cuenta hija.
        <b> Crear, editar y eliminar conceptos requiere rol Administrador.</b>
      </div>

      {!hayContexto ? (
        <div style={{ background: '#1e293b', border: '1px solid #f59e0b', color: '#fcd34d', padding: '16px', borderRadius: '10px' }}>
          ⚠️ Seleccione una empresa en el menú lateral para gestionar sus conceptos.
        </div>
      ) : (
        <>
          {/* Selector de tipo de operación */}
          <div style={{ display: 'flex', gap: '8px', marginBottom: '18px', flexWrap: 'wrap' }}>
            {TIPOS_OPERACION.map((t) => (
              <button
                key={t.valor}
                onClick={() => { setTipoActivo(t.valor); cancelar(); }}
                style={{
                  background: tipoActivo === t.valor ? t.color : '#1e293b',
                  color: tipoActivo === t.valor ? '#0f172a' : '#94a3b8',
                  border: '1px solid #334155', borderRadius: '8px',
                  padding: '9px 18px', cursor: 'pointer', fontWeight: 'bold', fontSize: '0.85rem'
                }}
              >
                {t.etiqueta}
              </button>
            ))}
          </div>


          {/* Formulario de alta/edición */}
          {Boolean(form.nombreConcepto || editandoId || form.cuentaContable) && (
            <div style={{ background: '#1e293b', border: '1px solid #16a34a', borderRadius: '12px', padding: '20px', marginBottom: '20px' }}>
              <h3 style={{ margin: '0 0 12px 0', color: '#34d399', fontSize: '1.05rem' }}>
                {editandoId ? '✏️ Editar concepto' : '➕ Nuevo concepto'}
              </h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '14px', marginBottom: '14px' }}>
                <div>
                  <label style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Nombre del concepto</label>
                  <input
                    type="text"
                    value={form.nombreConcepto}
                    onChange={(e) => setForm({ ...form, nombreConcepto: e.target.value })}
                    placeholder="Ej: Servicios de internet"
                    style={{ ...inputChico, width: '100%' }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Tipo de operación</label>
                  <select
                    value={form.tipoOperacion}
                    onChange={(e) => setForm({ ...form, tipoOperacion: e.target.value })}
                    style={{ ...inputChico, width: '100%' }}
                  >
                    {TIPOS_OPERACION.map((t) => <option key={t.valor} value={t.valor}>{t.etiqueta}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Cuenta contable (sólo de movimiento)</label>
                  <select
                    value={form.cuentaContable}
                    onChange={(e) => setForm({ ...form, cuentaContable: e.target.value })}
                    style={{ ...inputChico, width: '100%', border: cuentaEsPadre ? '1px solid #f87171' : undefined }}
                  >
                    <option value="">Seleccione la cuenta…</option>
                    {cuentaAsignada && !cuentaAsignada.esMovimiento && (
                      <option value={cuentaAsignada.codigo}>
                        ⚠️ {cuentaAsignada.codigo} - {cuentaAsignada.nombre} (CUENTA PADRE, NO APTA)
                      </option>
                    )}
                    {cuentasFiltradas.map((c) => (
                      <option key={c.id} value={c.codigo}>
                        {c.codigo} - {c.nombre}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Búsqueda dentro del plan de cuentas */}
              <div style={{ marginBottom: '12px' }}>
                <input
                  type="text"
                  value={busquedaCuenta}
                  onChange={(e) => setBusquedaCuenta(e.target.value)}
                  placeholder="🔍 Buscar cuenta por código o nombre…"
                  style={{ ...inputChico, width: '100%', maxWidth: '480px' }}
                />
                <span style={{ fontSize: '0.72rem', color: '#64748b' }}>
                  Se muestran {cuentasFiltradas.length} cuentas (de {cuentasAptas.length} de movimiento activas
                  {cuentasInactivas.length > 0 ? `; ${cuentasInactivas.length} inactivas ocultas` : ''}).
                </span>
              </div>

              {/* Advertencia si la cuenta asignada es padre/título */}
              {cuentaEsPadre && (
                <div style={{ background: '#2d1215', border: '1px solid #f87171', color: '#fca5a5', padding: '10px 14px', borderRadius: '8px', fontSize: '0.82rem', marginBottom: '12px' }}>
                  ⚠️ <b>{cuentaAsignada.codigo} - {cuentaAsignada.nombre}</b> es una cuenta <b>padre/título</b> (sin movimientos).
                  Los asientos automáticos fallan con este tipo de cuentas: seleccione una cuenta hija de movimiento.
                </div>
              )}

              {/* Cuenta seleccionada (resumen) */}
              {form.cuentaContable && !cuentaEsPadre && (
                <div style={{ background: '#0f172a', border: '1px solid #16a34a', color: '#86efac', padding: '10px 14px', borderRadius: '8px', fontSize: '0.82rem', marginBottom: '12px' }}>
                  ✅ Cuenta asignada: <b>{form.cuentaContable}</b>
                  {cuentaAsignada?.nombre ? ` - ${cuentaAsignada.nombre}` : ''}
                  {' · '}El asiento automático usará esta cuenta ({form.tipoOperacion === 'GASTO' ? 'Debe' : 'Haber'}).
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button onClick={cancelar} style={{ background: '#475569', color: '#fff', border: 'none', borderRadius: '8px', padding: '9px 16px', cursor: 'pointer', fontWeight: 'bold' }}>Cancelar</button>
                <button
                  onClick={guardar}
                  disabled={guardando || cuentaEsPadre}
                  style={{
                    background: '#16a34a', color: '#fff', border: 'none', borderRadius: '8px', padding: '9px 18px',
                    cursor: guardar || cuentaEsPadre ? 'not-allowed' : 'pointer', fontWeight: 'bold',
                    opacity: guardar || cuentaEsPadre ? 0.6 : 1
                  }}
                >
                  {guardando ? '⏳ Guardando…' : '💾 Guardar concepto'}
                </button>
              </div>
            </div>
          )}


          {/* Listado de conceptos del tipo activo */}
          {cargando ? (
            <div style={{ textAlign: 'center', padding: '40px', color: '#94a3b8' }}>⏳ Cargando conceptos…</div>
          ) : conceptos.length === 0 ? (
            <div style={{ background: '#0f172a', border: '1px dashed #475569', padding: '30px', textAlign: 'center', borderRadius: '12px', color: '#94a3b8' }}>
              No hay conceptos de tipo «{tipoActivo}» para esta empresa. Use «➕ Nuevo concepto» para crear el primero.
            </div>
          ) : (
            <div style={{ background: '#111827', borderRadius: '12px', overflowX: 'auto', border: '1px solid #334155' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                <thead>
                  <tr style={{ background: '#1e293b', color: '#93c5fd' }}>
                    <th style={{ padding: '10px 8px', textAlign: 'left', fontWeight: 'bold' }}>Concepto</th>
                    <th style={{ padding: '10px 8px', textAlign: 'left', fontWeight: 'bold' }}>Tipo</th>
                    <th style={{ padding: '10px 8px', textAlign: 'left', fontWeight: 'bold' }}>Cuenta contable</th>
                    <th style={{ padding: '10px 8px', textAlign: 'left', fontWeight: 'bold' }}>Nombre de la cuenta</th>
                    <th style={{ padding: '10px 8px', textAlign: 'left', fontWeight: 'bold' }}>Apto para asientos</th>
                    <th style={{ padding: '10px 8px', textAlign: 'center', fontWeight: 'bold' }}>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {conceptos.map((c) => {
                    const cuenta = cuentas.find((x) => x.codigo === String(c.cuentaContable || '').trim());
                    const esPadre = Boolean(cuenta && !cuenta.esMovimiento);
                    const inactiva = Boolean(cuenta && !cuenta.activa);
                    return (
                      <tr key={c.id} style={{ borderTop: '1px solid #1f2937' }}>
                        <td style={{ padding: '10px 8px' }}><b>{c.nombreConcepto}</b></td>
                        <td style={{ padding: '10px 8px' }}>
                          <span style={{ background: '#1e3a5f', color: '#93c5fd', padding: '2px 8px', borderRadius: '10px', fontSize: '0.75rem', fontWeight: 'bold' }}>
                            {c.tipoOperacion}
                          </span>
                        </td>
                        <td style={{ padding: '10px 8px', fontFamily: 'monospace' }}>{c.cuentaContable}</td>
                        <td style={{ padding: '10px 8px' }}>
                          {nombreCuentaDe(c.cuentaContable) || <span style={{ color: '#f87171' }}>cuenta no encontrada en el plan</span>}
                        </td>
                        <td style={{ padding: '10px 8px' }}>
                          {!cuenta ? (
                            <span style={{ color: '#f87171', fontWeight: 'bold' }}>⚠️ cuenta inexistente</span>
                          ) : inactiva ? (
                            <span style={{ color: '#fbbf24', fontWeight: 'bold' }}>⚠️ cuenta inactiva</span>
                          ) : esPadre ? (
                            <span style={{ color: '#f87171', fontWeight: 'bold' }}>⚠️ cuenta padre (no apta)</span>
                          ) : (
                            <span style={{ color: '#34d399', fontWeight: 'bold' }}>✅ apta</span>
                          )}
                        </td>
                        <td style={{ padding: '10px 8px', textAlign: 'center', whiteSpace: 'nowrap' }}>
                          <button
                            onClick={() => abrirEdicion(c)}
                            title="Editar concepto (nombre y cuenta contable)"
                            style={{ background: '#3b82f6', color: '#fff', border: 'none', borderRadius: '5px', padding: '5px 9px', cursor: 'pointer', marginRight: '6px' }}
                          >
                            ✏️
                          </button>
                          <button
                            onClick={() => eliminar(c)}
                            title="Eliminar concepto (bloqueado si está en uso)"
                            style={{ background: '#7f1d1d', color: '#fff', border: 'none', borderRadius: '5px', padding: '5px 9px', cursor: 'pointer' }}
                          >
                            🗑️
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}

