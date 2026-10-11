import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';

// ---------------------------------------------------------------------------
// REPORTES DE LOS LIBROS FISCALES (SENIAT): construye la estructura de las
// filas/columnas del libro en pantalla y sus exportaciones a PDF y XLS, con el
// mismo patrón visual y técnico de los reportes financieros (ReportesContables).
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

// Un índice de columna es de MONTO (alineado a la derecha) si su nombre está
// en la lista declarada por cada libro (columnasMonto); el resto es texto.
export const esColumnaMonto = (estructura, idx) =>
  (estructura.columnasMonto || []).includes(estructura.columnas[idx]);

// ---------------------------------------------------------------------------
// LIBRO DE VENTAS (facturas + resúmenes de máquina fiscal / cierre Z)
// ---------------------------------------------------------------------------
export const estructuraLibroVentas = ({ empresa, periodo, totales, documentos }) => {
  const columnas = [
    'Fecha', 'Tipo', 'Documento', 'Cliente (RIF)', 'N° Control',
    'Exento', 'Base Gravada', 'IVA', 'Total', 'Comprobante'
  ];

  const filas = documentos.map(({ esResumen, dato: doc }) => {
    if (esResumen) {
      return [
        formatearFechaLibro(doc.fecha),
        doc.tipoTransaccion || '01',
        `Resumen Z ${doc.numeroZ || ''}`,
        `Máquina ${doc.numeroControlMaquina || '—'}`,
        `${doc.facturaDesde || '—'} – ${doc.facturaHasta || '—'}`,
        fmtMoneda(doc.exento),
        fmtMoneda(doc.baseGravada),
        fmtMoneda(doc.iva),
        fmtMoneda(doc.total),
        doc.asientoContableId ? `Asiento #${doc.asientoContableId}` : 'Sin comprobante'
      ];
    }
    const cliente = doc.cliente || {};
    const lineas = doc?.detalles?.$values || doc?.detalles || [];
    const base = Number(doc?.subtotalMonedaBase ?? 0)
      || lineas.reduce((s, l) => s + Number(l.subtotalLineaMonedaBase ?? 0), 0);
    const iva = Number(doc?.ivaMonedaBase ?? 0);
    const total = Number(doc?.totalMonedaBase ?? 0) || base + iva;
    const exento = lineas
      .filter((l) => Number(l.tasaIVA ?? 0) === 0)
      .reduce((s, l) => s + Number(l.subtotalLineaMonedaBase ?? 0), 0);
    return [
      formatearFechaLibro(doc.fechaVenta),
      doc.tipoTransaccion || '01',
      `${doc.numeroFactura || '—'}${doc.isAnulada ? ' (ANULADA)' : ''}`,
      `${cliente.nombre || '—'} (${cliente.rif || 'S/RIF'})`,
      doc.numeroControl || '—',
      fmtMoneda(exento),
      fmtMoneda(Math.max(base - exento, 0)),
      fmtMoneda(iva),
      fmtMoneda(total),
      doc.asientoContableId ? `Asiento #${doc.asientoContableId}` : 'Sin comprobante'
    ];
  });

  return {
    titulo: 'Libro de Ventas IVA (SENIAT)',
    empresa,
    periodo,
    columnas,
    columnasMonto: ['Exento', 'Base Gravada', 'IVA', 'Total'],
    filas,
    totales: [
      '', '', `TOTALES (${totales.documentos} documentos)`, '',
      totales.anuladas > 0 ? `${totales.anuladas} anuladas` : '',
      fmtMoneda(totales.exento),
      fmtMoneda(totales.baseGravada),
      fmtMoneda(totales.iva),
      fmtMoneda(totales.total),
      ''
    ]
  };
};

// ---------------------------------------------------------------------------
// LIBRO DE COMPRAS (compras + retención de IVA por factura)
// ---------------------------------------------------------------------------
export const estructuraLibroCompras = ({ empresa, periodo, totales, compras, retencionPorCompra }) => {
  const columnas = [
    'Fecha', 'Tipo', 'N° Factura', 'N° Control', 'Proveedor (RIF)',
    'Exento', 'Base 8%', 'Base 16%', 'IVA Crédito', 'Retenido', 'Total', 'Comprobante'
  ];

  const filas = compras.map((c) => {
    const lineas = c?.detalles?.$values || c?.detalles || [];
    const base = Number(c?.subtotalMonedaBase ?? 0)
      || lineas.reduce((s, l) => s + Number(l.subtotalLineaMonedaBase ?? 0), 0);
    const iva = Number(c?.ivaMonedaBase ?? 0);
    const total = Number(c?.totalMonedaBase ?? 0) || base + iva;
    const porTasa = (tasa) => lineas
      .filter((l) => Number(l.tasaIVA ?? 0) === tasa)
      .reduce((s, l) => s + Number(l.subtotalLineaMonedaBase ?? 0), 0);
    const proveedor = c.proveedor || {};
    const retencion = typeof retencionPorCompra?.get === 'function'
      ? retencionPorCompra.get(Number(c.id))
      : null;
    return [
      formatearFechaLibro(c.fechaCompra),
      c.tipoTransaccion || '01',
      `${c.numeroFactura || '—'}${c.isAnulada ? ' (ANULADA)' : ''}`,
      c.numeroControl || '—',
      `${proveedor.razonsocial || '—'} (${proveedor.rif || 'S/RIF'})`,
      fmtMoneda(porTasa(0)),
      fmtMoneda(porTasa(8)),
      fmtMoneda(porTasa(16)),
      fmtMoneda(iva),
      retencion ? `${fmtMoneda(retencion.montoRetenido)} (${retencion.porcentajeRetencion}%)` : '—',
      fmtMoneda(total),
      c.asientoContableId ? `Asiento #${c.asientoContableId}` : 'Sin comprobante'
    ];
  });

  return {
    titulo: 'Libro de Compras IVA (SENIAT)',
    empresa,
    periodo,
    columnas,
    columnasMonto: ['Exento', 'Base 8%', 'Base 16%', 'IVA Crédito', 'Total'],
    filas,
    totales: [
      '', '', `TOTALES (${totales.documentos} documentos)`, '', '',
      fmtMoneda(totales.exento),
      fmtMoneda(totales.base8),
      fmtMoneda(totales.base16),
      fmtMoneda(totales.iva),
      fmtMoneda(totales.retenciones ?? 0),
      fmtMoneda(totales.total),
      ''
    ]
  };
};

