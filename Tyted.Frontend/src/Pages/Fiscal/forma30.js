import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import { fmtMoneda, formatearFechaLibro } from './reportesLibrosFiscal.js';

// ---------------------------------------------------------------------------
// MOTOR DE LA FORMA 30 (SENIAT): consolida el Libro de Ventas (facturas +
// resúmenes Z) y el Libro de Compras con los inputs manuales del declarante
// para producir el borrador de casillas: Débitos (40-49), Créditos (30-39 y
// subcasillas) y Autoliquidación (53/60/66/90). Funciones puras, sin React,
// para que sean validables con un smoke test en Node.
// ---------------------------------------------------------------------------

const num = (v) => Number(v ?? 0);

// Split por alícuota real de cada línea (0/8/16); IVA = base × tasa por línea
// para cuadrar exacto con el documento. Sin líneas: si hay IVA se asume
// alícuota general 16%; si no, la base es exenta.
const acumularLineas = (lineas, baseDoc, ivaDoc, acc) => {
  if (lineas.length === 0) {
    if (ivaDoc > 0) { acc.base16 += baseDoc; acc.iva16 += ivaDoc; } else { acc.exento += baseDoc; }
    return;
  }
  lineas.forEach((l) => {
    const b = num(l?.subtotalLineaMonedaBase);
    const t = num(l?.tasaIVA);
    if (t === 0) acc.exento += b;
    else if (t === 8) { acc.base8 += b; acc.iva8 += b * 0.08; }
    else { acc.base16 += b; acc.iva16 += b * (t / 100); }
  });
};

// --- DÉBITOS FISCALES (Libro de Ventas) -------------------------------------
// Los resúmenes Z no guardan alícuota: se asumen 16% (criterio SENIAT).
// Los documentos anulados quedan FUERA del débito fiscal.
export const desgloseDebitos = (ventas = [], resumenes = []) => {
  const acc = { exento: 0, base16: 0, iva16: 0, base8: 0, iva8: 0 };
  let documentos = 0, anuladas = 0;

  ventas.forEach((v) => {
    if (v?.isAnulada) { anuladas += 1; return; }
    documentos += 1;
    const lineas = v?.detalles?.$values || v?.detalles || [];
    const base = num(v?.subtotalMonedaBase)
      || lineas.reduce((s, l) => s + num(l?.subtotalLineaMonedaBase), 0);
    acumularLineas(lineas, base, num(v?.ivaMonedaBase), acc);
  });

  resumenes.forEach((r) => {
    if (r?.isAnulada) { anuladas += 1; return; }
    documentos += 1;
    acc.exento += num(r?.exento);
    acc.base16 += num(r?.baseGravada);
    acc.iva16 += num(r?.iva);
  });

  return { documentos, anuladas, ...acc };
};

// --- CRÉDITOS FISCALES (Libro de Compras) -----------------------------------
export const desgloseCreditos = (compras = []) => {
  const acc = { exento: 0, base16: 0, iva16: 0, base8: 0, iva8: 0 };
  let documentos = 0, anuladas = 0;

  compras.forEach((c) => {
    if (c?.isAnulada) { anuladas += 1; return; }
    documentos += 1;
    const lineas = c?.detalles?.$values || c?.detalles || [];
    const base = num(c?.subtotalMonedaBase)
      || lineas.reduce((s, l) => s + num(l?.subtotalLineaMonedaBase), 0);
    acumularLineas(lineas, base, num(c?.ivaMonedaBase), acc);
  });

  return { documentos, anuladas, ...acc };
};
// --- CÁLCULO DE CASILLAS ----------------------------------------------------
// inputs: item48 (ajustes débitos), item20 (excedente mes anterior),
// item38 (ajustes créditos) y item66 (retenciones del período): todos manuales.
export const calcularForma30 = ({
  ventas = [], resumenes = [], compras = [], retencionesEmitidas = [], inputs = {}
} = {}) => {
  const deb = desgloseDebitos(ventas, resumenes);
  const cre = desgloseCreditos(compras);

  const item48 = num(inputs.item48);
  const item20 = num(inputs.item20);
  const item38 = num(inputs.item38);
  const item66 = num(inputs.item66);

  // DÉBITOS FISCALES (Libro de Ventas)
  const item40 = deb.exento;                      // Ventas no gravadas
  const item41 = 0;                               // Exportaciones (sin flag BD)
  const item42 = deb.base16;                      // Base imponible 16%
  const item43 = deb.iva16;                       // Débito fiscal 16%
  const item443 = deb.base8;                      // Base imponible 8%
  const item453 = deb.iva8;                       // Débito fiscal 8%
  const item46 = item40 + item41 + item42 + item443; // Total ventas (base)
  const item47 = item43 + item453;                   // Total débito fiscal
  const item49 = item47 + item48;                    // TOTAL DÉBITOS

  // CRÉDITOS FISCALES (Libro de Compras)
  const item30 = cre.exento;                      // Compras no gravadas
  const item31 = 0;                               // Importaciones base (sin flag)
  const item32 = 0;                               // Importaciones crédito
  const item33 = cre.base16;                      // Base imponible 16%
  const item34 = cre.iva16;                       // Crédito fiscal 16%
  const item333 = cre.base8;                      // Base imponible 8%
  const item343 = cre.iva8;                       // Crédito fiscal 8%
  const item35 = item30 + item31 + item33 + item333; // Total compras (base)
  const item36 = item32 + item34 + item343;          // Total créditos período
  const item71 = item36;                             // Totalmente deducibles
  const item39 = item71 + item20 + item38;           // TOTAL CRÉDITOS

  // AUTOLIQUIDACIÓN
  const item53 = Math.max(0, item49 - item39);       // Cuota tributaria
  const item60 = Math.max(0, item39 - item49);       // Excedente a favor
  const item90 = Math.max(0, item53 - item66);       // TOTAL A PAGAR

  // Referencia informativa: retenciones EMITIDAS por la empresa a proveedores.
  // NO se restan del total a pagar (el crédito fiscal es el IVA completo; en
  // la casilla 66 aplican las retenciones practicadas A la empresa).
  const retencionesEmitidasTotal = retencionesEmitidas
    .reduce((s, r) => s + num(r?.montoRetenido), 0);

  return {
    deb, cre,
    item40, item41, item42, item43, item443, item453, item46, item47, item48, item49,
    item30, item31, item32, item33, item34, item333, item343, item35, item36, item71,
    item20, item38, item39,
    item53, item60, item66, item90,
    retencionesEmitidasTotal
  };
};

