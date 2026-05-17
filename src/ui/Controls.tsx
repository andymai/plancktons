import { useStore } from '../lib/store.js';
import { DraftSlider } from './DraftSlider.js';

const SCENES = [
  { id: 'single' as const, label: 'Single Planckton' },
  { id: 'cube' as const, label: 'Cube tiling (6 pieces)' },
  { id: 'reptile' as const, label: '8-reptile dissection' },
  { id: 'growth' as const, label: 'Random face-to-face growth' },
];

export function Controls() {
  const scene = useStore((s) => s.scene);
  const setScene = useStore((s) => s.setScene);
  const advanced = useStore((s) => s.advanced);
  const setAdvanced = useStore((s) => s.setAdvanced);
  return (
    <div className="controls">
      <div className="panel-header">
        <span className="panel-title">Scene</span>
        <label className="advanced-toggle" title="Toggle advanced/research controls (keyboard: ?)">
          <input
            type="checkbox"
            checked={advanced}
            onChange={(e) => setAdvanced(e.target.checked)}
          />
          Advanced
        </label>
      </div>
      <div className="scene-list">
        {SCENES.map((s, i) => (
          <button
            key={s.id}
            className={`scene-button ${scene === s.id ? 'active' : ''}`}
            onClick={() => setScene(s.id)}
            title={`Keyboard: ${i + 1}`}
          >
            {s.label}
          </button>
        ))}
      </div>
      <div className="panel-divider" />
      <SceneControls />
      {advanced && (
        <>
          <div className="panel-divider" />
          <AdvancedControls />
        </>
      )}
      <ShortcutsHint />
    </div>
  );
}

function ShortcutsHint() {
  return (
    <details className="shortcuts-details">
      <summary>Keyboard shortcuts</summary>
      <table className="shortcuts-table">
        <tbody>
          <tr>
            <td>1 – 4</td>
            <td>jump to scene</td>
          </tr>
          <tr>
            <td>← / →</td>
            <td>cycle scenes</td>
          </tr>
          <tr>
            <td>R</td>
            <td>random seed</td>
          </tr>
          <tr>
            <td>N</td>
            <td>next seed (seed + 1)</td>
          </tr>
          <tr>
            <td>A</td>
            <td>cycle animation mode</td>
          </tr>
          <tr>
            <td>Space</td>
            <td>play/pause (animated) or step</td>
          </tr>
          <tr>
            <td>?</td>
            <td>toggle advanced</td>
          </tr>
        </tbody>
      </table>
    </details>
  );
}

function SceneControls() {
  const scene = useStore((s) => s.scene);
  if (scene === 'single') return <SingleControls />;
  if (scene === 'cube') return <CubeControls />;
  if (scene === 'reptile') return <ReptileControls />;
  if (scene === 'growth') return <GrowthControls />;
  return null;
}

function SingleControls() {
  const chir = useStore((s) => s.singleChirality);
  const set = useStore((s) => s.setSingleChirality);
  return (
    <div>
      <div className="panel-title">Chirality</div>
      <div className="chirality-toggle">
        <button className={`chir-btn ${chir === 'R' ? 'active' : ''}`} onClick={() => set('R')}>
          Right (red)
        </button>
        <button className={`chir-btn ${chir === 'L' ? 'active' : ''}`} onClick={() => set('L')}>
          Left (white)
        </button>
      </div>
      <p className="caption">
        A Planckton (Hill tetrahedron). Four faces, two shapes: isoceles-right (1, 1, √2) and
        scalene-right (1, √2, √3). The two chiralities are mirror images.
      </p>
    </div>
  );
}

function CubeControls() {
  const v = useStore((s) => s.cubeExplode);
  const set = useStore((s) => s.setCubeExplode);
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
        />
        <span className="slider-value">{v.toFixed(2)}</span>
      </label>
      <p className="caption">
        Six Plancktons - 3 R + 3 L, one per permutation of (x, y, z) - fill a cube exactly. Each has
        volume L³/6.
      </p>
    </div>
  );
}

function ReptileControls() {
  const exp = useStore((s) => s.reptileExplode);
  const setExp = useStore((s) => s.setReptileExplode);
  const depth = useStore((s) => s.reptileDepth);
  const setDepth = useStore((s) => s.setReptileDepth);
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
        />
        <span className="slider-value">{exp.toFixed(2)}</span>
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
        A 2× Planckton splits into 8 unit copies. Recursing gives 8ᵈ pieces. This is the m³-reptile
        family - Matoušek &amp; Safernová (2010) proved it is the only such family for tetrahedra.
      </p>
    </div>
  );
}

