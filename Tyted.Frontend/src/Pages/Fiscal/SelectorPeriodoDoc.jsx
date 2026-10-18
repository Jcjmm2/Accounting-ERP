import { etiquetaPeriodo, esPeriodoCerrado } from './periodoDocHelper';
import { inputChico } from './libroComprasHelpers';

// ---------------------------------------------------------------------------
// SELECTOR «PERIODO AL QUE AFECTA» PARA LOS FORMULARIOS FISCALES (VENTAS Y
// COMPRAS): el periodo define el rango de fechas admitido por el documento
// (regla «fecha ∈ periodo»). Muestra nombre · rango · estado y bloquea los
// periodos CERRADOS. Presentacional: el estado viven en cada formulario.
// ---------------------------------------------------------------------------
export default function SelectorPeriodoDoc({ periodos, periodoId, onChange }) {
  return (
    <div>
      <label style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Periodo al que afecta *</label>
      <select
        value={periodoId ?? ''}
        onChange={(e) => onChange(e.target.value ? Number(e.target.value) : '')}
        style={{ ...inputChico, width: '100%' }}
      >
        <option value="">Seleccione el periodo…</option>
        {(periodos || []).map((p) => (
          <option key={p.id} value={p.id} disabled={esPeriodoCerrado(p)}>
            {etiquetaPeriodo(p)}{esPeriodoCerrado(p) ? ' (cerrado)' : ''}
          </option>
        ))}
      </select>
    </div>
  );
}
