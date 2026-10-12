import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';

// ---------------------------------------------------------------------------
// REPORTES DE LOS LIBROS FISCALES (SENIAT)
// Motor de estructura del Libro de Ventas y del Libro de Compras con el
// formato oficial: segregación CONTRIBUYENTE / NO CONTRIBUYENTE, cabeceras
// multi-nivel fusionadas en Excel (!merges de SheetJS), columnas separadas
// de retención de IVA y exportación PDF "plana" ultra compacta (misma data).
// ---------------------------------------------------------------------------

export const fmtMoneda = (v) => Number(v ?? 0).toLocaleString('es-VE', {
  minimumFractionDigits: 2, maximumFractionDigits: 2
});

export const formatearFechaLibro = (fecha) => {
  if (!fecha) return '—';
  const partes = String(fecha).split(/[-T]/);
  if (partes.length >= 3) return `${partes[2].slice(0, 2)}/${partes[1]}/${partes[0]}`;
  const d = new Date(fecha);
  return isNaN(d.getTime()) ? fecha : d.toLocaleDateString('es-VE');
};

// Un índice de columna es de MONTO (alineación a la derecha en pantalla/PDF y
// conversión a número con formato #,##0.00 en Excel) si fue declarado en
// indicesMonto por cada libro.
export const esColumnaMonto = (estructura, idx) =>
  (estructura.indicesMonto || []).includes(idx);

// ¿El cliente es CONTRIBUYENTE para el Libro de Ventas? Se prefiere un flag
// explícito del backend (cliente.esContribuyente); si no existe, se deduce del
// RIF: J (jurídico) o G (gubernamental) = CONTRIBUYENTE; V/E/P = NO CONTRIBUYENTE.
const esContribuyenteCliente = (cliente) => {
  if (typeof cliente?.esContribuyente === 'boolean') return cliente.esContribuyente;
  const rif = String(cliente?.rif || '').toUpperCase().trim();
  return rif.startsWith('J') || rif.startsWith('G');
};