// ---------------------------------------------------------------------------
// LIBRO DE GASTOS FISCALES (pestaña Compras y Gastos)
// ---------------------------------------------------------------------------
export const estructuraLibroGastos = ({ empresa, periodo, gastos }) => {
  const columnas = ['Fecha', 'Concepto', 'Categoría', 'Proveedor', 'Monto', 'Comprobante'];

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
    empresa,
    periodo,
    columnas,
    columnasMonto: ['Monto'],
    filas,
    totales: ['', `TOTALES (${gastos.length} gastos)`, '', '', fmtMoneda(totalGastos), '']
  };
};


// Convierte los montos "1.234,56" (es-VE) a número; devuelve null si no lo es.
const parseMonto = (texto) => {
  if (typeof texto !== 'string') return null;
  const limpio = texto.trim();
  if (!/^[\d.,]+$/.test(limpio)) return null;
  // Formato es-VE: punto de miles y coma decimal
  const normalizado = limpio.replace(/\./g, '').replace(',', '.');
  const numero = Number(normalizado);
  return isNaN(numero) ? null : numero;
};

// ---------------------------------------------------------------------------
// EXPORTACIÓN A PDF (carta, membrete en cada página, tema "plain" SENIAT)
// ---------------------------------------------------------------------------
export const exportarLibroPdf = (estructura) => {
  if (!estructura) return;
  const { empresa, periodo } = estructura;

  const pdf = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'letter' });

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
    styles: { fontSize: 8, cellPadding: 3, textColor: [0, 0, 0] },
    headStyles: { fontStyle: 'bold', borderBottom: '1px solid #000' },
    footStyles: { fontStyle: 'bold', borderTop: '1px solid #000' },
    margin: { top: 95, bottom: 50, left: 30, right: 30 },
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
// EXPORTACIÓN A XLS (SheetJS): membrete + columnas + datos; los montos se
// escriben como NÚMEROS con formato "#,##0.00" (misma técnica que los reportes
// financieros, ya que la edición comunitaria no serializa estilos de celda).
// ---------------------------------------------------------------------------
export const exportarLibroXls = (estructura) => {
  if (!estructura) return;
  const { empresa, periodo } = estructura;

  const datosExcel = [
    [`${(empresa?.razonSocial || empresa?.nombre || 'EMPRESA').toUpperCase()}`],
    [`RIF ${empresa?.rif || 'J-000000000'}`],
    [`${estructura.titulo} del ${formatearFechaLibro(periodo?.fechaInicio)} al ${formatearFechaLibro(periodo?.fechaFin)}`],
    ['Expresado en USD (moneda base)'],
    [], // fila en blanco de separación
    estructura.columnas,
    ...estructura.filas,
    estructura.totales
  ];

  const worksheet = XLSX.utils.aoa_to_sheet(datosExcel);

  // Alineación de montos a la derecha: números con formato #,##0.00.
  const indicesMonto = estructura.columnas
    .map((nombre, idx) => (esColumnaMonto(estructura, idx) ? idx : -1))
    .filter((idx) => idx >= 0);
  // Filas: 0-3 membrete, 4 en blanco, 5 títulos, 6+ datos (y la fila final de totales)
  const primeraFilaDatos = 6;
  const range = XLSX.utils.decode_range(worksheet['!ref'] || 'A1');
  for (let R = Math.max(primeraFilaDatos, range.s.r); R <= range.e.r; ++R) {
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

  // Configuración de impresión: márgenes carta y repetición del membrete y la
  // fila de columnas en cada página impresa (_xlnm.Print_Titles filas 1 a 6).
  worksheet['!margins'] = {
    left: 0.4, right: 0.4, top: 0.55, bottom: 0.5, header: 0.3, footer: 0.3
  };
  workbook.Workbook = {
    Names: [
      { Name: '_xlnm.Print_Titles', Sheet: 0, Ref: `'${nombreHoja}'!$1:$6` }
    ]
  };

  const nombre = `${estructura.titulo.replace(/[\s()]+/g, '')}_${periodo?.nombre || 'Periodo'}.xlsx`;
  XLSX.writeFile(workbook, nombre);
};

