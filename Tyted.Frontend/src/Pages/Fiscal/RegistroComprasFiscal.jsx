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
import ModalRelacionRetencionesIslr from './ModalRelacionRetencionesIslr';
import ModalConsultaEdicionDocFiscal from './ModalConsultaEdicionDocFiscal';

export default function RegistroComprasFiscal() {
  const { empresaActiva, periodoActivo, tasa } = useContext(ConfigContext);

  // --- DATOS DEL LIBRO ---
  const libro = useLibroCompras();
  const { empresaId, fechaInicio, fechaFin } = libro;

  // --- RETENCIÓN DE ISLR ---
  const isl = useRetencionIslr({
    empresaId,
    retencionIslrPorCompra: libro.retencionIslrPorCompra,
    retencionIslrPorGasto: libro.retencionIslrPorGasto,
    cargarCompras: libro.cargarCompras
  });

  // --- ALTAS FISCALES ---
  const [proveedores, setProveedores] = useState([]);
  const altaCompra = useAltaCompraFiscal({ empresaId, cargarCompras: libro.cargarCompras });
  const altaGasto = useAltaGasto({
    empresaId, proveedores, cargarCompras: libro.cargarCompras,
    abrirModalIslr: isl.abrirModalIslr
  });

  // --- EXCLUSIVIDAD DE PANELES ---
  const [mostrarForm, setMostrarForm] = useState(false);
  const [tipoAlta, setTipoAlta] = useState('FACTURA');
  const [mostrarConsultas, setMostrarConsultas] = useState(false);
  const [mostrarReporte, setMostrarReporte] = useState(false);
  const [mostrarRelacionIslr, setMostrarRelacionIslr] = useState(false);
  const [retencionesRelacionIslr, setRetencionesRelacionIslr] = useState([]);
  const [cargandoRelacionIslr, setCargandoRelacionIslr] = useState(false);

  // --- MODAL DE CONSULTA Y EDICIÓN UNIFICADO (Gastos y Facturas) ---
  const [docConsultaEdicion, setDocConsultaEdicion] = useState(null);
  const [procesandoId, setProcesandoId] = useState(null);

  useEffect(() => {
    if (mostrarConsultas || mostrarReporte) libro.cargarCompras();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [libro.cargarCompras, mostrarConsultas, mostrarReporte]);

  const asegurarCatalogos = async (necesitaConceptosGasto = false) => {
    if (proveedores.length === 0) {
      try {
        const data = await fiscalApi.getProveedores();
        setProveedores(Array.isArray(data) ? data : (data?.$values || []));
      } catch (error) {
        console.warn('Error cargando proveedores:', error);
      }
    }
    if (necesitaConceptosGasto && (!altaGasto.conceptosGasto || altaGasto.conceptosGasto.length === 0)) {
      await altaGasto.cargarConceptos();
    }
  };
  const alternarConsultas = () => {
    if (mostrarConsultas) {
      setMostrarConsultas(false);
      setDocConsultaEdicion(null);
      return;
    }
    setMostrarForm(false);
    setMostrarReporte(false);
    setMostrarRelacionIslr(false);
    isl.setModalIslr(null);
    setDocConsultaEdicion(null);
    setMostrarConsultas(true);
  };

  const alternarReporte = () => {
    if (mostrarReporte) {
      setMostrarReporte(false);
      return;
    }
    setMostrarForm(false);
    setMostrarConsultas(false);
    setMostrarRelacionIslr(false);
    isl.setModalIslr(null);
    setDocConsultaEdicion(null);
    setMostrarReporte(true);
  };

  const alternarRelacionIslr = async () => {
    if (mostrarRelacionIslr) {
      setMostrarRelacionIslr(false);
      return;
    }
    setMostrarForm(false);
    setMostrarConsultas(false);
    setMostrarReporte(false);
    isl.setModalIslr(null);
    setDocConsultaEdicion(null);
    setMostrarRelacionIslr(true);

    if (!empresaId || !fechaInicio || !fechaFin) return;
    setCargandoRelacionIslr(true);
    try {
      const data = await fiscalApi.getRetencionesIslr({ fechaInicio, fechaFin, empresaId });
      setRetencionesRelacionIslr(Array.isArray(data) ? data : (data?.$values || []));
    } catch (error) {
      console.error('Error cargando la relación de retenciones de ISLR:', error);
      alert(`❌ No se pudo cargar la relación de retenciones de ISLR:\n${mensajeErrorApi(error)}`);
    } finally {
      setCargandoRelacionIslr(false);
    }
  };

  const abrirFormUnico = async (tipo) => {
    setMostrarConsultas(false);
    setMostrarReporte(false);
    setMostrarRelacionIslr(false);
    isl.setModalIslr(null);
    setDocConsultaEdicion(null);
    setTipoAlta(tipo);
    if (tipo === 'FACTURA') altaCompra.limpiar();
    else altaGasto.limpiar();
    setMostrarForm(true);

    await asegurarCatalogos(tipo === 'GASTO');
  };

  // Abre el modal de Consulta y Edición desde cualquier fila (Gasto o Factura)
  const abrirConsultaEdicion = async (item) => {
    await asegurarCatalogos(Boolean(item?.esGasto));
    setDocConsultaEdicion(item);
  };

  const guardarConsultaEdicion = async ({ esGasto, id, payload }) => {
    try {
      if (esGasto) {
        await fiscalApi.actualizarGastoFiscal(id, payload);
      } else {
        await fiscalApi.actualizarFiscalCompra(id, payload);
      }
      alert('✅ Registro fiscal actualizado correctamente.');
      setDocConsultaEdicion(null);
      await libro.cargarCompras();
    } catch (error) {
      console.error('Error actualizando documento fiscal:', error);
      alert(`❌ No se pudo actualizar el registro:\n${mensajeErrorApi(error)}`);
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

      if (c.esCredito) {
        alert('ℹ️ Factura a CRÉDITO: el comprobante contable de la retención de IVA se generará al registrar el PAGO (💵) de la factura.');
      } else if (!c.asientoContableId) {
        alert('⚠️ Retención emitida. La factura aún NO tiene comprobante contable: contabilícela primero (🧾 de la factura) y después contabilice la retención.');
      } else {
        try {
          const asiento = await fiscalApi.contabilizarRetencionIva(r.id);
          if (asiento.generada) {
            alert(`✅ Comprobante contable ${asiento.numeroComprobante} de la retención de IVA generado (compra de contado).\nDebe/Haber: ${fmt(asiento.totalDebe)} Bs.`);
          } else {
            alert(`⚠️ Retención emitida SIN comprobante contable:\n${asiento.advertencia || asiento.mensaje || ''}`);
          }
        } catch (errorC) {
          alert(`⚠️ Retención emitida; el comprobante contable falló:\n${mensajeErrorApi(errorC)}\n\nUse el botón 🧾 de la retención para reintentar.`);
        }
      }
      await libro.cargarCompras();
    } catch (error) {
      console.error('Error emitiendo la retención de IVA:', error);
      alert(`❌ No se pudo emitir la retención:\n${mensajeErrorApi(error)}`);
    }
  };
  const contabilizarRetencionIvaAccion = async (c) => {
    const ret = libro.retencionPorCompra.get(Number(c.id));
    if (!ret || ret.asientoContableId) return;

    const confirmado = window.confirm(
      `Generar el comprobante contable de la retención de IVA ${ret.numeroComprobante} (${ret.porcentajeRetencion}%) sobre la factura ${c.numeroFactura || '(s/n)'}?\n\n` +
      'Partida doble: Debe Caja | Haber IVA Retenido por Entregar. Idempotente: no se duplicará.'
    );
    if (!confirmado) return;

    try {
      const r = await fiscalApi.contabilizarRetencionIva(ret.id);
      if (r.generada) alert(`✅ Comprobante ${r.numeroComprobante} generado.\nDebe/Haber: ${fmt(r.totalDebe)} Bs.`);
      else alert(`⚠️ ${r.mensaje || 'No se generó el comprobante.'}\n${r.advertencia || ''}`);
      await libro.cargarCompras();
    } catch (error) {
      console.error('Error contabilizando la retención de IVA:', error);
      alert(`❌ No se pudo contabilizar la retención de IVA:\n${mensajeErrorApi(error)}`);
    }
  };

  const registrarPagoCompraAccion = async (c) => {
    const retIva = libro.retencionPorCompra.get(Number(c.id));
    const retIslr = libro.retencionIslrPorCompra.get(Number(c.id));
    const hoy = new Date().toISOString().slice(0, 10);
    const fecha = window.prompt(
      `Fecha del pago de la factura ${c.numeroFactura || '(s/n)'} (AAAA-MM-DD):\n` +
      '(debe estar dentro de un periodo contable abierto)', hoy);
    if (fecha === null) return;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha.trim())) { alert('⚠️ Fecha inválida: use el formato AAAA-MM-DD.'); return; }

    const confirmado = window.confirm(
      `Registrar el pago total de la factura ${c.numeroFactura || '(s/n)'} con fecha ${fecha.trim()}.\n\n` +
      (retIva ? `Retención IVA ${retIva.numeroComprobante}: se contabiliza con el pago (Haber IVA Retenido por Entregar).\n` : '') +
      (retIslr ? `Retención ISLR ${retIslr.numeroComprobante}: se contabiliza antes del pago si aún no lo está.\n` : '') +
      'Partida doble: Debe Proveedores | Haber Caja (efectivo) + IVA Retenido. Idempotente: sólo una vez por factura.'
    );
    if (!confirmado) return;

    try {
      const r = await fiscalApi.registrarPagoCompra(c.id, `${fecha.trim()}T12:00:00`);
      alert(`✅ Pago contabilizado: comprobante ${r.numeroComprobante}.\nDebe/Haber: ${fmt(r.totalDebe)} Bs.`);
      await libro.cargarCompras();
    } catch (error) {
      console.error('Error registrando el pago de la compra:', error);
      alert(`❌ No se pudo registrar el pago:\n${mensajeErrorApi(error)}`);
    }
  };
  const guardarFacturaYCerrar = async () => {
    const ok = await altaCompra.guardarCompraFiscal();
    if (ok) setMostrarForm(false);
  };
  const guardarGastoYCerrar = async () => {
    const ok = await altaGasto.guardarGasto();
    if (ok) setMostrarForm(false);
  };

  const reporteLibro = estructuraLibroCompras({
    empresa: empresaActiva,
    periodo: periodoActivo,
    totales: libro.totales,
    compras: libro.compras,
    gastos: libro.gastos,
    retencionPorCompra: libro.retencionPorCompra
  });

  const hayContexto = Boolean(empresaId && fechaInicio && fechaFin);

  const docActual = docConsultaEdicion?.dato || docConsultaEdicion;
  const retIvaModal = docActual && !docConsultaEdicion?.esGasto
    ? libro.retencionPorCompra.get(Number(docActual.id))
    : null;
  const retIslrModal = docActual
    ? (docConsultaEdicion?.esGasto
        ? libro.retencionIslrPorGasto.get(Number(docActual.id))
        : libro.retencionIslrPorCompra.get(Number(docActual.id)))
    : null;

  return (
    <div style={{ padding: '24px', color: '#e2e8f0', minHeight: '80vh' }}>
      <CabeceraLibroCompras
        empresaActiva={empresaActiva}
        periodoActivo={periodoActivo}
        fechaInicio={fechaInicio}
        fechaFin={fechaFin}
        mostrarConsultas={mostrarConsultas}
        mostrarReporte={mostrarReporte}
        mostrarRelacionIslr={mostrarRelacionIslr}
        cargando={libro.cargando}
        hayContexto={hayContexto}
        onNuevoDocumento={() => abrirFormUnico('FACTURA')}
        onAlternarConsultas={alternarConsultas}
        onAlternarReporte={alternarReporte}
        onAlternarRelacionIslr={alternarRelacionIslr}
        onRecargar={libro.cargarCompras}
      />

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

          {/* --- CONSULTA Y EDICIÓN DEL LIBRO --- */}
          {mostrarConsultas && (
            <>
              {/* Tarjetas KPI compactas en una sola fila */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: '8px', marginBottom: '14px' }}>
                {[
                  { etiqueta: 'Docs.', valor: libro.totales.documentos, entero: true, color: '#60a5fa' },
                  { etiqueta: 'Exentas', valor: libro.totales.exento, color: '#94a3b8' },
                  { etiqueta: 'Base 8%', valor: libro.totales.base8, color: '#a78bfa' },
                  { etiqueta: 'Base 16%', valor: libro.totales.base16, color: '#34d399' },
                  { etiqueta: 'IVA Crédito', valor: libro.totales.iva, color: '#fbbf24' },
                  { etiqueta: 'IVA Ret.', valor: libro.totalRetenido, color: '#f472b6' },
                  { etiqueta: 'ISLR Ret.', valor: libro.totalIslrRetenido, color: '#60a5fa' },
                  { etiqueta: 'Total Bs.', valor: libro.totales.total, color: '#fff' }
                ].map((c) => (
                  <div key={c.etiqueta} style={{ background: '#0f172a', border: '1px solid #334155', borderRadius: '8px', padding: '8px 10px' }}>
                    <div style={{ fontSize: '0.67rem', color: '#94a3b8', marginBottom: '2px' }}>{c.etiqueta}</div>
                    <div style={{ fontSize: '0.95rem', fontWeight: 'bold', color: c.color }}>
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
                  procesandoId={procesandoId}
                  abrirConsultaEdicion={abrirConsultaEdicion}
                  contabilizar={contabilizar}
                  contabilizarGastoAccion={contabilizarGastoAccion}
                  emitirRetencion={emitirRetencion}
                  contabilizarRetencionIvaAccion={contabilizarRetencionIvaAccion}
                  registrarPagoCompraAccion={registrarPagoCompraAccion}
                  abrirModalIslr={isl.abrirModalIslr}
                  contabilizarRetencionIslrAccion={isl.contabilizarRetencionIslrAccion}
                />
              )}
            </>
          )}
        </>
      )}
      {/* --- MODAL UNIFICADO DE CONSULTA Y EDICIÓN (Gastos y Facturas) --- */}
      <ModalConsultaEdicionDocFiscal
        docWrapper={docConsultaEdicion}
        proveedores={proveedores}
        conceptosGasto={altaGasto.conceptosGasto || []}
        retencionIva={retIvaModal}
        retencionIslr={retIslrModal}
        onCerrar={() => setDocConsultaEdicion(null)}
        onGuardarCambios={guardarConsultaEdicion}
      />

      <ModalRetencionIslr
        modal={isl.modalIslr}
        conceptos={isl.conceptosIslr}
        onCambio={(patch) => isl.setModalIslr((m) => ({ ...m, ...patch }))}
        onEmitir={isl.emitirRetencionIslr}
        onCerrar={() => isl.setModalIslr(null)}
        emitiendo={isl.emitiendoIslr}
        contabilizarAuto={isl.contabilizarIslrAuto}
        onCambioContabilizarAuto={isl.setContabilizarIslrAuto}
      />

      <ModalRelacionRetencionesIslr
        abierto={mostrarRelacionIslr}
        retenciones={retencionesRelacionIslr}
        cargando={cargandoRelacionIslr}
        empresa={empresaActiva}
        periodo={periodoActivo}
        fechaInicio={fechaInicio}
        fechaFin={fechaFin}
        onCerrar={() => setMostrarRelacionIslr(false)}
      />
    </div>
  );
}