import { useEffect, useMemo, useState } from 'react';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import { contabilidadApi } from '../../Services/Contabilidad/ContabilidadApi';

const REPORT_OPTIONS = [
  { id: 'resumen', label: 'Resumen general', descripcion: 'Indicadores del período actual' },
  { id: 'balance-comprobacion', label: 'Balance de comprobación', descripcion: 'Detalle por cuenta de movimientos y saldos' },
  { id: 'balance-general', label: 'Balance general', descripcion: 'Activos, pasivos y patrimonio' },
  { id: 'estado-resultados', label: 'Estado de resultados', descripcion: 'Ingresos, gastos y utilidad' },
  { id: 'patrimonio', label: 'Patrimonio neto', descripcion: 'Capital, reservas y variación' },
  { id: 'efectivo', label: 'Flujo básico de efectivo', descripcion: 'Cuentas de caja y bancos' },
  { id: 'cierre-periodo', label: 'Cierre por período', descripcion: 'Saldo inicial, movimiento y cierre final' },
];

const moneyFormatter = new Intl.NumberFormat('es-CR', {
  style: 'currency',
  currency: 'CRC',
  minimumFractionDigits: 2,
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

export default function ReportesContables({ empresaActiva, periodoActivo }) {
  const [resumen, setResumen] = useState(null);
  const [balance, setBalance] = useState([]);
  const [cuentas, setCuentas] = useState([]);
  const [balanceGeneralFormal, setBalanceGeneralFormal] = useState(null);
  const [estadoResultadosFormal, setEstadoResultadosFormal] = useState(null);
  const [flujoEfectivoFormal, setFlujoEfectivoFormal] = useState(null);
  const [cierrePeriodoFormal, setCierrePeriodoFormal] = useState(null);
  const [selectedReporte, setSelectedReporte] = useState('balance-comprobacion');
  const [menuAbierto, setMenuAbierto] = useState(false);
  const [loading, setLoading] = useState(true);
  const [periodos, setPeriodos] = useState([]);
  const [empresaSeleccionadaId, setEmpresaSeleccionadaId] = useState(Number(empresaActiva?.id ?? 1));
  const [periodoSeleccionadoId, setPeriodoSeleccionadoId] = useState(Number(periodoActivo?.id ?? 1));
  const [aperturaSaldos, setAperturaSaldos] = useState([]);
  const [aperturaMensaje, setAperturaMensaje] = useState('');
  const [guardandoApertura, setGuardandoApertura] = useState(false);
  const [cerrandoPeriodo, setCerrandoPeriodo] = useState(false);

  useEffect(() => {
    setEmpresaSeleccionadaId(Number(empresaActiva?.id ?? 1));
    setPeriodoSeleccionadoId(Number(periodoActivo?.id ?? 1));
  }, [empresaActiva?.id, periodoActivo?.id]);

  useEffect(() => {
    const cargarPeriodos = async () => {
      try {
        const data = await contabilidadApi.getPeriodos();
        setPeriodos(Array.isArray(data) ? data : []);
      } catch (error) {
        console.error('Error cargando periodos:', error);
      }
    };

    cargarPeriodos();
  }, []);

  useEffect(() => {
    const cargar = async () => {
      try {
        setLoading(true);
        const periodoId = Number(periodoSeleccionadoId || periodoActivo?.id || 1);

        const [dataResumen, dataBalance, dataCuentas, dataBalanceGeneral, dataEstadoResultados, dataFlujoEfectivo, dataCierrePeriodo] = await Promise.all([
          contabilidadApi.getResumen(),
          contabilidadApi.getBalanceComprobacion(periodoId),
          contabilidadApi.getCuentas(),
          contabilidadApi.getBalanceGeneral(periodoId).catch(() => null),
          contabilidadApi.getEstadoResultados(periodoId).catch(() => null),
          contabilidadApi.getFlujoEfectivo(periodoId).catch(() => null),
          contabilidadApi.getCierrePeriodo(periodoId).catch(() => null),
        ]);

        setResumen(dataResumen);
        setBalance(Array.isArray(dataBalance) ? dataBalance : []);
        setCuentas(Array.isArray(dataCuentas) ? dataCuentas : []);
        setBalanceGeneralFormal(dataBalanceGeneral);
        setEstadoResultadosFormal(dataEstadoResultados);
        setFlujoEfectivoFormal(dataFlujoEfectivo);
        setCierrePeriodoFormal(dataCierrePeriodo);
      } catch (error) {
        console.error('Error cargando reportes contables:', error);
      } finally {
        setLoading(false);
      }
    };

    cargar();
  }, [periodoSeleccionadoId, periodoActivo?.id]);

  useEffect(() => {
    if (!Array.isArray(cuentas) || cuentas.length === 0) return;
    setAperturaSaldos((prev) => {
      if (prev.length > 0) return prev;
      return cuentas
        .filter((cuenta) => {
          const tipoCuenta = String(field(cuenta, 'tipoCuenta', 'TipoCuenta') ?? '').trim();
          return ['Activo', 'Pasivo', 'Patrimonio'].includes(tipoCuenta) || tipoCuenta === 'Capital';
        })
        .map((cuenta) => ({
          cuentaContableId: Number(field(cuenta, 'id', 'Id')),
          codigoCuenta: field(cuenta, 'codigoCuenta', 'CodigoCuenta') ?? '',
          nombreCuenta: field(cuenta, 'nombreCuenta', 'NombreCuenta') ?? 'Cuenta',
          tipoCuenta: field(cuenta, 'tipoCuenta', 'TipoCuenta') ?? '',
          debe: 0,
          haber: 0,
        }));
    });
  }, [cuentas]);

  const aperturaResumen = useMemo(() => {
    return aperturaSaldos.reduce((totales, item) => {
      const debe = Number(item?.debe ?? 0);
      const haber = Number(item?.haber ?? 0);
      totales.debe += debe;
      totales.haber += haber;
      totales.diferencia += debe - haber;
      return totales;
    }, { debe: 0, haber: 0, diferencia: 0 });
  }, [aperturaSaldos]);

  const manejarCambioApertura = (cuentaId, campo, valor) => {
    setAperturaSaldos((prev) => prev.map((item) =>
      item.cuentaContableId === cuentaId
        ? { ...item, [campo]: Number(valor || 0) }
        : item
    ));
  };

  const handleGuardarApertura = async () => {
    try {
      const saldosIniciales = aperturaSaldos
        .filter((item) => Number(item.debe || 0) > 0 || Number(item.haber || 0) > 0)
        .map((item) => ({
          cuentaContableId: item.cuentaContableId,
          debe: Number(item.debe || 0),
          haber: Number(item.haber || 0),
        }));

      if (!saldosIniciales.length) {
        setAperturaMensaje('Debe indicar al menos un valor de debe o haber para registrar la apertura.');
        return;
      }

      setGuardandoApertura(true);
      setAperturaMensaje('');
      await contabilidadApi.crearAperturaSaldosIniciales(empresaSeleccionadaId, periodoSeleccionadoId, saldosIniciales, 1);
      setAperturaMensaje('Asiento de apertura registrado correctamente.');
      setSelectedReporte('balance-comprobacion');
    } catch (error) {
      console.error('Error registrando apertura inicial:', error);
      setAperturaMensaje(error?.response?.data?.message || 'No fue posible registrar la apertura de saldos iniciales.');
    } finally {
      setGuardandoApertura(false);
    }
  };

  const handleCerrarPeriodo = async () => {
    try {
      setCerrandoPeriodo(true);
      setAperturaMensaje('');
      await contabilidadApi.cerrarPeriodo(periodoSeleccionadoId, 'Sistema');
      setAperturaMensaje('El período contable quedó cerrado correctamente.');
      const data = await contabilidadApi.getCierrePeriodo(periodoSeleccionadoId).catch(() => null);
      setCierrePeriodoFormal(data);
      setSelectedReporte('cierre-periodo');
    } catch (error) {
      console.error('Error cerrando periodo:', error);
      setAperturaMensaje(error?.response?.data?.message || 'No fue posible cerrar el período contable.');
    } finally {
      setCerrandoPeriodo(false);
    }
  };

  const cuentaMap = useMemo(() => {
    const map = new Map();
    cuentas.forEach((cuenta) => {
      const id = field(cuenta, 'id', 'Id', 'cuentaId', 'CuentaId');
      if (id !== undefined) {
        map.set(Number(id), cuenta);
      }
    });
    return map;
  }, [cuentas]);

  const balanceGeneral = useMemo(() => {
    const totals = { activo: 0, pasivo: 0, patrimonio: 0 };

    balance.forEach((item) => {
      const cuenta = cuentaMap.get(Number(field(item, 'cuentaId', 'CuentaId') ?? 0));
      const tipo = String(field(cuenta, 'tipoCuenta', 'TipoCuenta') ?? '').toLowerCase();
      const nombre = String(field(cuenta, 'nombreCuenta', 'NombreCuenta') ?? '').toLowerCase();
      const debe = Number(field(item, 'totalDebe', 'TotalDebe') ?? 0);
      const haber = Number(field(item, 'totalHaber', 'TotalHaber') ?? 0);
      const saldo = Math.abs(debe - haber);

      if (tipo.includes('activo') || nombre.includes('activo')) {
        totals.activo += saldo;
      } else if (tipo.includes('pasivo') || nombre.includes('pasivo')) {
        totals.pasivo += saldo;
      } else if (tipo.includes('patrimonio') || nombre.includes('patrimonio') || nombre.includes('capital')) {
        totals.patrimonio += saldo;
      }
    });

    return totals;
  }, [balance, cuentaMap]);

  const estadoResultados = useMemo(() => {
    const totals = { ingresos: 0, gastos: 0, utilidad: 0 };

    balance.forEach((item) => {
      const cuenta = cuentaMap.get(Number(field(item, 'cuentaId', 'CuentaId') ?? 0));
      const tipo = String(field(cuenta, 'tipoCuenta', 'TipoCuenta') ?? '').toLowerCase();
      const nombre = String(field(cuenta, 'nombreCuenta', 'NombreCuenta') ?? '').toLowerCase();
      const debe = Number(field(item, 'totalDebe', 'TotalDebe') ?? 0);
      const haber = Number(field(item, 'totalHaber', 'TotalHaber') ?? 0);
      const saldo = Math.abs(debe - haber);

      if (tipo.includes('ingreso') || nombre.includes('ingreso') || nombre.includes('venta') || nombre.includes('servicio')) {
        totals.ingresos += saldo;
      } else if (tipo.includes('gasto') || nombre.includes('gasto') || nombre.includes('costo')) {
        totals.gastos += saldo;
      }
    });

    totals.utilidad = totals.ingresos - totals.gastos;
    return totals;
  }, [balance, cuentaMap]);

  const flujoEfectivo = useMemo(() => {
    const totals = { caja: 0, bancos: 0, efectivoTotal: 0 };

    balance.forEach((item) => {
      const cuenta = cuentaMap.get(Number(field(item, 'cuentaId', 'CuentaId') ?? 0));
      const nombre = String(field(cuenta, 'nombreCuenta', 'NombreCuenta') ?? '').toLowerCase();
      const debe = Number(field(item, 'totalDebe', 'TotalDebe') ?? 0);
      const haber = Number(field(item, 'totalHaber', 'TotalHaber') ?? 0);
      const saldo = Math.abs(debe - haber);

      if (nombre.includes('caja') || nombre.includes('efectivo')) {
        totals.caja += saldo;
      }
      if (nombre.includes('banco') || nombre.includes('cta. cte') || nombre.includes('corriente')) {
        totals.bancos += saldo;
      }
    });

    totals.efectivoTotal = totals.caja + totals.bancos;
    return totals;
  }, [balance, cuentaMap]);

  const resumenConsolidado = useMemo(() => {
    const totals = { activo: 0, pasivo: 0, patrimonio: 0, ingresos: 0, egresos: 0 };

    balance.forEach((item) => {
      const cuenta = cuentaMap.get(Number(field(item, 'cuentaId', 'CuentaId') ?? 0));
      const tipo = String(field(cuenta, 'tipoCuenta', 'TipoCuenta') ?? '').toLowerCase();
      const nombre = String(field(cuenta, 'nombreCuenta', 'NombreCuenta') ?? '').toLowerCase();
      const saldo = Math.abs(Number(field(item, 'saldoFinal', 'SaldoFinal') ?? 0));

      if (tipo.includes('activo') || nombre.includes('activo')) {
        totals.activo += saldo;
      } else if (tipo.includes('pasivo') || nombre.includes('pasivo')) {
        totals.pasivo += saldo;
      } else if (tipo.includes('patrimonio') || nombre.includes('patrimonio') || nombre.includes('capital')) {
        totals.patrimonio += saldo;
      }

      if (tipo.includes('ingreso') || nombre.includes('ingreso') || nombre.includes('venta') || nombre.includes('servicio')) {
        totals.ingresos += saldo;
      } else if (tipo.includes('gasto') || nombre.includes('gasto') || nombre.includes('costo')) {
        totals.egresos += saldo;
      }
    });

    return totals;
  }, [balance, cuentaMap]);

  const balanceResumen = useMemo(() => {
    return balance.reduce((totales, cuenta) => {
      const saldoInicial = Number(field(cuenta, 'saldoInicial', 'SaldoInicial') ?? 0);
      const movimientoDebe = Number(field(cuenta, 'movimientoDebe', 'MovimientoDebe') ?? 0);
      const movimientoHaber = Number(field(cuenta, 'movimientoHaber', 'MovimientoHaber') ?? 0);
      const saldoFinal = Number(field(cuenta, 'saldoFinal', 'SaldoFinal') ?? 0);

      totales.saldoInicial += saldoInicial;
      totales.debe += movimientoDebe;
      totales.haber += movimientoHaber;
      totales.saldoFinal += saldoFinal;
      return totales;
    }, { saldoInicial: 0, debe: 0, haber: 0, saldoFinal: 0 });
  }, [balance]);

  const reporteActual = () => {
    switch (selectedReporte) {
      case 'resumen':
        return (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '16px' }}>
            <MetricCard title="Cuentas" value={resumen?.cuentas ?? 0} color="#93c5fd" />
            <MetricCard title="Asientos" value={resumen?.asientos ?? 0} color="#34d399" />
            <MetricCard title="Debe" value={formatMoney(resumen?.totalDebe ?? 0)} color="#fbbf24" />
            <MetricCard title="Haber" value={formatMoney(resumen?.totalHaber ?? 0)} color="#a78bfa" />
            <MetricCard title="Diferencia" value={formatMoney(resumen?.diferencia ?? 0)} color="#f87171" />
          </div>
        );
      case 'balance-general':
        return (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
            <MetricCard title="Activos" value={formatMoney(field(balanceGeneralFormal, 'activo', 'Activo') ?? balanceGeneral.activo)} color="#60a5fa" />
            <MetricCard title="Pasivos" value={formatMoney(field(balanceGeneralFormal, 'pasivo', 'Pasivo') ?? balanceGeneral.pasivo)} color="#f59e0b" />
            <MetricCard title="Patrimonio" value={formatMoney(field(balanceGeneralFormal, 'patrimonio', 'Patrimonio') ?? balanceGeneral.patrimonio)} color="#34d399" />
          </div>
        );
      case 'estado-resultados':
        return (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
            <MetricCard title="Ingresos" value={formatMoney(field(estadoResultadosFormal, 'ingresos', 'Ingresos') ?? estadoResultados.ingresos)} color="#34d399" />
            <MetricCard title="Gastos" value={formatMoney(field(estadoResultadosFormal, 'egresos', 'Egresos') ?? estadoResultados.gastos)} color="#f87171" />
            <MetricCard title="Utilidad neta" value={formatMoney(field(estadoResultadosFormal, 'utilidadNeta', 'UtilidadNeta') ?? estadoResultados.utilidad)} color="#60a5fa" />
          </div>
        );
      case 'patrimonio':
        return (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
            <MetricCard title="Patrimonio estimado" value={formatMoney(balanceGeneral.patrimonio)} color="#34d399" />
            <MetricCard title="Capital" value={formatMoney(balanceGeneral.patrimonio * 0.7)} color="#60a5fa" />
            <MetricCard title="Reservas" value={formatMoney(balanceGeneral.patrimonio * 0.3)} color="#a78bfa" />
          </div>
        );
      case 'efectivo':
        return (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
            <MetricCard title="Caja" value={formatMoney(field(flujoEfectivoFormal, 'caja', 'Caja') ?? flujoEfectivo.caja)} color="#fbbf24" />
            <MetricCard title="Bancos" value={formatMoney(field(flujoEfectivoFormal, 'bancos', 'Bancos') ?? flujoEfectivo.bancos)} color="#60a5fa" />
            <MetricCard title="Efectivo total" value={formatMoney(field(flujoEfectivoFormal, 'efectivoTotal', 'EfectivoTotal') ?? flujoEfectivo.efectivoTotal)} color="#34d399" />
          </div>
        );
      case 'cierre-periodo':
        return (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
            <MetricCard title="Saldo inicial" value={formatMoney(field(cierrePeriodoFormal, 'saldoInicial', 'SaldoInicial') ?? 0)} color="#93c5fd" />
            <MetricCard title="Debe" value={formatMoney(field(cierrePeriodoFormal, 'debe', 'Debe') ?? 0)} color="#34d399" />
            <MetricCard title="Haber" value={formatMoney(field(cierrePeriodoFormal, 'haber', 'Haber') ?? 0)} color="#f87171" />
            <MetricCard title="Saldo final" value={formatMoney(field(cierrePeriodoFormal, 'saldoFinal', 'SaldoFinal') ?? 0)} color="#fbbf24" />
          </div>
        );
      default:
        return (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '16px' }}>
            <MetricCard title="Total cuentas" value={balance.length} color="#93c5fd" />
            <MetricCard title="Periodo" value={periodoActivo?.nombre ?? 'Actual'} color="#fbbf24" />
            <MetricCard title="Entidad" value={empresaActiva?.nombre ?? 'Empresa'} color="#34d399" />
          </div>
        );
    }
  };

  const getReporteExportData = () => {
    const periodoNombre = periodoActivo?.nombre ?? 'Periodo actual';
    const empresaNombre = empresaActiva?.nombre ?? 'Empresa';

    switch (selectedReporte) {
      case 'resumen':
        return {
          title: 'Resumen general NIIF',
          columns: ['Indicador', 'Valor'],
          rows: [
            ['Cuentas', resumen?.cuentas ?? 0],
            ['Asientos', resumen?.asientos ?? 0],
            ['Debe', Number(resumen?.totalDebe ?? 0)],
            ['Haber', Number(resumen?.totalHaber ?? 0)],
            ['Diferencia', Number(resumen?.diferencia ?? 0)],
          ],
          periodoNombre,
          empresaNombre,
        };
      case 'balance-general':
        return {
          title: 'Balance general NIIF',
          columns: ['Concepto', 'Monto'],
          rows: [
            ['Activos', Number(balanceGeneral.activo)],
            ['Pasivos', Number(balanceGeneral.pasivo)],
            ['Patrimonio', Number(balanceGeneral.patrimonio)],
          ],
          periodoNombre,
          empresaNombre,
        };
      case 'estado-resultados':
        return {
          title: 'Estado de resultados NIIF',
          columns: ['Concepto', 'Monto'],
          rows: [
            ['Ingresos', Number(estadoResultados.ingresos)],
            ['Gastos', Number(estadoResultados.gastos)],
            ['Utilidad neta', Number(estadoResultados.utilidad)],
          ],
          periodoNombre,
          empresaNombre,
        };
      case 'patrimonio':
        return {
          title: 'Patrimonio neto NIIF',
          columns: ['Concepto', 'Monto'],
          rows: [
            ['Patrimonio estimado', Number(balanceGeneral.patrimonio)],
            ['Capital', Number(balanceGeneral.patrimonio * 0.7)],
            ['Reservas', Number(balanceGeneral.patrimonio * 0.3)],
          ],
          periodoNombre,
          empresaNombre,
        };
      case 'efectivo':
        return {
          title: 'Flujo básico de efectivo NIIF',
          columns: ['Concepto', 'Monto'],
          rows: [
            ['Caja', Number(flujoEfectivo.caja)],
            ['Bancos', Number(flujoEfectivo.bancos)],
            ['Efectivo total', Number(flujoEfectivo.efectivoTotal)],
          ],
          periodoNombre,
          empresaNombre,
        };
      default:
        return {
          title: 'Balance de comprobación NIIF',
          columns: ['Cuenta', 'Código', 'Saldo inicial', 'Debe', 'Haber', 'Saldo final', 'Naturaleza'],
          rows: balance.map((cuenta) => {
            const saldoInicial = Number(field(cuenta, 'saldoInicial', 'SaldoInicial') ?? 0);
            const movimientoDebe = Number(field(cuenta, 'movimientoDebe', 'MovimientoDebe') ?? 0);
            const movimientoHaber = Number(field(cuenta, 'movimientoHaber', 'MovimientoHaber') ?? 0);
            const saldoFinal = Number(field(cuenta, 'saldoFinal', 'SaldoFinal') ?? 0);

            return [
              field(cuenta, 'nombreCuenta', 'NombreCuenta') ?? '',
              field(cuenta, 'codigoCuenta', 'CodigoCuenta') ?? '',
              saldoInicial,
              movimientoDebe,
              movimientoHaber,
              saldoFinal,
              field(cuenta, 'naturaleza', 'Naturaleza') ?? '',
            ];
          }),
          periodoNombre,
          empresaNombre,
        };
    }
  };

  const exportarExcel = () => {
    try {
      const { title, columns, rows, periodoNombre, empresaNombre } = getReporteExportData();
      const workbook = XLSX.utils.book_new();
      const worksheetData = [columns, ...rows];
      const worksheet = XLSX.utils.aoa_to_sheet(worksheetData);

      worksheet['!cols'] = columns.map((col) => ({ wch: Math.max(col.length + 4, 16) }));
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Reporte');
      XLSX.writeFile(workbook, `${title.replace(/\s+/g, '-').toLowerCase()}-${Date.now()}.xlsx`);

      console.log(`Excel exportado para ${empresaNombre} - ${periodoNombre}`);
    } catch (error) {
      console.error('Error exportando Excel:', error);
    }
  };

  const exportarPdf = () => {
    try {
      const { title, columns, rows, periodoNombre, empresaNombre } = getReporteExportData();
      const pdf = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' });

      pdf.setFontSize(18);
      pdf.text(title, 40, 50);
      pdf.setFontSize(10);
      pdf.text(`${empresaNombre} • ${periodoNombre}`, 40, 72);
      pdf.text(`Fecha de exportación: ${new Date().toLocaleDateString('es-CR')}`, 40, 88);

      autoTable(pdf, {
        startY: 110,
        head: [columns],
        body: rows,
        theme: 'grid',
        styles: { fontSize: 8, cellPadding: 4 },
        headStyles: { fillColor: [37, 99, 235], textColor: [255, 255, 255] },
        alternateRowStyles: { fillColor: [241, 245, 249] },
        margin: { left: 40, right: 40 },
      });

      pdf.save(`${title.replace(/\s+/g, '-').toLowerCase()}-${Date.now()}.pdf`);
      console.log(`PDF exportado para ${empresaNombre} - ${periodoNombre}`);
    } catch (error) {
      console.error('Error exportando PDF:', error);
    }
  };

  return (
    <div style={{ padding: '24px', color: '#e2e8f0' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '16px', marginBottom: '20px', flexWrap: 'wrap' }}>
        <div>
          <p style={{ margin: 0, color: '#93c5fd', fontWeight: 600 }}>Reportes financieros NIIF</p>
          <h2 style={{ margin: '6px 0 0' }}>Contabilidad y cierre del período</h2>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', position: 'relative', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: '#0f172a', border: '1px solid #334155', borderRadius: '10px', padding: '8px 12px' }}>
            <label style={{ color: '#cbd5e1', fontSize: '0.8rem', fontWeight: 600 }}>Empresa</label>
            <strong style={{ color: '#93c5fd' }}>{empresaActiva?.nombre ?? 'Empresa principal'}</strong>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: '#0f172a', border: '1px solid #334155', borderRadius: '10px', padding: '8px 12px' }}>
            <label style={{ color: '#cbd5e1', fontSize: '0.8rem', fontWeight: 600 }}>Período</label>
            <select
              value={periodoSeleccionadoId}
              onChange={(event) => setPeriodoSeleccionadoId(Number(event.target.value))}
              style={{ background: '#111827', color: '#e2e8f0', border: '1px solid #475569', borderRadius: '8px', padding: '6px 10px' }}
            >
              {periodos.length ? periodos.map((periodo) => (
                <option key={periodo.id} value={periodo.id}>
                  {periodo.nombre ?? `${periodo.mes}/${periodo.anio}`}
                </option>
              )) : (
                <option value={periodoActivo?.id ?? 1}>{periodoActivo?.nombre ?? 'Período actual'}</option>
              )}
            </select>
          </div>

          <button
            onClick={() => setMenuAbierto((prev) => !prev)}
            style={{
              background: '#2563eb',
              color: '#fff',
              border: 'none',
              borderRadius: '10px',
              padding: '10px 18px',
              cursor: 'pointer',
              fontWeight: 600,
            }}
          >
            Generar reporte ▾
          </button>

          <button
            onClick={exportarPdf}
            style={{
              background: '#1f2937',
              color: '#fff',
              border: '1px solid #475569',
              borderRadius: '10px',
              padding: '10px 14px',
              cursor: 'pointer',
              fontWeight: 600,
            }}
          >
            PDF
          </button>

          <button
            onClick={exportarExcel}
            style={{
              background: '#14532d',
              color: '#fff',
              border: '1px solid #22c55e',
              borderRadius: '10px',
              padding: '10px 14px',
              cursor: 'pointer',
              fontWeight: 600,
            }}
          >
            Excel
          </button>

          {menuAbierto && (
            <div style={{ position: 'absolute', right: 0, top: 'calc(100% + 8px)', background: '#111827', border: '1px solid #334155', borderRadius: '10px', minWidth: '250px', boxShadow: '0 10px 24px rgba(15, 23, 42, 0.4)', zIndex: 10 }}>
              {REPORT_OPTIONS.map((reporte) => (
                <button
                  key={reporte.id}
                  onClick={() => {
                    setSelectedReporte(reporte.id);
                    setMenuAbierto(false);
                  }}
                  style={{
                    display: 'block',
                    width: '100%',
                    textAlign: 'left',
                    background: selectedReporte === reporte.id ? '#1d4ed8' : 'transparent',
                    color: '#e2e8f0',
                    border: 'none',
                    padding: '12px 14px',
                    cursor: 'pointer',
                    borderBottom: '1px solid #1f2937',
                  }}
                >
                  <div style={{ fontWeight: 700 }}>{reporte.label}</div>
                  <small style={{ color: '#cbd5e1' }}>{reporte.descripcion}</small>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <div style={{ background: '#111827', borderRadius: '12px', border: '1px solid #334155', padding: '18px', marginBottom: '20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', flexWrap: 'wrap', marginBottom: '14px' }}>
          <div>
            <div style={{ color: '#93c5fd', fontSize: '0.8rem', textTransform: 'uppercase', fontWeight: 700 }}>Apertura / cierre</div>
            <strong style={{ fontSize: '1.25rem' }}>Empresa y período contable</strong>
          </div>

          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            <button
              onClick={handleGuardarApertura}
              disabled={guardandoApertura}
              style={{ background: '#16a34a', color: '#fff', border: 'none', borderRadius: '10px', padding: '10px 14px', cursor: 'pointer', fontWeight: 700, opacity: guardandoApertura ? 0.7 : 1 }}
            >
              {guardandoApertura ? 'Guardando...' : 'Guardar apertura'}
            </button>
            <button
              onClick={handleCerrarPeriodo}
              disabled={cerrandoPeriodo}
              style={{ background: '#f59e0b', color: '#111827', border: 'none', borderRadius: '10px', padding: '10px 14px', cursor: 'pointer', fontWeight: 700, opacity: cerrandoPeriodo ? 0.7 : 1 }}
            >
              {cerrandoPeriodo ? 'Cerrando...' : 'Cerrar período'}
            </button>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px', marginBottom: '12px' }}>
          <MetricCard title="Empresa" value={empresaActiva?.nombre ?? 'Empresa principal'} color="#60a5fa" />
          <MetricCard title="Periodo" value={periodos.find((periodo) => Number(periodo.id) === Number(periodoSeleccionadoId))?.nombre ?? periodoActivo?.nombre ?? 'Mes actual'} color="#fbbf24" />
          <MetricCard title="Debe" value={formatMoney(aperturaResumen.debe)} color="#34d399" />
          <MetricCard title="Haber" value={formatMoney(aperturaResumen.haber)} color="#f87171" />
        </div>

        {aperturaMensaje && (
          <div style={{ background: '#0f172a', border: '1px solid #334155', color: '#dbeafe', borderRadius: '10px', padding: '10px 12px', marginBottom: '14px' }}>
            {aperturaMensaje}
          </div>
        )}

        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '640px' }}>
            <thead>
              <tr style={{ background: '#0f172a' }}>
                <th style={{ textAlign: 'left', padding: '10px 12px', color: '#93c5fd' }}>Cuenta</th>
                <th style={{ textAlign: 'left', padding: '10px 12px', color: '#93c5fd' }}>Código</th>
                <th style={{ textAlign: 'right', padding: '10px 12px', color: '#93c5fd' }}>Debe</th>
                <th style={{ textAlign: 'right', padding: '10px 12px', color: '#93c5fd' }}>Haber</th>
              </tr>
            </thead>
            <tbody>
              {aperturaSaldos.length ? aperturaSaldos.map((item) => (
                <tr key={item.cuentaContableId} style={{ borderBottom: '1px solid #1f2937' }}>
                  <td style={{ padding: '10px 12px' }}>{item.nombreCuenta}</td>
                  <td style={{ padding: '10px 12px', color: '#cbd5e1' }}>{item.codigoCuenta}</td>
                  <td style={{ padding: '10px 12px', textAlign: 'right' }}>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={item.debe}
                      onChange={(event) => manejarCambioApertura(item.cuentaContableId, 'debe', event.target.value)}
                      style={{ width: '120px', background: '#0f172a', color: '#e2e8f0', border: '1px solid #334155', borderRadius: '8px', padding: '6px 8px', textAlign: 'right' }}
                    />
                  </td>
                  <td style={{ padding: '10px 12px', textAlign: 'right' }}>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={item.haber}
                      onChange={(event) => manejarCambioApertura(item.cuentaContableId, 'haber', event.target.value)}
                      style={{ width: '120px', background: '#0f172a', color: '#e2e8f0', border: '1px solid #334155', borderRadius: '8px', padding: '6px 8px', textAlign: 'right' }}
                    />
                  </td>
                </tr>
              )) : (
                <tr>
                  <td colSpan="4" style={{ padding: '18px', color: '#94a3b8', textAlign: 'center' }}>No hay cuentas disponibles para apertura inicial.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {loading ? (
        <p style={{ color: '#94a3b8' }}>Cargando reportes del período...</p>
      ) : (
        <>
          {selectedReporte === 'balance-comprobacion' ? (
            <div style={{ background: '#111827', borderRadius: '12px', border: '1px solid #334155', overflow: 'hidden' }}>
              <div style={{ padding: '16px 18px', borderBottom: '1px solid #334155', background: '#0f172a' }}>
                <strong>Balance de comprobación</strong>
              </div>

              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '900px' }}>
                  <thead>
                    <tr style={{ background: '#0f172a' }}>
                      <th style={{ textAlign: 'left', padding: '12px 16px', color: '#93c5fd' }}>Cuenta</th>
                      <th style={{ textAlign: 'left', padding: '12px 16px', color: '#93c5fd' }}>Código</th>
                      <th style={{ textAlign: 'right', padding: '12px 16px', color: '#93c5fd' }}>Saldo inicial</th>
                      <th style={{ textAlign: 'right', padding: '12px 16px', color: '#93c5fd' }}>Debe</th>
                      <th style={{ textAlign: 'right', padding: '12px 16px', color: '#93c5fd' }}>Haber</th>
                      <th style={{ textAlign: 'right', padding: '12px 16px', color: '#93c5fd' }}>Saldo final</th>
                      <th style={{ textAlign: 'right', padding: '12px 16px', color: '#93c5fd' }}>Naturaleza</th>
                    </tr>
                  </thead>
                  <tbody>
                    {balance.length > 0 ? (
                      balance.map((cuenta) => {
                        const saldoInicial = Number(field(cuenta, 'saldoInicial', 'SaldoInicial') ?? 0);
                        const movimientoDebe = Number(field(cuenta, 'movimientoDebe', 'MovimientoDebe') ?? 0);
                        const movimientoHaber = Number(field(cuenta, 'movimientoHaber', 'MovimientoHaber') ?? 0);
                        const saldoFinal = Number(field(cuenta, 'saldoFinal', 'SaldoFinal') ?? 0);

                        return (
                          <tr key={`${field(cuenta, 'cuentaId', 'CuentaId')}-${field(cuenta, 'codigoCuenta', 'CodigoCuenta')}`} style={{ borderBottom: '1px solid #1f2937' }}>
                            <td style={{ padding: '12px 16px' }}>{field(cuenta, 'nombreCuenta', 'NombreCuenta')}</td>
                            <td style={{ padding: '12px 16px', color: '#cbd5e1' }}>{field(cuenta, 'codigoCuenta', 'CodigoCuenta')}</td>
                            <td style={{ padding: '12px 16px', textAlign: 'right' }}>{formatMoney(saldoInicial)}</td>
                            <td style={{ padding: '12px 16px', textAlign: 'right' }}>{formatMoney(movimientoDebe)}</td>
                            <td style={{ padding: '12px 16px', textAlign: 'right' }}>{formatMoney(movimientoHaber)}</td>
                            <td style={{ padding: '12px 16px', textAlign: 'right' }}>{formatMoney(saldoFinal)}</td>
                            <td style={{ padding: '12px 16px', textAlign: 'right', color: '#a5f3fc' }}>{field(cuenta, 'naturaleza', 'Naturaleza') ?? '-'}</td>
                          </tr>
                        );
                      })
                    ) : (
                      <tr>
                        <td colSpan="7" style={{ padding: '22px', color: '#94a3b8', textAlign: 'center' }}>
                          No hay movimientos para este período.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              <div style={{ marginTop: '18px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px' }}>
                <MetricCard title="Total saldo inicial" value={formatMoney(balanceResumen.saldoInicial)} color="#93c5fd" />
                <MetricCard title="Total debe" value={formatMoney(balanceResumen.debe)} color="#34d399" />
                <MetricCard title="Total haber" value={formatMoney(balanceResumen.haber)} color="#f87171" />
                <MetricCard title="Total saldo final" value={formatMoney(balanceResumen.saldoFinal)} color="#fbbf24" />
              </div>

              <div style={{ marginTop: '18px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '12px' }}>
                <MetricCard title="Activo" value={formatMoney(resumenConsolidado.activo)} color="#60a5fa" />
                <MetricCard title="Pasivo" value={formatMoney(resumenConsolidado.pasivo)} color="#f59e0b" />
                <MetricCard title="Patrimonio" value={formatMoney(resumenConsolidado.patrimonio)} color="#34d399" />
                <MetricCard title="Ingresos" value={formatMoney(resumenConsolidado.ingresos)} color="#a78bfa" />
                <MetricCard title="Egresos" value={formatMoney(resumenConsolidado.egresos)} color="#f87171" />
              </div>
            </div>
          ) : (
            <div style={{ marginTop: '18px' }}>{reporteActual()}</div>
          )}
        </>
      )}
    </div>
  );
}

function MetricCard({ title, value, color }) {
  return (
    <div style={{ background: '#111827', borderRadius: '12px', padding: '18px', border: '1px solid #1f2937' }}>
      <div style={{ color: '#94a3b8', fontSize: '0.82rem', marginBottom: '8px' }}>{title}</div>
      <strong style={{ color, fontSize: '1.7rem', display: 'block' }}>{value}</strong>
    </div>
  );
}