// ---------------------------------------------------------------------------
// LIBRO DE VENTAS (facturas + resúmenes de máquina fiscal / cierre Z)
// 23 columnas del formato SENIAT: base e IVA segregadas por tipo de sujeto y
// los resúmenes Z reportados con N° Z y rango de facturas (Desde / Hasta).
// ---------------------------------------------------------------------------
export const estructuraLibroVentas = ({ empresa, periodo, totales, documentos }) => {
  // Columnas planas para la vista web y el PDF (misma data que el Excel).
  const columnas = [
    'Nº Ope', 'Fecha', 'Nº R.I.F.', 'Razón Social', 'N° Fact.',
    'N° Control', 'N° Z', 'Desde', 'Hasta', 'N° N/D', 'N° N/C',
    'Tipo', 'Afectada', 'Comp. Ret.', 'Total Venta', 'Ventas Exentas',
    'Base (Contr)', '%', 'IVA (Contr)', 'Base (No Contr)', '%', 'IVA (No Contr)', 'IVA Ret'
  ];

  // Índices de columnas con montos (derecha / formato numérico en Excel).
  const indicesMonto = [14, 15, 16, 18, 19, 21, 22];

  // Cabeceras de 2 niveles exclusivas de la exportación Excel (SENIAT).
  const excelHeaders = [
    [
      'Nº Ope.', 'Fecha', 'Nº R.I.F.', 'Nombre o Razón Social', 'N° Factura',
      'N° Control', 'N° Z', 'Fact. Desde', 'Fact. Hasta', 'N° Nota Débito', 'N° Nota Crédito',
      'Tipo Trans.', 'Fact. Afectada', 'N° Comp. Ret.', 'Total Venta', 'Ventas Exentas',
      'CONTRIBUYENTE', '', '', 'NO CONTRIBUYENTE', '', '', 'IVA Retenido'
    ],
    [
      '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '',
      'Base Imponible', '%', 'Impuesto IVA', 'Base Imponible', '%', 'Impuesto IVA', ''
    ]
  ];

  // Fusiones de celdas (SheetJS): verticales en 0-15 y 22; grupos horizontales
  // CONTRIBUYENTE (16-18) y NO CONTRIBUYENTE (19-21).
  const excelMerges = [];
  for (let i = 0; i <= 15; i += 1) excelMerges.push({ s: { r: 0, c: i }, e: { r: 1, c: i } });
  excelMerges.push({ s: { r: 0, c: 16 }, e: { r: 0, c: 18 } });
  excelMerges.push({ s: { r: 0, c: 19 }, e: { r: 0, c: 21 } });
  excelMerges.push({ s: { r: 0, c: 22 }, e: { r: 1, c: 22 } });
  let op = 1;
  let sumTotal = 0, sumExento = 0, sumBaseC = 0, sumIvaC = 0, sumBaseNC = 0, sumIvaNC = 0, sumRet = 0;

  const filas = documentos.map(({ esResumen, dato: doc }) => {
    // --- RESUMEN DE VENTAS DE LA MÁQUINA FISCAL (cierre Z) ---
    if (esResumen) {
      // Por diseño se reporta en la sección NO CONTRIBUYENTE y usa las
      // columnas N° Z / Fact. Desde / Fact. Hasta del formato SENIAT.
      const total = Number(doc.total || 0);
      const exento = Number(doc.exento || 0);
      const base = Number(doc.baseGravada || 0);
      const iva = Number(doc.iva || 0);
      sumTotal += total;
      sumExento += exento;
      sumBaseNC += base;
      sumIvaNC += iva;

      return [
        op++, formatearFechaLibro(doc.fecha), 'S/RIF', 'Resumen Diario de Ventas',
        '', doc.numeroControlMaquina || '—', doc.numeroZ || '—',
        doc.facturaDesde || '—', doc.facturaHasta || '—',
        '', '', doc.tipoTransaccion || '01-REG', '', '',
        fmtMoneda(total), fmtMoneda(exento),
        fmtMoneda(0), '16%', fmtMoneda(0),
        fmtMoneda(base), '16%', fmtMoneda(iva),
        fmtMoneda(0)
      ];
    }

    // --- FACTURA FISCAL (VENTA) ---
    // INMUTABILIDAD FISCAL: se leen los montos congelados en Bolívares
    // (*MonedaExt) que envía el backend; el frontend NO convierte con tasa.
    const cliente = doc.cliente || {};
    const lineas = doc?.detalles?.$values || doc?.detalles || [];
    const base = Number(doc?.subtotalMonedaExt ?? 0)
      || lineas.reduce((s, l) => s + Number(l.subtotalLineaMonedaExt ?? 0), 0);
    const iva = Number(doc?.ivaMonedaExt ?? 0);
    const total = Number(doc?.totalMonedaExt ?? 0) || base + iva;
    const exento = lineas
      .filter((l) => Number(l.tasaIVA ?? 0) === 0)
      .reduce((s, l) => s + Number(l.subtotalLineaMonedaExt ?? 0), 0);
    const baseGravada = Math.max(base - exento, 0);

    // Segregación: CONTRIBUYENTE (J/G) vs NO CONTRIBUYENTE (V/E/P o sin RIF).
    let baseC = 0, ivaC = 0, baseNC = 0, ivaNC = 0;
    if (esContribuyenteCliente(cliente)) {
      baseC = baseGravada;
      ivaC = iva;
      sumBaseC += baseC;
      sumIvaC += ivaC;
    } else {
      baseNC = baseGravada;
      ivaNC = iva;
      sumBaseNC += baseNC;
      sumIvaNC += ivaNC;
    }
    sumTotal += total;
    sumExento += exento;

    const rif = String(cliente.rif || '').toUpperCase();
    return [
      op++, formatearFechaLibro(doc.fechaVenta), rif || 'S/RIF',
      `${cliente.nombre || '—'}${doc.isAnulada ? ' (ANULADA)' : ''}`,
      doc.numeroFactura || '—', doc.numeroControl || '—', '', '', '',
      '', '', doc.tipoTransaccion || '01-REG', '', '',
      fmtMoneda(total), fmtMoneda(exento),
      fmtMoneda(baseC), '16%', fmtMoneda(ivaC),
      fmtMoneda(baseNC), '16%', fmtMoneda(ivaNC),
      fmtMoneda(0)
    ];
  });

  const anuladas = Number(totales?.anuladas || 0);
  const filaTotales = [
    '', '', '',
    `TOTALES (${op - 1} op${anuladas > 0 ? ` · ${anuladas} anuladas` : ''})`,
    '', '', '', '', '', '', '', '', '', '',
    fmtMoneda(sumTotal), fmtMoneda(sumExento),
    fmtMoneda(sumBaseC), '', fmtMoneda(sumIvaC),
    fmtMoneda(sumBaseNC), '', fmtMoneda(sumIvaNC),
    fmtMoneda(sumRet)
  ];

  // --- RESUMEN DE FORMA 30: DÉBITOS FISCALES (se inyecta al final del libro) ---
  const base16Total = sumBaseC + sumBaseNC;
  const iva16Total = sumIvaC + sumIvaNC;
  const totalBaseDeterminacion = sumExento + base16Total;

  const resumenExcel = [
    [], [], // Espacios en blanco
    ['', 'DÉBITOS FISCALES', '', '', '', 'BASE IMPONIBLE', '', 'DÉBITO FISCAL'],
    ['', '1', 'Ventas Internas no Gravadas', '', '', sumExento, '', ''],
    ['', '2', 'Ventas de Exportación', '', '', 0, '', ''],
    ['', '3', 'Ventas Internas Gravadas por Alícuota General 16%', '', '', base16Total, '', iva16Total],
    ['', '4', 'Ventas Internas Gravadas por Alícuota General más Adicional', '', '', 0, '', 0],
    ['', '5', 'Ventas Internas Gravadas por Alícuota Reducida', '', '', 0, '', 0],
    ['', '6', 'Total Ventas y Débitos Fiscal para efectos de Determinación', '', '', totalBaseDeterminacion, '', iva16Total],
    ['', '7', 'Ajustes a los Débitos Fiscales de períodos anteriores', '', '', '', '', 0],
    ['', '8', 'Certificados de Débitos Fiscales Exonerados', '', '', '', '', 0],
    ['', '9', 'Total Débitos Fiscales', '', '', totalBaseDeterminacion, '', iva16Total]
  ];

  // Fusiones del resumen: títulos en la fila 2 y descripciones (c2-c4) por ítem.
  const resumenMerges = [
    { s: { r: 2, c: 1 }, e: { r: 2, c: 4 } },
    { s: { r: 2, c: 5 }, e: { r: 2, c: 6 } }
  ];
  for (let r = 3; r <= 11; r += 1) resumenMerges.push({ s: { r, c: 2 }, e: { r, c: 4 } });

  const resumenPdf = {
    head: [['', 'DÉBITOS FISCALES', 'BASE IMPONIBLE', 'DÉBITO FISCAL']],
    body: [
      ['1', 'Ventas Internas no Gravadas', fmtMoneda(sumExento), ''],
      ['2', 'Ventas de Exportación', fmtMoneda(0), ''],
      ['3', 'Ventas Internas Gravadas por Alícuota General 16%', fmtMoneda(base16Total), fmtMoneda(iva16Total)],
      ['4', 'Ventas Internas Gravadas por Alícuota General más Adicional', fmtMoneda(0), fmtMoneda(0)],
      ['5', 'Ventas Internas Gravadas por Alícuota Reducida', fmtMoneda(0), fmtMoneda(0)],
      ['6', 'Total Ventas y Débitos Fiscal para efectos de Determinación', fmtMoneda(totalBaseDeterminacion), fmtMoneda(iva16Total)],
      ['7', 'Ajustes a los Débitos Fiscales de períodos anteriores', '', fmtMoneda(0)],
      ['8', 'Certificados de Débitos Fiscales Exonerados', '', fmtMoneda(0)],
      ['9', 'Total Débitos Fiscales', fmtMoneda(totalBaseDeterminacion), fmtMoneda(iva16Total)]
    ]
  };

  return {
    titulo: 'Libro de Ventas IVA (SENIAT)',
    empresa, periodo,
    columnas, indicesMonto,
    excelHeaders, excelMerges,
    filas, totales: filaTotales,
    resumenExcel, resumenMerges, resumenPdf
  };
};
// ---------------------------------------------------------------------------
// LIBRO DE COMPRAS (compras + retención de IVA por factura)
// 22 columnas del formato SENIAT: N° y fecha del comprobante de retención y
// el monto retenido en columnas propias (sin concatenar texto).
// ---------------------------------------------------------------------------
export const estructuraLibroCompras = ({ empresa, periodo, totales, compras, retencionPorCompra }) => {
  const columnas = [
    'N° Op', 'Fecha Doc.', 'Nº R.I.F.', 'Proveedor', 'Tipo', 'Comp Ret', 'Fecha Ret',
    'N° Factura', 'N° Control', 'N° N/D', 'N° N/C', 'Trans.', 'Afectada',
    'Total Compra', 'Exentas', 'Base 16%', '%', 'IVA 16%', 'Base 8%', '%', 'IVA 8%', 'IVA Ret.'
  ];
  const indicesMonto = [13, 14, 15, 17, 18, 20, 21];

  // Cabeceras de 2 niveles exclusivas de la exportación Excel (SENIAT).
  const excelHeaders = [
    [
      'N° Op', 'Fecha Documento', 'Nº R.I.F.', 'Proveedor o Razón Social', 'Tipo Prov.',
      'N° de Comprobante', 'Fecha Aplic. Ret.', 'N° Factura', 'N° Control', 'N° Nota Débito', 'N° Nota Crédito',
      'Tipo Transacción', 'Doc. Afectado', 'Total Compras', 'Compras Exentas',
      'Base Imponible', '', 'Impuesto IVA', 'Base Imponible', '', 'Impuesto IVA', 'IVA Retenido'
    ],
    [
      '', '', '', '', '', '', '', '', '', '', '', '', '', '', '',
      '16%', '', '16%', '8%', '', '8%', ''
    ]
  ];

  // Fusiones de celdas (SheetJS): verticales en 0-14, 17, 20 y 21; las bases
  // imponibles agrupan su columna de alícuota (15-16 y 18-19).
  const excelMerges = [];
  for (let i = 0; i <= 14; i += 1) excelMerges.push({ s: { r: 0, c: i }, e: { r: 1, c: i } });
  excelMerges.push({ s: { r: 0, c: 15 }, e: { r: 0, c: 16 } });
  excelMerges.push({ s: { r: 0, c: 17 }, e: { r: 1, c: 17 } });
  excelMerges.push({ s: { r: 0, c: 18 }, e: { r: 0, c: 19 } });
  excelMerges.push({ s: { r: 0, c: 20 }, e: { r: 1, c: 20 } });
  excelMerges.push({ s: { r: 0, c: 21 }, e: { r: 1, c: 21 } });

  let op = 1;
  let sumTotal = 0, sumExento = 0, sumB16 = 0, sumI16 = 0, sumB8 = 0, sumI8 = 0, sumRet = 0;

  const filas = compras.map((c) => {
    // INMUTABILIDAD FISCAL: montos congelados en Bolívares (*MonedaExt) del
    // backend; sin conversiones en JavaScript.
    const lineas = c?.detalles?.$values || c?.detalles || [];
    const base = Number(c?.subtotalMonedaExt ?? 0)
      || lineas.reduce((s, l) => s + Number(l.subtotalLineaMonedaExt ?? 0), 0);
    const iva = Number(c?.ivaMonedaExt ?? 0);
    const total = Number(c?.totalMonedaExt ?? 0) || base + iva;
    const porTasa = (tasa) => lineas
      .filter((l) => Number(l.tasaIVA ?? 0) === tasa)
      .reduce((s, l) => s + Number(l.subtotalLineaMonedaExt ?? 0), 0);
    // IVA por alícuota calculado línea a línea: cuadra exactamente con el
    // crédito fiscal registrado en la factura (sin descuadres por redondeo).
    const ivaPorTasa = (tasa) => lineas
      .filter((l) => Number(l.tasaIVA ?? 0) === tasa)
      .reduce((s, l) => s + Number(l.subtotalLineaMonedaExt ?? 0) * (tasa / 100), 0);

    let exento = porTasa(0);
    let base16 = porTasa(16);
    let iva16 = ivaPorTasa(16);
    let base8 = porTasa(8);
    let iva8 = ivaPorTasa(8);

    // Sin desglose de líneas se aproxima: si hay IVA se atribuye a la
    // alícuota general (16%); si no, toda la base se considera exenta.
    if (lineas.length === 0) {
      if (iva > 0) { base16 = base; iva16 = iva; } else { exento = base; }
    }

    const proveedor = c.proveedor || {};
    const retencion = typeof retencionPorCompra?.get === 'function'
      ? retencionPorCompra.get(Number(c.id))
      : null;
    // Monto retenido YA en Bolívares (Bs.) congelado por el backend.
    const montoRet = retencion ? Number(retencion.montoRetenidoBs ?? retencion.montoRetenido ?? 0) : 0;

    sumTotal += total;
    sumExento += exento;
    sumB16 += base16; sumI16 += iva16;
    sumB8 += base8; sumI8 += iva8;
    sumRet += montoRet;

    return [
      op++, formatearFechaLibro(c.fechaCompra), proveedor.rif || 'S/RIF',
      `${proveedor.razonsocial || '—'}${c.isAnulada ? ' (ANULADA)' : ''}`,
      '01',
      retencion ? retencion.numeroComprobante : '',
      retencion?.fechaRetencion ? formatearFechaLibro(retencion.fechaRetencion) : '',
      c.numeroFactura || '—', c.numeroControl || '—', '', '',
      c.tipoTransaccion || '01-REG', '',
      fmtMoneda(total), fmtMoneda(exento),
      fmtMoneda(base16), '16%', fmtMoneda(iva16),
      fmtMoneda(base8), '8%', fmtMoneda(iva8),
      fmtMoneda(montoRet)
    ];
  });

  const anuladas = Number(totales?.anuladas || 0);
  const filaTotales = [
    '', '', '',
    `TOTALES (${op - 1} op${anuladas > 0 ? ` · ${anuladas} anuladas` : ''})`,
    '', '', '', '', '', '', '', '', '',
    fmtMoneda(sumTotal), fmtMoneda(sumExento),
    fmtMoneda(sumB16), '', fmtMoneda(sumI16),
    fmtMoneda(sumB8), '', fmtMoneda(sumI8),
    fmtMoneda(sumRet)
  ];

  // --- RESUMEN DE FORMA 30: CRÉDITOS FISCALES (se inyecta al final del libro) ---
  const totalBaseCreditos = sumExento + sumB16 + sumB8;
  const totalIvaCreditos = sumI16 + sumI8;

  const resumenExcel = [
    [], [], // Espacios en blanco
    ['', 'CRÉDITOS FISCALES', '', '', '', 'BASE IMPONIBLE', '', 'CRÉDITO FISCAL'],
    ['', '10', 'Compras no Gravadas y/o sin Derecho a Crédito Fiscal', '', '', sumExento, '', ''],
    ['', '11', 'Importación Gravadas por Alícuota General', '', '', 0, '', 0],
    ['', '12', 'Importaciones Gravadas por Alícuota General más Adicional', '', '', 0, '', 0],
    ['', '13', 'Importaciones Gravadas por Alícuota Reducida', '', '', 0, '', 0],
    ['', '14', 'Compras Internas Gravadas por Alícuota General 16%', '', '', sumB16, '', sumI16],
    ['', '15', 'Compras Internas Gravadas por Alícuota General más Adicional', '', '', 0, '', 0],
    ['', '16', 'Compras Internas Gravadas por Alícuota Reducida 8%', '', '', sumB8, '', sumI8],
    ['', '17', 'Total Compras y Créditos Fiscales del Período', '', '', totalBaseCreditos, '', totalIvaCreditos],
    ['', '18', 'Créditos Fiscales Totalmente Deducibles', '', '', '', '', totalIvaCreditos],
    ['', '19', 'Créditos Fiscales producto de la Aplicación del porcentaje de prorrata', '', '', '', '', 0],
    ['', '20', 'Total créditos fiscales deducibles', '', '', '', '', totalIvaCreditos],
    ['', '21', 'Excedente Créditos Fiscales del mes Anterior', '', '', '', '', 0],
    ['', '22', 'Reintegro Solicitado (sólo Exportadores)', '', '', '', '', 0],
    ['', '23', 'Reintegro Solicitado (entes exonerados)', '', '', '', '', 0],
    ['', '24', 'Ajustes a los Créditos Fiscales de períodos anteriores', '', '', '', '', 0],
    ['', '25', 'Certificados de Débitos Fiscales Exonerados', '', '', '', '', 0],
    ['', '26', 'Total Créditos Fiscales', '', '', '', '', totalIvaCreditos]
  ];

  // Fusiones del resumen: títulos en la fila 2 y descripciones (c2-c4) por ítem.
  const resumenMerges = [
    { s: { r: 2, c: 1 }, e: { r: 2, c: 4 } },
    { s: { r: 2, c: 5 }, e: { r: 2, c: 6 } }
  ];
  for (let r = 3; r <= 19; r += 1) resumenMerges.push({ s: { r, c: 2 }, e: { r, c: 4 } });

  const resumenPdf = {
    head: [['', 'CRÉDITOS FISCALES', 'BASE IMPONIBLE', 'CRÉDITO FISCAL']],
    body: [
      ['10', 'Compras no Gravadas y/o sin Derecho a Crédito Fiscal', fmtMoneda(sumExento), ''],
      ['11', 'Importación Gravadas por Alícuota General', fmtMoneda(0), fmtMoneda(0)],
      ['12', 'Importaciones Gravadas por Alícuota General más Adicional', fmtMoneda(0), fmtMoneda(0)],
      ['13', 'Importaciones Gravadas por Alícuota Reducida', fmtMoneda(0), fmtMoneda(0)],
      ['14', 'Compras Internas Gravadas por Alícuota General 16%', fmtMoneda(sumB16), fmtMoneda(sumI16)],
      ['15', 'Compras Internas Gravadas por Alícuota General más Adicional', fmtMoneda(0), fmtMoneda(0)],
      ['16', 'Compras Internas Gravadas por Alícuota Reducida 8%', fmtMoneda(sumB8), fmtMoneda(sumI8)],
      ['17', 'Total Compras y Créditos Fiscales del Período', fmtMoneda(totalBaseCreditos), fmtMoneda(totalIvaCreditos)],
      ['18', 'Créditos Fiscales Totalmente Deducibles', '', fmtMoneda(totalIvaCreditos)],
      ['19', 'Créditos Fiscales producto de la Aplicación del porcentaje de prorrata', '', fmtMoneda(0)],
      ['20', 'Total créditos fiscales deducibles', '', fmtMoneda(totalIvaCreditos)],
      ['21', 'Excedente Créditos Fiscales del mes Anterior', '', fmtMoneda(0)],
      ['22', 'Reintegro Solicitado (sólo Exportadores)', '', fmtMoneda(0)],
      ['23', 'Reintegro Solicitado (entes exonerados)', '', fmtMoneda(0)],
      ['24', 'Ajustes a los Créditos Fiscales de períodos anteriores', '', fmtMoneda(0)],
      ['25', 'Certificados de Débitos Fiscales Exonerados', '', fmtMoneda(0)],
      ['26', 'Total Créditos Fiscales', '', fmtMoneda(totalIvaCreditos)]
    ]
  };

  return {
    titulo: 'Libro de Compras IVA (SENIAT)',
    empresa, periodo,
    columnas, indicesMonto,
    excelHeaders, excelMerges,
    filas, totales: filaTotales,
    resumenExcel, resumenMerges, resumenPdf
  };
};
// ---------------------------------------------------------------------------
// LIBRO DE GASTOS FISCALES (pestaña Compras y Gastos)
// ---------------------------------------------------------------------------
export const estructuraLibroGastos = ({ empresa, periodo, gastos }) => {
  const columnas = ['Fecha', 'Concepto', 'Categoría', 'Proveedor', 'Monto', 'Comprobante'];
  const indicesMonto = [4];

  const filas = gastos.map((g) => [
    formatearFechaLibro(g.fecha),
    g.concepto || '—',
    g.categoria || '—',
    g.proveedor?.razonsocial || '—',
    // Monto congelado en Bolívares (Bs.); fallback al monto histórico (tasa 1).
    fmtMoneda(g.montoMonedaExt ?? g.monto),
    g.asientoContableId ? `Asiento #${g.asientoContableId}` : 'Sin comprobante'
  ]);

  const totalGastos = gastos.reduce((s, g) => s + Number(g.montoMonedaExt ?? g.monto ?? 0), 0);

  return {
    titulo: 'Libro de Gastos Fiscales',
    empresa, periodo,
    columnas, indicesMonto,
    filas,
    totales: ['', `TOTALES (${gastos.length} gastos)`, '', '', fmtMoneda(totalGastos), '']
  };
};

