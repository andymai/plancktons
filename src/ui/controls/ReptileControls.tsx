import { useStore } from '../../lib/store.js';
import { Term } from '../Term.js';

export function ReptileControls() {
  const exp = useStore((s) => s.reptileExplode);
  const setExp = useStore((s) => s.setReptileExplode);
  const depth = useStore((s) => s.reptileDepth);
  const setDepth = useStore((s) => s.setReptileDepth);
  const autoplay = useStore((s) => s.reptileAutoplay);
  const setAutoplay = useStore((s) => s.setReptileAutoplay);
  const count = 8 ** depth;
  return (
    <div>
      <div className="panel-title">8-reptile dissection</div>
      <label className="slider-row">
        <span>Explode</span>
        <input
          type="range"
          min={0}
          max={1}
          step={0.01}
          value={exp}
          onChange={(e) => setExp(parseFloat(e.target.value))}
          disabled={autoplay}
        />
        <span className="slider-value">{exp.toFixed(2)}</span>
      </label>
      <label
        className="checkbox-row"
        title="Animate explode 0 → 1 → 0 so the 8^depth sub-Plancktons visibly reassemble into the parent. Direct demonstration of m³-reptile self-similarity."
      >
        <input type="checkbox" checked={autoplay} onChange={(e) => setAutoplay(e.target.checked)} />
        Auto-play reptile dissection
      </label>
      <label className="slider-row" title="Recursion depth of the m³ dissection. 8^depth pieces.">
        <span>Depth</span>
        <input
          type="range"
          min={1}
          max={3}
          step={1}
          value={depth}
          onChange={(e) => setDepth(parseInt(e.target.value, 10))}
        />
        <span className="slider-value">
          {depth} ({count} pieces)
        </span>
      </label>
      <p className="caption">
        A 2× <Term name="planckton" /> splits into 8 unit copies. Recursing gives 8ᵈ pieces. This is
        the <Term name="reptile">m³-reptile</Term> family — Matoušek &amp; Safernová (2010) proved
        it is the only such family for tetrahedra.
      </p>
    </div>
  );
}
