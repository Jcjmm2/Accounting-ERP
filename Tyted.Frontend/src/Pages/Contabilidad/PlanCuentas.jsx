import { useEffect, useState } from 'react';
import { contabilidadApi } from '../../Services/Contabilidad/ContabilidadApi';

export default function PlanCuentas() {
  const [cuentas, setCuentas] = useState([]);
  const [codigo, setCodigo] = useState('');
  const [nombre, setNombre] = useState('');
  const [naturaleza, setNaturaleza] = useState('Deudora');

  const cargarCuentas = async () => {
    try {
      const data = await contabilidadApi.getCuentas();
      setCuentas(data);
    } catch (error) {
      console.error('Error cargando cuentas:', error);
    }
  };

  useEffect(() => {
    cargarCuentas();
  }, []);

  const guardarCuenta = async (event) => {
    event.preventDefault();

    try {
      await contabilidadApi.crearCuenta({
        codigoCuenta: codigo,
        nombreCuenta: nombre,
        naturaleza,
        tipoCuenta: 'Activo',
        activa: true,
        empresaId: 1,
        esMovimiento: true,
        nivel: 5,
        aceptaTerceros: false,
        aceptaCentroCosto: false
      });
      setCodigo('');
      setNombre('');
      await cargarCuentas();
    } catch (error) {
      console.error('Error creando cuenta:', error);
    }
  };

  return (
    <div style={{ padding: '24px', color: '#e2e8f0' }}>
      <h2 style={{ marginBottom: '20px' }}>Plan de cuentas</h2>

      <form onSubmit={guardarCuenta} style={{ display: 'grid', gap: '12px', maxWidth: '520px', marginBottom: '28px' }}>
        <input
          type="text"
          value={codigo}
          onChange={(e) => setCodigo(e.target.value)}
          placeholder="Código"
          style={{ padding: '10px 12px', borderRadius: '8px', border: '1px solid #334155', background: '#0f172a', color: '#fff' }}
        />
        <input
          type="text"
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
          placeholder="Nombre de la cuenta"
          style={{ padding: '10px 12px', borderRadius: '8px', border: '1px solid #334155', background: '#0f172a', color: '#fff' }}
        />
        <select
          value={naturaleza}
          onChange={(e) => setNaturaleza(e.target.value)}
          style={{ padding: '10px 12px', borderRadius: '8px', border: '1px solid #334155', background: '#0f172a', color: '#fff' }}
        >
          <option value="Deudora">Deudora</option>
          <option value="Acreedora">Acreedora</option>
        </select>
        <button type="submit" style={{ background: '#2563eb', color: '#fff', border: 'none', borderRadius: '8px', padding: '10px', cursor: 'pointer' }}>
          Guardar cuenta
        </button>
      </form>

      <div style={{ background: '#111827', borderRadius: '12px', padding: '12px', overflow: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ color: '#93c5fd' }}>
              <th style={{ textAlign: 'left', padding: '10px' }}>Código</th>
              <th style={{ textAlign: 'left', padding: '10px' }}>Nombre</th>
              <th style={{ textAlign: 'left', padding: '10px' }}>Naturaleza</th>
            </tr>
          </thead>
          <tbody>
            {cuentas.length === 0 ? (
              <tr>
                <td colSpan="3" style={{ padding: '16px', color: '#94a3b8' }}>No hay cuentas registradas todavía.</td>
              </tr>
            ) : (
              cuentas.map((cuenta) => (
                <tr key={cuenta.id ?? cuenta.cuentaId} style={{ borderTop: '1px solid #1f2937' }}>
                  <td style={{ padding: '10px' }}>{cuenta.codigoCuenta ?? cuenta.codigo}</td>
                  <td style={{ padding: '10px' }}>{cuenta.nombreCuenta ?? cuenta.nombre}</td>
                  <td style={{ padding: '10px' }}>{cuenta.naturaleza}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