// Secciones reutilizadas por la UI, el Excel y el PDF. El 5° elemento de la
// fila (true) marca casilla de INGRESO MANUAL.
export const seccionesForma30 = (c) => ([
  {
    titulo: 'DÉBITOS FISCALES',
    columnas: ['Ítem', 'Descripción', 'Base Imponible', 'Débito Fiscal'],
    filas: [
      ['40', 'Ventas Internas no Gravadas', c.item40, null],
      ['41', 'Ventas de Exportación', c.item41, null],
      ['42', 'Ventas Internas Gravadas por Alícuota General 16%', c.item42, c.item43],
      ['443', 'Ventas Internas Gravadas por Alícuota Reducida 8%', c.item443, c.item453],
      ['46', 'Total Ventas (Base) para efectos de Determinación', c.item46, null],
      ['47', 'Total Débito Fiscal', null, c.item47],
      ['48', 'Ajustes a los Débitos Fiscales de períodos anteriores', null, c.item48, true],
      ['49', 'TOTAL DÉBITOS FISCALES', null, c.item49]
    ]
  },
  {
    titulo: 'CRÉDITOS FISCALES',
    columnas: ['Ítem', 'Descripción', 'Base Imponible', 'Crédito Fiscal'],
    filas: [
      ['30', 'Compras no Gravadas y/o sin Derecho a Crédito Fiscal', c.item30, null],
      ['31', 'Importaciones Gravadas por Alícuota General', c.item31, null],
      ['32', 'Importaciones Gravadas por Alícuota General (Crédito)', null, c.item32],
      ['33', 'Compras Internas Gravadas por Alícuota General 16%', c.item33, c.item34],
      ['333', 'Compras Internas Gravadas por Alícuota Reducida 8%', c.item333, c.item343],
      ['35', 'Total Compras (Base) del Período', c.item35, null],
      ['36', 'Total Créditos Fiscales del Período', null, c.item36],
      ['71', 'Créditos Fiscales Totalmente Deducibles', null, c.item71],
      ['20', 'Excedente de Créditos Fiscales del Mes Anterior', null, c.item20, true],
      ['38', 'Ajustes a los Créditos Fiscales de períodos anteriores', null, c.item38, true],
      ['39', 'TOTAL CRÉDITOS FISCALES', null, c.item39]
    ]
  },
  {
    titulo: 'DETERMINACIÓN DEL IMPUESTO A PAGAR',
    columnas: ['Ítem', 'Descripción', 'Base', 'Monto'],
    filas: [
      ['53', 'Cuota Tributaria del Período (Débitos − Créditos)', null, c.item53],
      ['60', 'Excedente de Crédito Fiscal para el Mes Siguiente', null, c.item60],
      ['66', 'Retenciones del Período (practicadas a la empresa)', null, c.item66, true],
      ['90', 'TOTAL A PAGAR', null, c.item90]
    ]
  }
]);
// ---------------------------------------------------------------------------
// EXPORTACIÓN DE LA FORMA 30 (Excel + PDF)
// ---------------------------------------------------------------------------
const membreteForma30 = (empresa, periodo) => ([
  [`${(empresa?.razonSocial || empresa?.nombre || 'EMPRESA').toUpperCase()}`],
  [`RIF ${empresa?.rif || 'J-000000000'}`],
  [`FORMA 30 — Determinación y Pago del IVA · Periodo ${periodo?.nombre || ''} (${formatearFechaLibro(periodo?.fechaInicio)} al ${formatearFechaLibro(periodo?.fechaFin)})`],
  ['Expresado en USD (moneda base)']
]);

