import { useMemo, useState } from 'react';
import { useStore, isAtLeast } from '../lib/store.js';
import { type CurvePoint, type TrialResult, downloadCSV, trialsToCSV } from '../lib/study.js';
import { PACKING_REFERENCES } from '../lib/references.js';
import { type PairCorrelation, type PairCorrelationAniso } from '../lib/paircorr.js';
import { type KineticsResult } from '../lib/kinetics.js';
import { type AutocorrResult } from '../lib/autocorr.js';
import {
  fitAsymptotePower,
  fitExpDecay,
  fitLogLog,
  type AsymptotePowerFit,
  type ExpDecayFit,
  type LogLogFit,
} from '../lib/scaling.js';
import { useWorkerRun } from './useWorkerRun.js';
import { ProgressBar } from './ProgressBar.js';
import { SvgPlot } from './SvgPlot.js';
import { CloseIcon, DownloadIcon, PinIcon } from './icons.js';

type FitModel = 'power' | 'asymptote+power' | 'exp';
type YMetric = 'etaC' | 'etaB';

interface CombinedFit {
  power: LogLogFit | null;
  asym: AsymptotePowerFit | null;
  exp: ExpDecayFit | null;
}

function bestFitModel(f: CombinedFit): FitModel {
  const candidates: { name: FitModel; aic: number }[] = [];
  if (f.power) candidates.push({ name: 'power', aic: f.power.aic });
  if (f.asym) candidates.push({ name: 'asymptote+power', aic: f.asym.aic });
  if (f.exp) candidates.push({ name: 'exp', aic: f.exp.aic });
  candidates.sort((a, b) => a.aic - b.aic);
  return candidates[0]?.name ?? 'power';
}

// Extended past N=50 so the fit models see the η(N) tail (asymptote-vs-power
// is only decidable once the curve has visibly flattened). At trialsPerN=15
// the full sweep stays under ~30 s in the worker.
const DEFAULT_NS = [1, 2, 4, 6, 8, 12, 16, 20, 25, 30, 40, 50, 70, 100, 150, 200];

export function Research() {
  const mode = useStore((s) => s.mode);
  if (!isAtLeast(mode, 'research')) return null;
  return (
    <div className="research">
      <div className="panel-title">Research mode</div>
      <Histogram />
      <Curve />
      <PairCorrelationPlot />
      <KineticsPanel />
      <AutocorrPanel />
      <ReferencesTable />
    </div>
  );
}

interface SavedRun {
  label: string;
  trials: TrialResult[];
}

function statsOf(trials: TrialResult[]) {
  const n = trials.length;
  if (n === 0) return null;
  const effs = trials.map((t) => t.efficiency);
  const mean = effs.reduce((s, x) => s + x, 0) / n;
  // Bessel-corrected sample variance, so SEM = s/√n is unbiased.
  const variance = n > 1 ? effs.reduce((s, x) => s + (x - mean) ** 2, 0) / (n - 1) : NaN;
  const std = Math.sqrt(variance);
  return {
    mean,
    std,
    sem: std / Math.sqrt(n),
    min: Math.min(...effs),
    max: Math.max(...effs),
    n,
  };
}

function paramLabel(growth: {
  N: number;
  strategy: string;
  compactBeta: number;
  chiralityBias: number;
}) {
  const beta = growth.strategy === 'compact' ? ` β=${growth.compactBeta}` : '';
  return `${growth.strategy}${beta} cR=${growth.chiralityBias.toFixed(2)} N=${growth.N}`;
}

function Histogram() {
  const growth = useStore((s) => s.growth);
  const [snapshot, setSnapshot] = useState<SavedRun | null>(null);
  const [count, setCount] = useState(100);
  const [bParams, setBParams] = useState<typeof growth | null>(null);

  const job = useWorkerRun<{ kind: 'study'; trials: TrialResult[] }>();
  // useMemo so downstream `[trials]` deps don't fire on every render.
  const trials = useMemo<TrialResult[]>(() => job.result?.trials ?? [], [job.result]);
  const running = job.running;
  const err = job.err;
  const progress = job.progress;
  const run = () => {
    const params = { ...growth };
    setBParams(params);
    job.run({
      kind: 'study',
      params: {
        N: params.N,
        trials: count,
        startSeed: params.seed,
        chiralityBias: params.chiralityBias,
        strategy: params.strategy,
        compactBeta: params.compactBeta,
      },
    });
  };

  const stats = useMemo(() => statsOf(trials), [trials]);
  const snapStats = useMemo(() => (snapshot ? statsOf(snapshot.trials) : null), [snapshot]);

  const histo = useMemo(
    () =>
      buildOverlayHistogram(
        trials.map((t) => t.efficiency),
        snapshot ? snapshot.trials.map((t) => t.efficiency) : null,
        20
      ),
    [trials, snapshot]
  );

  // Label the current B series with the params used at run() time, not the
  // current sidebar values - prevents the displayed legend from drifting if
  // the user changes parameters after kicking off a study.
  const currentLabel = paramLabel(bParams ?? growth);
  const exportParams = bParams ?? growth;

  return (
    <details className="research-section collapsible" open>
      <summary className="research-title">Efficiency histogram (N={growth.N})</summary>
      <div className="research-row">
        <label>
          Trials:&nbsp;
          <input
            type="number"
            value={count}
            min={10}
            max={10000}
            step={10}
            onChange={(e) => setCount(parseInt(e.target.value, 10) || 100)}
            style={{ width: '5rem' }}
            title="Number of independent trials at the current N. Runs on a Web Worker so the UI stays responsive."
          />
        </label>
        <button onClick={run} disabled={running}>
          {running ? 'Running…' : 'Run study'}
        </button>
        {running && <button onClick={job.cancel}>cancel</button>}
        {trials.length > 0 && (
          <button
            onClick={() => setSnapshot({ label: currentLabel, trials: [...trials] })}
            title="Save the current trials as 'A' so the next run overlays as 'B' for comparison."
          >
            <PinIcon /> Pin as A
          </button>
        )}
        {snapshot && (
          <button
            onClick={() => setSnapshot(null)}
            title="Clear the saved comparison run"
            aria-label="Clear comparison A"
          >
            <CloseIcon />
          </button>
        )}
        {trials.length > 0 && (
          <button
            onClick={() =>
              downloadCSV(
                trialsToCSV(trials, {
                  studyParams: {
                    N: exportParams.N,
                    chiralityBias: exportParams.chiralityBias,
                    strategy: exportParams.strategy,
                    compactBeta: exportParams.compactBeta,
                    startSeed: exportParams.seed,
                  },
                }),
                `plancktons_trials_N${exportParams.N}_${exportParams.strategy}.csv`
              )
            }
          >
            <DownloadIcon /> CSV
          </button>
        )}
      </div>
      {stats && (
        <div className="stats-line">
          <span style={{ color: '#5fa8e3' }}>B ({currentLabel})</span>: μ={stats.mean.toFixed(3)} ±{' '}
          {stats.sem.toFixed(4)} (SEM) · σ={stats.std.toFixed(3)} · n={stats.n}
        </div>
      )}
      {snapStats && (
        <div className="stats-line">
          <span style={{ color: '#e7a44a' }}>A (saved: {snapshot!.label})</span>: μ=
          {snapStats.mean.toFixed(3)} ± {snapStats.sem.toFixed(4)} · σ={snapStats.std.toFixed(3)} ·
          n={snapStats.n}
        </div>
      )}
      {progress && running && (
        <ProgressBar done={progress.done} total={progress.total} label="trials" />
      )}
      {err && <div className="error-line">⚠ {err}</div>}
      {histo && <HistogramBars histo={histo} />}
    </details>
  );
}

