import { useStore } from '../../lib/store.js';
import { Term } from '../Term.js';

export function CubeControls() {
  const v = useStore((s) => s.cubeExplode);
  const set = useStore((s) => s.setCubeExplode);
  const autoplay = useStore((s) => s.cubeAutoplay);
  const setAutoplay = useStore((s) => s.setCubeAutoplay);
  return (
    <div>
      <div className="panel-title">Cube tiling</div>
      <label className="slider-row">
        <span>Explode</span>
        <input
          type="range"
          min={0}
          max={1}
          step={0.01}
          value={v}
          onChange={(e) => set(parseFloat(e.target.value))}
          disabled={autoplay}
        />
        <span className="slider-value">{v.toFixed(2)}</span>
      </label>
      <label
        className="checkbox-row"
        title="Animate the explode 0 → 1 → 0 so the 6 pieces visibly reassemble into the cube. Most visceral demonstration of scissors-congruence (Dehn invariant = 0)."
      >
        <input type="checkbox" checked={autoplay} onChange={(e) => setAutoplay(e.target.checked)} />
        Auto-play scissors-congruence morph
      </label>
      <p className="caption">
        Six <Term name="planckton">Plancktons</Term> — 3 R + 3 L, one per permutation of (x, y, z) —
        fill a cube exactly. Each has volume L³/6. The Dehn invariant collapses to zero, so this is
        a <Term name="scissorsCongruence" /> in action.
      </p>
    </div>
  );
}