function GrowthControls() {
  const growth = useStore((s) => s.growth);
  const setGrowth = useStore((s) => s.setGrowth);
  const animationMode = useStore((s) => s.animationMode);
  const setAnimationMode = useStore((s) => s.setAnimationMode);
  const animSpeed = useStore((s) => s.animSpeed);
  const setAnimSpeed = useStore((s) => s.setAnimSpeed);
  return (
    <div>
      <div className="panel-title">Random face-to-face growth</div>
      <label
        className="slider-row"
        title="Target Planckton count. Random face-to-face growth typically jams between N≈100 and N≈500 depending on strategy."
      >
        <span>Plancktons (N)</span>
        <DraftSlider
          min={1}
          max={500}
          step={1}
          value={Math.min(500, growth.N)}
          onCommit={(v) => setGrowth({ N: v })}
        />
        <input
          type="number"
          min={1}
          max={2000}
          step={1}
          value={growth.N}
          onChange={(e) => {
            const n = parseInt(e.target.value, 10);
            if (Number.isFinite(n) && n >= 1) setGrowth({ N: n });
          }}
          style={{ width: '4.2rem' }}
          title="Slider tops at 500; type above for N up to 2000 (slow at extreme N)."
        />
      </label>
      <label
        className="slider-row"
        title="Deterministic PRNG seed. Re-running with the same seed reproduces the exact same assembly."
      >
        <span>Seed</span>
        <input
          type="number"
          min={0}
          value={growth.seed}
          onChange={(e) => setGrowth({ seed: parseInt(e.target.value, 10) || 1 })}
          style={{ width: '5.5rem' }}
        />
        <button
          onClick={() => setGrowth({ seed: Math.floor(Math.random() * 1e6) })}
          title="Random seed (keyboard: R)"
        >
          random
        </button>
        <button
          onClick={() => setGrowth({ seed: growth.seed + 1 })}
          title="Next deterministic trial - seed + 1 (keyboard: N)"
        >
          next
        </button>
      </label>
      <label className="slider-row">
        <span>Strategy</span>
        <select
          value={growth.strategy}
          onChange={(e) => setGrowth({ strategy: e.target.value as 'uniform' | 'compact' })}
          title="How the next free face is chosen. Uniform = unbiased random; compact = prefer concave pockets toward the assembly centroid."
        >
          <option value="uniform">Uniform random</option>
          <option value="compact">Compact - fill pockets</option>
        </select>
      </label>
      {growth.strategy === 'compact' && (
        <label
          className="slider-row"
          title="Inverse temperature in p(face) ∝ exp(β·n̂·ĉ). β=0 recovers uniform; β≳15 saturates to greedy 'always fill the deepest pocket'."
        >
          <span>β (compactness)</span>
          <DraftSlider
            min={0}
            max={20}
            step={0.2}
            value={growth.compactBeta}
            onCommit={(v) => setGrowth({ compactBeta: v })}
          />
          <span className="slider-value">{growth.compactBeta.toFixed(1)}</span>
        </label>
      )}
      <label
        className="slider-row"
        title="Probability the next Planckton drawn is right-handed. 0 = all-L, 1 = all-R, 0.5 = balanced."
      >
        <span>Chirality (R : L)</span>
        <DraftSlider
          min={0}
          max={1}
          step={0.01}
          value={growth.chiralityBias}
          onCommit={(v) => setGrowth({ chiralityBias: v })}
        />
        <span className="slider-value">
          {(growth.chiralityBias * 100).toFixed(0)} :{' '}
          {((1 - growth.chiralityBias) * 100).toFixed(0)}
        </span>
      </label>
      <div className="panel-divider-small" />
      <label className="slider-row">
        <span>Playback</span>
        <select
          value={animationMode}
          onChange={(e) => setAnimationMode(e.target.value as 'instant' | 'animated' | 'step')}
          title="How the assembly fills in. Instant = jump to N; animated = grow at a configurable rate; step = one Planckton per click (or Space)."
        >
          <option value="instant">Instant</option>
          <option value="animated">Animated</option>
          <option value="step">Manual (step)</option>
        </select>
      </label>
      {animationMode === 'animated' && (
        <label className="slider-row">
          <span>Speed</span>
          <input
            type="range"
            min={0.5}
            max={30}
            step={0.5}
            value={animSpeed}
            onChange={(e) => setAnimSpeed(parseFloat(e.target.value))}
          />
          <span className="slider-value">{animSpeed.toFixed(1)}/s</span>
        </label>
      )}
      {animationMode === 'step' && <StepButton />}
      <p className="caption">
        Each step picks a free face at random and glues a fresh Planckton onto a congruent face.
        SAT-checked rejection guarantees no two Plancktons overlap. Compact mode biases toward
        concave pockets - tighter packings, but also earlier jamming.
      </p>
    </div>
  );
}

function StepButton() {
  const bumpStep = useStore((s) => s.bumpStep);
  return (
    <div className="slider-row">
      <span>Step</span>
      <button
        onClick={bumpStep}
        style={{ flex: 1 }}
        title="Append one Planckton, clamped to the N target (keyboard: Space)"
      >
        Add tet
      </button>
    </div>
  );
}

function AdvancedControls() {
  const color = useStore((s) => s.color);
  const setColor = useStore((s) => s.setColor);
  return (
    <div>
      <div className="panel-title">Display</div>
      <label className="slider-row">
        <span>Color mode</span>
        <select
          value={color.colorMode}
          onChange={(e) => setColor({ colorMode: e.target.value as 'chirality' | 'depth' })}
          title="How Plancktons are colored. Chirality = red/white per R/L; depth = rainbow by placement order."
        >
          <option value="chirality">By chirality</option>
          <option value="depth">By placement order</option>
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
        title="Solid ellipsoid aligned with the gyration-tensor eigenvectors, scaled by √(5λᵢ)"
      >
        <input
          type="checkbox"
          checked={color.showEllipsoid}
          onChange={(e) => setColor({ showEllipsoid: e.target.checked })}
        />
        Inertia ellipsoid
      </label>
      <label
        className="checkbox-row"
        title="Show known packing densities (sphere FCC, regular tet, RCP, RLP, …) as horizontal lines on the V*/V curve"
      >
        <input
          type="checkbox"
          checked={color.showReferences}
          onChange={(e) => setColor({ showReferences: e.target.checked })}
        />
        Reference densities on plots
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
          step={0.002}
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