function Curve() {
  const growth = useStore((s) => s.growth);
  const [trialsPerN, setTrialsPerN] = useState(15);
  const [logLog, setLogLog] = useState(false);
  const [showFit, setShowFit] = useState(true);
  const [showSpread, setShowSpread] = useState(false);
  const [yMetric, setYMetric] = useState<YMetric>('etaC');

  const job = useWorkerRun<{ kind: 'curve'; points: CurvePoint[] }>();
  const points = useMemo<CurvePoint[]>(() => job.result?.points ?? [], [job.result]);
  const [snapshot, setSnapshot] = useState<{ label: string; points: CurvePoint[] } | null>(null);
  const running = job.running;
  const err = job.err;
  const progress = job.progress;
  const run = () =>
    job.run({
      kind: 'curve',
      Ns: DEFAULT_NS,
      trialsPerN,
      startSeed: growth.seed,
      chiralityBias: growth.chiralityBias,
      strategy: growth.strategy,
      compactBeta: growth.compactBeta,
    });

  // Three candidate models on (1 − η) vs N; AIC picks the best.
  const fits = useMemo<CombinedFit>(() => {
    if (points.length < 4) return { power: null, asym: null, exp: null };
    const usable = points.filter((p) => Number.isFinite(p.meanEff) && p.meanEff < 1);
    const xs = usable.map((p) => p.N);
    const ys = usable.map((p) => Math.max(1e-9, 1 - p.meanEff));
    return {
      power: fitLogLog(xs, ys),
      asym: fitAsymptotePower(xs, ys),
      exp: fitExpDecay(xs, ys),
    };
  }, [points]);

  // Fractal dimension from R_g ~ N^(1/D_f).
  const rgFit = useMemo<LogLogFit | null>(() => {
    if (points.length < 3) return null;
    return fitLogLog(
      points.map((p) => p.N),
      points.map((p) => p.meanRg)
    );
  }, [points]);
  const fractalDim = rgFit && rgFit.alpha > 0 ? 1 / rgFit.alpha : null;
  const fractalDimErr =
    rgFit && rgFit.alpha > 0 ? rgFit.alphaErr / (rgFit.alpha * rgFit.alpha) : null;

  // Surface roughness exponent α from S(N) ~ N^α. For compact 3D growth
  // (every tet contributes a fixed bulk volume), α = 2/3 by surface-to-
  // volume scaling. α > 2/3 indicates fractal / branchy growth where each
  // tet exposes more surface than the bulk ratio would predict.
  const surfaceFit = useMemo<LogLogFit | null>(() => {
    if (points.length < 3) return null;
    return fitLogLog(
      points.map((p) => p.N),
      points.map((p) => p.meanSurface)
    );
  }, [points]);

  const bestModel = bestFitModel(fits);
  const { power, asym, exp } = fits;

  return (
    <details className="research-section collapsible" open>
      <summary className="research-title">η vs N (current strategy)</summary>
      <div className="research-row">
        <label>
          Trials/N:&nbsp;
          <input
            type="number"
            value={trialsPerN}
            min={3}
            max={1000}
            step={1}
            onChange={(e) => setTrialsPerN(parseInt(e.target.value, 10) || 15)}
            style={{ width: '5rem' }}
            title="Trials per N value in the sweep. Total work is trialsPerN × |Ns|."
          />
        </label>
        <button onClick={run} disabled={running}>
          {running ? 'Running…' : 'Run sweep'}
        </button>
        {running && <button onClick={job.cancel}>cancel</button>}
        {points.length > 0 && (
          <button
            onClick={() => setSnapshot({ label: paramLabel(growth), points: [...points] })}
            title="Save the current sweep as A so the next sweep overlays as B."
          >
            <PinIcon /> Pin as A
          </button>
        )}
        {snapshot && (
          <button
            onClick={() => setSnapshot(null)}
            title="Clear the saved overlay"
            aria-label="Clear sweep A"
          >
            <CloseIcon />
          </button>
        )}
      </div>
      {snapshot && (
        <div className="stats-line">
          <span style={{ color: '#e7a44a' }}>A: {snapshot.label}</span>
          {points.length > 0 && (
            <>
              {' · '}
              <span style={{ color: '#5fa8e3' }}>B: {paramLabel(growth)}</span>
            </>
          )}
        </div>
      )}
      {progress && running && (
        <ProgressBar done={progress.done} total={progress.total} label="trials" />
      )}
      <div className="research-row">
        <label title="η_C = V*/V_hull (compactness, NOT a real packing density) vs η_B = V*/V_bbox (literature-comparable).">
          y:&nbsp;
          <select value={yMetric} onChange={(e) => setYMetric(e.target.value as YMetric)}>
            <option value="etaC">η_C (hull)</option>
            <option value="etaB">η_B (bbox)</option>
          </select>
        </label>
        <label className="checkbox-row" style={{ padding: 0 }}>
          <input type="checkbox" checked={logLog} onChange={(e) => setLogLog(e.target.checked)} />
          log–log
        </label>
        <label className="checkbox-row" style={{ padding: 0 }}>
          <input type="checkbox" checked={showFit} onChange={(e) => setShowFit(e.target.checked)} />
          fit
        </label>
        <label
          className="checkbox-row"
          style={{ padding: 0 }}
          title="Band = ±SEM (uncertainty in the sample mean) when unchecked, ±σ (spread of individual trials) when checked."
        >
          <input
            type="checkbox"
            checked={showSpread}
            onChange={(e) => setShowSpread(e.target.checked)}
          />
          ±σ instead of ±SEM
        </label>
      </div>
      {err && <div className="error-line">⚠ {err}</div>}
      {points.length > 0 && (
        <CurvePlot
          points={points}
          snapshotPoints={snapshot?.points ?? null}
          logLog={logLog}
          showFit={showFit}
          showSpread={showSpread}
          yMetric={yMetric}
          fits={fits}
          bestModel={bestModel}
        />
      )}
      {showFit && logLog && points.length > 0 && yMetric === 'etaC' && (
        <div className="stats-block">
          <div className="stats-line">
            Model selection by AIC (lower = better, Δ &gt; 2 is meaningful):
          </div>
          {power && (
            <div className="stats-line">
              <strong>power</strong> 1−η ≈ A·N<sup>α</sup>: α = {power.alpha.toFixed(3)} ±{' '}
              {power.alphaErr.toFixed(3)} · A = {Math.exp(power.intercept).toFixed(3)} · R² ={' '}
              {power.r2.toFixed(3)} · AIC = {power.aic.toFixed(1)}
              {bestModel === 'power' ? ' ← best' : ''}
            </div>
          )}
          {asym && (
            <div className="stats-line">
              <strong>asym+power</strong> 1−η ≈ y∞ + B·N<sup>−β</sup>: y∞ = {asym.yInf.toFixed(3)} ·
              B = {asym.B.toFixed(3)} · β = {asym.beta.toFixed(3)} · R² = {asym.r2.toFixed(3)} · AIC
              = {asym.aic.toFixed(1)}
              {bestModel === 'asymptote+power' ? ' ← best' : ''}
            </div>
          )}
          {exp && (
            <div className="stats-line">
              <strong>exp</strong> 1−η ≈ y∞ + B·exp(−N/N₀): y∞ = {exp.yInf.toFixed(3)} · B ={' '}
              {exp.B.toFixed(3)} · N₀ = {exp.N0.toFixed(1)} · R² = {exp.r2.toFixed(3)} · AIC ={' '}
              {exp.aic.toFixed(1)}
              {bestModel === 'exp' ? ' ← best' : ''}
            </div>
          )}
        </div>
      )}
      {surfaceFit && points.length > 0 && (
        <div
          className="stats-line"
          title="From S(N) ~ N^α. α = 2/3 = compact 3D growth (every tet adds the same bulk volume to surface area). α > 2/3 = fractal / branchy growth where new tets expose more surface than the bulk scaling predicts."
        >
          Surface exponent α = {surfaceFit.alpha.toFixed(3)} ± {surfaceFit.alphaErr.toFixed(3)} (R²
          = {surfaceFit.r2.toFixed(3)})
          {Math.abs(surfaceFit.alpha - 2 / 3) < 0.05
            ? ' — compact 3D'
            : surfaceFit.alpha > 2 / 3
              ? ' — fractal / branchy'
              : ' — sub-bulk (rounded surface)'}
        </div>
      )}
      {fractalDim && points.length > 0 && (
        <div
          className="stats-line"
          title="From R_g ~ N^(1/D_f). D_f → 3 for compact 3D; lower values indicate fractal / surface-dominated growth."
        >
          Fractal dimension D_f = {fractalDim.toFixed(2)} ±{' '}
          {fractalDimErr ? fractalDimErr.toFixed(2) : '?'} (R² = {rgFit?.r2.toFixed(3)})
        </div>
      )}
      {points.length > 0 && (
        <table className="curve-table">
          <thead>
            <tr>
              <th>N</th>
              <th>η_C</th>
              <th>SEM</th>
              <th>η_B</th>
              <th>⟨z⟩</th>
              <th>reached</th>
            </tr>
          </thead>
          <tbody>
            {points.map((p) => (
              <tr key={p.N}>
                <td>{p.N}</td>
                <td>{p.meanEff.toFixed(3)}</td>
                <td>{p.semEff.toFixed(3)}</td>
                <td>{p.meanBboxEff.toFixed(3)}</td>
                <td>{p.meanZ.toFixed(2)}</td>
                <td>{p.nReached}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </details>
  );
}

// ---------------------------------------------------------------------------
// Inline SVG plots (no external chart lib)
// ---------------------------------------------------------------------------

interface OverlayHisto {
  binsA: number[] | null;
  binsB: number[];
  edges: number[];
  totalA: number;
  totalB: number;
}

function bin(values: ReadonlyArray<number>, edges: ReadonlyArray<number>): number[] {
  const nBins = edges.length - 1;
  const out = new Array(nBins).fill(0);
  const min = edges[0] as number;
  const max = edges[edges.length - 1] as number;
  for (const v of values) {
    if (v < min || v > max) continue;
    const idx = Math.min(nBins - 1, Math.floor(((v - min) / (max - min || 1)) * nBins));
    out[idx]++;
  }
  return out;
}

function buildOverlayHistogram(
  bValues: ReadonlyArray<number>,
  aValues: ReadonlyArray<number> | null,
  nBins: number
): OverlayHisto | null {
  if (bValues.length === 0 && (!aValues || aValues.length === 0)) return null;
  const all = aValues ? [...bValues, ...aValues] : [...bValues];
  const min = Math.min(...all);
  const max = Math.max(...all);
  const span = max - min < 1e-9 ? 1e-9 : max - min;
  const edges: number[] = [];
  for (let i = 0; i <= nBins; i++) edges.push(min + (span * i) / nBins);
  return {
    binsA: aValues ? bin(aValues, edges) : null,
    binsB: bin(bValues, edges),
    edges,
    totalA: aValues?.length ?? 0,
    totalB: bValues.length,
  };
}

function HistogramBars({ histo }: { histo: OverlayHisto }) {
  const W = 380;
  const H = 140;
  const pad = { l: 4, r: 4, t: 6, b: 22 };
  const nBins = histo.binsB.length;
  const innerW = W - pad.l - pad.r;
  const innerH = H - pad.t - pad.b;
  // Per-series fractions, so distributions are comparable when trial counts
  // differ. maxFrac is the max across both normalised series, not raw counts.
  const normB = histo.totalB > 0 ? 1 / histo.totalB : 0;
  const normA = histo.totalA > 0 ? 1 / histo.totalA : 0;
  let maxFrac = 1e-9;
  for (const c of histo.binsB) if (c * normB > maxFrac) maxFrac = c * normB;
  if (histo.binsA) for (const c of histo.binsA) if (c * normA > maxFrac) maxFrac = c * normA;
  return (
    <SvgPlot width={W} height={H} filename="plancktons_histogram">
      <rect x={0} y={0} width={W} height={H} fill="#222831" />
      {histo.binsB.map((c, i) => {
        const x = pad.l + (i / nBins) * innerW;
        const w = innerW / nBins - 0.5;
        const h = ((c * normB) / maxFrac) * innerH;
        return (
          <rect
            key={`b${i}`}
            x={x}
            y={pad.t + innerH - h}
            width={w}
            height={h}
            fill="#5fa8e3"
            fillOpacity={histo.binsA ? 0.6 : 0.9}
          />
        );
      })}
      {histo.binsA &&
        histo.binsA.map((c, i) => {
          const x = pad.l + (i / nBins) * innerW;
          const w = innerW / nBins - 0.5;
          const h = ((c * normA) / maxFrac) * innerH;
          return (
            <rect
              key={`a${i}`}
              x={x}
              y={pad.t + innerH - h}
              width={w}
              height={h}
              fill="none"
              stroke="#e7a44a"
              strokeWidth={1.5}
            />
          );
        })}
      <text x={pad.l} y={H - 6} fontSize={10} fill="#999">
        {histo.edges[0]?.toFixed(3)}
      </text>
      <text x={W - pad.r} y={H - 6} fontSize={10} fill="#999" textAnchor="end">
        {histo.edges[histo.edges.length - 1]?.toFixed(3)}
      </text>
      <text x={W / 2} y={H - 6} fontSize={10} fill="#aaa" textAnchor="middle">
        efficiency η
      </text>
    </SvgPlot>
  );
}

function curveMean(p: CurvePoint, m: YMetric): number {
  return m === 'etaC' ? p.meanEff : p.meanBboxEff;
}

function curveSpread(p: CurvePoint, m: YMetric, showSpread: boolean): number {
  let s: number;
  if (m === 'etaC') s = showSpread ? p.stdEff : p.semEff;
  else s = showSpread ? p.stdBboxEff : p.semBboxEff;
  return Number.isFinite(s) ? s : 0;
}

function curveYAxisLabel(m: YMetric, logLog: boolean): string {
  if (logLog) return '1 − η' + (m === 'etaC' ? '_C' : '_B');
  return m === 'etaC' ? 'η_C = V*/V_hull' : 'η_B = V*/V_bbox';
}

function CurvePlot({
  points,
  snapshotPoints,
  logLog,
  showFit,
  showSpread,
  yMetric,
  fits,
  bestModel,
}: {
  points: CurvePoint[];
  snapshotPoints: CurvePoint[] | null;
  logLog: boolean;
  showFit: boolean;
  showSpread: boolean;
  yMetric: YMetric;
  fits: CombinedFit;
  bestModel: FitModel;
}) {
  const showRefs = useStore((s) => s.color.showReferences);
  const W = 380;
  const H = 220;
  const pad = { l: 42, r: 8, t: 12, b: 28 };
  // η_B uses the same denominator as literature references; η_C does not.
  const refsApply = yMetric === 'etaB';
  const meanFor = (p: CurvePoint) => curveMean(p, yMetric);
  const spreadFor = (p: CurvePoint) => curveSpread(p, yMetric, showSpread);
  const filt = points.filter((p) => Number.isFinite(meanFor(p)));
  if (filt.length === 0) return null;
  const maxN = Math.max(...filt.map((p) => p.N));
  const minN = Math.max(1, Math.min(...filt.map((p) => p.N)));
  const refMax = showRefs && refsApply ? Math.max(...PACKING_REFERENCES.map((r) => r.density)) : 0;
  const maxY = Math.min(
    1.05,
    Math.max(0.8, Math.max(...filt.map((p) => meanFor(p) + spreadFor(p)), refMax) * 1.05)
  );
  const minY = logLog
    ? Math.max(1e-3, Math.min(...filt.map((p) => Math.max(1e-9, 1 - meanFor(p) - spreadFor(p)))))
    : 0;

  // In log-log mode, plot (1 - η) on y vs N on x. In linear, plot η.
  // k ∈ {-1, 0, +1} selects the lower / center / upper band edge.
  const yVal = (p: CurvePoint, k = 0) =>
    logLog ? Math.max(1e-9, 1 - meanFor(p) - k * spreadFor(p)) : meanFor(p) + k * spreadFor(p);
  const x = (n: number) =>
    logLog
      ? pad.l +
        ((W - pad.l - pad.r) * (Math.log(n) - Math.log(minN))) /
          (Math.log(maxN) - Math.log(minN) || 1)
      : pad.l + ((W - pad.l - pad.r) * n) / maxN;
  const y = (v: number) =>
    logLog
      ? pad.t +
        ((H - pad.t - pad.b) * (Math.log(maxY) - Math.log(Math.max(v, 1e-9)))) /
          (Math.log(maxY) - Math.log(Math.max(minY, 1e-9)) || 1)
      : pad.t + (H - pad.t - pad.b) * (1 - v / maxY);

  const pathBand: string[] = [];
  filt.forEach((p, i) => pathBand.push(`${i === 0 ? 'M' : 'L'} ${x(p.N)} ${y(yVal(p, -1))}`));
  for (let i = filt.length - 1; i >= 0; i--) {
    pathBand.push(`L ${x(filt[i]!.N)} ${y(yVal(filt[i]!, 1))}`);
  }
  pathBand.push('Z');
  const pathLine = filt.map((p, i) => `${i === 0 ? 'M' : 'L'} ${x(p.N)} ${y(yVal(p))}`).join(' ');
  // Snapshot overlay (saved run A). Same yMetric and log/linear projection.
  const snapFilt = snapshotPoints?.filter((p) => Number.isFinite(meanFor(p))) ?? [];
  const snapLine = snapFilt
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${x(p.N)} ${y(yVal(p))}`)
    .join(' ');

  const yAxisLabel = curveYAxisLabel(yMetric, logLog);
  const xAxisLabel = 'N';
  const yTicks = logLog
    ? [1, 0.5, 0.2, 0.1, 0.05, 0.02, 0.01].filter((t) => t >= minY && t <= maxY)
    : [0, 0.25, 0.5, 0.75, 1].filter((t) => t <= maxY);

  // Fit overlay: only the best-by-AIC model, only on log-log for η_C. Sample
  // the chosen model on 60 x-points spanning [minN, maxN] in log space.
  let fitPath: string | null = null;
  if (showFit && logLog && yMetric === 'etaC') {
    const samples = 60;
    const predict = fitPredictor(bestModel, fits);
    if (predict) {
      const pts: { n: number; v: number }[] = [];
      for (let i = 0; i <= samples; i++) {
        const n = Math.exp(Math.log(minN) + ((Math.log(maxN) - Math.log(minN)) * i) / samples);
        const v = predict(n);
        if (Number.isFinite(v) && v > 0) pts.push({ n, v });
      }
      if (pts.length > 1) {
        fitPath = pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${x(p.n)} ${y(p.v)}`).join(' ');
      }
    }
  }

  return (
    <SvgPlot
      width={W}
      height={H}
      filename={`plancktons_curve_${yMetric}${logLog ? '_loglog' : ''}`}
    >
      <rect x={0} y={0} width={W} height={H} fill="#222831" />
      {yTicks.map((t) => (
        <g key={t}>
          <line
            x1={pad.l}
            y1={y(t)}
            x2={W - pad.r}
            y2={y(t)}
            stroke="#333a44"
            strokeDasharray="2 3"
          />
          <text x={pad.l - 4} y={y(t) + 3} fontSize={9} fill="#999" textAnchor="end">
            {t}
          </text>
        </g>
      ))}
      {!logLog &&
        showRefs &&
        refsApply &&
        PACKING_REFERENCES.filter((r) => r.density <= maxY).map((r, ri) => (
          <g key={r.label}>
            <line
              x1={pad.l}
              y1={y(r.density)}
              x2={W - pad.r}
              y2={y(r.density)}
              stroke={r.color}
              strokeDasharray="3 2"
              strokeOpacity={0.7}
            />
            <text
              x={ri % 2 === 0 ? W - pad.r - 4 : pad.l + 4}
              y={y(r.density) - 2}
              fontSize={8}
              fill={r.color}
              textAnchor={ri % 2 === 0 ? 'end' : 'start'}
            >
              {r.label} {r.density.toFixed(3)}
            </text>
          </g>
        ))}
      <path d={pathBand.join(' ')} fill="#5fa8e3" fillOpacity={0.22} />
      <path d={pathLine} stroke="#5fa8e3" fill="none" strokeWidth={2} />
      {snapLine && (
        <>
          <path d={snapLine} stroke="#e7a44a" fill="none" strokeWidth={2} strokeDasharray="5 3" />
          {snapFilt.map((p) => (
            <circle
              key={`snap-${p.N}`}
              cx={x(p.N)}
              cy={y(yVal(p))}
              r={2.5}
              fill="none"
              stroke="#e7a44a"
              strokeWidth={1.5}
            />
          ))}
        </>
      )}
      {fitPath && (
        <path d={fitPath} stroke="#e7a44a" strokeDasharray="4 3" fill="none" strokeWidth={1.5} />
      )}
      {filt.map((p) => (
        <circle key={p.N} cx={x(p.N)} cy={y(yVal(p))} r={3} fill="#5fa8e3" />
      ))}
      <text
        x={pad.l + (W - pad.l - pad.r) / 2}
        y={H - 6}
        fontSize={10}
        fill="#aaa"
        textAnchor="middle"
      >
        {xAxisLabel}
        {logLog ? ' (log)' : ''}
      </text>
      <text
        x={10}
        y={pad.t + (H - pad.t - pad.b) / 2}
        fontSize={10}
        fill="#aaa"
        textAnchor="middle"
        transform={`rotate(-90 10 ${pad.t + (H - pad.t - pad.b) / 2})`}
      >
        {yAxisLabel}
        {logLog ? ' (log)' : ''}
      </text>
    </SvgPlot>
  );
}

function fitPredictor(model: FitModel, fits: CombinedFit): ((n: number) => number) | null {
  switch (model) {
    case 'power': {
      const f = fits.power;
      return f ? (n) => Math.exp(f.intercept + f.alpha * Math.log(n)) : null;
    }
    case 'asymptote+power': {
      const f = fits.asym;
      return f ? (n) => f.yInf + f.B * Math.pow(n, -f.beta) : null;
    }
    case 'exp': {
      const f = fits.exp;
      return f ? (n) => f.yInf + f.B * Math.exp(-n / f.N0) : null;
    }
  }
}

function PairCorrelationPlot() {
  const growth = useStore((s) => s.growth);
  const [nTrials, setNTrials] = useState(20);
  const [aniso, setAniso] = useState(false);

  const job = useWorkerRun<{
    kind: 'paircorr';
    pc: PairCorrelation | null;
    pcAniso: PairCorrelationAniso | null;
  }>();
  const pc = job.result?.pc ?? null;
  const pcAniso = job.result?.pcAniso ?? null;
  const running = job.running;
  const err = job.err;
  const progress = job.progress;
  const run = () =>
    job.run({
      kind: 'paircorr',
      N: growth.N,
      seed: growth.seed,
      chiralityBias: growth.chiralityBias,
      strategy: growth.strategy,
      compactBeta: growth.compactBeta,
      nTrials,
      aniso,
    });

  return (
    <details className="research-section collapsible">
      <summary
        className="research-title"
        title="g(r) = local density at distance r normalized by bulk density. Random uniform → 1; periodic crystal → sharp peaks; amorphous → broad peaks decaying to 1."
      >
        Pair correlation g(r) (tet centroids)
      </summary>
      <div className="research-row">
        <label>
          Trials:&nbsp;
          <input
            type="number"
            value={nTrials}
            min={1}
            max={500}
            step={1}
            onChange={(e) => setNTrials(parseInt(e.target.value, 10) || 20)}
            style={{ width: '5rem' }}
            title="Average g(r) across this many independent assemblies."
          />
        </label>
        <label
          className="checkbox-row"
          style={{ padding: 0 }}
          title="Also compute gPar / gPerp - g(r) split by angle to the principal gyration axis. Reveals nematic-like ordering invisible to the radial-only g(r)."
        >
          <input type="checkbox" checked={aniso} onChange={(e) => setAniso(e.target.checked)} />
          anisotropic split (g∥ / g⊥)
        </label>
        <button onClick={run} disabled={running}>
          {running ? 'Running…' : `Compute g(r) at N=${growth.N}`}
        </button>
        {running && <button onClick={job.cancel}>cancel</button>}
      </div>
      {progress && running && (
        <ProgressBar done={progress.done} total={progress.total} label="trials" />
      )}
      {err && <div className="error-line">⚠ {err}</div>}
      {pc === null && job.result && !running && (
        <div className="error-line">⚠ No assemblies produced ≥2 tets.</div>
      )}
      {pc && pc.r.length > 0 && <PairCorrPlot pc={pc} aniso={pcAniso} />}
    </details>
  );
}

function PairCorrPlot({ pc, aniso }: { pc: PairCorrelation; aniso: PairCorrelationAniso | null }) {
  const W = 380;
  const H = 180;
  const pad = { l: 38, r: 8, t: 12, b: 28 };
  const innerW = W - pad.l - pad.r;
  const innerH = H - pad.t - pad.b;
  const maxR = pc.r[pc.r.length - 1] as number;
  const maxG = Math.max(2, ...pc.g, ...(aniso?.gPar ?? []), ...(aniso?.gPerp ?? []));
  const x = (r: number) => pad.l + (innerW * r) / maxR;
  const y = (g: number) => pad.t + innerH * (1 - g / maxG);

  const path = (ys: ReadonlyArray<number>) =>
    pc.r.map((r, i) => `${i === 0 ? 'M' : 'L'} ${x(r)} ${y(ys[i] as number)}`).join(' ');

  const gTicks = [0, 1, 2, maxG].filter((t, i, arr) => arr.indexOf(t) === i && t <= maxG);

  return (
    <SvgPlot width={W} height={H} filename={aniso ? 'plancktons_gr_aniso' : 'plancktons_gr'}>
      <rect x={0} y={0} width={W} height={H} fill="#222831" />
      {gTicks.map((t) => (
        <g key={t}>
          <line
            x1={pad.l}
            y1={y(t)}
            x2={W - pad.r}
            y2={y(t)}
            stroke={t === 1 ? '#666' : '#333a44'}
            strokeDasharray={t === 1 ? '4 2' : '2 3'}
          />
          <text x={pad.l - 4} y={y(t) + 3} fontSize={9} fill="#999" textAnchor="end">
            {t.toFixed(t > 5 ? 0 : 1)}
          </text>
        </g>
      ))}
      <path d={path(pc.g)} stroke="#5fa8e3" fill="none" strokeWidth={2} />
      {aniso && (
        <>
          <path
            d={path(aniso.gPar)}
            stroke="#e7a44a"
            fill="none"
            strokeWidth={1.5}
            strokeDasharray="6 3"
          />
          <path
            d={path(aniso.gPerp)}
            stroke="#5cd99b"
            fill="none"
            strokeWidth={1.5}
            strokeDasharray="2 3"
          />
          {/* Legend */}
          <g transform={`translate(${W - pad.r - 100}, ${pad.t + 4})`}>
            <rect x={-2} y={-2} width={102} height={42} fill="#15181c" fillOpacity={0.7} rx={3} />
            <line x1={0} y1={6} x2={14} y2={6} stroke="#5fa8e3" strokeWidth={2} />
            <text x={18} y={9} fontSize={9} fill="#aaa">
              g(r) all
            </text>
            <line
              x1={0}
              y1={20}
              x2={14}
              y2={20}
              stroke="#e7a44a"
              strokeWidth={1.5}
              strokeDasharray="6 3"
            />
            <text x={18} y={23} fontSize={9} fill="#aaa">
              g∥(r) parallel
            </text>
            <line
              x1={0}
              y1={34}
              x2={14}
              y2={34}
              stroke="#5cd99b"
              strokeWidth={1.5}
              strokeDasharray="2 3"
            />
            <text x={18} y={37} fontSize={9} fill="#aaa">
              g⊥(r) perp
            </text>
          </g>
        </>
      )}
      <text x={pad.l + innerW / 2} y={H - 6} fontSize={10} fill="#aaa" textAnchor="middle">
        r / L
      </text>
      <text
        x={10}
        y={pad.t + innerH / 2}
        fontSize={10}
        fill="#aaa"
        textAnchor="middle"
        transform={`rotate(-90 10 ${pad.t + innerH / 2})`}
      >
        g(r)
      </text>
    </SvgPlot>
  );
}

function KineticsPanel() {
  const growth = useStore((s) => s.growth);
  const job = useWorkerRun<{ kind: 'kinetics'; kinetics: KineticsResult }>();
  const result = job.result?.kinetics ?? null;

  function run() {
    job.run({
      kind: 'kinetics',
      growth: {
        L: 1,
        N: growth.N,
        seed: growth.seed,
        chiralityBias: growth.chiralityBias,
        strategy: growth.strategy,
        compactBeta: growth.compactBeta,
      },
    });
  }

  return (
    <details className="research-section collapsible">
      <summary
        className="research-title"
        title="Avrami-KJMA kinetics: η_C(t) = η_∞ · (1 − exp(−K·t^n)). n=1 surface-limited, n=3 bulk-nucleation, n=4 increasing-nucleation."
      >
        Growth kinetics (Avrami)
      </summary>
      <div className="research-row">
        <button onClick={run} disabled={job.running}>
          {job.running ? 'Running…' : `Run to N=${growth.N}`}
        </button>
        {job.running && <button onClick={job.cancel}>cancel</button>}
      </div>
      {job.progress && job.running && (
        <ProgressBar done={job.progress.done} total={job.progress.total} label="growth steps" />
      )}
      {job.err && <div className="error-line">⚠ {job.err}</div>}
      {result && (
        <>
          <KineticsPlot trajectory={result.trajectory} etaInf={result.etaInf} />
          <div className="stats-line">
            η_∞ = {(result.etaInf * 100).toFixed(2)}% (final), trajectory length ={' '}
            {result.trajectory.length}
          </div>
          {result.fit ? (
            <div className="stats-line">
              <strong>
                Avrami exponent n = {result.fit.n.toFixed(2)} ± {result.fit.nErr.toFixed(2)}
              </strong>
              &nbsp;· K = {result.fit.K.toExponential(2)} &nbsp;· R² = {result.fit.r2.toFixed(3)}
              {' · '}
              {result.fit.n < 1.5
                ? 'surface-limited (n ≈ 1)'
                : result.fit.n < 2.5
                  ? '2D growth (n ≈ 2)'
                  : result.fit.n < 3.5
                    ? '3D bulk (n ≈ 3)'
                    : 'increasing-rate nucleation (n ≥ 4)'}
            </div>
          ) : (
            <div className="stats-line" style={{ color: 'var(--text-dim)' }}>
              No Avrami fit (trajectory too short or η never approached η_∞).
            </div>
          )}
        </>
      )}
    </details>
  );
}

function KineticsPlot({
  trajectory,
  etaInf,
}: {
  trajectory: ReadonlyArray<number>;
  etaInf: number;
}) {
  const W = 380;
  const H = 160;
  const pad = { l: 36, r: 8, t: 12, b: 24 };
  const innerW = W - pad.l - pad.r;
  const innerH = H - pad.t - pad.b;
  const maxT = trajectory.length;
  const maxY = Math.max(1, etaInf * 1.05);
  const x = (t: number) => pad.l + (innerW * t) / Math.max(1, maxT - 1);
  const y = (v: number) => pad.t + innerH * (1 - v / maxY);
  const path = trajectory.map((v, t) => `${t === 0 ? 'M' : 'L'} ${x(t)} ${y(v)}`).join(' ');
  const yTicks = [0, 0.25, 0.5, 0.75, 1].filter((t) => t <= maxY);
  return (
    <SvgPlot width={W} height={H} filename="plancktons_kinetics">
      <rect x={0} y={0} width={W} height={H} fill="#222831" />
      {yTicks.map((t) => (
        <g key={t}>
          <line
            x1={pad.l}
            y1={y(t)}
            x2={W - pad.r}
            y2={y(t)}
            stroke="#333a44"
            strokeDasharray="2 3"
          />
          <text x={pad.l - 4} y={y(t) + 3} fontSize={9} fill="#999" textAnchor="end">
            {t}
          </text>
        </g>
      ))}
      <line
        x1={pad.l}
        y1={y(etaInf)}
        x2={W - pad.r}
        y2={y(etaInf)}
        stroke="#e7a44a"
        strokeDasharray="4 2"
        strokeOpacity={0.7}
      />
      <text x={W - pad.r - 4} y={y(etaInf) - 3} fontSize={9} fill="#e7a44a" textAnchor="end">
        η∞ = {etaInf.toFixed(3)}
      </text>
      <path d={path} stroke="#5fa8e3" fill="none" strokeWidth={2} />
      <text x={pad.l + innerW / 2} y={H - 6} fontSize={10} fill="#aaa" textAnchor="middle">
        growth step
      </text>
      <text
        x={10}
        y={pad.t + innerH / 2}
        fontSize={10}
        fill="#aaa"
        textAnchor="middle"
        transform={`rotate(-90 10 ${pad.t + innerH / 2})`}
      >
        η_C
      </text>
    </SvgPlot>
  );
}

function AutocorrPanel() {
  const growth = useStore((s) => s.growth);
  const job = useWorkerRun<{ kind: 'autocorr'; autocorr: AutocorrResult | null }>();
  const result = job.result?.autocorr ?? null;

  function run() {
    job.run({
      kind: 'autocorr',
      growth: {
        L: 1,
        N: growth.N,
        seed: growth.seed,
        chiralityBias: growth.chiralityBias,
        strategy: growth.strategy,
        compactBeta: growth.compactBeta,
      },
      voxelSize: 1 / 10,
      samples: 200_000,
      nBins: 60,
      autocorrSeed: growth.seed,
    });
  }

  return (
    <details className="research-section collapsible">
      <summary
        className="research-title"
        title="S₂(r) = P(two random points distance r apart are both inside the aggregate). S₂(0) = φ (volume fraction); S₂(∞) = φ² (statistically independent). The drop from φ to φ² happens at the correlation length — typical feature size of the cluster."
      >
        Two-point autocorrelation S₂(r)
      </summary>
      <div className="research-row">
        <button onClick={run} disabled={job.running}>
          {job.running ? 'Computing…' : `Compute S₂(r) at N=${growth.N}`}
        </button>
        {job.running && <button onClick={job.cancel}>cancel</button>}
      </div>
      {job.err && <div className="error-line">⚠ {job.err}</div>}
      {result && (
        <>
          <AutocorrPlot result={result} />
          <div className="stats-line">
            φ = {result.phi.toFixed(4)} &nbsp;·&nbsp; φ² = {result.phi2.toFixed(4)}
            &nbsp;·&nbsp; voxel = {result.voxelSize.toFixed(3)} L
          </div>
        </>
      )}
    </details>
  );
}

function AutocorrPlot({ result }: { result: AutocorrResult }) {
  const W = 380;
  const H = 160;
  const pad = { l: 38, r: 8, t: 12, b: 24 };
  const innerW = W - pad.l - pad.r;
  const innerH = H - pad.t - pad.b;
  const maxR = result.r[result.r.length - 1] ?? 1;
  const maxY = Math.max(result.phi, ...result.s2.filter((v) => Number.isFinite(v))) * 1.1 || 1;
  const x = (r: number) => pad.l + (innerW * r) / maxR;
  const y = (v: number) => pad.t + innerH * (1 - v / maxY);
  const path = result.r
    .map((r, i) => {
      const v = result.s2[i];
      return Number.isFinite(v) ? `${i === 0 ? 'M' : 'L'} ${x(r)} ${y(v!)}` : '';
    })
    .filter(Boolean)
    .join(' ');
  return (
    <SvgPlot width={W} height={H} filename="plancktons_s2">
      <rect x={0} y={0} width={W} height={H} fill="#222831" />
      {/* φ reference line. */}
      <line
        x1={pad.l}
        y1={y(result.phi)}
        x2={W - pad.r}
        y2={y(result.phi)}
        stroke="#e7a44a"
        strokeDasharray="4 2"
        strokeOpacity={0.7}
      />
      <text x={W - pad.r - 4} y={y(result.phi) - 3} fontSize={9} fill="#e7a44a" textAnchor="end">
        φ = {result.phi.toFixed(3)}
      </text>
      {/* φ² asymptote. */}
      <line
        x1={pad.l}
        y1={y(result.phi2)}
        x2={W - pad.r}
        y2={y(result.phi2)}
        stroke="#5cd99b"
        strokeDasharray="2 3"
        strokeOpacity={0.7}
      />
      <text x={pad.l + 4} y={y(result.phi2) - 3} fontSize={9} fill="#5cd99b">
        φ² = {result.phi2.toFixed(4)}
      </text>
      <path d={path} stroke="#5fa8e3" fill="none" strokeWidth={2} />
      <text x={pad.l + innerW / 2} y={H - 6} fontSize={10} fill="#aaa" textAnchor="middle">
        r / L
      </text>
      <text
        x={10}
        y={pad.t + innerH / 2}
        fontSize={10}
        fill="#aaa"
        textAnchor="middle"
        transform={`rotate(-90 10 ${pad.t + innerH / 2})`}
      >
        S₂(r)
      </text>
    </SvgPlot>
  );
}

function ReferencesTable() {
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
