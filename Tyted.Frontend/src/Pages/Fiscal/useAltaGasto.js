import { useState, useContext } from 'react';
import { ConfigContext } from '../../Context/ConfigContext';
import { fiscalApi, mensajeErrorApi } from '../../Services/Fiscal/FiscalApi';
import { guiaCuentasBase } from './libroComprasHelpers';

// ---------------------------------------------------------------------------
// HOOK DE ALTA DE GASTO FISCAL (entidad propia, sin inventario): concepto
// contable + alícuota en Bs. Requiere periodo contable ABIERTO. Soporta el
// modo híbrido ISLR: el concepto GASTO puede marcar «sujeta a ISLR», lo que
// preselecciona la casilla de emisión (siempre desmarcable). La emisión de la
// retención es SIEMPRE explícita por documento, nunca automática.
// ---------------------------------------------------------------------------
const formGastoInicial = () => ({
  fecha: new Date().toISOString().slice(0, 10),
  concepto: '',
  conceptoId: '',
  codigoProv: '',
  // Datos fiscales del documento soporte (Libro de Compras SENIAT):
  // N° de factura/boleta y N° de control son OBLIGATORIOS («S/N» si el
  // documento no tiene control) y el tipo de transacción es elegible.
  numeroFactura: '',
  numeroControl: '',
  tipoTransaccion: '01',
  monto: '',
  // Alícuota del gasto: 0 (EXENTO) | 8 | 16. El monto tecleado es la BASE
  // sin IVA y la alícuota calcula el IVA aparte (Bs.).
  alicuota: '0'
});

