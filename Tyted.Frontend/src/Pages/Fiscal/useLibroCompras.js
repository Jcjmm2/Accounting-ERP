import { useState, useContext, useCallback } from 'react';
import { ConfigContext } from '../../Context/ConfigContext';
import { fiscalApi, mensajeErrorApi } from '../../Services/Fiscal/FiscalApi';
import { desgloseGasto } from './reportesLibrosFiscal';
import { desgloseCompra } from './libroComprasHelpers';

// ---------------------------------------------------------------------------
// HOOK DEL LIBRO DE COMPRAS FISCAL: carga bajo demanda del libro combinado
// (facturas + gastos) con sus retenciones de IVA (F2) e ISLR (Decreto 1.808),
// los mapas de retención vigente por documento, los totales del período y la
// lista combinada ordenada para la tabla de consulta/edición.
// El selector global empresa/periodo (ConfigContext) rige el rango consultado.
// ---------------------------------------------------------------------------
export function useLibroCompras() {
  const { empresaActiva, periodoActivo } = useContext(ConfigContext);
  const empresaId = Number(empresaActiva?.id ?? 0);
  const fechaInicio = periodoActivo?.fechaInicio;
  const fechaFin = periodoActivo?.fechaFin;

  const [compras, setCompras] = useState([]);
  const [gastos, setGastos] = useState([]);
  const [retenciones, setRetenciones] = useState([]);
  // Retenciones de ISLR emitidas (Decreto 1.808) del periodo/empresa.
  const [retencionesIslr, setRetencionesIslr] = useState([]);
  const [cargando, setCargando] = useState(false);

  const cargarCompras = useCallback(async () => {
    if (!empresaId || !fechaInicio || !fechaFin) {
      setCompras([]);
      return;
    }
    setCargando(true);
    try {
      const data = await fiscalApi.getCompras({ fechaInicio, fechaFin, empresaId });
      setCompras(Array.isArray(data) ? data : (data?.$values || []));
      // Retenciones de IVA del mismo periodo/empresa (F2); un fallo aquí no
      // debe impedir ver el libro de compras.
      try {
        const rets = await fiscalApi.getRetencionesIva({ fechaInicio, fechaFin, empresaId });
        setRetenciones(Array.isArray(rets) ? rets : (rets?.$values || []));
      } catch (errorRet) {
        console.warn('Error cargando retenciones de IVA:', errorRet);
        setRetenciones([]);
      }
      // Retenciones de ISLR del mismo periodo/empresa (Decreto 1.808).
      try {
        const retsIslr = await fiscalApi.getRetencionesIslr({ fechaInicio, fechaFin, empresaId });
        setRetencionesIslr(Array.isArray(retsIslr) ? retsIslr : (retsIslr?.$values || []));
      } catch (errorIslr) {
        console.warn('Error cargando retenciones de ISLR:', errorIslr);
        setRetencionesIslr([]);
      }
      // Gastos fiscales del mismo periodo/empresa (pestaña Compras y Gastos)
      try {
        const gas = await fiscalApi.getGastos({ fechaInicio, fechaFin, empresaId });
        setGastos(Array.isArray(gas) ? gas : (gas?.$values || []));
      } catch (errorGasto) {
        console.warn('Error cargando gastos:', errorGasto);
        setGastos([]);
      }
    } catch (error) {
      console.error('Error cargando el Libro de Compras:', error);
      alert(`❌ No se pudo cargar el Libro de Compras:\n${mensajeErrorApi(error)}`);
    } finally {
      setCargando(false);
    }
  }, [empresaId, fechaInicio, fechaFin]);

  // Retención vigente por factura (una sola por compra) y total retenido.
  // Monto en Bolívares (Bs.) congelado por el backend (montoRetenidoBs).
  const retencionPorCompra = new Map(retenciones.map((r) => [Number(r.compraId), r]));
  const totalRetenido = retenciones.reduce((s, r) => s + Number(r.montoRetenidoBs ?? r.montoRetenido ?? 0), 0);

  // Retención de ISLR VIGENTE por compra y por gasto (una sola por documento).
  // Sólo cuentan las retenciones con Estado = Emitida: las anuladas quedan en
  // el histórico (y en el XML de declaraciones NO entran) y permiten re-emitir.
  const retencionesIslrVigentes = retencionesIslr.filter((r) => (r.estado || 'Emitida') === 'Emitida');
  const retencionIslrPorCompra = new Map(retencionesIslrVigentes.filter((r) => r.compraId).map((r) => [Number(r.compraId), r]));
  const retencionIslrPorGasto = new Map(retencionesIslrVigentes.filter((r) => r.gastoId).map((r) => [Number(r.gastoId), r]));
  // Total de ISLR retenido en el periodo (tarjeta de resumen de consultas; el
  // Libro de Compras —ley del IVA— no muestra columna de ISLR: se reporta en
  // su propia relación, modal «📑 Retenciones ISLR»).
  const totalIslrRetenido = retencionesIslrVigentes.reduce((s, r) => s + Number(r.montoRetenidoBs ?? 0), 0);

  // Resumen COMBINADO del período (líneas 30/33/34 del formato SENIAT):
  // facturas de compra + gastos, cada uno con sus alícuotas.
  const totales = compras.reduce((acc, c) => {
    const d = desgloseCompra(c);
    acc.documentos += 1;
    acc.exento += d.exento;
    acc.base8 += d.base8;
    acc.base16 += d.base16;
    acc.iva += d.iva;
    acc.total += d.total;
    if (c.isAnulada) acc.anuladas += 1;
    return acc;
  }, { documentos: 0, exento: 0, base8: 0, base16: 0, iva: 0, total: 0, anuladas: 0 });

  gastos.forEach((g) => {
    const d = desgloseGasto(g);
    totales.documentos += 1;
    totales.exento += d.exento;
    totales.base8 += d.base8;
    totales.base16 += d.base16;
    totales.iva += d.iva;
    totales.total += d.total;
    if (g.isAnulada) totales.anuladas += 1;
  });

  // Lista COMBINADA facturas + gastos ordenada por fecha (una sola tabla de
  // consulta/edición en lugar de las antiguas pestañas separadas).
  const documentosCombinados = [
    ...compras.map((c) => ({ tipo: 'FACTURA', fecha: c.fechaCompra, datos: c })),
    ...gastos.map((g) => ({ tipo: 'GASTO', fecha: g.fecha, datos: g }))
  ].sort((a, b) => new Date(a.fecha) - new Date(b.fecha));

  return {
    empresaId, fechaInicio, fechaFin,
    compras, gastos, retenciones, retencionesIslr, cargando,
    cargarCompras,
    retencionPorCompra, totalRetenido,
    retencionIslrPorCompra, retencionIslrPorGasto, totalIslrRetenido,
    totales, documentosCombinados
  };
}
