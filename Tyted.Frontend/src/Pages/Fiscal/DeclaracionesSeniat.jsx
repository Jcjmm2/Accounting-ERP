import { useState, useContext, useEffect, useCallback } from 'react';
import { ConfigContext } from '../../Context/ConfigContext';
import { fiscalApi, mensajeErrorApi } from '../../Services/Fiscal/FiscalApi';

// ---------------------------------------------------------------------------
// DECLARACIONES SENIAT (Fase 5)
// Genera y descarga los dos archivos que el Portal Fiscal exige a los agentes
// de retención:
//  - TXT de RETENCIONES DE IVA por quincena (Forma 99035, art. 14-15 de la
//    Providencia SNAT/2025/000054): detalle por comprobante, 16 columnas A-P
//    separadas por TABULADOR, según la especificación técnica del Portal.
//  - XML de RETENCIONES DE ISLR mensual (Manual Técnico SENIAT v2.3,
//    N° 60.40.40.039): raíz <RelacionRetencionesISLR RifAgente Periodo> con
//    <DetalleRetencion> y decimales con PUNTO (máx. 2).
// La generación vive en el backend (DeclaracionesSeniatService) por su
// precisión decimal y su cobertura con tests xUnit; aquí SÓLO se previsualiza
// el contenido y se descarga el archivo.
// ---------------------------------------------------------------------------

const MESES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
];

const inputChico = {
  background: '#0f172a', color: '#fff', border: '1px solid #475569',
  borderRadius: '6px', padding: '8px 10px', fontSize: '0.85rem'
};

const th = { padding: '8px 6px', textAlign: 'left', fontWeight: 'bold', whiteSpace: 'nowrap' };
const td = { padding: '8px 6px' };

const relleno = (n) => String(n).padStart(2, '0');
const formatearMonto = (valor) => Number(valor || 0).toFixed(2);

const fechaCorta = (iso) => {
  const fecha = new Date(iso);
  if (Number.isNaN(fecha.getTime())) return '—';
  return `${relleno(fecha.getDate())}/${relleno(fecha.getMonth() + 1)}/${fecha.getFullYear()}`;
};

