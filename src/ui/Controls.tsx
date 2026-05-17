import { useState } from 'react';
import { useStore, isAtLeast } from '../lib/store.js';
import type { GrowthParams, SceneId } from '../lib/store.js';
import { DraftSlider } from './DraftSlider.js';
import { useDraftValue } from './useDraftValue.js';
import { useWorkerRun } from './useWorkerRun.js';
import { ProgressBar } from './ProgressBar.js';
import { Term } from './Term.js';
import { useRadioGroup } from './useRadioGroup.js';
import type { MorphologyResult } from '../lib/morphology.js';
import type { VoronoiResult } from '../lib/voronoi.js';
import type { McRefineResult } from '../lib/mcRefine.js';
import type { GrowthJob } from '../worker/study.worker.js';

function growthJob(g: GrowthParams): GrowthJob {
  return {
    L: 1,
    N: g.N,
    seed: g.seed,
    chiralityBias: g.chiralityBias,
    strategy: g.strategy,
    compactBeta: g.compactBeta,
  };
}

const SCENES = [
  {
    id: 'single' as const,
    label: 'Single Planckton',
    tip: 'One Hill orthoscheme - inspect its edges, faces, and rational-π dihedral angles.',
  },
  {
    id: 'cube' as const,
    label: 'Cube tiling (6 pieces)',
    tip: 'Six Plancktons (3 R + 3 L) tile a unit cube exactly. The η = 1 reference case.',
  },
  {
    id: 'reptile' as const,
    label: '8-reptile dissection',
    tip: 'Matoušek-Safernová m³ self-similar dissection: every Planckton splits into 8 copies of itself.',
  },
  {
    id: 'growth' as const,
    label: 'Random face-to-face growth',
    tip: 'Face-restricted cluster aggregation (Eden-like growth on the face graph) with SAT overlap rejection. Not standard RSA (no spatial randomness) and not DLA (no diffusion). Aggregate density study this app is built around.',
  },
];

const SCENE_IDS = SCENES.map((s) => s.id) as readonly SceneId[];