export const exportarForma30Xls = ({ empresa, periodo, calculos }) => {
  if (!calculos) return;
  const secciones = seccionesForma30(calculos);

  const datosExcel = [...membreteForma30(empresa, periodo), []];
  secciones.forEach((s) => {
    datosExcel.push([], [s.titulo]);
    datosExcel.push(s.columnas);
    s.filas.forEach((f) => datosExcel.push([f[0], f[1], f[2] ?? '', f[3] ?? '']));
  });

  const worksheet = XLSX.utils.aoa_to_sheet(datosExcel);
  // Montos nativos con formato contable #,##0.00 en las columnas C y D.
  const range = XLSX.utils.decode_range(worksheet['!ref'] || 'A1');
  for (let R = 0; R <= range.e.r; R += 1) {
    for (const C of [2, 3]) {
      const addr = XLSX.utils.encode_cell({ r: R, c: C });
      const celda = worksheet[addr];
      if (celda && typeof celda.v === 'number') {
        celda.t = 'n';
        celda.z = '#,##0.00';
      }
    }
  }

  const workbook = XLSX.utils.book_new();
  const nombreHoja = 'Forma 30';
  XLSX.utils.book_append_sheet(workbook, worksheet, nombreHoja);
  worksheet['!margins'] = { left: 0.4, right: 0.4, top: 0.55, bottom: 0.5, header: 0.3, footer: 0.3 };

  const nombre = `Forma30_${(periodo?.nombre || 'Periodo').replace(/[\s()]+/g, '')}.xlsx`;
  XLSX.writeFile(workbook, nombre);
};

export const exportarForma30Pdf = ({ empresa, periodo, calculos }) => {
  if (!calculos) return;
  const secciones = seccionesForma30(calculos);
  const pdf = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'letter' });

  const dibujarMembrete = () => {
    pdf.setFontSize(11);
    pdf.setFont('helvetica', 'bold');
    pdf.text(`${(empresa?.razonSocial || empresa?.nombre || 'EMPRESA').toUpperCase()}`, 40, 40);
    pdf.setFontSize(9);
    pdf.setFont('helvetica', 'normal');
    pdf.text(`RIF ${empresa?.rif || 'J-000000000'}`, 40, 54);
    pdf.text(`FORMA 30 — Determinación y Pago del IVA · Periodo ${periodo?.nombre || ''}`, 40, 68);
    pdf.text(`${formatearFechaLibro(periodo?.fechaInicio)} al ${formatearFechaLibro(periodo?.fechaFin)} · Expresado en USD`, 40, 80);
  };

  secciones.forEach((s, idx) => {
    autoTable(pdf, {
      startY: idx === 0 ? 100 : pdf.lastAutoTable.finalY + 26,
      head: [s.columnas],
      body: s.filas.map((f) => [
        f[0],
        f[1],
        f[2] === null || f[2] === undefined ? '—' : fmtMoneda(f[2]),
        f[3] === null || f[3] === undefined ? '—' : fmtMoneda(f[3])
      ]),
      theme: 'plain',
      tableWidth: 474, // 34 + 250 + 95 + 95: ancho fijo sin auto-chequeo
      styles: { fontSize: 8, cellPadding: 3, textColor: [0, 0, 0] },
      headStyles: { fontStyle: 'bold', borderBottom: '1px solid #000' },
      columnStyles: {
        0: { cellWidth: 34, fontStyle: 'bold' },
        1: { cellWidth: 250 },
        2: { halign: 'right', cellWidth: 95 },
        3: { halign: 'right', cellWidth: 95 }
      },
      margin: { top: 100, bottom: 60, left: 40, right: 40 },
      willDrawPage: () => { if (idx === 0) dibujarMembrete(); }
    });
  });

  // Nota metodológica al pie del último bloque.
  const yFinal = (pdf.lastAutoTable && pdf.lastAutoTable.finalY) || 100;
  pdf.setFontSize(7);
  pdf.setFont('helvetica', 'italic');
  pdf.text(
    'Notas: casillas 48/20/38/66 de ingreso manual · resúmenes Z atribuidos a alícuota general 16% · documentos anulados excluidos.',
    40, yFinal + 24
  );

  const totalPaginas = pdf.internal.getNumberOfPages();
  for (let pagina = 1; pagina <= totalPaginas; pagina += 1) {
    pdf.setPage(pagina);
    pdf.setFontSize(8);
    pdf.setFont('helvetica', 'normal');
    pdf.text(`Página ${pagina} de ${totalPaginas}`, 40, pdf.internal.pageSize.getHeight() - 30);
  }

  pdf.save(`Forma30_${(periodo?.nombre || 'Periodo').replace(/[\s()]+/g, '')}.pdf`);
};


