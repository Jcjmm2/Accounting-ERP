import { useState, useEffect, useContext } from 'react';
import { ConfigContext } from '../../Context/ConfigContext';
import { fiscalApi, mensajeErrorApi } from '../../Services/Fiscal/FiscalApi';
import { fmt, baseImponibleIslrBs, calcularRetencionIslr, guiaCuentasBase } from './libroComprasHelpers';

// ---------------------------------------------------------------------------
// HOOK DE RETENCIÓN DE ISLR (Decreto 1.808): gestiona el catálogo de conceptos
// de la empresa, el modal de emisión (base imponible editable con tope), la
// emisión (el backend calcula y congela el monto en Bs. con la UT vigente),
// la anulación (motivo auditado + reverso contable) y la contabilización.
// La emisión es SIEMPRE explícita por documento (nunca automática).
// ---------------------------------------------------------------------------
export function useRetencionIslr({ empresaId, retencionIslrPorCompra, retencionIslrPorGasto, cargarCompras }) {
  const { tasa } = useContext(ConfigContext);

  // Conceptos de retención ISLR (catálogo de la empresa) para el modal.
  const [conceptosIslr, setConceptosIslr] = useState([]);
  // Modal de emisión: { compra | gasto, conceptoId, baseMax, baseBs }.
  const [modalIslr, setModalIslr] = useState(null);
  const [emitiendoIslr, setEmitiendoIslr] = useState(false);

  // Abre el modal con un documento origen (compra o gasto), cargando el
  // catálogo ISLR de la empresa. El concepto puede venir sugerido por el
  // concepto GASTO (modo híbrido); la emisión sigue siendo explícita.
  const abrirModalIslr = async ({ compra = null, gasto = null, conceptoId = '' } = {}) => {
    const doc = compra || gasto;
    if (!doc || doc.isAnulada) return;
    const yaEmitida = compra
      ? retencionIslrPorCompra.has(Number(compra.id))
      : retencionIslrPorGasto.has(Number(gasto.id));
    if (yaEmitida) return;

    // Refresca SIEMPRE el catálogo ISLR al abrir el modal: los conceptos dados
    // de alta en otra sesión/pestaña aparecen sin recargar la página.
    try {
      const data = await fiscalApi.getConceptos({ empresaId, tipo: 'ISLR' });
      const lista = Array.isArray(data) ? data : (data?.$values || []);
      setConceptosIslr(lista);
      if (lista.length === 0) {
        alert('⚠️ No hay conceptos ISLR para esta empresa.\n\nVaya a 🧮 Conceptos → pestaña 📑 Retenciones ISLR y pulse «📚 Precargar catálogo ISLR».');
        return;
      }
    } catch (error) {
      console.error('Error cargando conceptos ISLR:', error);
      alert(`❌ No se pudieron cargar los conceptos ISLR:\n${mensajeErrorApi(error)}`);
      return;
    }

    // Base imponible EDITABLE con tope = base del documento origen (retención
    // parcial válida p. ej. en facturas mixtas); arranca con la base completa.
    const baseMax = baseImponibleIslrBs(doc, Boolean(gasto));
    setModalIslr({ compra, gasto, conceptoId: conceptoId ? String(conceptoId) : '', baseMax, baseBs: baseMax });
  };

  // Emite la retención ISLR con el concepto elegido. El backend calcula
  // (Base × %) − Sustraendo con la UT vigente y congela el monto en Bs.
  const emitirRetencionIslr = async () => {
    if (!modalIslr?.conceptoId) return;
    const compra = modalIslr.compra || null;
    const gasto = modalIslr.gasto || null;
    const doc = compra || gasto;
    if (!doc) return;
    const concepto = conceptosIslr.find((x) => Number(x.id) === Number(modalIslr.conceptoId));
    if (!concepto) return;

    // Sujeto retenido: el comprobante y el XML exigen el RIF del proveedor.
    const rif = String(compra?.proveedor?.rif || gasto?.proveedor?.rif || '').trim();
    if (!rif) {
      alert('⚠️ El documento no tiene proveedor con RIF: la retención de ISLR requiere el RIF del sujeto retenido.');
      return;
    }

    // Base imponible EDITABLE (retención parcial) con tope = base del documento.
    const baseBs = Number(modalIslr.baseBs) || 0;
    const baseMax = Number(modalIslr.baseMax) || baseImponibleIslrBs(doc, Boolean(gasto));
    if (!(baseBs > 0)) {
      alert('⚠️ La base imponible de la retención de ISLR debe ser mayor a cero.');
      return;
    }
    if (baseBs > baseMax + 0.01) {
      alert(`⚠️ La base imponible (Bs. ${fmt(baseBs)}) no puede exceder la base del documento origen (Bs. ${fmt(baseMax)}).`);
      return;
    }

    const { pct, sustraendo, neto } = calcularRetencionIslr(concepto, baseBs);

    const etiquetaDoc = gasto
      ? `el gasto «${gasto.concepto || '(s/n)'}» (Doc. ${gasto.numeroFactura || '—'})`
      : `la factura ${compra.numeroFactura || '(s/n)'}`;

    const ok = window.confirm(
      `Emitir retención de ISLR (Decreto 1.808) sobre ${etiquetaDoc}?\n\n` +
      `Sujeto retenido (RIF): ${rif}\n` +
      `Concepto: ${concepto.nombreConcepto} (Cód. ${concepto.codigoSeniat})\n` +
      `Base imponible (Bs.): ${fmt(baseBs)}\n` +
      `Tarifa: ${pct}%\n` +
      `Sustraendo (Bs.): ${fmt(sustraendo)}\n` +
      `Monto a retener (Bs.): ${fmt(neto)}\n\n` +
      'El monto se congelará en Bolívares al momento de emitir.'
    );
    if (!ok) return;

    setEmitiendoIslr(true);
    try {
      const r = await fiscalApi.emitirRetencionIslr({
        compraId: compra ? compra.id : null,
        gastoId: gasto ? gasto.id : null,
        empresaId,
        conceptoOperacionalId: Number(concepto.id),
        baseImponibleBs: baseBs,
        porcentajeRetencion: pct,
        tasaDeCambio: Number(tasa) || 1
      });
      alert(
        `✅ Comprobante de retención ISLR ${r.numeroComprobante} emitido.\n` +
        `Base (Bs.): ${fmt(r.baseImponibleBs)} · Retenido (${r.porcentajeRetencion}%): ${fmt(r.montoRetenidoBs)} Bs.`
      );
      setModalIslr(null);
      await cargarCompras();
    } catch (error) {
      console.error('Error emitiendo retención ISLR:', error);
      alert(`❌ No se pudo emitir la retención ISLR:\n${mensajeErrorApi(error)}`);
    } finally {
      setEmitiendoIslr(false);
    }
  };

  // Comprobante contable de la retención ISLR (Debe Proveedores / Haber ISLR
  // retenido por pagar). Idempotente: no duplica el comprobante.
  const contabilizarRetencionIslrAccion = async (ret) => {
    const confirmado = window.confirm(
      `Generar el comprobante contable de la retención de ISLR ${ret.numeroComprobante}?\n\n` +
      'Partida doble: Debe Proveedores / Haber ISLR retenido por pagar. Idempotente: no se duplicará.'
    );
    if (!confirmado) return;
    try {
      const r = await fiscalApi.contabilizarRetencionIslr(ret.id);
      if (r.generada) {
        alert(`✅ Comprobante ${r.numeroComprobante} generado.\nDebe/Haber: ${fmt(r.totalDebe)} Bs.`);
      } else {
        alert(`⚠️ ${r.mensaje || 'No se generó el comprobante.'}\n${r.advertencia || ''}${guiaCuentasBase(r.advertencia)}`);
      }
      await cargarCompras();
    } catch (error) {
      console.error('Error contabilizando la retención ISLR:', error);
      alert(`❌ No se pudo contabilizar la retención ISLR:\n${mensajeErrorApi(error)}`);
    }
  };

  // Anulación de la retención ISLR con motivo auditado. Si ya estaba
  // contabilizada, el backend genera automáticamente el REVERSO contable
  // (no se borra nada: rastro auditable en el libro mayor y en la BD).
  const anularRetencionIslrAccion = async (ret) => {
    const motivo = window.prompt(
      `Anular el comprobante de retención de ISLR ${ret.numeroComprobante}?\n\n` +
      'El motivo queda auditado. Si la retención ya fue contabilizada se generará el ' +
      'comprobante de REVERSO contable (Debe ISLR retenido / Haber Proveedores).\n' +
      'Tras anular podrá re-emitir la retención sobre el mismo documento.\n\nMotivo de la anulación:',
      ''
    );
    if (motivo === null) return;
    try {
      await fiscalApi.anularRetencionIslr(ret.id, motivo);
      alert(`✅ Retención ISLR ${ret.numeroComprobante} anulada.`);
      await cargarCompras();
    } catch (error) {
      console.error('Error anulando la retención ISLR:', error);
      alert(`❌ No se pudo anular la retención ISLR:\n${mensajeErrorApi(error)}`);
    }
  };

  // UX de modal: mientras el modal ISLR está abierto, Escape lo cierra y el
  // scroll de fondo queda bloqueado (se restaura al cerrar).
  useEffect(() => {
    if (!modalIslr) return undefined;
    const alPulsarTecla = (e) => { if (e.key === 'Escape') setModalIslr(null); };
    window.addEventListener('keydown', alPulsarTecla);
    const overflowAnterior = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', alPulsarTecla);
      document.body.style.overflow = overflowAnterior;
    };
  }, [modalIslr]);

  return {
    conceptosIslr, modalIslr, setModalIslr, emitiendoIslr,
    abrirModalIslr, emitirRetencionIslr,
    contabilizarRetencionIslrAccion, anularRetencionIslrAccion
  };
}
