import { useState, useEffect, useContext } from 'react';
import { ConfigContext } from '../../Context/ConfigContext';
import { estructuraLibroCompras } from './reportesLibrosFiscal';
import { fiscalApi, mensajeErrorApi } from '../../Services/Fiscal/FiscalApi';
import { fmt } from './libroComprasHelpers';
import { useLibroCompras } from './useLibroCompras';
import { useRetencionIslr } from './useRetencionIslr';
import { useAltaCompraFiscal } from './useAltaCompraFiscal';
import { useAltaGasto } from './useAltaGasto';
import CabeceraLibroCompras from './CabeceraLibroCompras';
import PanelReportesLibro from './PanelReportesLibro';
import FormularioCompraFiscal from './FormularioCompraFiscal';
import FormularioGastoFiscal from './FormularioGastoFiscal';
import TablaDocumentosCombinados from './TablaDocumentosCombinados';
import ModalRetencionIslr from './ModalRetencionIslr';

// ---------------------------------------------------------------------------
// REGISTRO DE COMPRAS (LIBRO DE COMPRAS IVA + ISLR): orquestador liviano.
// La lógica vive en hooks (useLibroCompras, useRetencionIslr,
// useAltaCompraFiscal, useAltaGasto) y la UI en componentes presentacionales;
// aquí sólo se compone el flujo y la EXCLUSIVIDAD de paneles.
// ---------------------------------------------------------------------------
export default function RegistroComprasFiscal() {
  const { empresaActiva, periodoActivo, tasa } = useContext(ConfigContext);

  // --- DATOS DEL LIBRO (carga bajo demanda, maps y totales) ---
  const libro = useLibroCompras();
  const { empresaId, fechaInicio, fechaFin } = libro;

  // --- RETENCIÓN DE ISLR (modal, emitir, contabilizar, anular) ---
  const isl = useRetencionIslr({
    empresaId,
    retencionIslrPorCompra: libro.retencionIslrPorCompra,
    retencionIslrPorGasto: libro.retencionIslrPorGasto,
    cargarCompras: libro.cargarCompras
  });

  // --- ALTAS FISCALES (factura con líneas | gasto con concepto) ---
  const [proveedores, setProveedores] = useState([]);
  const altaCompra = useAltaCompraFiscal({ empresaId, cargarCompras: libro.cargarCompras });
  const altaGasto = useAltaGasto({
    empresaId, proveedores, cargarCompras: libro.cargarCompras,
    abrirModalIslr: isl.abrirModalIslr
  });

  // --- EXCLUSIVIDAD DE PANELES (formulario | consultas | reportes | modal) ---
  const [mostrarForm, setMostrarForm] = useState(false);
  const [tipoAlta, setTipoAlta] = useState('FACTURA');
  const [mostrarConsultas, setMostrarConsultas] = useState(false);
  const [mostrarReporte, setMostrarReporte] = useState(false);

  // --- EDICIÓN EN FILA Y ACCIONES SOBRE DOCUMENTOS ---
  const [editandoId, setEditandoId] = useState(null);
  const [formFiscal, setFormFiscal] = useState({ tipoTransaccion: '01', numeroControl: '' });
  const [procesandoId, setProcesandoId] = useState(null);

  // NOTA: el libro ya NO se carga automáticamente al entrar ni al cambiar de
  // contexto; se consulta bajo demanda (botón «🔍 Consultas y edición» o
  // «📊 Reportes»). Si el contexto cambia con el libro abierto, se recarga.
  useEffect(() => {
    if (mostrarConsultas || mostrarReporte) libro.cargarCompras();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [libro.cargarCompras, mostrarConsultas, mostrarReporte]);

  // Apertura/cierre del panel de consultas (la carga la dispara el useEffect).
  const alternarConsultas = () => {
    if (mostrarConsultas) {
      setMostrarConsultas(false);
      setEditandoId(null);
      return;
    }
    setMostrarForm(false);
    setMostrarReporte(false);
    isl.setModalIslr(null);
    setEditandoId(null);
    setMostrarConsultas(true);
  };

  // Apertura/cierre del panel de reportes con la misma exclusividad.
  const alternarReporte = () => {
    if (mostrarReporte) {
      setMostrarReporte(false);
      return;
    }
    setMostrarForm(false);
    setMostrarConsultas(false);
    isl.setModalIslr(null);
    setEditandoId(null);
    setMostrarReporte(true);
  };

  // Abre el formulario ÚNICO con el tipo elegido, limpia el estado del modo
  // seleccionado y precarga los catálogos que necesiten ambos (proveedores;
  // conceptos contable GASTO cuando aplica).
  const abrirFormUnico = async (tipo) => {
    setMostrarConsultas(false);
    setMostrarReporte(false);
    isl.setModalIslr(null);
    setEditandoId(null);
    setTipoAlta(tipo);
    if (tipo === 'FACTURA') altaCompra.limpiar();
    else altaGasto.limpiar();
    setMostrarForm(true);

    if (proveedores.length === 0) {
      try {
        const data = await fiscalApi.getProveedores();
        setProveedores(Array.isArray(data) ? data : (data?.$values || []));
      } catch (error) {
        console.warn('Error cargando proveedores:', error);
      }
    }
    if (tipo === 'GASTO') await altaGasto.cargarConceptos();
  };

  const abrirEdicion = (c) => {
    // Exclusividad: editar en fila cancela el formulario de alta, el panel de
    // reportes y el modal ISLR (la tabla de consultas permanece).
    setMostrarForm(false);
    setMostrarReporte(false);
    isl.setModalIslr(null);
    setEditandoId(c.id);
    setFormFiscal({ tipoTransaccion: c.tipoTransaccion || '01', numeroControl: c.numeroControl || '' });
  };

  const guardarFiscal = async (c) => {
    if (!['01', '02', '03'].includes(formFiscal.tipoTransaccion)) {
      alert('⚠️ Tipo de transacción inválido: use 01, 02 o 03.');
      return;
    }
    try {
      await fiscalApi.actualizarFiscalCompra(c.id, {
        tipoTransaccion: formFiscal.tipoTransaccion,
        numeroControl: formFiscal.numeroControl || null
      });
      setEditandoId(null);
      await libro.cargarCompras();
    } catch (error) {
      console.error('Error guardando datos fiscales:', error);
      alert(`❌ No se pudo actualizar el documento:\n${mensajeErrorApi(error)}`);
    }
  };

  const contabilizar = async (c) => {
    const confirmado = window.confirm(
      `Generar el comprobante contable de la compra ${c.numeroFactura || '(s/n)'}?\n\n` +
      'Partida doble: compras + IVA crédito fiscal / proveedores. Idempotente: no se duplicará.'
    );
    if (!confirmado) return;

    setProcesandoId(c.id);
    try {
      const r = await fiscalApi.contabilizarCompra(c.id);
      if (r.generada) {
        alert(`✅ Comprobante ${r.numeroComprobante} generado.\nDebe/Haber: ${fmt(r.totalDebe)}`);
      } else {
        alert(`⚠️ ${r.mensaje || 'No se generó el comprobante.'}\n${r.advertencia || ''}`);
      }
      await libro.cargarCompras();
    } catch (error) {
      console.error('Error contabilizando la compra:', error);
      alert(`❌ No se pudo contabilizar:\n${mensajeErrorApi(error)}`);
    } finally {
      setProcesandoId(null);
    }
  };

  const contabilizarGastoAccion = async (g) => {
    const confirmado = window.confirm(`Generar el comprobante contable del gasto «${g.concepto}»? (idempotente: no se duplica)`);
    if (!confirmado) return;
    try {
      const r = await fiscalApi.contabilizarGasto(g.id);
      if (r.generada) alert(`✅ Comprobante ${r.numeroComprobante} generado.\nDebe/Haber: ${fmt(r.totalDebe)}`);
      else alert(`⚠️ ${r.mensaje || 'No se generó el comprobante.'}\n${r.advertencia || ''}`);
      await libro.cargarCompras();
    } catch (error) {
      console.error('Error contabilizando el gasto:', error);
      alert(`❌ No se pudo contabilizar:\n${mensajeErrorApi(error)}`);
    }
  };

  // Emisión del comprobante de retención de IVA (F2): 75% o 100% sobre el IVA
  // de la factura, con correlativo oficial SENIAT AAAAMM + 8 dígitos.
  const emitirRetencion = async (c) => {
    if (c.isAnulada || libro.retencionPorCompra.has(Number(c.id))) return;

    const respuesta = window.prompt('Porcentaje de retención de IVA sobre el IVA de la factura (75 o 100):', '75');
    if (respuesta === null) return;
    const porcentaje = Number(respuesta);
    if (porcentaje !== 75 && porcentaje !== 100) {
      alert('⚠️ El porcentaje debe ser 75 o 100.');
      return;
    }

    const confirmado = window.confirm(
      `Emitir el comprobante de retención de IVA (${porcentaje}%) sobre la factura ${c.numeroFactura || '(s/n)'}?\n\n` +
      'Se generará el número correlativo oficial SENIAT (AAAAMM + 8 dígitos). Una sola retención vigente por factura.'
    );
    if (!confirmado) return;

    try {
      const r = await fiscalApi.emitirRetencionIva({ compraId: c.id, empresaId, porcentaje });
      alert(
        `✅ Comprobante de retención ${r.numeroComprobante} emitido.\n` +
        `IVA (Bs.): ${fmt(r.ivaCalculadoBs ?? r.ivaCalculado)} · Retenido (${r.porcentajeRetencion}%): ${fmt(r.montoRetenidoBs ?? r.montoRetenido)} Bs.`
      );
      await libro.cargarCompras();
    } catch (error) {
      console.error('Error emitiendo la retención de IVA:', error);
      alert(`❌ No se pudo emitir la retención:\n${mensajeErrorApi(error)}`);
    }
  };

  // Guardado del formulario ÚNICO: el hook hace la llamada; si tuvo éxito la
  // página cierra el panel (el hook ya recarga el libro).
  const guardarFacturaYCerrar = async () => {
    const ok = await altaCompra.guardarCompraFiscal();
    if (ok) setMostrarForm(false);
  };
  const guardarGastoYCerrar = async () => {
    const ok = await altaGasto.guardarGasto();
    if (ok) setMostrarForm(false);
  };

  // Libro COMBINADO para la vista previa y la exportación a PDF/Excel.
  const reporteLibro = estructuraLibroCompras({
    empresa: empresaActiva,
    periodo: periodoActivo,
    totales: { ...libro.totales, retenciones: libro.totalRetenido },
    compras: libro.compras,
    gastos: libro.gastos,
    retencionPorCompra: libro.retencionPorCompra,
    retencionIslrPorCompra: libro.retencionIslrPorCompra,
    retencionIslrPorGasto: libro.retencionIslrPorGasto
  });

  const hayContexto = Boolean(empresaId && fechaInicio && fechaFin);

  return (
    <div style={{ padding: '24px', color: '#e2e8f0', minHeight: '80vh' }}>
      {/* Cabecera con el contexto global (empresa/periodo) que rige el libro */}
      <CabeceraLibroCompras
        empresaActiva={empresaActiva}
        periodoActivo={periodoActivo}
        fechaInicio={fechaInicio}
        fechaFin={fechaFin}
        mostrarConsultas={mostrarConsultas}
        mostrarReporte={mostrarReporte}
        cargando={libro.cargando}
        hayContexto={hayContexto}
        onNuevoDocumento={() => abrirFormUnico('FACTURA')}
        onAlternarConsultas={alternarConsultas}
        onAlternarReporte={alternarReporte}
        onRecargar={libro.cargarCompras}
      />

      {/* --- PANEL DE REPORTES: vista previa del libro COMBINADO --- */}
      {hayContexto && mostrarReporte && (
        <PanelReportesLibro
          reporteLibro={reporteLibro}
          cargando={libro.cargando}
          empresaActiva={empresaActiva}
          fechaInicio={fechaInicio}
          fechaFin={fechaFin}
        />
      )}

      {!hayContexto ? (
        <div style={{ background: '#1e293b', border: '1px solid #f59e0b', color: '#fcd34d', padding: '16px', borderRadius: '10px' }}>
          ⚠️ Seleccione una empresa y un periodo contable en el menú lateral para cargar el Libro de Compras.
        </div>
      ) : (
        <>
          {/*
            FORMULARIO ÚNICO: FACTURA (compra con líneas de producto) o GASTO
            (concepto contable + alícuota en Bs.). El selector decide el modo;
            en el backend cada uno sigue creando su entidad (Compra / Gasto).
          */}
          {mostrarForm && (
            <div style={{ background: '#1e293b', border: `1px solid ${tipoAlta === 'FACTURA' ? '#16a34a' : '#f59e0b'}`, borderRadius: '12px', padding: '20px', marginBottom: '20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px', marginBottom: '6px' }}>
                <h3 style={{ margin: 0, color: tipoAlta === 'FACTURA' ? '#34d399' : '#fbbf24', fontSize: '1.05rem' }}>➕ Nuevo documento fiscal</h3>
                <div style={{ display: 'flex', gap: '6px' }}>
                  {[{ id: 'FACTURA', etiqueta: '🧾 Factura de compra' }, { id: 'GASTO', etiqueta: '💸 Gasto' }].map((t) => (
                    <button
                      key={t.id}
                      onClick={() => abrirFormUnico(t.id)}
                      style={{
                        background: tipoAlta === t.id ? (t.id === 'FACTURA' ? '#34d399' : '#f59e0b') : '#0f172a',
                        color: tipoAlta === t.id ? '#052e16' : '#94a3b8',
                        border: '1px solid #334155', borderRadius: '8px',
                        padding: '7px 14px', cursor: 'pointer', fontWeight: 'bold', fontSize: '0.82rem'
                      }}
                    >
                      {t.etiqueta}
                    </button>
                  ))}
                </div>
              </div>
              <p style={{ margin: '0 0 14px 0', color: '#94a3b8', fontSize: '0.8rem' }}>
                {tipoAlta === 'FACTURA'
                  ? 'Documento declarativo: NO afecta el inventario (sin aumento de stock, sin costos, sin kardex).'
                  : 'Documento propio del módulo fiscal: NO toca inventario ni compras. Requiere periodo contable ABIERTO.'}
              </p>

              {tipoAlta === 'FACTURA' ? (
                <FormularioCompraFiscal
                  alta={{ ...altaCompra, guardarCompraFiscal: guardarFacturaYCerrar }}
                  proveedores={proveedores}
                  tasa={tasa}
                  onCancelar={() => setMostrarForm(false)}
                />
              ) : (
                <FormularioGastoFiscal
                  alta={{ ...altaGasto, guardarGasto: guardarGastoYCerrar }}
                  proveedores={proveedores}
                  onCancelar={() => setMostrarForm(false)}
                />
              )}
            </div>
          )}

          {/* --- CONSULTA Y EDICIÓN DEL LIBRO (bajo demanda) --- */}
          {mostrarConsultas && (
            <>
              {/* Resumen COMBINADO del período (facturas + gastos con sus alícuotas) */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '12px', marginBottom: '20px' }}>
                {[
                  { etiqueta: 'Documentos (facturas + gastos)', valor: libro.totales.documentos, entero: true, color: '#60a5fa' },
                  { etiqueta: 'Exentas', valor: libro.totales.exento, color: '#94a3b8' },
                  { etiqueta: 'Base 8%', valor: libro.totales.base8, color: '#a78bfa' },
                  { etiqueta: 'Base 16%', valor: libro.totales.base16, color: '#34d399' },
                  { etiqueta: 'IVA Crédito Fiscal', valor: libro.totales.iva, color: '#fbbf24' },
                  { etiqueta: 'IVA Retenido (75/100)', valor: libro.totalRetenido, color: '#f472b6' },
                  { etiqueta: 'ISLR Retenido (1.808)', valor: libro.totalIslrRetenido, color: '#60a5fa' },
                  { etiqueta: 'Total (facturas + gastos)', valor: libro.totales.total, color: '#fff' }
                ].map((c) => (
                  <div key={c.etiqueta} style={{ background: '#0f172a', border: '1px solid #334155', borderRadius: '10px', padding: '12px' }}>
                    <div style={{ fontSize: '0.7rem', color: '#94a3b8', marginBottom: '4px' }}>{c.etiqueta}</div>
                    <div style={{ fontSize: '1.05rem', fontWeight: 'bold', color: c.color }}>
                      {c.entero ? c.valor : fmt(c.valor)}
                    </div>
                  </div>
                ))}
              </div>

              {libro.cargando ? (
                <div style={{ textAlign: 'center', padding: '40px', color: '#94a3b8' }}>⏳ Cargando el libro (facturas y gastos)…</div>
              ) : libro.documentosCombinados.length === 0 ? (
                <div style={{ background: '#0f172a', border: '1px dashed #475569', padding: '30px', textAlign: 'center', borderRadius: '12px', color: '#94a3b8' }}>
                  No hay facturas de compra ni gastos registrados en el periodo seleccionado.
                </div>
              ) : (
                <TablaDocumentosCombinados
                  documentosCombinados={libro.documentosCombinados}
                  retencionPorCompra={libro.retencionPorCompra}
                  retencionIslrPorCompra={libro.retencionIslrPorCompra}
                  retencionIslrPorGasto={libro.retencionIslrPorGasto}
                  editandoId={editandoId}
                  setEditandoId={setEditandoId}
                  formFiscal={formFiscal}
                  setFormFiscal={setFormFiscal}
                  procesandoId={procesandoId}
                  abrirEdicion={abrirEdicion}
                  guardarFiscal={guardarFiscal}
                  contabilizar={contabilizar}
                  contabilizarGastoAccion={contabilizarGastoAccion}
                  emitirRetencion={emitirRetencion}
                  abrirModalIslr={isl.abrirModalIslr}
                  contabilizarRetencionIslrAccion={isl.contabilizarRetencionIslrAccion}
                  anularRetencionIslrAccion={isl.anularRetencionIslrAccion}
                  empresaActiva={empresaActiva}
                  periodoActivo={periodoActivo}
                />
              )}
            </>
          )}
        </>
      )}

      {/* --- MODAL DE EMISIÓN DE RETENCIÓN DE ISLR (Decreto 1.808) --- */}
      <ModalRetencionIslr
        modal={isl.modalIslr}
        conceptos={isl.conceptosIslr}
        onCambio={(patch) => isl.setModalIslr((m) => ({ ...m, ...patch }))}
        onEmitir={isl.emitirRetencionIslr}
        onCerrar={() => isl.setModalIslr(null)}
        emitiendo={isl.emitiendoIslr}
      />
    </div>
  );
}
