// ---------------------------------------------------------------------------
// HELPERS DEL LIBRO DE COMPRAS FISCAL (IVA + ISLR SENIAT)
// Funciones puras compartidas por la página RegistroComprasFiscal, sus hooks,
// el modal de retención ISLR y la tabla combinada. Sin estado de React.
// ---------------------------------------------------------------------------
export const fmt = (v) => Number(v ?? 0).toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export const formatearFecha = (fecha) => {
  if (!fecha) return '—';
  const partes = String(fecha).split(/[-T]/);
  if (partes.length >= 3) return `${partes[2].slice(0, 2)}/${partes[1]}/${partes[0]}`;
  const d = new Date(fecha);
  return isNaN(d.getTime()) ? fecha : d.toLocaleDateString('es-VE');
};

export const TIPOS_TRANSACCION = [
  { valor: '01', etiqueta: '01 Registro' },
  { valor: '02', etiqueta: '02 Complemento' },
  { valor: '03', etiqueta: '03 Anulación' }
];

// Desglose por alícuota (Providencia 0049): exentas, base reducida 8%,
// base general 16% y crédito fiscal total. Se leen los montos congelados en
// Bolívares (*MonedaExt) del backend; el frontend NO convierte con tasa.
export const desgloseCompra = (compra) => {
  const lineas = compra?.detalles?.$values || compra?.detalles || [];
  const base = Number(compra?.subtotalMonedaExt ?? 0)
    || lineas.reduce((s, l) => s + Number(l.subtotalLineaMonedaExt ?? 0), 0);
  const iva = Number(compra?.ivaMonedaExt ?? 0);
  const total = Number(compra?.totalMonedaExt ?? 0) || base + iva;
  const porTasa = (tasa) => lineas
    .filter((l) => Number(l.tasaIVA ?? 0) === tasa)
    .reduce((s, l) => s + Number(l.subtotalLineaMonedaExt ?? 0), 0);
  const exento = porTasa(0);
  const base8 = porTasa(8);
  const base16 = porTasa(16);
  return { base, exento, base8, base16, iva, total };
};

// Redondeo comercial a 2 decimales (AwayFromZero), idéntico al del backend
// (Math.Round MidpointRounding.AwayFromZero): evita descuadres de centavos
// entre la vista previa del modal y el monto congelado al emitir.
export const redondear2 = (v) => {
  const n = Number(v) || 0;
  return ((n < 0 ? -1 : 1) * Math.round(Math.abs(n) * 100)) / 100;
};

// Cálculo del monto a retener ISLR (Decreto 1.808): (Base × %) − Sustraendo,
// con tope en 0. Única fuente de verdad del FRONTEND (preview del modal y
// confirmación de emisión); el backend recalcula con la misma fórmula y su
// redondeo (con la UT vigente), y es quien congela el valor legal en Bs.
export const calcularRetencionIslr = (concepto, baseBs) => {
  const pct = Number(concepto?.porcentajeRetencion ?? 0);
  const sustraendo = concepto?.aplicaSustraendo ? Number(concepto.montoSustraendoBs ?? 0) : 0;
  const bruto = Number(baseBs || 0) * pct / 100;
  const neto = Math.max(0, redondear2(bruto - sustraendo));
  return { pct, sustraendo, bruto, neto };
};

// Base imponible en Bs. del documento origen ISLR: para la compra usa el
// subtotal congelado (*MonedaExt) o el desglose de líneas; para el gasto usa
// la BASE sin IVA digitada (montoMonedaExt) — el IVA nunca integra la base.
export const baseImponibleIslrBs = (doc, esGasto) => {
  if (!doc) return 0;
  if (esGasto) return Number(doc?.montoMonedaExt ?? 0) || Number(doc?.monto ?? 0);
  const d = desgloseCompra(doc);
  return Number(doc?.subtotalMonedaExt ?? 0) || d.base;
};

// Cuando el motor aborta por cuentas base ausentes (caja/proveedores, IVA o
// compras/gastos), amplía el aviso con el paso a paso para corregirlo desde la
// UI (plan de cuentas o panel de conceptos SISTEMA), en vez de sólo el código.
export const guiaCuentasBase = (texto) => {
  if (!texto || !String(texto).includes('No se encontraron activas')) return '';
  return '\n\n🔧 Cómo corregirlo:\n' +
    '1) Contabilidad → Plan de Cuentas: cree/reactive la(s) cuenta(s) indicada(s) y verifique que estén ACTIVAS y sean de MOVIMIENTO.\n' +
    '2) O bien 🧮 Conceptos → pestaña ⚙️ SISTEMA: reasigne la cuenta base (CAJA_PRINCIPAL, PROVEEDORES, IVA_CREDITO…).\n' +
    '3) Vuelva a pulsar 🧾 (el proceso es idempotente: no duplica el asiento).';
};

// Estilos compartidos de la tabla/libro (tema oscuro Slate).
export const thStyle = { padding: '10px 8px', textAlign: 'left', fontWeight: 'bold', whiteSpace: 'nowrap' };
export const tdStyle = { padding: '8px', borderTop: '1px solid #1f2937', verticalAlign: 'middle' };
export const inputChico = {
  background: '#0f172a', color: '#fff', border: '1px solid #475569',
  borderRadius: '6px', padding: '6px 8px', fontSize: '0.8rem'
};
