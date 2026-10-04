import { useState } from 'react';
import { contabilidadApi } from '../../Services/Contabilidad/ContabilidadApi';

export default function NuevoAsiento() {
  const [descripcion, setDescripcion] = useState('');
  const [cuentaId, setCuentaId] = useState('');
  const [monto, setMonto] = useState('');
  const [lado, setLado] = useState('Debe');

  const guardar = async (event) => {
    event.preventDefault();

    const asiento = {
      concepto: descripcion,
      fechaComprobante: new Date().toISOString(),
      estado: 'Aprobado',
      periodoContableId: 1,
      empresaId: 1,
      usuarioId: 1,
      tipoComprobante: 'Diario',
      numeroComprobante: `A-${Date.now()}`,
      detalles: [
        {
          cuentaContableId: Number(cuentaId),
          debe: lado === 'Debe' ? Number(monto) : 0,
          haber: lado === 'Haber' ? Number(monto) : 0,
          referencia: descripcion
        }
      ]
    };

    try {
      await contabilidadApi.crearAsiento(asiento);
      setDescripcion('');
      setCuentaId('');
      setMonto('');
      setLado('Debe');
      alert('Asiento registrado correctamente');
    } catch (error) {
      console.error('Error creando asiento:', error);
      alert('No se pudo registrar el asiento');
    }
  };

  return (
    <div style={{ padding: '24px', color: '#e2e8f0' }}>
      <h2>Nuevo asiento</h2>

      <form onSubmit={guardar} style={{ display: 'grid', gap: '12px', maxWidth: '500px' }}>
        <input
          type="text"
          value={descripcion}
          onChange={(e) => setDescripcion(e.target.value)}
          placeholder="Descripción"
          style={{ padding: '10px 12px', borderRadius: '8px', border: '1px solid #334155', background: '#0f172a', color: '#fff' }}
        />
        <input
          type="number"
          value={cuentaId}
          onChange={(e) => setCuentaId(e.target.value)}
          placeholder="ID de cuenta"
          style={{ padding: '10px 12px', borderRadius: '8px', border: '1px solid #334155', background: '#0f172a', color: '#fff' }}
        />
        <input
          type="number"
          value={monto}
          onChange={(e) => setMonto(e.target.value)}
          placeholder="Monto"
          style={{ padding: '10px 12px', borderRadius: '8px', border: '1px solid #334155', background: '#0f172a', color: '#fff' }}
        />
        <select
          value={lado}
          onChange={(e) => setLado(e.target.value)}
          style={{ padding: '10px 12px', borderRadius: '8px', border: '1px solid #334155', background: '#0f172a', color: '#fff' }}
        >
          <option value="Debe">Debe</option>
          <option value="Haber">Haber</option>
        </select>
        <button type="submit" style={{ background: '#16a34a', color: '#fff', border: 'none', borderRadius: '8px', padding: '10px', cursor: 'pointer' }}>
          Registrar asiento
        </button>
      </form>
    </div>
  );
}
