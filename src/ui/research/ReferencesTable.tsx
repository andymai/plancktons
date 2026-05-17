import { PACKING_REFERENCES } from '../../lib/references.js';

export function ReferencesTable() {
  return (
    <details className="references-details">
      <summary>Reference packing densities</summary>
      <table className="references-table">
        <thead>
          <tr>
            <th>System</th>
            <th>Δ</th>
            <th>Citation</th>
          </tr>
        </thead>
        <tbody>
          {PACKING_REFERENCES.map((r) => (
            <tr key={r.label}>
              <td>
                <span className="ref-swatch" style={{ background: r.color }} />
                {r.label}
              </td>
              <td>{r.density.toFixed(4)}</td>
              <td title={r.note}>
                {r.url ? (
                  <a href={r.url} target="_blank" rel="noopener noreferrer">
                    {r.citation}
                  </a>
                ) : (
                  r.citation
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </details>
  );
}