export default function DeclaracionesSeniat() {
  const { empresaActiva, periodoActivo } = useContext(ConfigContext);
  const empresaId = Number(empresaActiva?.id ?? 0);
  const rif = empresaActiva?.rif || 'RIF';

  const [anio, setAnio] = useState(() => Number(periodoActivo?.anio) || new Date().getFullYear());
  const [mes, setMes] = useState(() => Number(periodoActivo?.mes) || new Date().getMonth() + 1);
  const [quincena, setQuincena] = useState(1);
  const [retIva, setRetIva] = useState([]);
  const [retIslr, setRetIslr] = useState([]);
  const [cargando, setCargando] = useState(false);
  const [descargando, setDescargando] = useState(null);

  // Sincroniza con el periodo contable activo cuando cambia.
  useEffect(() => {
    if (Number(periodoActivo?.anio) > 0) setAnio(Number(periodoActivo.anio));
    if (Number(periodoActivo?.mes) > 0) setMes(Number(periodoActivo.mes));
  }, [periodoActivo?.anio, periodoActivo?.mes]);

  // Previsualización de las retenciones que entrarán en cada archivo.
  const cargarPrevisualizacion = useCallback(async () => {
    if (!empresaId) { setRetIva([]); setRetIslr([]); return; }
    setCargando(true);
    const ultimoDia = new Date(anio, mes, 0).getDate();
    const inicio = `${anio}-${relleno(mes)}-01`;
    const fin = `${anio}-${relleno(mes)}-${relleno(ultimoDia)}`;
    try {
      const [iva, isl] = await Promise.all([
        fiscalApi.getRetencionesIva({ empresaId, fechaInicio: inicio, fechaFin: fin }),
        fiscalApi.getRetencionesIslr({ empresaId, fechaInicio: inicio, fechaFin: fin })
      ]);
      const listaIva = Array.isArray(iva) ? iva : (iva?.$values || []);
      const listaIslr = Array.isArray(isl) ? isl : (isl?.$values || []);
      // Corte quincenal LOCAL (sólo informativo): el backend vuelve a filtrar
      // por fechas al generar el archivo.
      setRetIva(listaIva.filter((r) => {
        const dia = new Date(r.fechaRetencion).getDate();
        return quincena === 1 ? dia <= 15 : dia >= 16;
      }));
      setRetIslr(listaIslr);
    } catch (error) {
      console.error('Error cargando previsualización de declaraciones:', error);
      alert(`❌ No se pudieron cargar las retenciones del periodo:\n${mensajeErrorApi(error)}`);
    } finally {
      setCargando(false);
    }
  }, [empresaId, anio, mes, quincena]);

  useEffect(() => { cargarPrevisualizacion(); }, [cargarPrevisualizacion]);

  const totalIvaRetenido = retIva.reduce((suma, r) => suma + Number(r.montoRetenidoBs || 0), 0);
  const totalIslrRetenido = retIslr.reduce((suma, r) => suma + Number(r.montoRetenidoBs || 0), 0);

  const ultimoDiaMes = new Date(anio, mes, 0).getDate();
  const etiquetaMes = `${MESES[(mes - 1 + 12) % 12]} ${anio}`;
  const rangoTxt = quincena === 1
    ? `01/${relleno(mes)}/${anio} al 15/${relleno(mes)}/${anio}`
    : `16/${relleno(mes)}/${anio} al ${relleno(ultimoDiaMes)}/${relleno(mes)}/${anio}`;

  const hayContexto = Boolean(empresaId);

  // Con responseType 'blob' los errores del backend llegan DENTRO de un Blob:
  // hay que leerlo para mostrar el mensaje real (p. ej. 400 con { message }).
  const leerErrorBlob = async (error) => {
    if (error?.response?.data instanceof Blob) {
      try {
        const json = JSON.parse(await error.response.data.text());
        return json.message || json.title || 'El backend rechazó la petición.';
      } catch {
        /* el blob no era JSON: se usa el mensaje genérico */
      }
    }
    return mensajeErrorApi(error);
  };

  const dispararDescarga = (blob, nombre) => {
    const url = URL.createObjectURL(blob);
    const enlace = document.createElement('a');
    enlace.href = url;
    enlace.download = nombre;
    document.body.appendChild(enlace);
    enlace.click();
    enlace.remove();
    URL.revokeObjectURL(url);
  };

  const descargarTxt = async () => {
    setDescargando('txt');
    try {
      const { blob, nombre } = await fiscalApi.descargarTxtIva({ empresaId, anio, mes, quincena });
      dispararDescarga(blob, nombre || `RetIVA_${rif}_${anio}${relleno(mes)}_Q${quincena}.txt`);
    } catch (error) {
      console.error('Error generando el TXT de IVA:', error);
      alert(`❌ No se pudo generar el TXT de IVA:\n${await leerErrorBlob(error)}`);
    } finally {
      setDescargando(null);
    }
  };

  const descargarXml = async () => {
    setDescargando('xml');
    try {
      const { blob, nombre } = await fiscalApi.descargarXmlIslr({ empresaId, anio, mes });
      dispararDescarga(blob, nombre || `RetISLR_${rif}_${anio}${relleno(mes)}.xml`);
    } catch (error) {
      console.error('Error generando el XML de ISLR:', error);
      alert(`❌ No se pudo generar el XML de ISLR:\n${await leerErrorBlob(error)}`);
    } finally {
      setDescargando(null);
    }
  };

  return (
    <div style={{ padding: '24px', color: '#e2e8f0', minHeight: '80vh' }}>
      {/* Cabecera */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px',
        background: '#1e293b', padding: '16px 20px', borderRadius: '12px', border: '1px solid #334155', marginBottom: '20px'
      }}>
        <div>
          <h2 style={{ margin: '0 0 4px 0', color: '#f87171', fontSize: '1.2rem' }}>📄 Declaraciones SENIAT</h2>
          <span style={{ color: '#94a3b8', fontSize: '0.85rem' }}>
            🏢 <b style={{ color: '#60a5fa' }}>{empresaActiva?.razonSocial || empresaActiva?.nombre || '—'}</b>
            {' · '}RIF <b>{rif}</b>
            {' · '}Archivos para el Portal Fiscal: retenciones de IVA (quincenal) e ISLR (mensual)
          </span>
        </div>
      </div>

      {!hayContexto && (
        <div style={{ background: '#1e293b', border: '1px solid #f59e0b', color: '#fcd34d', padding: '16px', borderRadius: '10px', marginBottom: '18px' }}>
          ⚠️ Seleccione una empresa en el menú lateral para generar sus declaraciones.
        </div>
      )}

      {/* Selector de periodo */}
      <div style={{
        display: 'flex', gap: '12px', alignItems: 'flex-end', flexWrap: 'wrap',
        background: '#0f172a', border: '1px solid #334155', borderRadius: '10px', padding: '14px 16px', marginBottom: '18px'
      }}>
        <div>
          <label style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Año</label>
          <br />
          <input
            type="number" min={2000} max={2100} value={anio}
            onChange={(e) => setAnio(Number(e.target.value))}
            style={{ ...inputChico, width: '110px' }}
          />
        </div>
        <div>
          <label style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Mes</label>
          <br />
          <select value={mes} onChange={(e) => setMes(Number(e.target.value))} style={{ ...inputChico, width: '150px' }}>
            {MESES.map((nombre, i) => <option key={nombre} value={i + 1}>{nombre}</option>)}
          </select>
        </div>
        <div>
          <label style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Quincena del TXT de IVA</label>
          <br />
          <div style={{ display: 'flex', gap: '6px' }}>
            {[1, 2].map((q) => (
              <button
                key={q}
                onClick={() => setQuincena(q)}
                style={{
                  background: quincena === q ? '#3b82f6' : '#1e293b',
                  color: quincena === q ? '#fff' : '#94a3b8',
                  border: '1px solid #334155', borderRadius: '8px',
                  padding: '9px 14px', cursor: 'pointer', fontWeight: 'bold', fontSize: '0.82rem'
                }}
              >
                {q === 1 ? '1ª (1-15)' : `2ª (16-${ultimoDiaMes})`}
              </button>
            ))}
          </div>
        </div>
        <span style={{ color: '#64748b', fontSize: '0.78rem', paddingBottom: '8px' }}>
          Periodo: <b style={{ color: '#93c5fd' }}>{etiquetaMes}</b>
          {' · '}Rango del TXT: <b style={{ color: '#93c5fd' }}>{rangoTxt}</b>
        </span>
      </div>

      {/* --- PANEL 1: TXT DE RETENCIONES DE IVA (QUINCENAL) --- */}
      <div style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '12px', padding: '18px 20px', marginBottom: '18px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px', marginBottom: '12px' }}>
          <div>
            <h3 style={{ margin: '0 0 2px 0', color: '#34d399', fontSize: '1rem' }}>📒 TXT — Retenciones de IVA (quincenal, Forma 99035)</h3>
            <span style={{ color: '#94a3b8', fontSize: '0.8rem' }}>
              16 columnas separadas por tabulador · <b>{retIva.length}</b> comprobante{retIva.length === 1 ? '' : 's'} en {rangoTxt}
              {' · '}Total retenido: <b style={{ color: '#86efac' }}>Bs. {formatearMonto(totalIvaRetenido)}</b>
            </span>
          </div>
          <button
            onClick={descargarTxt}
            disabled={!hayContexto || Boolean(descargando)}
            title="Descargar el TXT listo para cargar en el Portal Fiscal (se declara incluso sin retenciones: pago cero)"
            style={{
              background: '#1d4ed8', color: '#fff', border: 'none', borderRadius: '8px', padding: '10px 16px',
              cursor: hayContexto && !descargando ? 'pointer' : 'not-allowed', fontWeight: 'bold',
              opacity: hayContexto && !descargando ? 1 : 0.6
            }}
          >
            {descargando === 'txt' ? '⏳ Generando…' : '⬇️ Descargar TXT (IVA quincenal)'}
          </button>
        </div>

        {cargando ? (
          <div style={{ textAlign: 'center', padding: '20px', color: '#94a3b8' }}>⏳ Cargando previsualización…</div>
        ) : retIva.length === 0 ? (
          <div style={{ background: '#0f172a', border: '1px dashed #475569', padding: '18px', textAlign: 'center', borderRadius: '8px', color: '#94a3b8', fontSize: '0.82rem', lineHeight: '1.5' }}>
            Sin retenciones de IVA en esta quincena. El art. 15 de la Providencia SNAT/2025/000054 obliga a presentar la
            declaración <b>aunque sea en pago cero</b>: el botón de descarga sigue habilitado y generará un archivo sin
            líneas de detalle.
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
              <thead>
                <tr style={{ background: '#0f172a', color: '#93c5fd' }}>
                  <th style={th}>N° Comprobante</th>
                  <th style={th}>Fecha</th>
                  <th style={th}>RIF Proveedor</th>
                  <th style={th}>Factura</th>
                  <th style={th}>Control</th>
                  <th style={{ ...th, textAlign: 'right' }}>Base Imponible</th>
                  <th style={{ ...th, textAlign: 'right' }}>IVA Retenido</th>
                </tr>
              </thead>
              <tbody>
                {retIva.slice(0, 100).map((r) => (
                  <tr key={r.id} style={{ borderTop: '1px solid #1f2937' }}>
                    <td style={td}>{r.numeroComprobante}</td>
                    <td style={td}>{fechaCorta(r.fechaRetencion)}</td>
                    <td style={td}>{r.proveedorRif || '—'}</td>
                    <td style={td}>{r.numeroFactura || '—'}</td>
                    <td style={td}>{r.numeroControl || '—'}</td>
                    <td style={{ ...td, textAlign: 'right' }}>{formatearMonto(r.baseImponibleBs)}</td>
                    <td style={{ ...td, textAlign: 'right' }}>{formatearMonto(r.montoRetenidoBs)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {retIva.length > 100 && (
              <div style={{ color: '#64748b', fontSize: '0.75rem', marginTop: '6px' }}>
                Mostrando los primeros 100 de {retIva.length} comprobantes (el archivo los incluye todos).
              </div>
            )}
          </div>
        )}
      </div>

      {/* --- PANEL 2: XML DE RETENCIONES DE ISLR (MENSUAL) --- */}
      <div style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '12px', padding: '18px 20px', marginBottom: '18px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px', marginBottom: '12px' }}>
          <div>
            <h3 style={{ margin: '0 0 2px 0', color: '#60a5fa', fontSize: '1rem' }}>🗂️ XML — Retenciones de ISLR (mensual, Manual Técnico v2.3)</h3>
            <span style={{ color: '#94a3b8', fontSize: '0.8rem' }}>
              Raíz &lt;RelacionRetencionesISLR&gt; · <b>{retIslr.length}</b> comprobante{retIslr.length === 1 ? '' : 's'} en {etiquetaMes}
              {' · '}Total retenido: <b style={{ color: '#86efac' }}>Bs. {formatearMonto(totalIslrRetenido)}</b>
            </span>
          </div>
          <button
            onClick={descargarXml}
            disabled={!hayContexto || Boolean(descargando)}
            title="Descargar el XML listo para cargar en el Portal Fiscal (mes completo)"
            style={{
              background: '#1d4ed8', color: '#fff', border: 'none', borderRadius: '8px', padding: '10px 16px',
              cursor: hayContexto && !descargando ? 'pointer' : 'not-allowed', fontWeight: 'bold',
              opacity: hayContexto && !descargando ? 1 : 0.6
            }}
          >
            {descargando === 'xml' ? '⏳ Generando…' : '⬇️ Descargar XML (ISLR mensual)'}
          </button>
        </div>

        {cargando ? (
          <div style={{ textAlign: 'center', padding: '20px', color: '#94a3b8' }}>⏳ Cargando previsualización…</div>
        ) : retIslr.length === 0 ? (
          <div style={{ background: '#0f172a', border: '1px dashed #475569', padding: '18px', textAlign: 'center', borderRadius: '8px', color: '#94a3b8', fontSize: '0.82rem' }}>
            No hay retenciones de ISLR emitidas en {etiquetaMes}: no hay archivo XML que generar para este periodo.
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
              <thead>
                <tr style={{ background: '#0f172a', color: '#93c5fd' }}>
                  <th style={th}>N° Comprobante</th>
                  <th style={th}>Fecha</th>
                  <th style={th}>RIF Proveedor</th>
                  <th style={th}>Factura</th>
                  <th style={th}>Código</th>
                  <th style={{ ...th, textAlign: 'right' }}>Base Imponible</th>
                  <th style={{ ...th, textAlign: 'right' }}>%</th>
                  <th style={{ ...th, textAlign: 'right' }}>Retenido</th>
                </tr>
              </thead>
              <tbody>
                {retIslr.slice(0, 100).map((r) => (
                  <tr key={r.id} style={{ borderTop: '1px solid #1f2937' }}>
                    <td style={td}>{r.numeroComprobante}</td>
                    <td style={td}>{fechaCorta(r.fechaRetencion)}</td>
                    <td style={td}>{r.proveedorRif || '—'}</td>
                    <td style={td}>{r.numeroFactura || '—'}</td>
                    <td style={{ ...td, fontFamily: 'monospace' }}>{r.codigoConcepto || '—'}</td>
                    <td style={{ ...td, textAlign: 'right' }}>{formatearMonto(r.baseImponibleBs)}</td>
                    <td style={{ ...td, textAlign: 'right' }}>{Number(r.porcentajeRetencion || 0)}</td>
                    <td style={{ ...td, textAlign: 'right' }}>{formatearMonto(r.montoRetenidoBs)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div style={{ background: '#0f172a', border: '1px solid #334155', color: '#94a3b8', padding: '10px 14px', borderRadius: '8px', fontSize: '0.78rem', marginTop: '12px', lineHeight: '1.6' }}>
          📎 <b>Manual Técnico SENIAT v2.3:</b> la base imponible va <b>ENTERA</b> porque el sustraendo del Decreto 1.808
          (códigos 002, 006, 010…) lo aplica automáticamente el Portal Fiscal.
          ⚠️ El portal exige incluir también los pagos del mes que <b>no generaron retención (0%)</b>; este sistema declara
          únicamente las retenciones emitidas, así que verifique que no falte ningún pago sujeto al Anexo 6.1 antes de presentar.
        </div>
      </div>

      {/* Nota metodológica general */}
      <div style={{ background: '#0f172a', border: '1px solid #334155', color: '#94a3b8', padding: '12px 16px', borderRadius: '10px', fontSize: '0.8rem', lineHeight: '1.6' }}>
        📎 Los archivos se generan en el <b>backend</b> (decimal exacto, culture explícita y validación de cada campo contra
        el XSD oficial), por lo que las cifras del archivo son idénticas a las del sistema. El <b>TXT</b> sigue la
        especificación técnica del Portal Fiscal (16 columnas A-P, delimitado por tabulador) y el <b>XML</b> el Manual Técnico
        N° 60.40.40.039 v2.3 (UTF-8, decimales con punto). Ambas declaraciones se presentan según el calendario del sujeto
        pasivo especial; su incumplimiento es ilícito tributario formal (art. 103 del Código Orgánico Tributario).
      </div>
    </div>
  );
}




