import { useStore } from '../../lib/store.js';

export function DisplayControls() {
  const color = useStore((s) => s.color);
  const setColor = useStore((s) => s.setColor);
  return (
    <div>
      <div className="panel-title">Display</div>
      <label className="slider-row">
        <span>Color mode</span>
        <select
          value={color.colorMode}
          onChange={(e) =>
            setColor({
              colorMode: e.target.value as 'chirality' | 'depth' | 'coordination',
            })
          }
          title="How Plancktons are colored. Chirality = red/white per R/L; depth = rainbow by placement order; coordination = grey (z=0, isolated) → red (z=4, fully interior)."
        >
          <option value="chirality">By chirality</option>
          <option value="depth">By placement order</option>
          <option value="coordination">By coordination (z)</option>
        </select>
      </label>
      <label className="slider-row">
        <span>R color</span>
        <input
          type="color"
          value={color.rightColor}
          onChange={(e) => setColor({ rightColor: e.target.value })}
          title="Right-handed Planckton color"
        />
      </label>
      <label className="slider-row">
        <span>L color</span>
        <input
          type="color"
          value={color.leftColor}
          onChange={(e) => setColor({ leftColor: e.target.value })}
          title="Left-handed Planckton color"
        />
      </label>

      <div className="panel-divider-small" />

      <label
        className="checkbox-row"
        title="Tightest convex envelope of all Planckton vertices. Its volume V is the upper bound used in η = V*/V. Size is derived from the assembly geometry, not adjustable."
      >
        <input
          type="checkbox"
          checked={color.showHull}
          onChange={(e) => setColor({ showHull: e.target.checked })}
        />
        Convex hull
      </label>
      <label
        className="checkbox-row"
        title="Gyration ellipsoid: principal axes are the eigenvectors of G_ij = ⟨rᵢrⱼ⟩, semi-axes = √(5λᵢ). NOT the inertia ellipsoid - that's a different tensor."
      >
        <input
          type="checkbox"
          checked={color.showEllipsoid}
          onChange={(e) => setColor({ showEllipsoid: e.target.checked })}
        />
        Gyration ellipsoid
      </label>
      <label className="checkbox-row">
        <input
          type="checkbox"
          checked={color.showEdges}
          onChange={(e) => setColor({ showEdges: e.target.checked })}
        />
        Edge outlines
      </label>
      {color.showEdges && (
        <label className="slider-row">
          <span>Edge opacity</span>
          <input
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={color.edgeOpacity}
            onChange={(e) => setColor({ edgeOpacity: parseFloat(e.target.value) })}
          />
          <span className="slider-value">{color.edgeOpacity.toFixed(2)}</span>
        </label>
      )}

      <div className="panel-divider-small" />

      <label
        className="slider-row"
        title="Render-only shrink: each Planckton is drawn smaller than its true volume so that shared faces don't z-fight. The math vertices are unchanged."
      >
        <span>Render gap</span>
        <input
          type="range"
          min={0}
          max={0.06}
          step={0.001}
          value={color.tetInset}
          onChange={(e) => setColor({ tetInset: parseFloat(e.target.value) })}
        />
        <span className="slider-value">{(color.tetInset * 100).toFixed(1)}%</span>
      </label>
      <p className="caption" style={{ margin: '4px 0 0' }}>
        Plancktons share faces exactly in the math (V★ = N·L³/6). The render gap is purely cosmetic
        - set to 0 to see touching faces.
      </p>
    </div>
  );
}
