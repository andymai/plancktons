import { useState } from 'react';
import { useStore } from '../../lib/store.js';
import type { GrowthParams } from '../../lib/store.js';
import type { MorphologyResult } from '../../lib/morphology.js';
import type { VoronoiResult } from '../../lib/voronoi.js';
import type { McRefineResult } from '../../lib/mcRefine.js';
import type { GrowthJob } from '../../worker/study.worker.js';
import { useWorkerRun } from '../useWorkerRun.js';
import { ProgressBar } from '../ProgressBar.js';
import { Term } from '../Term.js';

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

export function AnalysesControls() {
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
