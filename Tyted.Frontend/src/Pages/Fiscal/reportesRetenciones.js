import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

// ---------------------------------------------------------------------------
// COMPROBANTES DE RETENCIÓN (SENIAT)
// - IVA: Providencia Administrativa SNAT/2025/000054.
// - ISLR: Decreto 1.808.
// INMUTABILIDAD FISCAL: todos los montos se leen DIRECTO de los campos *Bs que
// congela el backend. NO se convierte ni se recalcula con tasa en JavaScript.
// ---------------------------------------------------------------------------

const fmt = (v) => Number(v ?? 0).toLocaleString('es-VE', {
  minimumFractionDigits: 2, maximumFractionDigits: 2
});

const formatearFecha = (fecha) => {
  if (!fecha) return '—';
  const partes = String(fecha).split(/[-T]/);
  if (partes.length >= 3) return `${partes[2].slice(0, 2)}/${partes[1]}/${partes[0]}`;
  const d = new Date(fecha);
  return isNaN(d.getTime()) ? fecha : d.toLocaleDateString('es-VE');
};

// Membrete compartido: agente de retención (empresa) y sujeto retenido (proveedor).
const dibujarPartes = (pdf, empresa, proveedor, x, ancho, y) => {
  pdf.setFontSize(9);
  pdf.rect(x, y, ancho, 50);
  pdf.setFont('helvetica', 'bold');
  pdf.text('AGENTE DE RETENCIÓN:', x + 5, y + 12);
  pdf.setFont('helvetica', 'normal');
  pdf.text(`Razón Social: ${String(empresa?.razonSocial || empresa?.nombre || '').toUpperCase()}`, x + 5, y + 25);
  pdf.text(`RIF: ${empresa?.rif || '—'}`, x + ancho - 150, y + 25);
  pdf.text(`Dirección: ${empresa?.direccion || '—'}`, x + 5, y + 38);

  pdf.rect(x, y + 60, ancho, 50);
  pdf.setFont('helvetica', 'bold');
  pdf.text('SUJETO RETENIDO:', x + 5, y + 72);
  pdf.setFont('helvetica', 'normal');
  pdf.text(`Razón Social: ${String(proveedor?.razonsocial || '').toUpperCase()}`, x + 5, y + 85);
  pdf.text(`RIF: ${proveedor?.rif || '—'}`, x + ancho - 150, y + 85);
  pdf.text(`Dirección: ${proveedor?.direccion || '—'}`, x + 5, y + 98);
};

export const generarComprobanteIVA = (retencion, compra, empresa, periodo) => {
  if (!retencion || !compra) return;
  const pdf = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'letter' });
  const proveedor = compra.proveedor || {};
  const ancho = pdf.internal.pageSize.getWidth();

  pdf.setFontSize(10);
  pdf.setFont('helvetica', 'bold');
  pdf.text('COMPROBANTE DE RETENCIÓN DEL IMPUESTO AL VALOR AGREGADO', ancho / 2, 35, { align: 'center' });
  pdf.setFontSize(8);
  pdf.setFont('helvetica', 'normal');
  pdf.text('(Providencia Administrativa Nº SNAT/2025/000054)', ancho / 2, 47, { align: 'center' });

  dibujarPartes(pdf, empresa, proveedor, 40, ancho - 80, 60);

  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(9);
  pdf.text(`N° COMPROBANTE: ${retencion.numeroComprobante}`, ancho - 230, 185);
  pdf.text(`FECHA: ${formatearFecha(retencion.fechaRetencion)}`, ancho - 230, 197);
  pdf.text(`PERIODO: ${periodo?.nombre || '—'}`, ancho - 230, 209);

  const total = Number(retencion.montoFacturaBs ?? 0) || (Number(retencion.baseImponibleBs ?? 0) + Number(retencion.ivaCalculadoBs ?? 0));
  const base = Number(retencion.baseImponibleBs ?? 0);
  const iva = Number(retencion.ivaCalculadoBs ?? 0);
  const retenido = Number(retencion.montoRetenidoBs ?? 0);

  autoTable(pdf, {
    startY: 230,
    head: [[
      'N° Factura', 'N° Control', 'Tipo', 'Total (Bs.)',
      'Base (Bs.)', 'IVA (Bs.)', '% Ret.', 'IVA Retenido (Bs.)'
    ]],
    body: [[
      compra.numeroFactura || '—', compra.numeroControl || '—', compra.tipoTransaccion || '01',
      fmt(total), fmt(base), fmt(iva), `${retencion.porcentajeRetencion}%`, fmt(retenido)
    ]],
    theme: 'grid',
    styles: { fontSize: 8, halign: 'center' },
    headStyles: { fillColor: [230, 230, 230], textColor: [0, 0, 0], fontStyle: 'bold' },
    columnStyles: { 3: { halign: 'right' }, 4: { halign: 'right' }, 5: { halign: 'right' }, 7: { halign: 'right', fontStyle: 'bold' } }
  });

  const fy = pdf.lastAutoTable.finalY + 60;
  pdf.setFont('helvetica', 'bold');
  pdf.text('___________________________________', ancho * 0.3, fy, { align: 'center' });
  pdf.text('AGENTE DE RETENCIÓN', ancho * 0.3, fy + 15, { align: 'center' });
  pdf.text('___________________________________', ancho * 0.7, fy, { align: 'center' });
  pdf.text('SUJETO RETENIDO', ancho * 0.7, fy + 15, { align: 'center' });

  pdf.setFontSize(6);
  pdf.setFont('helvetica', 'normal');
  pdf.text('Montos en Bolívares (Bs.) — SNAT/2025/000054.', 40, pdf.internal.pageSize.getHeight() - 25);
  pdf.save(`Comprobante_IVA_${retencion.numeroComprobante}_${proveedor.rif || 'S-RIF'}.pdf`);
};

