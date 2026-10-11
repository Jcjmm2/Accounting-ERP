import { useState, useContext, useEffect, useCallback, useMemo } from 'react';
import { ConfigContext } from '../../Context/ConfigContext';
import { fiscalApi } from '../../Services/Fiscal/FiscalApi';
import {
  calcularForma30,
  seccionesForma30,
  exportarForma30Xls,
  exportarForma30Pdf
} from './forma30';

// ---------------------------------------------------------------------------
// FORMA 30 SENIAT: borrador consolidado del período. Cruza el Libro de Ventas
// (facturas + resúmenes Z) con el Libro de Compras y las retenciones emitidas;
// las casillas 48/20/38/66 se capturan manualmente (no provienen de los libros).
// ---------------------------------------------------------------------------

const fmt = (v) => Number(v ?? 0).toLocaleString('es-VE', {
  minimumFractionDigits: 2, maximumFractionDigits: 2
});

const inputChico = {
  background: '#0f172a', color: '#fff', border: '1px solid #475569',
  borderRadius: '6px', padding: '6px 8px', fontSize: '0.8rem', width: '140px'
};

const normalizar = (data) => (Array.isArray(data) ? data : (data?.$values || []));

// Ítem de casilla -> clave de estado del input manual.
const CAMPOS_MANUALES = { '48': 'item48', '20': 'item20', '38': 'item38', '66': 'item66' };
// Filas de totales (se resaltan en negrita).
const CASILLAS_TOTALES = new Set(['46', '47', '49', '35', '36', '71', '39', '53', '60', '90']);

