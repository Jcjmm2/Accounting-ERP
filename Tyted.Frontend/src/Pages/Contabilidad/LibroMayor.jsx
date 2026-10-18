import { useEffect, useState } from 'react';
import { contabilidadApi } from '../../Services/Contabilidad/ContabilidadApi';

// Mismo formato de montos es-VE que los demás reportes financieros: los
// exportadores PDF/Excel de ReportesContables lo reconocen como monto.
const fmtMonto = (v) => Number(v ?? 0).toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// Fecha corta dd/mm/aaaa sin problemas de zona horaria (partes de la cadena).
const fmtFecha = (fecha) => {
  if (!fecha) return '—';
  const [anio, mes, dia] = String(fecha).split('T')[0].split('-');
  return `${Number(dia)}/${Number(mes)}/${anio}`;
};

// ---------------------------------------------------------------------------
// LIBRO MAYOR: consulta por cuenta y rango con fila explícita de SALDO
// INICIAL (histórico anterior al rango + apertura manual del propio rango,
// con el mismo criterio del Balance de Comprobación). Se incrusta en
// ReportesContables (opción «📖 Libro Mayor») y publica su estructura vía
// `onEstructura` para habilitar las descargas PDF/Excel del generador.
// ---------------------------------------------------------------------------
export default function LibroMayor({ empresaActiva, periodoActivo, onEstructura }) {
  const [cuentaId, setCuentaId] = useState('');
  const [cuentas, setCuentas] = useState([]);
  const [movimientos, setMovimientos] = useState([]);
  const [saldoInicial, setSaldoInicial] = useState(0);
  const [cargando, setCargando] = useState(false);

  // Fechas del rango: SIEMPRE en formato plano AAAA-MM-DD (el ISO con hora
  // deja el input date en blanco). Inicializan con el periodo activo.
  const [fechaInicio, setFechaInicio] = useState((periodoActivo?.fechaInicio || '').split('T')[0]);
  const [fechaFin, setFechaFin] = useState((periodoActivo?.fechaFin || '').split('T')[0]);

  // Carga las cuentas SÓLO de la empresa activa (selector único) y limpia la
  // cuenta elegida, los movimientos y la estructura exportable al cambiar de
  // empresa para no dejar en pantalla resultados de la empresa anterior.
  useEffect(() => {
    const cargarCuentas = async () => {
      try {
        const data = await contabilidadApi.getCuentas(empresaActiva?.id);
        setCuentas(Array.isArray(data) ? data : (data?.$values || []));
      } catch (error) {
        console.error('Error cargando cuentas para libro mayor', error);
        setCuentas([]);
      }
    };
    setCuentaId('');
    setMovimientos([]);
    setSaldoInicial(0);
    onEstructura?.(null);
    cargarCuentas();
  }, [empresaActiva?.id, onEstructura]);

  // Al cambiar de periodo se resincronizan las fechas del rango y se
  // invalidan los resultados anteriores (queda pendiente de nueva consulta).
  useEffect(() => {
    setFechaInicio((periodoActivo?.fechaInicio || '').split('T')[0]);
    setFechaFin((periodoActivo?.fechaFin || '').split('T')[0]);
    setMovimientos([]);
    setSaldoInicial(0);
    onEstructura?.(null);
  }, [periodoActivo?.id, periodoActivo?.fechaInicio, periodoActivo?.fechaFin, onEstructura]);

  const buscarLibroMayor = async () => {
    if (!cuentaId) {
      alert('️ Seleccione una cuenta para consultar el libro mayor.');
      return;
    }
    setCargando(true);
    try {
      // Se envía la empresa activa: el backend sólo devuelve movimientos si
      // la cuenta pertenece a esa empresa (aislamiento por selector único).
      const data = await contabilidadApi.getLibroMayor(
        Number(cuentaId),
        fechaInicio || undefined,
        fechaFin || undefined,
        empresaActiva?.id || undefined
      );
      const lista = Array.isArray(data) ? data : (data?.$values || []);
      // Saldo inicial del rango: primera fila del backend (histórico + apertura
      // del propio rango). Se toma en una variable local porque el estado
      // `saldoInicial` aún no se ha actualizado al construir la estructura.
      const inicial = lista.length > 0 ? Number(lista[0].saldoInicial ?? 0) : 0;
      setMovimientos(lista);
      setSaldoInicial(inicial);

      // Estructura exportable (PDF/Excel) con el MISMO formato de los demás
      // reportes financieros: membrete + fila «Saldo inicial» + movimientos +
      // fila de TOTALES. Sin movimientos no hay estructura (descargas off).
      if (lista.length === 0) {
        onEstructura?.(null);
      } else {
        const cuentaSel = cuentas.find((c) => Number(c.id ?? c.cuentaId) === Number(cuentaId));
        const codigo = cuentaSel?.codigoCuenta || cuentaSel?.codigo || '';
        const nombre = cuentaSel?.nombreCuenta || cuentaSel?.nombre || '';
        const totalDebe = lista.reduce((s, m) => s + Number(m.debe || 0), 0);
        const totalHaber = lista.reduce((s, m) => s + Number(m.haber || 0), 0);
        const saldoFinal = Number(lista[lista.length - 1]?.saldoAcumulado ?? 0);
        onEstructura?.({
          titulo: `Libro Mayor — ${codigo} ${nombre}`,
          // Rango REAL de la consulta (el membrete lo usa en vez del periodo
          // global: el usuario puede consultar fechas distintas al periodo).
          fechaDesde: fechaInicio || undefined,
          fechaHasta: fechaFin || undefined,
          columnas: ['Fecha', 'Comprobante', 'Concepto', 'Debe', 'Haber', 'Saldo acumulado'],
          filas: [
            [
              { content: 'SALDO INICIAL', styles: { fontStyle: 'bold' } },
              '—',
              { content: `Saldo inicial${fechaInicio ? ` al ${fmtFecha(fechaInicio)}` : ''}`, styles: { fontStyle: 'bold' } },
              '—',
              '—',
              { content: fmtMonto(inicial), styles: { fontStyle: 'bold' } }
            ],
            ...lista.map((m) => [
              fmtFecha(m.fechaComprobante),
              m.numeroComprobante || '—',
              m.concepto || '',
              fmtMonto(m.debe),
              fmtMonto(m.haber),
              fmtMonto(m.saldoAcumulado)
            ])
          ],
          totales: ['', '', 'TOTALES', fmtMonto(totalDebe), fmtMonto(totalHaber), fmtMonto(saldoFinal)]
        });
      }
    } catch (error) {
      console.error('Error consultando libro mayor:', error);
      onEstructura?.(null);
      alert('❌ No se pudo consultar el libro mayor.');
    } finally {
      setCargando(false);
    }
  };

  const inputStyle = {
    padding: '10px 12px', borderRadius: '8px', border: '1px solid #334155',
    background: '#0f172a', color: '#fff', width: '100%', boxSizing: 'border-box'
  };

  return (
    <div style={{ padding: '24px', color: '#e2e8f0' }}>
      {/* Encabezado con contexto */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '10px' }}>
        <h2 style={{ margin: 0 }}>📖 Libro Mayor</h2>
        <div style={{ fontSize: '0.85rem', color: '#94a3b8', textAlign: 'right' }}>
          <div>🏢 {empresaActiva?.nombre || 'Sin empresa'}</div>
          <div>📅 {periodoActivo?.nombre || 'Sin periodo'}</div>
        </div>
      </div>

      {/* Filtros de Búsqueda */}
      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', 
        gap: '16px', marginBottom: '24px', alignItems: 'end',
        background: '#1e293b', padding: '20px', borderRadius: '12px', border: '1px solid #334155'
      }}>
        <div>
          <label style={{ display: 'block', color: '#94a3b8', marginBottom: '6px', fontSize: '0.85rem' }}>Cuenta Contable</label>
          <select value={cuentaId} onChange={(e) => setCuentaId(e.target.value)} style={inputStyle}>
            <option value="">-- Seleccione una cuenta --</option>
            {cuentas.map((cuenta) => (
              <option key={cuenta.id} value={cuenta.id}>
                {cuenta.codigoCuenta || cuenta.codigo} - {cuenta.nombreCuenta || cuenta.nombre}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label style={{ display: 'block', color: '#94a3b8', marginBottom: '6px', fontSize: '0.85rem' }}>Fecha Desde</label>
          <input type="date" value={fechaInicio} onChange={(e) => setFechaInicio(e.target.value)} style={inputStyle} />
        </div>
        <div>
          <label style={{ display: 'block', color: '#94a3b8', marginBottom: '6px', fontSize: '0.85rem' }}>Fecha Hasta</label>
          <input type="date" value={fechaFin} onChange={(e) => setFechaFin(e.target.value)} style={inputStyle} />
        </div>
        <button 
          onClick={buscarLibroMayor} 
          disabled={cargando}
          style={{ 
            background: '#2563eb', color: '#fff', border: 'none', borderRadius: '8px', 
            padding: '10px 16px', cursor: cargando ? 'not-allowed' : 'pointer', fontWeight: 'bold' 
          }}
        >
          {cargando ? 'Consultando...' : '🔍 Consultar'}
        </button>
      </div>

      {/* Tabla de Resultados */}
      <div style={{ background: '#111827', borderRadius: '12px', overflow: 'hidden', border: '1px solid #334155' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: '#1e293b', color: '#93c5fd', textAlign: 'left' }}>
              <th style={{ padding: '12px' }}>Fecha</th>
              <th style={{ padding: '12px' }}>Comprobante</th>
              <th style={{ padding: '12px' }}>Concepto</th>
              <th style={{ padding: '12px', textAlign: 'right' }}>Debe</th>
              <th style={{ padding: '12px', textAlign: 'right' }}>Haber</th>
              <th style={{ padding: '12px', textAlign: 'right' }}>Saldo acumulado</th>
            </tr>
          </thead>
          <tbody>
            {movimientos.length === 0 ? (
              <tr>
                <td colSpan="6" style={{ padding: '30px', textAlign: 'center', color: '#94a3b8' }}>
                  {cargando ? 'Buscando movimientos...' : 'No hay movimientos para esta cuenta en el rango seleccionado.'}
                </td>
              </tr>
            ) : (
              <>
                {/* FILA DE SALDO INICIAL: histórico anterior al rango + apertura
                    manual del propio rango (mismo criterio del Balance de
                    Comprobación). El backend lo envía en `saldoInicial`. */}
                <tr style={{ background: '#0f172a', borderBottom: '1px solid #fbbf24' }}>
                  <td colSpan={3} style={{ padding: '12px', color: '#fbbf24', fontWeight: 'bold', fontStyle: 'italic' }}>
                    SALDO INICIAL{fechaInicio ? ` al ${fmtFecha(fechaInicio)}` : ''}
                  </td>
                  <td style={{ padding: '12px', textAlign: 'right', color: '#64748b' }}>—</td>
                  <td style={{ padding: '12px', textAlign: 'right', color: '#64748b' }}>—</td>
                  <td style={{ padding: '12px', textAlign: 'right', fontWeight: 'bold', color: saldoInicial >= 0 ? '#34d399' : '#f87171' }}>
                    {saldoInicial.toFixed(2)}
                  </td>
                </tr>
                {movimientos.map((item, index) => {
                const saldoAcumulado = Number(item.saldoAcumulado ?? 0);
                return (
                  <tr key={`${item.asientoId}-${index}`} style={{ borderTop: '1px solid #1f2937' }}>
                    <td style={{ padding: '12px' }}>{new Date(item.fechaComprobante).toLocaleDateString()}</td>
                    <td style={{ padding: '12px', fontFamily: 'monospace', color: '#60a5fa' }}>{item.numeroComprobante}</td>
                    <td style={{ padding: '12px' }}>{item.concepto}</td>
                    <td style={{ padding: '12px', textAlign: 'right', color: '#60a5fa' }}>{Number(item.debe || 0).toFixed(2)}</td>
                    <td style={{ padding: '12px', textAlign: 'right', color: '#f87171' }}>{Number(item.haber || 0).toFixed(2)}</td>
                    <td style={{ padding: '12px', textAlign: 'right', fontWeight: 'bold', color: saldoAcumulado >= 0 ? '#34d399' : '#f87171' }}>
                      {saldoAcumulado.toFixed(2)}
                    </td>
                  </tr>
                );
              })}
              </>
            )}
          </tbody>
          {movimientos.length > 0 && (
            <tfoot>
              <tr style={{ borderTop: '1.5px solid #000', fontWeight: 'bold', background: '#1e293b' }}>
                <td colSpan={3} style={{ padding: '12px', color: '#93c5fd' }}>TOTALES (Bs.)</td>
                <td style={{ padding: '12px', textAlign: 'right', color: '#60a5fa' }}>
                  {movimientos.reduce((s, m) => s + Number(m.debe || 0), 0).toFixed(2)}
                </td>
                <td style={{ padding: '12px', textAlign: 'right', color: '#f87171' }}>
                  {movimientos.reduce((s, m) => s + Number(m.haber || 0), 0).toFixed(2)}
                </td>
                <td style={{ padding: '12px', textAlign: 'right', color: '#34d399' }}>
                  {Number(movimientos[movimientos.length - 1]?.saldoAcumulado ?? 0).toFixed(2)}
                </td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  );
}
