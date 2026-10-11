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
    const cliente = doc.cliente || {};
    const lineas = doc?.detalles?.$values || doc?.detalles || [];
    const base = Number(doc?.subtotalMonedaBase ?? 0)
      || lineas.reduce((s, l) => s + Number(l.subtotalLineaMonedaBase ?? 0), 0);
    const iva = Number(doc?.ivaMonedaBase ?? 0);
    const total = Number(doc?.totalMonedaBase ?? 0) || base + iva;
    const exento = lineas
      .filter((l) => Number(l.tasaIVA ?? 0) === 0)
      .reduce((s, l) => s + Number(l.subtotalLineaMonedaBase ?? 0), 0);
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

  return {
    titulo: 'Libro de Ventas IVA (SENIAT)',
    empresa, periodo,
    columnas, indicesMonto,
    excelHeaders, excelMerges,
    filas, totales: filaTotales
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
    const lineas = c?.detalles?.$values || c?.detalles || [];
    const base = Number(c?.subtotalMonedaBase ?? 0)
      || lineas.reduce((s, l) => s + Number(l.subtotalLineaMonedaBase ?? 0), 0);
    const iva = Number(c?.ivaMonedaBase ?? 0);
    const total = Number(c?.totalMonedaBase ?? 0) || base + iva;
    const porTasa = (tasa) => lineas
      .filter((l) => Number(l.tasaIVA ?? 0) === tasa)
      .reduce((s, l) => s + Number(l.subtotalLineaMonedaBase ?? 0), 0);
    // IVA por alícuota calculado línea a línea: cuadra exactamente con el
    // crédito fiscal registrado en la factura (sin descuadres por redondeo).
    const ivaPorTasa = (tasa) => lineas
      .filter((l) => Number(l.tasaIVA ?? 0) === tasa)
      .reduce((s, l) => s + Number(l.subtotalLineaMonedaBase ?? 0) * (tasa / 100), 0);

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
    const montoRet = retencion ? Number(retencion.montoRetenido) : 0;

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

  return {
    titulo: 'Libro de Compras IVA (SENIAT)',
    empresa, periodo,
    columnas, indicesMonto,
    excelHeaders, excelMerges,
    filas, totales: filaTotales
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
    fmtMoneda(g.monto),
    g.asientoContableId ? `Asiento #${g.asientoContableId}` : 'Sin comprobante'
  ]);

  const totalGastos = gastos.reduce((s, g) => s + Number(g.monto ?? 0), 0);

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
    pdf.text('Expresado en USD (moneda base)', 40, 72);
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
    // Ultra compactación para que las 23 columnas quepan en la hoja.
    styles: { fontSize: 6, cellPadding: 2, textColor: [0, 0, 0] },
    headStyles: { fontStyle: 'bold', borderBottom: '1px solid #000' },
    footStyles: { fontStyle: 'bold', borderTop: '1px solid #000' },
    margin: { top: 95, bottom: 50, left: 20, right: 20 },
    willDrawPage: () => dibujarMembrete()
  });

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
    ['Expresado en USD (moneda base)'],
    [], // fila en blanco de separación
    ...headerRows,
    ...estructura.filas,
    estructura.totales
  ];

  const worksheet = XLSX.utils.aoa_to_sheet(datosExcel);

  // Inyección de "merges" si la matriz trae cabeceras complejas.
  if (estructura.excelMerges) {
    worksheet['!merges'] = estructura.excelMerges.map((m) => ({
      // +5 por el desplazamiento del membrete (5 filas arriba)
      s: { r: m.s.r + 5, c: m.s.c },
      e: { r: m.e.r + 5, c: m.e.c }
    }));
  }

  // Conversión y formato de las celdas numéricas contables.
  const indicesMonto = estructura.indicesMonto || [];
  const primeraFilaDatos = 5 + headerRows.length;
  const range = XLSX.utils.decode_range(worksheet['!ref'] || 'A1');

  for (let R = Math.max(primeraFilaDatos, range.s.r); R <= range.e.r; R += 1) {
    for (const C of indicesMonto) {
      const cellAddress = XLSX.utils.encode_cell({ r: R, c: C });
      const celda = worksheet[cellAddress];
      if (!celda || typeof celda.v !== 'string') continue;
      const monto = parseMonto(celda.v);
      if (monto === null) continue;
      celda.t = 'n';
      celda.v = monto;
      celda.z = '#,##0.00';
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