export default function ReporteForma30() {
  const { empresaActiva, periodoActivo } = useContext(ConfigContext);

  const empresaId = Number(empresaActiva?.id ?? 0);
  const fechaInicio = periodoActivo?.fechaInicio;
  const fechaFin = periodoActivo?.fechaFin;
  const hayContexto = Boolean(empresaId && fechaInicio && fechaFin);

  const [ventas, setVentas] = useState([]);
  const [resumenes, setResumenes] = useState([]);
  const [compras, setCompras] = useState([]);
  const [retenciones, setRetenciones] = useState([]);
  const [cargando, setCargando] = useState(false);
  const [aviso, setAviso] = useState('');
  const [inputs, setInputs] = useState({ item48: '', item20: '', item38: '', item66: '' });

  // Carga en paralelo: un fallo parcial no anula el resto del borrador.
  const cargar = useCallback(async () => {
    // Los setState se postergan tras el primer await para no ejecutarse de
    // forma síncrona dentro del cuerpo del useEffect (regla set-state-in-effect).
    await Promise.resolve();
    if (!hayContexto) {
      setVentas([]); setResumenes([]); setCompras([]); setRetenciones([]);
      return;
    }
    setCargando(true);
    setAviso('');
    const params = { fechaInicio, fechaFin, empresaId };
    const [rVentas, rResumenes, rCompras, rRet] = await Promise.allSettled([
      fiscalApi.getVentas(params),
      fiscalApi.getResumenesVentas(params),
      fiscalApi.getCompras(params),
      fiscalApi.getRetencionesIva(params)
    ]);

    if (rVentas.status === 'fulfilled') setVentas(normalizar(rVentas.value));
    else { setVentas([]); console.error('Error cargando ventas:', rVentas.reason); }

    if (rResumenes.status === 'fulfilled') setResumenes(normalizar(rResumenes.value));
    else { setResumenes([]); console.warn('Error cargando resúmenes Z:', rResumenes.reason); }

    if (rCompras.status === 'fulfilled') setCompras(normalizar(rCompras.value));
    else { setCompras([]); console.error('Error cargando compras:', rCompras.reason); }

    if (rRet.status === 'fulfilled') setRetenciones(normalizar(rRet.value));
    else { setRetenciones([]); console.warn('Error cargando retenciones:', rRet.reason); }

    const fallos = [rVentas, rResumenes, rCompras, rRet]
      .filter((r) => r.status === 'rejected').length;
    if (fallos > 0) {
      setAviso(`⚠️ ${fallos} fuente(s) de datos no respondieron; verifique los valores antes de declarar.`);
    }
    setCargando(false);
  }, [empresaId, fechaInicio, fechaFin, hayContexto]);

  // Se carga automáticamente al abrir la página y al cambiar empresa/periodo;
  // el timer posterga la llamada fuera del cuerpo síncrono del efecto y el
  // cleanup cancela cargas obsoletas si el contexto cambia.
  useEffect(() => {
    const timer = setTimeout(() => { cargar(); }, 0);
    return () => clearTimeout(timer);
  }, [cargar]);

  // Motor de cálculo en tiempo real: se recalcula con cada cambio de input.
  const calculos = useMemo(
    () => calcularForma30({
      ventas, resumenes, compras, retencionesEmitidas: retenciones, inputs
    }),
    [ventas, resumenes, compras, retenciones, inputs]
  );

  const secciones = seccionesForma30(calculos);

  const cambiarInput = (clave, valor) => setInputs((prev) => ({ ...prev, [clave]: valor }));

  const argsExport = { empresa: empresaActiva, periodo: periodoActivo, calculos };
  const formatearFecha = (fecha) => {
    if (!fecha) return '—';
    const partes = String(fecha).split(/[-T]/);
    if (partes.length >= 3) return `${partes[2].slice(0, 2)}/${partes[1]}/${partes[0]}`;
    const d = new Date(fecha);
    return isNaN(d.getTime()) ? fecha : d.toLocaleDateString('es-VE');
  };

  const tarjetas = [
    { etiqueta: '49 · Total Débitos', valor: fmt(calculos.item49), color: '#f87171' },
    { etiqueta: '39 · Total Créditos', valor: fmt(calculos.item39), color: '#34d399' },
    { etiqueta: '53 · Cuota Tributaria', valor: fmt(calculos.item53), color: '#fbbf24' },
    { etiqueta: '60 · Excedente a Favor', valor: fmt(calculos.item60), color: '#60a5fa' },
    { etiqueta: '90 · TOTAL A PAGAR', valor: fmt(calculos.item90), color: '#fff', destacado: true },
    { etiqueta: 'Documentos (Ventas / Compras)', valor: `${calculos.deb.documentos} / ${calculos.cre.documentos}`, color: '#94a3b8' }
  ];

  return (
    <div style={{ padding: '24px', color: '#e2e8f0', minHeight: '80vh' }}>
      {/* Cabecera con el contexto global (empresa/periodo) */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px',
        background: '#1e293b', padding: '16px 20px', borderRadius: '12px', border: '1px solid #334155', marginBottom: '20px'
      }}>
        <div>
          <h2 style={{ margin: '0 0 4px 0', color: '#fbbf24', fontSize: '1.2rem' }}>
            🧾 Forma 30 · Determinación y Pago del IVA (SENIAT)
          </h2>
          <span style={{ color: '#94a3b8', fontSize: '0.85rem' }}>
            🏢 <b style={{ color: '#60a5fa' }}>{empresaActiva?.razonSocial || empresaActiva?.nombre || '—'}</b>
            {' · '}📅 {formatearFecha(fechaInicio)} al {formatearFecha(fechaFin)}
            {' · '}<b style={{ color: '#fbbf24' }}>{periodoActivo?.nombre || 'Sin periodo'}</b>
          </span>
        </div>
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          <button
            onClick={cargar}
            disabled={!hayContexto || cargando}
            style={{
              background: '#475569', color: '#fff', border: 'none', borderRadius: '8px',
              padding: '10px 16px', cursor: hayContexto && !cargando ? 'pointer' : 'not-allowed',
              fontWeight: 'bold', opacity: hayContexto ? 1 : 0.5
            }}
          >
            {cargando ? '⏳ Cargando…' : '🔄 Recargar'}
          </button>
          <button
            onClick={() => exportarForma30Xls(argsExport)}
            disabled={!hayContexto}
            style={{
              background: '#16a34a', color: '#fff', border: 'none', borderRadius: '8px',
              padding: '10px 16px', cursor: hayContexto ? 'pointer' : 'not-allowed',
              fontWeight: 'bold', opacity: hayContexto ? 1 : 0.5
            }}
            title="Descargar el borrador de la Forma 30 en Excel"
          >
            📊 Descargar Excel
          </button>
          <button
            onClick={() => exportarForma30Pdf(argsExport)}
            disabled={!hayContexto}
            style={{
              background: '#dc2626', color: '#fff', border: 'none', borderRadius: '8px',
              padding: '10px 16px', cursor: hayContexto ? 'pointer' : 'not-allowed',
              fontWeight: 'bold', opacity: hayContexto ? 1 : 0.5
            }}
            title="Descargar el borrador de la Forma 30 en PDF"
          >
            📄 Descargar PDF
          </button>
        </div>
      </div>

      {!hayContexto ? (
        <div style={{ background: '#1e293b', border: '1px solid #f59e0b', color: '#fcd34d', padding: '16px', borderRadius: '10px' }}>
          ⚠️ Seleccione una empresa y un periodo contable en el menú lateral para generar la Forma 30.
        </div>
      ) : (
        <>
          {aviso && (
            <div style={{ background: '#1e293b', border: '1px solid #f59e0b', color: '#fcd34d', padding: '12px 16px', borderRadius: '10px', marginBottom: '16px' }}>
              {aviso}
            </div>
          )}

          {/* Tarjetas con el resultado de la determinación */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: '12px', marginBottom: '16px' }}>
            {tarjetas.map((t) => (
              <div key={t.etiqueta} style={{
                background: t.destacado ? '#14532d' : '#0f172a',
                border: `1px solid ${t.destacado ? '#16a34a' : '#334155'}`,
                borderRadius: '10px', padding: '12px'
              }}>
                <div style={{ fontSize: '0.7rem', color: '#94a3b8', marginBottom: '4px' }}>{t.etiqueta}</div>
                <div style={{ fontSize: '1.05rem', fontWeight: 'bold', color: t.color }}>{t.valor}</div>
              </div>
            ))}
          </div>

          {/* Referencia informativa: retenciones emitidas (no se restan de la 66) */}
          <div style={{ background: '#0f172a', border: '1px solid #334155', color: '#94a3b8', padding: '10px 14px', borderRadius: '8px', marginBottom: '20px', fontSize: '0.8rem' }}>
            ℹ️ Retenciones de IVA <b>emitidas a proveedores</b> en el período: <b style={{ color: '#f472b6' }}>${fmt(calculos.retencionesEmitidasTotal)}</b>.
            {' '}No se restan de la casilla 66 (en ella aplican las retenciones practicadas <b>a</b> la empresa).
          </div>
          {cargando ? (
            <div style={{ textAlign: 'center', padding: '40px', color: '#94a3b8' }}>
              ⏳ Cargando datos del período (Ventas, Compras, Resúmenes Z y Retenciones)…
            </div>
          ) : (
            secciones.map((s) => (
              <div
                key={s.titulo}
                style={{ background: '#0f172a', border: '1px solid #334155', borderRadius: '12px', padding: '18px', marginBottom: '16px' }}
              >
                <h3 style={{ margin: '0 0 12px 0', color: '#93c5fd', fontSize: '1rem' }}>{s.titulo}</h3>
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                    <thead>
                      <tr style={{ background: '#1e293b', color: '#93c5fd', textAlign: 'left' }}>
                        {s.columnas.map((col, i) => (
                          <th
                            key={`${s.titulo}-${i}`}
                            style={{ padding: '9px 8px', fontWeight: 'bold', textAlign: i >= 2 ? 'right' : 'left' }}
                          >
                            {col}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {s.filas.map((f) => {
                        const item = f[0];
                        const campoManual = CAMPOS_MANUALES[item];
                        const esTotal = CASILLAS_TOTALES.has(item);
                        return (
                          <tr
                            key={`${s.titulo}-${item}`}
                            style={{
                              borderTop: '1px solid #1f2937',
                              background: campoManual ? '#1b1630' : 'transparent',
                              fontWeight: esTotal ? 'bold' : 'normal',
                              color: esTotal ? '#fbbf24' : '#e2e8f0'
                            }}
                          >
                            <td style={{ padding: '7px 8px', fontFamily: 'monospace', width: '60px' }}>{item}</td>
                            <td style={{ padding: '7px 8px' }}>{f[1]}</td>
                            <td style={{ padding: '7px 8px', textAlign: 'right' }}>
                              {f[2] === null || f[2] === undefined ? '—' : fmt(f[2])}
                            </td>
                            <td style={{ padding: '7px 8px', textAlign: 'right' }}>
                              {campoManual ? (
                                <input
                                  type="number"
                                  min="0"
                                  step="0.01"
                                  value={inputs[campoManual]}
                                  onChange={(e) => cambiarInput(campoManual, e.target.value)}
                                  placeholder="0.00"
                                  title="Casilla de ingreso manual"
                                  style={inputChico}
                                />
                              ) : (f[3] === null || f[3] === undefined ? '—' : fmt(f[3]))}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            ))
          )}

          {/* Notas metodológicas del borrador */}
          <div style={{
            background: '#1e293b', border: '1px dashed #475569', borderRadius: '10px',
            padding: '14px 16px', color: '#94a3b8', fontSize: '0.78rem', lineHeight: 1.7
          }}>
            <b style={{ color: '#fbbf24' }}>📌 Notas metodológicas del borrador:</b><br />
            • Las casillas <b>48 / 20 / 38 / 66</b> son de ingreso manual (no provienen de los libros del período).<br />
            • Los <b>resúmenes de la máquina fiscal (Z)</b> se atribuyen a alícuota general 16% (no guardan desglose por tasa).<br />
            • Los documentos <b>anulados</b> quedan excluidos de débitos y créditos.<br />
            • Exportaciones (41) e importaciones (31/32) se reportan en 0,00 mientras no se registren con su tipificación.<br />
            • La casilla 66 sólo admite retenciones practicadas <b>a</b> la empresa; las emitidas a proveedores se muestran sólo como referencia.
          </div>
        </>
      )}
    </div>
  );
}


