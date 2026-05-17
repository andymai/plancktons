import { useMemo, useState } from 'react';
import { useStore } from '../lib/store.js';
import {
  type CurvePoint,
  type TrialResult,
  downloadCSV,
  runCurve,
  runStudy,
  trialsToCSV,
} from '../lib/study.js';
import { PACKING_REFERENCES } from '../lib/references.js';
import { fitLogLog, type LogLogFit } from '../lib/scaling.js';

const DEFAULT_NS = [1, 2, 4, 6, 8, 12, 16, 20, 25, 30, 40, 50];

export function Research() {
  const advanced = useStore((s) => s.advanced);
  if (!advanced) return null;
  return (
    <div className="research">
      <div className="panel-title">Research mode</div>
      <Histogram />
      <Curve />
      <ReferencesTable />
    </div>
  );
}

interface SavedRun {
  label: string;
  trials: TrialResult[];
}

function statsOf(trials: TrialResult[]) {
  if (trials.length === 0) return null;
  const effs = trials.map((t) => t.efficiency);
  const mean = effs.reduce((s, x) => s + x, 0) / effs.length;
  const variance = effs.reduce((s, x) => s + (x - mean) ** 2, 0) / effs.length;
  const std = Math.sqrt(variance);
  return {
    mean,
    std,
    sem: std / Math.sqrt(effs.length),
    min: Math.min(...effs),
    max: Math.max(...effs),
    n: effs.length,
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
  const [trials, setTrials] = useState<TrialResult[]>([]);
  const [snapshot, setSnapshot] = useState<SavedRun | null>(null);
  const [count, setCount] = useState(100);
  const [running, setRunning] = useState(false);

  const [err, setErr] = useState<string | null>(null);

  function run() {
    setRunning(true);
    setErr(null);
    setTimeout(() => {
      try {
        const t = runStudy({
          N: growth.N,
          trials: count,
          startSeed: growth.seed,
          chiralityBias: growth.chiralityBias,
          strategy: growth.strategy,
          compactBeta: growth.compactBeta,
        });
        setTrials(t);
      } catch (e) {
        setErr(e instanceof Error ? e.message : String(e));
      } finally {
        setRunning(false);
      }
    }, 0);
  }

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

  const currentLabel = paramLabel(growth);

  return (
    <div className="research-section">
      <div className="research-title">Efficiency histogram (N={growth.N})</div>
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
            title="Number of independent trials at the current N. 10000+ trials are fine; main-thread compute will block briefly."
          />
        </label>
        <button onClick={run} disabled={running}>
          {running ? 'Running…' : 'Run study'}
        </button>
        {trials.length > 0 && (
          <button
            onClick={() => setSnapshot({ label: currentLabel, trials: [...trials] })}
            title="Save the current trials as 'A' so the next run overlays as 'B' for comparison."
          >
            📌 Save A
          </button>
        )}
        {snapshot && (
          <button onClick={() => setSnapshot(null)} title="Clear the saved comparison run">
            ✕
          </button>
        )}
        {trials.length > 0 && (
          <button
            onClick={() =>
              downloadCSV(
                trialsToCSV(trials),
                `plancktons_trials_N${growth.N}_${growth.strategy}.csv`
              )
            }
          >
            ⬇ CSV
          </button>
        )}
      </div>
      {stats && (
        <div className="stats-line">
          <span style={{ color: '#5fa8e3' }}>B (current)</span>: μ={stats.mean.toFixed(3)} ±{' '}
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
      {err && <div className="error-line">⚠ {err}</div>}
      {histo && <HistogramBars histo={histo} />}
    </div>
  );
}

function Curve() {
  const growth = useStore((s) => s.growth);
  const [trialsPerN, setTrialsPerN] = useState(15);
  const [points, setPoints] = useState<CurvePoint[]>([]);
  const [running, setRunning] = useState(false);
  const [logLog, setLogLog] = useState(false);
  const [showFit, setShowFit] = useState(true);

  const [err, setErr] = useState<string | null>(null);

  function run() {
    setRunning(true);
    setErr(null);
    setTimeout(() => {
      try {
        const p = runCurve(
          DEFAULT_NS,
          trialsPerN,
          growth.seed,
          growth.chiralityBias,
          growth.strategy,
          growth.compactBeta
        );
        setPoints(p);
      } catch (e) {
        setErr(e instanceof Error ? e.message : String(e));
      } finally {
        setRunning(false);
      }
    }, 0);
  }

  // Power-law fit on (1 − η) vs N: deviation from perfect packing typically
  // decays as a power of N for compact strategies.
  const fit = useMemo<LogLogFit | null>(() => {
    if (points.length < 3) return null;
    const xs = points.map((p) => p.N).filter((_, i) => points[i]!.meanEff < 1);
    const ys = points
      .map((p) => Math.max(1e-9, 1 - p.meanEff))
      .filter((_, i) => points[i]!.meanEff < 1);
    return fitLogLog(xs, ys);
  }, [points]);

  return (
    <div className="research-section">
      <div className="research-title">Efficiency V*/V vs N (current strategy)</div>
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
        <label className="checkbox-row" style={{ padding: 0, marginLeft: 'auto' }}>
          <input type="checkbox" checked={logLog} onChange={(e) => setLogLog(e.target.checked)} />
          log–log
        </label>
        <label className="checkbox-row" style={{ padding: 0 }}>
          <input type="checkbox" checked={showFit} onChange={(e) => setShowFit(e.target.checked)} />
          fit
        </label>
      </div>
      {err && <div className="error-line">⚠ {err}</div>}
      {points.length > 0 && (
        <CurvePlot points={points} logLog={logLog} showFit={showFit} fit={fit} />
      )}
      {fit && showFit && points.length > 0 && (
        <div className="stats-line">
          1 − η ≈ A · N<sup>α</sup> &nbsp;·&nbsp; α = {fit.alpha.toFixed(3)} &nbsp;·&nbsp; A ={' '}
          {Math.exp(fit.intercept).toFixed(3)} &nbsp;·&nbsp; R² = {fit.r2.toFixed(4)} (n=
          {fit.n})
        </div>
      )}
      {points.length > 0 && (
        <table className="curve-table">
          <thead>
            <tr>
              <th>N</th>
              <th>eff</th>
              <th>std</th>
            </tr>
          </thead>
          <tbody>
            {points.map((p) => (
              <tr key={p.N}>
                <td>{p.N}</td>
                <td>{p.meanEff.toFixed(3)}</td>
                <td>{p.stdEff.toFixed(3)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
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
  const maxCount = Math.max(...histo.binsB, ...(histo.binsA ?? [0]));
  const nBins = histo.binsB.length;
  const innerW = W - pad.l - pad.r;
  const innerH = H - pad.t - pad.b;
  // Normalize per-series so distributions are comparable.
  const normB = histo.totalB > 0 ? 1 / histo.totalB : 0;
  const normA = histo.totalA > 0 ? 1 / histo.totalA : 0;
  const maxFrac = Math.max(maxCount * Math.max(normA, normB), 1e-9);
  return (
    <svg width={W} height={H} className="plot">
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
    </svg>
  );
}

function CurvePlot({
  points,
  logLog,
  showFit,
  fit,
}: {
  points: CurvePoint[];
  logLog: boolean;
  showFit: boolean;
  fit: LogLogFit | null;
}) {
  const showRefs = useStore((s) => s.color.showReferences);
  const W = 380;
  const H = 220;
  const pad = { l: 42, r: 8, t: 12, b: 28 };
  const maxN = Math.max(...points.map((p) => p.N));
  const minN = Math.max(1, Math.min(...points.map((p) => p.N)));
  const refMax = showRefs ? Math.max(...PACKING_REFERENCES.map((r) => r.density)) : 0;
  const maxY = Math.min(
    1.05,
    Math.max(0.8, Math.max(...points.map((p) => p.meanEff + p.stdEff), refMax) * 1.05)
  );
  const minY = logLog
    ? Math.max(1e-3, Math.min(...points.map((p) => Math.max(1e-9, 1 - p.meanEff - p.stdEff))))
    : 0;

  // In log-log mode, plot (1 - η) on y vs N on x. In linear, plot η.
  const yVal = (p: CurvePoint, k: 1 | -1 = 1) =>
    logLog ? Math.max(1e-9, 1 - p.meanEff - k * p.stdEff) : p.meanEff + k * p.stdEff;
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
  points.forEach((p, i) => pathBand.push(`${i === 0 ? 'M' : 'L'} ${x(p.N)} ${y(yVal(p, -1))}`));
  for (let i = points.length - 1; i >= 0; i--) {
    pathBand.push(`L ${x(points[i]!.N)} ${y(yVal(points[i]!, 1))}`);
  }
  pathBand.push('Z');
  const pathLine = points
    .map(
      (p, i) =>
        `${i === 0 ? 'M' : 'L'} ${x(p.N)} ${y(logLog ? Math.max(1e-9, 1 - p.meanEff) : p.meanEff)}`
    )
    .join(' ');

  const yAxisLabel = logLog ? '1 − η' : 'η = V*/V';
  const xAxisLabel = 'N';
  const yTicks = logLog
    ? [1, 0.5, 0.2, 0.1, 0.05, 0.02, 0.01].filter((t) => t >= minY && t <= maxY)
    : [0, 0.25, 0.5, 0.75, 1].filter((t) => t <= maxY);

  // Fit overlay: 1 - η = A · N^α
  const fitPath =
    showFit && fit && logLog
      ? `M ${x(minN)} ${y(Math.exp(fit.intercept + fit.alpha * Math.log(minN)))} L ${x(maxN)} ${y(Math.exp(fit.intercept + fit.alpha * Math.log(maxN)))}`
      : null;

  return (
    <svg width={W} height={H} className="plot">
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
      {fitPath && (
        <path d={fitPath} stroke="#e7a44a" strokeDasharray="4 3" fill="none" strokeWidth={1.5} />
      )}
      {points.map((p) => (
        <circle
          key={p.N}
          cx={x(p.N)}
          cy={y(logLog ? Math.max(1e-9, 1 - p.meanEff) : p.meanEff)}
          r={3}
          fill="#5fa8e3"
        />
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
    </svg>
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
