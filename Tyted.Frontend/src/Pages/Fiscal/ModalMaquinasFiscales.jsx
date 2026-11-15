import { useState } from 'react';
import { fiscalApi, mensajeErrorApi } from '../../Services/Fiscal/FiscalApi';

const inputModal = {
  background: '#0f172a',
  color: '#fff',
  border: '1px solid #475569',
  borderRadius: '6px',
  padding: '7px 9px',
  fontSize: '0.82rem',
  width: '100%',
  boxSizing: 'border-box'
};

export default function ModalMaquinasFiscales({ empresaId, maquinas, onClose, onGuardado }) {
  const [editId, setEditId] = useState(null);
  const [guardando, setGuardando] = useState(false);
  const [form, setForm] = useState({
    numeroControl: '',
    alias: '',
    marcaModelo: '',
    numeroZInicial: '',
    facturaInicial: '',
    activa: true,
    esPredeterminada: maquinas.length === 0
  });

  const limpiarForm = () => {
    setEditId(null);
    setForm({
      numeroControl: '',
      alias: '',
      marcaModelo: '',
      numeroZInicial: '',
      facturaInicial: '',
      activa: true,
      esPredeterminada: false
    });
  };

  const editarMaquina = (m) => {
    setEditId(m.id);
    setForm({
      numeroControl: m.numeroControl || '',
      alias: m.alias || '',
      marcaModelo: m.marcaModelo || '',
      numeroZInicial: m.numeroZInicial || '',
      facturaInicial: m.facturaInicial || '',
      activa: m.activa ?? true,
      esPredeterminada: m.esPredeterminada ?? false
    });
  };

  const guardar = async (e) => {
    e.preventDefault();
    if (!form.numeroControl.trim()) {
      alert('⚠️ Indique el N° de Control de la máquina fiscal (ej. Z7C7038271).');
      return;
    }
    setGuardando(true);
    try {
      const payload = { ...form, empresaId };
      const guardada = editId
        ? await fiscalApi.actualizarMaquinaFiscal(editId, payload)
        : await fiscalApi.crearMaquinaFiscal(payload);

      limpiarForm();
      await onGuardado(guardada.numeroControl);
    } catch (err) {
      alert(`❌ Error guardando máquina fiscal:\n${mensajeErrorApi(err)}`);
    } finally {
      setGuardando(false);
    }
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(2, 6, 23, 0.78)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1200, padding: '16px'
    }}>
      <div style={{
        background: '#1e293b', border: '1px solid #7c3aed', borderRadius: '12px',
        width: '100%', maxWidth: '720px', maxHeight: '90vh', overflowY: 'auto', padding: '20px', color: '#e2e8f0'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
          <h3 style={{ margin: 0, color: '#c4b5fd', fontSize: '1.05rem' }}>
            🖨️ Maestro de Máquinas Fiscales
          </h3>
          <button
            type="button"
            onClick={onClose}
            style={{ background: '#334155', color: '#fff', border: 'none', borderRadius: '6px', padding: '5px 10px', cursor: 'pointer' }}
          >
            ✕
          </button>
        </div>

        {/* Formulario alta / edición */}
        <form onSubmit={guardar} style={{ background: '#0f172a', border: '1px solid #334155', borderRadius: '8px', padding: '14px', marginBottom: '16px' }}>
          <div style={{ fontSize: '0.8rem', fontWeight: 'bold', color: '#93c5fd', marginBottom: '10px' }}>
            {editId ? '✏️ Editando máquina fiscal' : '➕ Registrar nueva máquina fiscal'}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '10px', marginBottom: '10px' }}>
            <div>
              <label style={{ fontSize: '0.72rem', color: '#94a3b8' }}>N° Control / Serial *</label>
              <input
                type="text"
                value={form.numeroControl}
                onChange={(e) => setForm({ ...form, numeroControl: e.target.value.toUpperCase() })}
                placeholder="Z7C7038271"
                style={inputModal}
              />
            </div>
            <div>
              <label style={{ fontSize: '0.72rem', color: '#94a3b8' }}>Alias / Caja *</label>
              <input
                type="text"
                value={form.alias}
                onChange={(e) => setForm({ ...form, alias: e.target.value })}
                placeholder="Caja Principal"
                style={inputModal}
              />
            </div>
            <div>
              <label style={{ fontSize: '0.72rem', color: '#94a3b8' }}>Marca / Modelo</label>
              <input
                type="text"
                value={form.marcaModelo}
                onChange={(e) => setForm({ ...form, marcaModelo: e.target.value })}
                placeholder="Bixolon SRP-812"
                style={inputModal}
              />
            </div>
            <div>
              <label style={{ fontSize: '0.72rem', color: '#94a3b8' }}>Últ. Z previo (opcional)</label>
              <input
                type="text"
                value={form.numeroZInicial}
                onChange={(e) => setForm({ ...form, numeroZInicial: e.target.value })}
                placeholder="Ej. 0031"
                title="Si la máquina ya venía operando, indique el último N° Z antes de usar TYTED"
                style={inputModal}
              />
            </div>
            <div>
              <label style={{ fontSize: '0.72rem', color: '#94a3b8' }}>Últ. Factura previa</label>
              <input
                type="text"
                value={form.facturaInicial}
                onChange={(e) => setForm({ ...form, facturaInicial: e.target.value })}
                placeholder="Ej. 00000071"
                title="Último número de factura emitido antes de usar TYTED"
                style={inputModal}
              />
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
            <div style={{ display: 'flex', gap: '14px', fontSize: '0.78rem' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '5px', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={form.esPredeterminada}
                  onChange={(e) => setForm({ ...form, esPredeterminada: e.target.checked })}
                />
                ⭐ Predeterminada
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '5px', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={form.activa}
                  onChange={(e) => setForm({ ...form, activa: e.target.checked })}
                />
                Activa
              </label>
            </div>

            <div style={{ display: 'flex', gap: '8px' }}>
              {editId && (
                <button
                  type="button"
                  onClick={limpiarForm}
                  style={{ background: '#475569', color: '#fff', border: 'none', borderRadius: '6px', padding: '6px 12px', cursor: 'pointer', fontSize: '0.8rem' }}
                >
                  Cancelar edición
                </button>
              )}
              <button
                type="submit"
                disabled={guardando}
                style={{ background: '#7c3aed', color: '#fff', border: 'none', borderRadius: '6px', padding: '6px 14px', cursor: 'pointer', fontWeight: 'bold', fontSize: '0.8rem' }}
              >
                {guardando ? '⏳ Guardando…' : editId ? '💾 Actualizar máquina' : '➕ Guardar máquina'}
              </button>
            </div>
          </div>
        </form>

        {/* Listado de máquinas de la empresa */}
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
          <thead>
            <tr style={{ background: '#0f172a', color: '#93c5fd', textAlign: 'left' }}>
              <th style={{ padding: '8px' }}>N° Control</th>
              <th style={{ padding: '8px' }}>Alias / Caja</th>
              <th style={{ padding: '8px' }}>Último Z</th>
              <th style={{ padding: '8px' }}>Últ. Factura</th>
              <th style={{ padding: '8px' }}>Estado</th>
              <th style={{ padding: '8px', textAlign: 'center' }}>Acción</th>
            </tr>
          </thead>
          <tbody>
            {maquinas.length === 0 ? (
              <tr>
                <td colSpan={6} style={{ padding: '16px', textAlign: 'center', color: '#94a3b8' }}>
                  No hay máquinas fiscales registradas para esta empresa.
                </td>
              </tr>
            ) : maquinas.map((m) => (
              <tr key={m.id} style={{ borderTop: '1px solid #334155', opacity: m.activa ? 1 : 0.55 }}>
                <td style={{ padding: '8px', fontFamily: 'monospace', fontWeight: 'bold' }}>
                  {m.numeroControl} {m.esPredeterminada && <span title="Predeterminada">⭐</span>}
                </td>
                <td style={{ padding: '8px' }}>
                  {m.alias}
                  {m.marcaModelo && <span style={{ display: 'block', fontSize: '0.7rem', color: '#94a3b8' }}>{m.marcaModelo}</span>}
                </td>
                <td style={{ padding: '8px', fontFamily: 'monospace', color: '#a78bfa' }}>{m.ultimoNumeroZ || '—'}</td>
                <td style={{ padding: '8px', fontFamily: 'monospace', color: '#34d399' }}>{m.ultimaFacturaHasta || '—'}</td>
                <td style={{ padding: '8px' }}>
                  <span style={{
                    background: m.activa ? '#064e3b' : '#7f1d1d',
                    color: m.activa ? '#6ee7b7' : '#fca5a5',
                    padding: '2px 7px', borderRadius: '8px', fontSize: '0.7rem'
                  }}>
                    {m.activa ? 'Activa' : 'Inactiva'}
                  </span>
                </td>
                <td style={{ padding: '8px', textAlign: 'center' }}>
                  <button
                    type="button"
                    onClick={() => editarMaquina(m)}
                    style={{ background: '#3b82f6', color: '#fff', border: 'none', borderRadius: '5px', padding: '4px 8px', cursor: 'pointer' }}
                    title="Editar máquina"
                  >
                    ✏️
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}