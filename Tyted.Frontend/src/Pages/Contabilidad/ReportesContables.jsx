import { useEffect, useMemo, useState } from 'react';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import { contabilidadApi } from '../../Services/Contabilidad/ContabilidadApi';

// Opciones adaptadas a los formatos formales solicitados
const REPORT_OPTIONS = [
  { id: 'balance-comprobacion', label: 'Balance de Comprobación', icon: '📑' },
  { id: 'estado-resultados', label: 'Estado de Resultado', icon: '📈' },
  { id: 'situacion-financiera', label: 'Situación Financiera', icon: '⚖️' },
  { id: 'resumen-diario', label: 'Resumen de Diario', icon: '📓' },
];

const moneyFormatter = new Intl.NumberFormat('es-VE', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const field = (obj, ...keys) => {
  for (const key of keys) {
    if (obj && obj[key] !== undefined && obj[key] !== null) {
      return obj[key];
    }
  }
  return undefined;
};

const formatMoney = (value) => moneyFormatter.format(Number(value ?? 0));

const formatearFecha = (fechaStr) => {
  if (!fechaStr || fechaStr === '---') return '---';
  try {
    // Si la fecha viene en formato "YYYY-MM-DD" o "YYYY/MM/DD"
    const partes = fechaStr.split(/[-/T]/);
    if (partes.length >= 3) {
      const [anio, mes, dia] = partes;
      return `${dia}/${mes}/${anio}`;
    }
    const d = new Date(fechaStr);
    return isNaN(d.getTime()) ? fechaStr : d.toLocaleDateString('es-VE');
  } catch {
    return fechaStr;
  }
};

export default function ReportesContables({ empresaActiva, periodoActivo }) {
  const [balance, setBalance] = useState([]);
  const [cuentas, setCuentas] = useState([]);
  const [selectedReporte, setSelectedReporte] = useState(null);
  const [loading, setLoading] = useState(false);
  
  // Jerarquía de periodos
  const [periodos, setPeriodos] = useState([]);
  const [periodoSeleccionadoId, setPeriodoSeleccionadoId] = useState(Number(periodoActivo?.id ?? 1));

  useEffect(() => {
    setPeriodoSeleccionadoId(Number(periodoActivo?.id ?? 1));
  }, [periodoActivo?.id]);

  useEffect(() => {
    const cargarPeriodos = async () => {
      try {
        const data = await contabilidadApi.getPeriodos();
        setPeriodos(Array.isArray(data) ? data : (data?.$values || []));
      } catch (error) {
        console.error('Error cargando periodos:', error);
      }
    };
    cargarPeriodos();
  }, []);

  // Aplanar la jerarquía Padre/Hijo para el selector
  const listaPeriodosJerarquia = useMemo(() => {
    const lista = [];
    periodos.forEach(p => {
      lista.push({ ...p, isPadre: true, label: `📁 [AÑO] ${p.nombre || p.anio}` });
      const subs = p.subPeriodos?.$values || p.subPeriodos || [];
      subs.forEach(sub => {
        lista.push({ ...sub, isPadre: false, label: `   └ 📄 ${sub.nombre || sub.mes}` });
      });
    });
    return lista;
  }, [periodos]);

  const periodoSeleccionadoData = useMemo(() => {
    return listaPeriodosJerarquia.find(p => Number(p.id) === periodoSeleccionadoId) || periodoActivo;
  }, [listaPeriodosJerarquia, periodoSeleccionadoId, periodoActivo]);

  // Carga de datos contables formales según el periodo seleccionado
  useEffect(() => {
    const cargar = async () => {
      try {
        setLoading(true);
        setSelectedReporte(null); // Ocultar reporte previo al cambiar periodo
        const [dataBalance, dataCuentas] = await Promise.all([
          contabilidadApi.getBalanceComprobacion(periodoSeleccionadoId).catch(() => []),
          contabilidadApi.getCuentas().catch(() => []),
        ]);
        setBalance(Array.isArray(dataBalance) ? dataBalance : (dataBalance?.$values || []));
        setCuentas(Array.isArray(dataCuentas) ? dataCuentas : (dataCuentas?.$values || []));
      } catch (error) {
        console.error('Error cargando reportes:', error);
      } finally {
        setLoading(false);
      }
    };
    cargar();
  }, [periodoSeleccionadoId]);

  // Mapeo unificado para agrupar cuentas (Activo, Pasivo, Capital, Ingreso, Egreso)
  const cuentaMap = useMemo(() => {
    const map = new Map();
    cuentas.forEach((cuenta) => {
      const id = field(cuenta, 'id', 'Id', 'cuentaId', 'CuentaId');
      if (id !== undefined) map.set(Number(id), cuenta);
    });
    return map;
  }, [cuentas]);

  const cuentasEnriquecidas = useMemo(() => {
    return balance.map(b => {
      const cuenta = cuentaMap.get(Number(field(b, 'cuentaId', 'CuentaId')));
      return {
        ...b,
        codigo: field(cuenta, 'codigoCuenta', 'CodigoCuenta') || field(b, 'codigoCuenta', 'CodigoCuenta') || '',
        nombre: field(cuenta, 'nombreCuenta', 'NombreCuenta') || field(b, 'nombreCuenta', 'NombreCuenta') || '',
        tipo: String(field(cuenta, 'tipoCuenta', 'TipoCuenta') || field(b, 'tipoCuenta', 'TipoCuenta') || '').toUpperCase(),
        saldoInicial: Number(field(b, 'saldoInicial', 'SaldoInicial') ?? 0),
        debe: Number(field(b, 'movimientoDebe', 'MovimientoDebe') ?? 0),
        haber: Number(field(b, 'movimientoHaber', 'MovimientoHaber') ?? 0),
        saldoFinal: Number(field(b, 'saldoFinal', 'SaldoFinal') ?? 0),
      };
    }).sort((a, b) => a.codigo.localeCompare(b.codigo));
  }, [balance, cuentaMap]);

  // Generadores de estructuras (Basados en los PDFs adjuntos)
  const getEstructuraReporte = () => {
    switch (selectedReporte) {
      case 'balance-comprobacion': {
        const totales = cuentasEnriquecidas.reduce((acc, c) => ({
          inicial: acc.inicial + c.saldoInicial,
          debe: acc.debe + c.debe,
          haber: acc.haber + c.haber,
          final: acc.final + c.saldoFinal
        }), { inicial: 0, debe: 0, haber: 0, final: 0 });

        return {
          titulo: 'Balance de Comprobación',
          columnas: ['Nombre de La Cuenta', 'Saldo Inicial', 'Monto Debe', 'Monto Haber', 'Saldo Actual'],
          filas: cuentasEnriquecidas.map(c => [
            `${c.codigo} - ${c.nombre}`, formatMoney(c.saldoInicial), formatMoney(c.debe), formatMoney(c.haber), formatMoney(c.saldoFinal)
          ]),
          totales: ['TOTALES..', formatMoney(totales.inicial), formatMoney(totales.debe), formatMoney(totales.haber), formatMoney(totales.final)]
        };
      }
      case 'estado-resultados': {
        const ingresos = cuentasEnriquecidas.filter(c => c.tipo.includes('INGRESO'));
        const egresos = cuentasEnriquecidas.filter(c => c.tipo.includes('GASTO') || c.tipo.includes('COSTO'));
        
        const totalIngresos = ingresos.reduce((sum, c) => sum + Math.abs(c.saldoFinal), 0);
        const totalEgresos = egresos.reduce((sum, c) => sum + Math.abs(c.saldoFinal), 0);
        const utilidad = totalIngresos - totalEgresos;

        const filas = [
          [{ content: 'INGRESOS', styles: { fontStyle: 'bold' } }, ''],
          ...ingresos.map(c => [c.nombre, formatMoney(Math.abs(c.saldoFinal))]),
          [{ content: 'TOTAL INGRESOS', styles: { fontStyle: 'bold' } }, { content: formatMoney(totalIngresos), styles: { fontStyle: 'bold' } }],
          [{ content: '', styles: { minCellHeight: 10 } }, ''],
          [{ content: 'EGRESOS', styles: { fontStyle: 'bold' } }, ''],
          ...egresos.map(c => [c.nombre, formatMoney(Math.abs(c.saldoFinal))]),
          [{ content: 'TOTAL EGRESOS', styles: { fontStyle: 'bold' } }, { content: formatMoney(totalEgresos), styles: { fontStyle: 'bold' } }],
        ];

        return {
          titulo: 'Estado De Resultado',
          columnas: ['Descripción', 'Monto'],
          filas,
          totales: ['UTILIDAD O PERDIDA NETA DEL EJERCICIO', formatMoney(utilidad)]
        };
      }
      case 'situacion-financiera': {
        const activos = cuentasEnriquecidas.filter(c => c.tipo.includes('ACTIVO'));
        const pasivos = cuentasEnriquecidas.filter(c => c.tipo.includes('PASIVO'));
        const patrimonio = cuentasEnriquecidas.filter(c => c.tipo.includes('PATRIMONIO') || c.tipo.includes('CAPITAL'));

        const totalActivos = activos.reduce((sum, c) => sum + Math.abs(c.saldoFinal), 0);
        const totalPasivos = pasivos.reduce((sum, c) => sum + Math.abs(c.saldoFinal), 0);
        const totalPatrimonio = patrimonio.reduce((sum, c) => sum + Math.abs(c.saldoFinal), 0);

        const filas = [
          [{ content: 'ACTIVO', styles: { fontStyle: 'bold' } }, ''],
          ...activos.map(c => [c.nombre, formatMoney(Math.abs(c.saldoFinal))]),
          [{ content: 'TOTAL ACTIVO', styles: { fontStyle: 'bold' } }, { content: formatMoney(totalActivos), styles: { fontStyle: 'bold' } }],
          [{ content: '', styles: { minCellHeight: 10 } }, ''],
          [{ content: 'PASIVO', styles: { fontStyle: 'bold' } }, ''],
          ...pasivos.map(c => [c.nombre, formatMoney(Math.abs(c.saldoFinal))]),
          [{ content: 'TOTAL PASIVO', styles: { fontStyle: 'bold' } }, { content: formatMoney(totalPasivos), styles: { fontStyle: 'bold' } }],
          [{ content: '', styles: { minCellHeight: 10 } }, ''],
          [{ content: 'PATRIMONIO', styles: { fontStyle: 'bold' } }, ''],
          ...patrimonio.map(c => [c.nombre, formatMoney(Math.abs(c.saldoFinal))]),
          [{ content: 'TOTAL PATRIMONIO', styles: { fontStyle: 'bold' } }, { content: formatMoney(totalPatrimonio), styles: { fontStyle: 'bold' } }],
        ];

        return {
          titulo: 'Estado de Situación Financiera',
          columnas: ['Descripción', 'Monto'],
          filas,
          totales: ['TOTAL PASIVO Y PATRIMONIO', formatMoney(totalPasivos + totalPatrimonio)]
        };
      }
      case 'resumen-diario': {
        // Filtrar cuentas que tuvieron movimiento en el mes
        const cuentasConMovimiento = cuentasEnriquecidas.filter(c => c.debe > 0 || c.haber > 0);
        const totales = cuentasConMovimiento.reduce((acc, c) => ({
          debe: acc.debe + c.debe, haber: acc.haber + c.haber
        }), { debe: 0, haber: 0 });

        return {
          titulo: 'Resumen de Diario',
          columnas: ['Código', 'NOMBRE DE LA CUENTA', 'DEBE', 'HABER'],
          filas: cuentasConMovimiento.map(c => [
            c.codigo, c.nombre, formatMoney(c.debe), formatMoney(c.haber)
          ]),
          totales: ['TOTALES..', '', formatMoney(totales.debe), formatMoney(totales.haber)]
        };
      }
      default:
        return null;
    }
  };

  const exportarPdf = () => {
    const estructura = getEstructuraReporte();
    if (!estructura) return;

    const pdf = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'letter' });
    const fechaEmision = new Date();
    
    // Encabezado según formato PDF
    pdf.setFontSize(10);
    pdf.setFont('helvetica', 'bold');
    pdf.text(`${empresaActiva?.nombre?.toUpperCase() || 'EMPRESA PRINCIPAL'}`, 40, 40);
    pdf.text(`RIF ${empresaActiva?.rif || 'J-000000000'}`, 40, 52);
    pdf.text(`${estructura.titulo} DEL ${periodoSeleccionadoData?.fechaInicio || ''} AL ${periodoSeleccionadoData?.fechaFin || ''}`, 40, 64);
    pdf.setFont('helvetica', 'normal');
    pdf.text('Expresado en Bolívar', 40, 76);
    pdf.text(`${estructura.titulo} del ${formatearFecha(periodoSeleccionadoData?.fechaInicio)} al ${formatearFecha(periodoSeleccionadoData?.fechaFin)}`, 40, 64);

    // Preparar filas eliminando configuraciones de objetos que usa HTML/jsPDF-autotable mezclado
    const cleanFilas = estructura.filas.map(fila => fila.map(celda => typeof celda === 'object' && celda !== null ? celda.content : celda));
    const cleanTotales = estructura.totales.map(celda => typeof celda === 'object' && celda !== null ? celda.content : celda);

    autoTable(pdf, {
      startY: 105,
      head: [estructura.columnas],
      body: [...cleanFilas, cleanTotales],
      theme: 'plain', // Sin bordes ni colores de fondo, imitando el PDF
      styles: { fontSize: 8, cellPadding: 3, textColor: [0, 0, 0] },
      headStyles: { fontStyle: 'bold', borderBottom: '1px solid #000' },
      footStyles: { fontStyle: 'bold', borderTop: '1px solid #000' },
      margin: { left: 40, right: 40 },
    });

    pdf.save(`${estructura.titulo.replace(/\s+/g, '')}_${periodoSeleccionadoData?.nombre || 'Reporte'}.pdf`);
  };

  const reporteData = getEstructuraReporte();
  const fechaActualObj = new Date();

  const exportarExcel = () => {
    const estructura = getEstructuraReporte();
    if (!estructura) return;

    // Limpiar celdas con estilos (igual que en PDF)
    const cleanFilas = estructura.filas.map(fila => 
      fila.map(celda => (typeof celda === 'object' && celda !== null ? celda.content : celda))
    );
    const cleanTotales = estructura.totales.map(celda => 
      typeof celda === 'object' && celda !== null ? celda.content : celda
    );

    // Estructurar los datos con el mismo membrete formal del PDF
    const datosExcel = [
      [empresaActiva?.nombre?.toUpperCase() || 'EMPRESA PRINCIPAL, C.A'],
      [`RIF ${empresaActiva?.rif || 'J-000000000'}`],
      [`${estructura.titulo} del ${formatearFecha(periodoSeleccionadoData?.fechaInicio)} al ${formatearFecha(periodoSeleccionadoData?.fechaFin)}`],
      ['Expresado en Bolívar'],
      [], // Fila en blanco de separación
      estructura.columnas,
      ...cleanFilas,
      cleanTotales
    ];

    // Crear la hoja de trabajo y el libro con SheetJS (xlsx)
    const worksheet = XLSX.utils.aoa_to_sheet(datosExcel);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Reporte Financiero');

    // Descargar archivo
    XLSX.writeFile(workbook, `${estructura.titulo.replace(/\s+/g, '')}_${periodoSeleccionadoData?.nombre || 'Reporte'}.xlsx`);
  };

  return (
    <div style={{ padding: '24px', color: '#e2e8f0', minHeight: '80vh' }}>
      
      {/* 1. ZONA SUPERIOR: Selector de Periodo Padre/Hijo */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#1e293b', padding: '16px 20px', borderRadius: '12px', marginBottom: '24px', border: '1px solid #334155', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h2 style={{ margin: '0 0 4px 0', color: '#60a5fa', fontSize: '1.2rem' }}>Generador de Documentos Financieros</h2>
          <span style={{ color: '#94a3b8', fontSize: '0.85rem' }}>Seleccione el rango operativo y el reporte a previsualizar.</span>
        </div>
        
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', width: '300px' }}>
          <label style={{ color: '#cbd5e1', fontSize: '0.8rem', fontWeight: 600 }}>Periodo de Emisión (Padre / Hijo)</label>
          <select
            value={periodoSeleccionadoId}
            onChange={(e) => setPeriodoSeleccionadoId(Number(e.target.value))}
            style={{ width: '100%', background: '#0f172a', color: '#fff', border: '1px solid #475569', borderRadius: '8px', padding: '10px' }}
          >
            {listaPeriodosJerarquia.map((p) => (
              <option key={p.id} value={p.id} style={{ fontWeight: p.isPadre ? 'bold' : 'normal' }}>
                {p.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* 2. ZONA MEDIA: Selector de Reportes (Iconos) */}
      <div style={{ display: 'flex', gap: '12px', overflowX: 'auto', paddingBottom: '16px', marginBottom: '10px' }}>
        {REPORT_OPTIONS.map((reporte) => (
          <button
            key={reporte.id}
            onClick={() => setSelectedReporte(reporte.id)}
            style={{
              display: 'flex', alignItems: 'center', gap: '10px',
              background: selectedReporte === reporte.id ? '#2563eb' : '#1e293b',
              color: selectedReporte === reporte.id ? '#ffffff' : '#94a3b8',
              border: selectedReporte === reporte.id ? '1px solid #3b82f6' : '1px solid #334155',
              borderRadius: '10px', padding: '12px 18px', cursor: 'pointer',
              transition: 'all 0.2s ease', whiteSpace: 'nowrap', fontWeight: 'bold'
            }}
          >
            <span style={{ fontSize: '1.4rem' }}>{reporte.icon}</span>
            {reporte.label}
          </button>
        ))}
      </div>

      {/* 3. ZONA INFERIOR: Previsualización de la "Hoja de Papel" */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '40px', color: '#94a3b8' }}>⏳ Consolidando datos del periodo...</div>
      ) : selectedReporte && reporteData ? (
        <div style={{ background: '#0f172a', padding: '24px', borderRadius: '12px', border: '1px solid #334155' }}>
          
          {/* Botonera de Exportación interna */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginBottom: '20px' }}>
             <button 
               onClick={exportarExcel} 
               style={{ display: 'flex', alignItems: 'center', gap: '8px', background: '#16a34a', color: '#fff', border: 'none', borderRadius: '8px', padding: '10px 16px', cursor: 'pointer', fontWeight: 'bold' }}
             >
               📊 Descargar Excel
             </button>
             <button 
               onClick={exportarPdf} 
               style={{ display: 'flex', alignItems: 'center', gap: '8px', background: '#dc2626', color: '#fff', border: 'none', borderRadius: '8px', padding: '10px 16px', cursor: 'pointer', fontWeight: 'bold' }}
             >
               📄 Descargar PDF
             </button>
          </div>

          {/* AVISO CUANDO EL PERIODO NO TIENE MOVIMIENTOS REGISTRADOS */}
          {reporteData.filas.length === 0 && (
            <div style={{
              background: '#1e293b', border: '1px solid #f59e0b', color: '#fcd34d',
              padding: '12px 16px', borderRadius: '8px', marginBottom: '20px', fontSize: '0.9rem'
            }}>
              ℹ️ No se encontraron movimientos contables para «{periodoSeleccionadoData?.nombre || 'este periodo'}».
              Verifique que los asientos se hayan registrado en este periodo y que la empresa activa sea la correcta.
            </div>
          )}

          {/* HOJA DE PAPEL ESTILO PDF */}
          <div style={{ 
            background: '#ffffff', color: '#000000', padding: '40px 50px', 
            borderRadius: '4px', maxWidth: '850px', margin: '0 auto', 
            boxShadow: '0 10px 25px rgba(0,0,0,0.5)', fontFamily: 'Arial, sans-serif', fontSize: '12px'
          }}>
            {/* Encabezado del Documento */}
              <div style={{ marginBottom: '24px', lineHeight: '1.4' }}>
                <div style={{ fontWeight: 'bold', fontSize: '14px' }}>{empresaActiva?.nombre?.toUpperCase() || 'EMPRESA PRINCIPAL, C.A'}</div>
                <div>RIF {empresaActiva?.rif || 'J-000000000'}</div>
                <div style={{ fontWeight: 'bold' }}>
                  {reporteData.titulo} del {formatearFecha(periodoSeleccionadoData?.fechaInicio)} al {formatearFecha(periodoSeleccionadoData?.fechaFin)}
                </div>
                <div>Expresado en Bolívar</div>
              </div>

            {/* Tabla Principal */}
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1.5px solid #000' }}>
                  {reporteData.columnas.map((col, idx) => (
                    <th key={idx} style={{ textAlign: idx === 0 ? 'left' : 'right', padding: '8px 4px', fontWeight: 'bold' }}>{col}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {reporteData.filas.map((fila, idxFila) => (
                  <tr key={idxFila}>
                    {fila.map((celda, idxCelda) => {
                      const isBold = typeof celda === 'object' && celda?.styles?.fontStyle === 'bold';
                      const text = typeof celda === 'object' ? celda.content : celda;
                      return (
                        <td key={idxCelda} style={{ textAlign: idxCelda === 0 ? 'left' : 'right', padding: '4px', fontWeight: isBold ? 'bold' : 'normal', paddingTop: celda?.styles?.minCellHeight ? '15px' : '4px' }}>
                          {text}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr style={{ borderTop: '1.5px solid #000', fontWeight: 'bold' }}>
                  {reporteData.totales.map((total, idx) => (
                    <td key={idx} style={{ textAlign: idx === 0 ? 'left' : 'right', padding: '10px 4px' }}>{total}</td>
                  ))}
                </tr>
              </tfoot>
            </table>
          </div>

        </div>
      ) : (
        <div style={{ textAlign: 'center', padding: '40px', color: '#64748b', border: '2px dashed #334155', borderRadius: '12px' }}>
          ↑ Seleccione un reporte en el menú superior para generar la vista previa del documento.
        </div>
      )}
    </div>
  );
}