export function useAltaGasto({ empresaId, proveedores, cargarCompras, abrirModalIslr }) {
  const { tasa } = useContext(ConfigContext);

  const [guardandoGasto, setGuardandoGasto] = useState(false);
  const [contabilizarGastoAuto, setContabilizarGastoAuto] = useState(true);
  // Conceptos de operación tipo GASTO (catálogo por empresa, puente con el
  // plan de cuentas): reemplazan la lista estática de categorías.
  const [conceptosGasto, setConceptosGasto] = useState([]);
  const [formGasto, setFormGasto] = useState(formGastoInicial());
  // Modo híbrido ISLR: preselección de la casilla de emisión (desmarcable).
  const [islrEnGasto, setIslrEnGasto] = useState(false);

  // Catálogo de conceptos GASTO (una sola vez por sesión).
  const cargarConceptos = async () => {
    if (conceptosGasto.length > 0) return;
    try {
      const data = await fiscalApi.getConceptos({ empresaId, tipo: 'GASTO' });
      setConceptosGasto(Array.isArray(data) ? data : (data?.$values || []));
    } catch (error) {
      console.warn('Error cargando conceptos de gasto:', error);
    }
  };

  // Limpia el modo GASTO al abrir el formulario único.
  const limpiar = () => {
    setFormGasto(formGastoInicial());
    setIslrEnGasto(false);
  };

  // Gasto en curso: base en Bs. digitada por el usuario + IVA derivado de la
  // alícuota seleccionada (la base es la verdad fiscal; el IVA va aparte).
  const alicuotaGasto = Number(formGasto.alicuota || 0);
  const baseGastoBs = Number(formGasto.monto) || 0;
  const ivaGastoBs = Number((baseGastoBs * alicuotaGasto / 100).toFixed(2));

  const guardarGasto = async () => {
    if (!formGasto.fecha) { alert('⚠️ Indique la fecha del gasto (debe estar dentro del periodo contable abierto).'); return; }
    if (!formGasto.concepto.trim()) { alert('⚠️ Indique el concepto del gasto.'); return; }
    if (!formGasto.conceptoId) { alert('⚠️ Seleccione el concepto contable (GASTO).'); return; }
    if (!formGasto.numeroFactura?.trim()) { alert('⚠️ Indique el N° de factura/documento del gasto (dato obligatorio del Libro de Compras).'); return; }
    if (!formGasto.numeroControl?.trim()) {
      alert('⚠️ Indique el N° de control del gasto (dato obligatorio del Libro de Compras).\n\nSi el documento no tiene control (p. ej. boleta de pago), escriba «S/N».');
      return;
    }
    if (!(Number(formGasto.monto) > 0)) { alert('⚠️ El monto debe ser mayor a cero.'); return; }
    // Gasto GRAVADO (IVA > 0) ⇒ exige proveedor con RIF: su base aporta crédito
    // fiscal al Libro de Compras y el RIF del proveedor es obligatorio ahí.
    if (alicuotaGasto > 0 && !formGasto.codigoProv) {
      alert('⚠️ Los gastos con IVA (crédito fiscal) requieren proveedor con RIF.\n\nSeleccione el proveedor o registre el gasto como EXENTO si aplica.');
      return;
    }
    // Retención ISLR desde el formulario (modo híbrido): exige sujeto retenido.
    if (islrEnGasto && !formGasto.codigoProv) {
      alert('⚠️ Marcó «Emitir retención ISLR»: seleccione el proveedor (sujeto retenido con RIF) o desmarque la casilla.');
      return;
    }
    // Capturas previas al confirm (el estado se limpia tras guardar).
    const emitirIslrAlFinalizar = islrEnGasto;
    const conceptoGastoId = formGasto.conceptoId;
    const codigoProvGasto = formGasto.codigoProv;

    const tasaDia = Number(tasa) || 1;
    const etiquetaIva = alicuotaGasto === 0
      ? 'exento de IVA'
      : `IVA ${alicuotaGasto}%: Bs. ${ivaGastoBs.toFixed(2)} (total Bs. ${(baseGastoBs + ivaGastoBs).toFixed(2)})`;

    const confirmado = window.confirm(
      `Registrar el gasto «${formGasto.concepto}» por Bs. ${baseGastoBs.toFixed(2)} — ${etiquetaIva}.\n\n` +
      'El monto es la BASE sin IVA; el gasto es un documento fiscal propio: NO toca inventario ni compras.' +
      (contabilizarGastoAuto ? ' Se generará su comprobante contable (Debe Gastos + IVA Crédito / Haber Caja o Proveedores).' : '')
    );
    if (!confirmado) return;

    setGuardandoGasto(true);
    try {
      const creado = await fiscalApi.crearGasto({
        empresaId,
        fecha: `${formGasto.fecha}T12:00:00`,
        concepto: formGasto.concepto.trim(),
        // Concepto operacional (puente con el plan de cuentas): su CuentaContable
        // define la cuenta del Debe del comprobante contable.
        conceptoOperacionalId: Number(formGasto.conceptoId),
        codigoProv: formGasto.codigoProv ? Number(formGasto.codigoProv) : null,
        // Datos fiscales del documento soporte (columnas N° Factura/N° Control
        // y Tipo de transacción del Libro de Compras SENIAT).
        numeroFactura: formGasto.numeroFactura.trim(),
        numeroControl: formGasto.numeroControl.trim(),
        tipoTransaccion: formGasto.tipoTransaccion,
        // Verdad fiscal en Bs. EXACTOS (montoMonedaExt/ivaMonedaExt) + moneda
        // base USD derivada con la tasa para el asiento contable.
        monto: Number((baseGastoBs / tasaDia).toFixed(2)),
        montoMonedaExt: baseGastoBs,
        ivaMonedaExt: ivaGastoBs,
        tasaDeCambio: tasaDia
      });

      if (contabilizarGastoAuto && creado?.id) {
        try {
          const r = await fiscalApi.contabilizarGasto(creado.id);
          if (!r.generada) alert(`⚠️ Gasto registrado, pero el comprobante no se generó:\n${r.advertencia || r.mensaje || ''}${guiaCuentasBase(r.advertencia)}`);
        } catch (errorC) {
          alert(`⚠️ Gasto registrado; el comprobante contable falló:\n${mensajeErrorApi(errorC)}`);
        }
      }

      alert('✅ Gasto fiscal registrado.');
      await cargarCompras();

      // Modo híbrido ISLR: si se pidió emitir la retención al finalizar, se
      // abre el modal de emisión con el gasto creado y el concepto ISLR
      // sugerido por el concepto GASTO preseleccionado (la emisión sigue
      // siendo explícita: el usuario confirma y puede cambiar el concepto).
      if (emitirIslrAlFinalizar && creado?.id) {
        const conceptoSel = conceptosGasto.find((x) => Number(x.id) === Number(conceptoGastoId));
        const prov = proveedores.find((p) => Number(p.codigoProv) === Number(codigoProvGasto)) || null;
        await abrirModalIslr({
          gasto: { ...creado, proveedor: prov },
          conceptoId: conceptoSel?.conceptoIslrSugeridoId || ''
        });
      }
      return true;
    } catch (error) {
      console.error('Error creando gasto:', error);
      alert(`❌ No se pudo registrar el gasto:\n${mensajeErrorApi(error)}`);
      return false;
    } finally {
      setGuardandoGasto(false);
    }
  };

  return {
    formGasto, setFormGasto,
    conceptosGasto, cargarConceptos,
    islrEnGasto, setIslrEnGasto,
    alicuotaGasto, baseGastoBs, ivaGastoBs,
    contabilizarGastoAuto, setContabilizarGastoAuto,
    guardandoGasto,
    guardarGasto, limpiar
  };
}