export function Controls() {
  const scene = useStore((s) => s.scene);
  const setScene = useStore((s) => s.setScene);
  const mode = useStore((s) => s.mode);
  const getSceneRadioProps = useRadioGroup(SCENE_IDS, scene, setScene);
  return (
    <div className="controls">
      <div className="panel-header">
        <span className="panel-title">Scene</span>
      </div>
      <div className="scene-list" role="radiogroup" aria-label="Scene">
        {SCENES.map((s, i) => (
          <button
            key={s.id}
            type="button"
            role="radio"
            aria-checked={scene === s.id}
            className={`scene-button ${scene === s.id ? 'active' : ''}`}
            onClick={() => setScene(s.id)}
            title={`${s.tip}  (Keyboard: ${i + 1})`}
            {...getSceneRadioProps(s.id)}
          >
            {s.label}
          </button>
        ))}
      </div>
      <div className="panel-divider" />
      <SceneControls />
      {isAtLeast(mode, 'explore') && (
        <>
          <div className="panel-divider" />
          <DisplayControls />
        </>
      )}
      {isAtLeast(mode, 'research') && (
        <>
          <div className="panel-divider" />
          <AnalysesControls />
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
            <td>cycle mode (learn / explore / research)</td>
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

const CHIRALITY_IDS = ['R', 'L'] as const;

function SingleControls() {
  const chir = useStore((s) => s.singleChirality);
  const set = useStore((s) => s.setSingleChirality);
  const showAngles = useStore((s) => s.singleShowAngles);
  const setShowAngles = useStore((s) => s.setSingleShowAngles);
  const getRadioProps = useRadioGroup(CHIRALITY_IDS, chir, set);
  return (
    <div>
      <div className="panel-title">Chirality</div>
      <div className="chirality-toggle" role="radiogroup" aria-label="Chirality">
        <button
          type="button"
          role="radio"
          aria-checked={chir === 'R'}
          className={`chir-btn ${chir === 'R' ? 'active' : ''}`}
          onClick={() => set('R')}
          {...getRadioProps('R')}
        >
          Right (red)
        </button>
        <button
          type="button"
          role="radio"
          aria-checked={chir === 'L'}
          className={`chir-btn ${chir === 'L' ? 'active' : ''}`}
          onClick={() => set('L')}
          {...getRadioProps('L')}
        >
          Left (white)
        </button>
      </div>
      <label
        className="checkbox-row"
        title="Float text labels at each edge midpoint showing the dihedral angle in rational-π form (π/2, π/3, π/4). Visual proof that the Dehn invariant collapses to zero."
      >
        <input
          type="checkbox"
          checked={showAngles}
          onChange={(e) => setShowAngles(e.target.checked)}
        />
        Show dihedral angles
      </label>
      <p className="caption">
        A <Term name="planckton" /> (<Term name="hillT1" /> orthoscheme). Four faces, two shapes:
        isoceles-right (1, 1, √2) and scalene-right (1, √2, √3). The two{' '}
        <Term name="chirality">chiralities</Term> are mirror images. All 6 dihedral angles are
        rational multiples of π — the <Term name="dehnInvariant" /> property.
      </p>
    </div>
  );
}

function CubeControls() {
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

function ReptileControls() {
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

function GrowthControls() {
  const growth = useStore((s) => s.growth);
  const setGrowth = useStore((s) => s.setGrowth);
  const animationMode = useStore((s) => s.animationMode);
  const setAnimationMode = useStore((s) => s.setAnimationMode);
  const animSpeed = useStore((s) => s.animSpeed);
  const setAnimSpeed = useStore((s) => s.setAnimSpeed);
  const [draftN, setDraftN] = useDraftValue(growth.N);
  const [draftBeta, setDraftBeta] = useDraftValue(growth.compactBeta);
  const [draftChir, setDraftChir] = useDraftValue(growth.chiralityBias);
  return (
    <div>
      <div className="panel-title">Random face-to-face growth</div>
      <label
        className="slider-row"
        title="Target Planckton count. Slider goes to 1000 to cover the asymptotic regime (η flattens near N ≈ 500-1000 for compact β=3). Type for higher; growth is ~3 s/trial at N=400, ~10 s/trial at N=1000."
      >
        <span>Plancktons (N)</span>
        <DraftSlider
          min={1}
          max={1000}
          step={1}
          value={Math.min(1000, growth.N)}
          onCommit={(v) => setGrowth({ N: v })}
          onDraftChange={setDraftN}
        />
        <input
          type="number"
          min={1}
          max={2000}
          step={1}
          value={draftN}
          onChange={(e) => {
            const n = parseInt(e.target.value, 10);
            if (Number.isFinite(n) && n >= 1) setGrowth({ N: n });
          }}
          style={{ width: '4.2rem' }}
          title="Slider tops at 1000; type above for N up to 2000 (slow at extreme N)."
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
            onDraftChange={setDraftBeta}
          />
          <span className="slider-value">{draftBeta.toFixed(1)}</span>
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
          onDraftChange={setDraftChir}
        />
        <span className="slider-value">
          {(draftChir * 100).toFixed(0)} : {((1 - draftChir) * 100).toFixed(0)}
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
        Each step picks a free face at random and glues a fresh <Term name="planckton" /> onto a
        congruent face. SAT-checked rejection guarantees no two Plancktons overlap. Compact mode
        biases toward concave pockets — tighter packings, but also earlier <Term name="jamming" />.
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

function DisplayControls() {
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

function AnalysesControls() {
  const color = useStore((s) => s.color);
  const setColor = useStore((s) => s.setColor);
  return (
    <div>
      <div className="panel-title">Analyses</div>
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
      <MorphologyPanel />
      <VoronoiPanel />
      <McRefinePanel />
    </div>
  );
}

function MorphologyPanel() {
  const scene = useStore((s) => s.scene);
  const growth = useStore((s) => s.growth);
  // Plain controlled state - the compute is button-triggered (worker job),
  // not per-tick, so we don't need DraftSlider's commit-on-release. Using
  // DraftSlider here previously caused a UX bug where the displayed alpha
  // could diverge from the committed alpha if the release mouseup landed
  // outside the input element.
  const [alpha, setAlpha] = useState(0.5);
  const job = useWorkerRun<{ kind: 'morph'; morph: MorphologyResult | null }>();
  const morph = job.result?.morph ?? null;
  // V_morph is only meaningful for the growth aggregate (other scenes are
  // canonical tilings with η_C = 1 by construction).
  if (scene !== 'growth') return null;

  function run() {
    job.run({ kind: 'morph', growth: growthJob(growth), voxelSize: 1 / 12, alpha });
  }

  // Worker returns V_morph but not N, so recompute V* = N·L³/6 here from the
  // current growth.N.
  const Vstar = morph ? growth.N / 6 : 0;
  const etaM = morph && morph.volume > 0 ? Vstar / morph.volume : null;

  return (
    <>
      <div className="panel-divider-small" />
      <div className="panel-title" style={{ marginBottom: 4 }}>
        Morphological hull <Term name="etaM">η_M</Term>
      </div>
      <p className="caption" style={{ margin: '0 0 6px' }}>
        Third packing fraction: η_M = V★/V_morph where V_morph is the closure of the aggregate by a
        ball of radius α. Fills pockets &lt; 2α. Always V★ ≤ V_morph ≤ V_hull ≤ V_bbox.
      </p>
      <label
        className="slider-row"
        title="Probe-sphere radius α (units of L). Larger α fills bigger pockets. α = L is the natural choice for a Hill T₁ orthoscheme."
      >
        <span>α</span>
        <input
          type="range"
          min={0.05}
          max={2}
          step={0.05}
          value={alpha}
          onChange={(e) => setAlpha(parseFloat(e.target.value))}
        />
        <span className="slider-value">{alpha.toFixed(2)} L</span>
      </label>
      <div className="research-row">
        <button onClick={run} disabled={job.running}>
          {job.running ? 'Computing…' : 'Compute V_morph'}
        </button>
        {job.running && <button onClick={job.cancel}>cancel</button>}
      </div>
      {job.err && <div className="error-line">⚠ {job.err}</div>}
      {morph && etaM !== null && (
        <div className="stats-block">
          <div className="stats-line">
            V_morph = {morph.volume.toFixed(3)} L³ &nbsp;·&nbsp;{' '}
            <strong>η_M = {(etaM * 100).toFixed(1)}%</strong>
          </div>
          <div className="stats-line" style={{ color: 'var(--text-dim)' }}>
            grid {morph.dims[0]}×{morph.dims[1]}×{morph.dims[2]} @ {morph.voxelSize.toFixed(3)} L
          </div>
        </div>
      )}
    </>
  );
}

function VoronoiPanel() {
  const scene = useStore((s) => s.scene);
  const growth = useStore((s) => s.growth);
  const job = useWorkerRun<{
    kind: 'voronoi';
    voronoi: VoronoiResult | null;
    etaV: number | null;
  }>();
  const result = job.result ?? null;
  if (scene !== 'growth') return null;

  function run() {
    job.run({ kind: 'voronoi', growth: growthJob(growth), voxelSize: 1 / 8, padL: 1 });
  }

  return (
    <>
      <div className="panel-divider-small" />
      <div className="panel-title" style={{ marginBottom: 4 }}>
        Voronoi packing fraction <Term name="etaV">η_V</Term>
      </div>
      <p className="caption" style={{ margin: '0 0 6px' }}>
        Fourth η: per-tet Voronoi cell volume → η_V = V★/⟨V_voronoi⟩. The literature-standard metric
        for random packings (Scott-Kilgour, Onoda- Liniger). Interior cells only (boundary cells are
        clipped by the container and excluded from the mean).
      </p>
      <div className="research-row">
        <button onClick={run} disabled={job.running}>
          {job.running ? 'Computing…' : 'Compute η_V'}
        </button>
        {job.running && <button onClick={job.cancel}>cancel</button>}
      </div>
      {job.err && <div className="error-line">⚠ {job.err}</div>}
      {result && result.voronoi && (
        <div className="stats-block">
          {result.etaV !== null ? (
            <div className="stats-line">
              <strong>η_V = {(result.etaV * 100).toFixed(1)}%</strong>
              &nbsp;·&nbsp; ⟨V_voronoi⟩ ={' '}
              {(result.voronoi.interiorVolume / result.voronoi.interiorCount).toFixed(3)} L³
              &nbsp;·&nbsp; n_interior = {result.voronoi.interiorCount} /{' '}
              {result.voronoi.volumes.length}
            </div>
          ) : (
            <div className="stats-line" style={{ color: 'var(--text-dim)' }}>
              No interior cells (assembly too small for the container padding). Grow more tets or
              increase padding.
            </div>
          )}
          <div className="stats-line" style={{ color: 'var(--text-dim)' }}>
            grid {result.voronoi.dims[0]}×{result.voronoi.dims[1]}×{result.voronoi.dims[2]} @{' '}
            {result.voronoi.voxelSize.toFixed(3)} L
          </div>
        </div>
      )}
    </>
  );
}

function McRefinePanel() {
  const scene = useStore((s) => s.scene);
  const growth = useStore((s) => s.growth);
  const [steps, setSteps] = useState(100);
  const [temperature, setTemperature] = useState(0.001);
  const job = useWorkerRun<{ kind: 'mc'; mc: McRefineResult }>();
  const mc = job.result?.mc ?? null;
  if (scene !== 'growth') return null;

  function run() {
    job.run({
      kind: 'mc',
      growth: growthJob(growth),
      steps,
      temperature,
      mcSeed: growth.seed + 1,
    });
  }

  return (
    <>
      <div className="panel-divider-small" />
      <div className="panel-title" style={{ marginBottom: 4 }}>
        Metropolis MC refinement
      </div>
      <p className="caption" style={{ margin: '0 0 6px' }}>
        Post-growth relaxation: detach a leaf tet (z=1), re-grow on the trimmed assembly, accept by
        Metropolis on ΔE = −Δη_C. T → 0 = greedy; T ≈ 0.01 = mild thermal noise. Lets η_C climb
        above the RSA jamming line.
      </p>
      <label className="slider-row" title="Number of MC trial moves.">
        <span>Steps</span>
        <input
          type="number"
          value={steps}
          min={1}
          max={5000}
          step={10}
          onChange={(e) => setSteps(parseInt(e.target.value, 10) || 100)}
          style={{ width: '5rem' }}
        />
      </label>
      <label
        className="slider-row"
        title="Temperature in η units. 1e-9 = strict greedy; 0.001 = barely thermal; 0.01 = warm; 0.1 = liquid."
      >
        <span>T</span>
        <input
          type="range"
          min={-9}
          max={-1}
          step={0.5}
          value={Math.log10(Math.max(1e-9, temperature))}
          onChange={(e) => setTemperature(Math.pow(10, parseFloat(e.target.value)))}
        />
        <span className="slider-value">{temperature.toExponential(0)}</span>
      </label>
      <div className="research-row">
        <button onClick={run} disabled={job.running}>
          {job.running ? 'Running…' : 'Run MC refine'}
        </button>
        {job.running && <button onClick={job.cancel}>cancel</button>}
      </div>
      {job.progress && job.running && (
        <ProgressBar done={job.progress.done} total={job.progress.total} label="MC steps" />
      )}
      {job.err && <div className="error-line">⚠ {job.err}</div>}
      {mc && (
        <div className="stats-block">
          <div className="stats-line">
            <strong>
              η_C: {(mc.initialEta * 100).toFixed(2)}% → {(mc.finalEta * 100).toFixed(2)}%
            </strong>
            &nbsp;(Δ = {((mc.finalEta - mc.initialEta) * 100).toFixed(2)} pts)
          </div>
          <div className="stats-line" style={{ color: 'var(--text-dim)' }}>
            accepted: {mc.accepted} / {mc.proposed} proposed
            {mc.proposed > 0 && ` (${((100 * mc.accepted) / mc.proposed).toFixed(0)}% acceptance)`}
            {' · '}
            {mc.proposed === 0
              ? 'no valid leaf moves found'
              : `accept rate = ${((100 * mc.accepted) / steps).toFixed(0)}% of steps`}
          </div>
        </div>
      )}
    </>
  );
}
