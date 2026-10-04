import { useState, useEffect } from 'react';
import { contabilidadApi } from '../../Services/Contabilidad/ContabilidadApi';

export default function NuevoAsiento({ empresaActiva, periodoActivo }) {
  const [fecha, setFecha] = useState(new Date().toISOString().split('T')[0]);
  const [concepto, setConcepto] = useState('');
  
  const [lineas, setLineas] = useState([
    { cuentaId: '', debe: '', haber: '' },
    { cuentaId: '', debe: '', haber: '' }
  ]);
  
  const [cuentasDisponibles, setCuentasDisponibles] = useState([]);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    const cargarCuentas = async () => {
      try {
        // ✅ CORRECCIÓN 1: Usar el método real que existe en tu API
        const data = await contabilidadApi.getCuentas();
        setCuentasDisponibles(data);
      } catch (err) {
        console.error("Error cargando cuentas para asiento:", err);
      } finally {
        setCargando(false);
      }
    };
    cargarCuentas();
  }, []);

  // Cálculos de totales en tiempo real
  const totalDebe = lineas.reduce((sum, l) => sum + (parseFloat(l.debe) || 0), 0);
  const totalHaber = lineas.reduce((sum, l) => sum + (parseFloat(l.haber) || 0), 0);
  const diferencia = Math.abs(totalDebe - totalHaber);
  const cuadrado = diferencia === 0 && totalDebe > 0;

  const agregarLinea = () => setLineas([...lineas, { cuentaId: '', debe: '', haber: '' }]);

  const eliminarLinea = (index) => {
    if (lineas.length > 2) setLineas(lineas.filter((_, i) => i !== index));
  };

  const actualizarLinea = (index, campo, valor) => {
    const nuevasLineas = [...lineas];
    nuevasLineas[index][campo] = valor;
    
    // Regla contable: Si escribe en Debe, limpia Haber (y viceversa)
    if (campo === 'debe' && valor) nuevasLineas[index].haber = '';
    if (campo === 'haber' && valor) nuevasLineas[index].debe = '';
    
    setLineas(nuevasLineas);
  };

  const guardar = async (e) => {
    e.preventDefault();
    if (!cuadrado) return alert('⚠️ El asiento no está cuadrado. El Debe debe ser igual al Haber.');

    // ✅ CORRECCIÓN 2: Manejo seguro por si las props no llegan (fallback a 1)
    const empId = empresaActiva?.id ?? 1;
    const perId = periodoActivo?.id ?? 1;

    const asiento = {
      concepto,
      fechaComprobante: new Date(fecha).toISOString(),
      estado: 'Aprobado',
      periodoContableId: perId, 
      empresaId: empId,         
      usuarioId: 1, 
      tipoComprobante: 'Diario',
      numeroComprobante: `A-${Date.now()}`,
      detalles: lineas
        .filter(l => l.cuentaId && (l.debe || l.haber))
        .map(l => ({
          cuentaContableId: Number(l.cuentaId),
          debe: parseFloat(l.debe) || 0,
          haber: parseFloat(l.haber) || 0,
          referencia: concepto
        }))
    };

    try {
      await contabilidadApi.crearAsiento(asiento);
      alert('✅ Asiento registrado correctamente');
      setConcepto('');
      setLineas([
        { cuentaId: '', debe: '', haber: '' },
        { cuentaId: '', debe: '', haber: '' }
      ]);
    } catch (error) {
      console.error(error);
      alert('❌ Error al registrar el asiento: ' + (error.message || 'Error desconocido'));
    }
  };

  return (
    <div style={{ padding: '24px', color: '#e2e8f0', maxWidth: '1100px', margin: '0 auto' }}>
      
      {/* Encabezado del Comprobante */}
      <div style={{ background: '#1e293b', padding: '16px', borderRadius: '10px', marginBottom: '20px', border: '1px solid #334155' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
          <h2 style={{ margin: 0 }}>✍️ Comprobante de Diario</h2>
          <div style={{ fontSize: '0.85rem', color: '#94a3b8', textAlign: 'right' }}>
            {/* ✅ CORRECCIÓN 3: Renderizado seguro de contexto con fallback */}
            <div>🏢 {empresaActiva?.nombre || 'Empresa por defecto'}</div>
            <div>📅 {periodoActivo?.nombre || 'Periodo por defecto'}</div>
          </div>
        </div>
      </div>

      <form onSubmit={guardar}>
        {/* Datos Generales */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '16px', marginBottom: '20px' }}>
          <div>
            <label style={{ fontSize: '0.85rem', color: '#94a3b8', marginBottom: '4px', display: 'block' }}>Fecha</label>
            <input type="date" value={fecha} onChange={e => setFecha(e.target.value)} style={inputStyle} required />
          </div>
          <div>
            <label style={{ fontSize: '0.85rem', color: '#94a3b8', marginBottom: '4px', display: 'block' }}>Concepto / Glosa</label>
            <input type="text" value={concepto} onChange={e => setConcepto(e.target.value)} placeholder="Ej. Pago de servicios básicos mes de Enero" style={inputStyle} required />
          </div>
        </div>

        {/* Tabla de Movimientos (Partida Doble) */}
        <div style={{ background: '#0f172a', borderRadius: '10px', border: '1px solid #334155', overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#1e293b', textAlign: 'left' }}>
                <th style={{ padding: '12px', width: '50%' }}>Cuenta Contable</th>
                <th style={{ padding: '12px', width: '20%', textAlign: 'right' }}>DEBE</th>
                <th style={{ padding: '12px', width: '20%', textAlign: 'right' }}>HABER</th>
                <th style={{ padding: '12px', width: '10%' }}></th>
              </tr>
            </thead>
            <tbody>
              {lineas.map((linea, index) => (
                <tr key={index} style={{ borderBottom: '1px solid #334155' }}>
                  <td style={{ padding: '8px' }}>
                    <select 
                      value={linea.cuentaId} 
                      onChange={e => actualizarLinea(index, 'cuentaId', e.target.value)}
                      style={{ ...inputStyle, width: '100%' }}
                      required
                      disabled={cargando}
                    >
                      <option value="">{cargando ? 'Cargando cuentas...' : 'Seleccione cuenta...'}</option>
                      {cuentasDisponibles.map(c => (
                        <option key={c.id} value={c.id}>
                          {/* ✅ CORRECCIÓN 4: Usar los nombres de propiedades reales de tu API con fallback */}
                          {c.codigoCuenta || c.codigo} - {c.nombreCuenta || c.nombre}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td style={{ padding: '8px' }}>
                    <input type="number" step="0.01" value={linea.debe} onChange={e => actualizarLinea(index, 'debe', e.target.value)} placeholder="0.00" style={{ ...inputStyle, textAlign: 'right' }} />
                  </td>
                  <td style={{ padding: '8px' }}>
                    <input type="number" step="0.01" value={linea.haber} onChange={e => actualizarLinea(index, 'haber', e.target.value)} placeholder="0.00" style={{ ...inputStyle, textAlign: 'right' }} />
                  </td>
                  <td style={{ padding: '8px', textAlign: 'center' }}>
                    <button type="button" onClick={() => eliminarLinea(index)} style={{ background: '#dc2626', color: '#fff', border: 'none', borderRadius: '6px', padding: '6px 10px', cursor: 'pointer' }}>✕</button>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr style={{ background: '#1e293b', fontWeight: 'bold', fontSize: '1.1rem' }}>
                <td style={{ padding: '12px', textAlign: 'right' }}>TOTALES:</td>
                <td style={{ padding: '12px', textAlign: 'right', color: '#60a5fa' }}>{totalDebe.toFixed(2)}</td>
                <td style={{ padding: '12px', textAlign: 'right', color: '#f87171' }}>{totalHaber.toFixed(2)}</td>
                <td></td>
              </tr>
            </tfoot>
          </table>
        </div>

        {/* Pie de formulario con validación */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '20px', flexWrap: 'wrap', gap: '10px' }}>
          <button type="button" onClick={agregarLinea} style={{ background: '#334155', color: '#fff', border: 'none', borderRadius: '8px', padding: '10px 16px', cursor: 'pointer' }}>
            + Agregar Línea
          </button>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            {!cuadrado && totalDebe > 0 && (
              <span style={{ color: '#f87171', fontSize: '0.9rem', fontWeight: 'bold' }}>
                ⚠️ Diferencia: {diferencia.toFixed(2)}
              </span>
            )}
            <button type="submit" disabled={!cuadrado || !concepto || cargando} style={{ 
              background: cuadrado ? '#16a34a' : '#475569', 
              color: '#fff', border: 'none', borderRadius: '8px', padding: '12px 24px', 
              cursor: cuadrado ? 'pointer' : 'not-allowed', fontWeight: 'bold', fontSize: '1rem'
            }}>
              💾 Guardar Asiento
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}

const inputStyle = {
  padding: '10px 12px', borderRadius: '8px', border: '1px solid #334155',
  background: '#1e293b', color: '#fff', width: '100%', boxSizing: 'border-box'
};