export const generarComprobanteISLR = (retencion, compra, empresa) => {
  if (!retencion) return;
  const pdf = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'letter' });
  const proveedor = compra?.proveedor || {};
  const ancho = pdf.internal.pageSize.getWidth();

  pdf.setFontSize(11);
  pdf.setFont('helvetica', 'bold');
  pdf.text('COMPROBANTE DE RETENCIÓN DE IMPUESTO SOBRE LA RENTA', ancho / 2, 35, { align: 'center' });
  pdf.setFontSize(8);
  pdf.setFont('helvetica', 'normal');
  pdf.text('(Decreto 1.808 — Reglamento Parcial de la LISR en materia de Retenciones)', ancho / 2, 47, { align: 'center' });

  dibujarPartes(pdf, empresa, proveedor, 40, ancho - 80, 60);

  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(9);
  pdf.text(`N° COMPROBANTE: ${retencion.numeroComprobante || 'S/N'}`, ancho - 230, 185);
  pdf.text(`FECHA: ${formatearFecha(retencion.fechaRetencion || compra?.fechaCompra)}`, ancho - 230, 197);

  autoTable(pdf, {
    startY: 220,
    head: [[
      'N° Factura', 'Cód. Concepto', 'Base (Bs.)', '% Ret.',
      'Sustraendo (Bs.)', 'Total Retenido (Bs.)'
    ]],
    body: [[
      retencion.numeroFactura || compra?.numeroFactura || '0',
      retencion.codigoConcepto || '—',
      fmt(retencion.baseImponibleBs),
      `${retencion.porcentajeRetencion}%`,
      fmt(retencion.sustraendoBs),
      fmt(retencion.montoRetenidoBs)
    ]],
    theme: 'grid',
    styles: { fontSize: 8, halign: 'center' },
    headStyles: { fillColor: [230, 230, 230], textColor: [0, 0, 0], fontStyle: 'bold' },
    columnStyles: { 2: { halign: 'right' }, 4: { halign: 'right' }, 5: { halign: 'right', fontStyle: 'bold' } }
  });

  const fy = pdf.lastAutoTable.finalY + 60;
  pdf.setFont('helvetica', 'bold');
  pdf.text('___________________________________', ancho / 2, fy, { align: 'center' });
  pdf.text('AGENTE DE RETENCIÓN', ancho / 2, fy + 15, { align: 'center' });

  pdf.setFontSize(6);
  pdf.setFont('helvetica', 'normal');
  pdf.text('Montos en Bolívares (Bs.) — Decreto 1.808. El sustraendo sólo aplica a personas naturales residentes.', 40, pdf.internal.pageSize.getHeight() - 25);
  pdf.save(`Comprobante_ISLR_${retencion.numeroComprobante || 'SN'}_${proveedor.rif || 'S-RIF'}.pdf`);
};
