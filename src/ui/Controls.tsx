import { useStore } from '../lib/store.js';

const SCENES = [
  { id: 'single' as const, label: 'Single Planckton' },
  { id: 'cube' as const, label: '6-piece cube tiling' },
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
      <div className="panel-title">Scene</div>
      <div className="scene-list">
        {SCENES.map((s) => (
          <button
            key={s.id}
            className={`scene-button ${scene === s.id ? 'active' : ''}`}
            onClick={() => setScene(s.id)}
          >
            {s.label}
          </button>
        ))}
      </div>
      <div className="panel-divider" />
      <SceneControls />
      <div className="panel-divider" />
      <div className="advanced-toggle">
        <label>
          <input
            type="checkbox"
            checked={advanced}
            onChange={(e) => setAdvanced(e.target.checked)}
          />
          Advanced mode
        </label>
      </div>
      {advanced && <AdvancedControls />}
    </div>
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
          Right-handed (red)
        </button>
        <button className={`chir-btn ${chir === 'L' ? 'active' : ''}`} onClick={() => set('L')}>
          Left-handed (white)
        </button>
      </div>
      <p className="caption">
        A Planckton (Hill tetrahedron) is a space-filling tet with two triangle types: an isoceles
        right (1, 1, √2) and a scalene right (1, √2, √3). The mirror image is its chiral twin.
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
        Six Plancktons (3 right + 3 left, one per permutation of (x, y, z)) tile a cube exactly.
        Each occupies L³ / 6 of the cube.
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
        Doubling a Planckton gives 8× the volume — so 8 unit Plancktons tile a 2× Planckton (depth
        1). Recursing gives 64 (depth 2) or 512 (depth 3) sub-Plancktons. This is the m³-reptile
        family Matoušek proved is the only one for tetrahedra.
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
      <div className="panel-title">Random growth</div>
      <label
        className="slider-row"
        title="Target number of Plancktons. Random face-to-face growth typically jams between N≈100 and N≈500 depending on strategy."
      >
        <span>N (target tets)</span>
        <input
          type="range"
          min={1}
          max={500}
          step={1}
          value={growth.N}
          onChange={(e) => setGrowth({ N: parseInt(e.target.value, 10) })}
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
          title="Random seed"
        >
          🎲
        </button>
        <button
          onClick={() => setGrowth({ seed: growth.seed + 1 })}
          title="Increment seed (next deterministic trial)"
        >
          ↺
        </button>
      </label>
      <label className="slider-row">
        <span>Strategy</span>
        <select
          value={growth.strategy}
          onChange={(e) => setGrowth({ strategy: e.target.value as 'uniform' | 'compact' })}
        >
          <option value="uniform">Uniform random face</option>
          <option value="compact">Compact (fill pockets)</option>
        </select>
      </label>
      {growth.strategy === 'compact' && (
        <label
          className="slider-row"
          title="Inverse temperature in p(face) ∝ exp(β·n̂·ĉ). β=0 recovers uniform; β≳15 saturates to greedy 'always fill the deepest pocket'."
        >
          <span>β (compactness)</span>
          <input
            type="range"
            min={0}
            max={20}
            step={0.2}
            value={growth.compactBeta}
            onChange={(e) => setGrowth({ compactBeta: parseFloat(e.target.value) })}
          />
          <span className="slider-value">{growth.compactBeta.toFixed(1)}</span>
        </label>
      )}
      <label className="slider-row">
        <span>Chirality bias</span>
        <input
          type="range"
          min={0}
          max={1}
          step={0.01}
          value={growth.chiralityBias}
          onChange={(e) => setGrowth({ chiralityBias: parseFloat(e.target.value) })}
        />
        <span className="slider-value">R:{(growth.chiralityBias * 100).toFixed(0)}%</span>
      </label>
      <div className="panel-divider-small" />
      <label className="slider-row">
        <span>Animation</span>
        <select
          value={animationMode}
          onChange={(e) => setAnimationMode(e.target.value as 'instant' | 'animated' | 'step')}
        >
          <option value="instant">Instant snap</option>
          <option value="animated">Animated growth</option>
          <option value="step">Step-by-step</option>
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
        Each step picks a random free face of the assembly and attaches a new Planckton (random
        chirality) with a compatible face. The "compact" strategy biases toward concave pockets,
        producing a denser shrink-wrap.
      </p>
    </div>
  );
}

function StepButton() {
  const bumpStep = useStore((s) => s.bumpStep);
  return (
    <div className="slider-row">
      <span>Add tet</span>
      <button
        onClick={bumpStep}
        style={{ flex: 1 }}
        title="Append one Planckton, clamped to the N target"
      >
        +1 Planckton →
      </button>
    </div>
  );
}

function AdvancedControls() {
  const color = useStore((s) => s.color);
  const setColor = useStore((s) => s.setColor);
  return (
    <div>
      <div className="panel-title">Visual</div>
      <label className="slider-row">
        <span>Right (R) color</span>
        <input
          type="color"
          value={color.rightColor}
          onChange={(e) => setColor({ rightColor: e.target.value })}
        />
      </label>
      <label className="slider-row">
        <span>Left (L) color</span>
        <input
          type="color"
          value={color.leftColor}
          onChange={(e) => setColor({ leftColor: e.target.value })}
        />
      </label>
      <label className="slider-row">
        <span>Color mode</span>
        <select
          value={color.colorMode}
          onChange={(e) => setColor({ colorMode: e.target.value as 'chirality' | 'depth' })}
        >
          <option value="chirality">Chirality (red R / white L)</option>
          <option value="depth">Placement order (rainbow)</option>
        </select>
      </label>
      <label className="checkbox-row">
        <input
          type="checkbox"
          checked={color.showHull}
          onChange={(e) => setColor({ showHull: e.target.checked })}
        />
        Show convex hull (vacuum bag)
      </label>
      <label className="checkbox-row">
        <input
          type="checkbox"
          checked={color.showEllipsoid}
          onChange={(e) => setColor({ showEllipsoid: e.target.checked })}
        />
        Show inertia ellipsoid
      </label>
      <label className="checkbox-row">
        <input
          type="checkbox"
          checked={color.showReferences}
          onChange={(e) => setColor({ showReferences: e.target.checked })}
        />
        Reference packing densities on plots
      </label>
      <label className="checkbox-row">
        <input
          type="checkbox"
          checked={color.showEdges}
          onChange={(e) => setColor({ showEdges: e.target.checked })}
        />
        Show edges
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
      <label className="slider-row">
        <span>Tet inset</span>
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
        Tets are mathematically face-sharing (V = N·L³/6 exactly). A small rendered gap avoids
        z-fighting on shared faces; set to 0 to see the true touching configuration.
      </p>
    </div>
  );
}