// Convierte los montos con formato es-VE ("1.234,56") a número nativo para el
// Excel; devuelve null si la celda no es un monto.
const parseMonto = (texto) => {
  if (typeof texto !== 'string') return null;
  const limpio = texto.trim();
  if (!/^-?[\d.,]+$/.test(limpio)) return null;
  const normalizado = limpio.replace(/\./g, '').replace(',', '.');
  const numero = Number(normalizado);
  return isNaN(numero) ? null : numero;
};

// ---------------------------------------------------------------------------
// EXPORTACIÓN A PDF (AutoTable renderiza la tabla plana ultra compacta; el
// formato "legal" (oficio) apaisado maximiza el espacio para 22/23 columnas)
// ---------------------------------------------------------------------------
export const exportarLibroPdf = (estructura) => {
  if (!estructura) return;
  const { empresa, periodo } = estructura;

  const pdf = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'legal' });

  const dibujarMembrete = () => {
    pdf.setFontSize(10);
    pdf.setFont('helvetica', 'bold');
    pdf.text(`${empresa?.razonSocial || empresa?.nombre || 'EMPRESA'.toUpperCase()}`.toUpperCase(), 40, 36);
    pdf.text(`RIF ${empresa?.rif || 'J-000000000'}`, 40, 48);
    pdf.text(`${estructura.titulo} del ${formatearFechaLibro(periodo?.fechaInicio)} al ${formatearFechaLibro(periodo?.fechaFin)}`, 40, 60);
    pdf.setFont('helvetica', 'normal');
    pdf.text('Expresado en Bs. (moneda fiscal)', 40, 72);
  };

  // Alineación: columnas de monto a la derecha, resto a la izquierda.
  const columnStyles = {};
  estructura.columnas.forEach((_, idx) => {
    columnStyles[idx] = { halign: esColumnaMonto(estructura, idx) ? 'right' : 'left' };
  });

  const head = [estructura.columnas.map((col, idx) => ({
    content: col,
    styles: { halign: columnStyles[idx].halign }
  }))];
  const totales = estructura.totales.map((celda) => ({ content: celda, styles: { fontStyle: 'bold' } }));

  autoTable(pdf, {
    startY: 95,
    head,
    body: [...estructura.filas, totales],
    columnStyles,
    theme: 'plain',
    // Ancho explícito: evita el chequeo de auto-ajuste de AutoTable (ruido de
    // consola con columnas muy largas); las celdas largas se parten en líneas.
    tableWidth: '100%',
    // Ultra compactación para que las 23 columnas quepan en la hoja.
    styles: { fontSize: 6, cellPadding: 2, textColor: [0, 0, 0] },
    headStyles: { fontStyle: 'bold', borderBottom: '1px solid #000' },
    footStyles: { fontStyle: 'bold', borderTop: '1px solid #000' },
    margin: { top: 95, bottom: 50, left: 20, right: 20 },
    willDrawPage: () => dibujarMembrete()
  });

  // --- TABLA RESUMEN (Forma 30) al final del libro en PDF ---
  if (estructura.resumenPdf) {
    autoTable(pdf, {
      // Separación de 30px desde el final de la tabla principal (si no cabe,
      // AutoTable salta de página y el membrete se repite vía willDrawPage).
      startY: pdf.lastAutoTable.finalY + 30,
      head: estructura.resumenPdf.head,
      body: estructura.resumenPdf.body,
      theme: 'plain',
      tableWidth: 470, // 30 + 260 + 90 + 90: ancho fijo sin auto-chequeo
      styles: { fontSize: 7, cellPadding: 3, textColor: [0, 0, 0] },
      headStyles: { fontStyle: 'bold', borderBottom: '1px solid #000' },
      columnStyles: {
        0: { cellWidth: 30, fontStyle: 'bold' },
        1: { cellWidth: 260 },
        2: { halign: 'right', cellWidth: 90 },
        3: { halign: 'right', cellWidth: 90 }
      },
      margin: { top: 95, bottom: 50, left: 40, right: 40 },
      willDrawPage: () => dibujarMembrete()
    });
  }

  // Numeración al pie de cada hoja: "Página X de Y".
  const totalPaginas = pdf.internal.getNumberOfPages();
  const altoPagina = pdf.internal.pageSize.getHeight();
  for (let pagina = 1; pagina <= totalPaginas; pagina += 1) {
    pdf.setPage(pagina);
    pdf.setFontSize(8);
    pdf.setFont('helvetica', 'normal');
    pdf.text(`Página ${pagina} de ${totalPaginas}`, 40, altoPagina - 25);
  }

  const nombre = `${estructura.titulo.replace(/[\s()]+/g, '')}_${periodo?.nombre || 'Periodo'}.pdf`;
  pdf.save(nombre);
};
// ---------------------------------------------------------------------------
// EXPORTACIÓN A XLS (SheetJS) con cabeceras complejas fusionadas (SENIAT):
// membrete + cabeceras multi-nivel (!merges) + datos; los montos se escriben
// como NÚMEROS con formato "#,##0.00" (la edición comunitaria no serializa
// estilos de celda, por eso se usa el formato numérico nativo).
// ---------------------------------------------------------------------------
export const exportarLibroXls = (estructura) => {
  if (!estructura) return;
  const { empresa, periodo } = estructura;

  // Las estructuras con cabeceras SENIAT traen excelHeaders (2 filas); las
  // simples (Libro de Gastos) usan la fila única de columnas planas.
  const headerRows = estructura.excelHeaders || [estructura.columnas];

  const datosExcel = [
    [`${(empresa?.razonSocial || empresa?.nombre || 'EMPRESA').toUpperCase()}`],
    [`RIF ${empresa?.rif || 'J-000000000'}`],
    [`${estructura.titulo} del ${formatearFechaLibro(periodo?.fechaInicio)} al ${formatearFechaLibro(periodo?.fechaFin)}`],
    ['Expresado en Bs. (moneda fiscal)'],
    [], // fila en blanco de separación
    ...headerRows,
    ...estructura.filas,
    estructura.totales
  ];

  // El resumen Forma 30 se inyecta al final de la tabla principal; la fila de
  // inicio sirve además para desplazar sus fusiones de celdas.
  const filaInicioResumen = datosExcel.length;
  if (estructura.resumenExcel) datosExcel.push(...estructura.resumenExcel);

  const worksheet = XLSX.utils.aoa_to_sheet(datosExcel);

  // Fusiones: cabeceras SENIAT (+5 por el membrete) + fusiones del resumen
  // (desplazadas a la fila donde comienza el resumen dentro de la hoja).
  const merges = estructura.excelMerges
    ? estructura.excelMerges.map((m) => ({
      s: { r: m.s.r + 5, c: m.s.c },
      e: { r: m.e.r + 5, c: m.e.c }
    }))
    : [];
  if (estructura.resumenExcel && estructura.resumenMerges) {
    estructura.resumenMerges.forEach((m) => {
      merges.push({
        s: { r: m.s.r + filaInicioResumen, c: m.s.c },
        e: { r: m.e.r + filaInicioResumen, c: m.e.c }
      });
    });
  }
  if (merges.length > 0) worksheet['!merges'] = merges;

  // Conversión y formato de las celdas numéricas contables: en la tabla
  // principal los montos vienen como texto es-VE y se parsean; en el resumen
  // ya vienen como números nativos y sólo se les aplica el formato #,##0.00.
  const indicesMonto = estructura.indicesMonto || [];
  const primeraFilaDatos = 5 + headerRows.length;
  const range = XLSX.utils.decode_range(worksheet['!ref'] || 'A1');

  for (let R = 0; R <= range.e.r; R += 1) {
    for (let C = 0; C <= range.e.c; C += 1) {
      const cellAddress = XLSX.utils.encode_cell({ r: R, c: C });
      const celda = worksheet[cellAddress];
      if (!celda) continue;

      if (R >= primeraFilaDatos && R < filaInicioResumen && typeof celda.v === 'string') {
        if (indicesMonto.includes(C)) {
          const monto = parseMonto(celda.v);
          if (monto === null) continue;
          celda.t = 'n';
          celda.v = monto;
          celda.z = '#,##0.00';
        }
      } else if (typeof celda.v === 'number') {
        celda.t = 'n';
        celda.z = '#,##0.00';
      }
    }
  }

  const workbook = XLSX.utils.book_new();
  const nombreHoja = 'Libro Fiscal';
  XLSX.utils.book_append_sheet(workbook, worksheet, nombreHoja);

  // Repetición automática del membrete y las cabeceras al imprimir.
  worksheet['!margins'] = { left: 0.4, right: 0.4, top: 0.55, bottom: 0.5, header: 0.3, footer: 0.3 };
  workbook.Workbook = {
    Names: [
      { Name: '_xlnm.Print_Titles', Sheet: 0, Ref: `'${nombreHoja}'!$1:$${5 + headerRows.length}` }
    ]
  };

  const nombre = `${estructura.titulo.replace(/[\s()]+/g, '')}_${periodo?.nombre || 'Periodo'}.xlsx`;
  XLSX.writeFile(workbook, nombre);
};




