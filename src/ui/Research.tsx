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

function Histogram() {
  const growth = useStore((s) => s.growth);
  const [trials, setTrials] = useState<TrialResult[]>([]);
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

  const histo = useMemo(() => buildHistogram(trials.map((t) => t.efficiency), 16), [trials]);
  const stats = useMemo(() => {
    if (trials.length === 0) return null;
    const effs = trials.map((t) => t.efficiency);
    const mean = effs.reduce((s, x) => s + x, 0) / effs.length;
    const variance = effs.reduce((s, x) => s + (x - mean) ** 2, 0) / effs.length;
    return { mean, std: Math.sqrt(variance), min: Math.min(...effs), max: Math.max(...effs) };
  }, [trials]);

  return (
    <div className="research-section">
      <div className="research-title">
        Efficiency histogram (N={growth.N}, current strategy & chirality bias)
      </div>
      <div className="research-row">
        <label>
          Trials:&nbsp;
          <input
            type="number"
            value={count}
            min={10}
            max={2000}
            step={10}
            onChange={(e) => setCount(parseInt(e.target.value, 10) || 100)}
            style={{ width: '5rem' }}
          />
        </label>
        <button onClick={run} disabled={running}>
          {running ? 'Running…' : 'Run study'}
        </button>
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
          mean {stats.mean.toFixed(3)} · std {stats.std.toFixed(3)} · min{' '}
          {stats.min.toFixed(3)} · max {stats.max.toFixed(3)}
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
            max={200}
            step={1}
            onChange={(e) => setTrialsPerN(parseInt(e.target.value, 10) || 15)}
            style={{ width: '5rem' }}
          />
        </label>
        <button onClick={run} disabled={running}>
          {running ? 'Running…' : 'Run sweep'}
        </button>
      </div>
      {err && <div className="error-line">⚠ {err}</div>}
      {points.length > 0 && <CurvePlot points={points} />}
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

interface Histo {
  bins: number[];
  edges: number[]; // length bins.length + 1
}

function buildHistogram(values: ReadonlyArray<number>, nBins: number): Histo | null {
  if (values.length === 0) return null;
  const min = Math.min(...values);
  const max = Math.max(...values);
  if (max - min < 1e-9) return { bins: [values.length], edges: [min, max + 1e-9] };
  const edges: number[] = [];
  for (let i = 0; i <= nBins; i++) edges.push(min + ((max - min) * i) / nBins);
  const bins = new Array(nBins).fill(0);
  for (const v of values) {
    const idx = Math.min(nBins - 1, Math.floor(((v - min) / (max - min)) * nBins));
    bins[idx]++;
  }
  return { bins, edges };
}

function HistogramBars({ histo }: { histo: Histo }) {
  const W = 320;
  const H = 110;
  const maxCount = Math.max(...histo.bins);
  return (
    <svg width={W} height={H} className="plot">
      <rect x={0} y={0} width={W} height={H} fill="#222831" />
      {histo.bins.map((c, i) => {
        const x = (i / histo.bins.length) * W;
        const w = W / histo.bins.length - 1;
        const h = maxCount === 0 ? 0 : (c / maxCount) * (H - 24);
        return (
          <rect
            key={i}
            x={x + 0.5}
            y={H - 18 - h}
            width={w}
            height={h}
            fill="#5fa8e3"
          />
        );
      })}
      <text x={4} y={H - 4} fontSize={10} fill="#999">
        {histo.edges[0]?.toFixed(2)}
      </text>
      <text x={W - 4} y={H - 4} fontSize={10} fill="#999" textAnchor="end">
        {histo.edges[histo.edges.length - 1]?.toFixed(2)}
      </text>
    </svg>
  );
}

function CurvePlot({ points }: { points: CurvePoint[] }) {
  const showRefs = useStore((s) => s.color.showReferences);
  const W = 320;
  const H = 180;
  const pad = { l: 30, r: 6, t: 8, b: 18 };
  const maxN = Math.max(...points.map((p) => p.N));
  const refMax = showRefs ? Math.max(...PACKING_REFERENCES.map((r) => r.density)) : 0;
  const maxEff = Math.min(
    1.05,
    Math.max(0.8, Math.max(...points.map((p) => p.meanEff + p.stdEff), refMax) * 1.05)
  );
  const x = (n: number) => pad.l + ((W - pad.l - pad.r) * n) / maxN;
  const y = (e: number) => pad.t + (H - pad.t - pad.b) * (1 - e / maxEff);
  const pathBand: string[] = [];
  points.forEach((p, i) =>
    pathBand.push(`${i === 0 ? 'M' : 'L'} ${x(p.N)} ${y(p.meanEff + p.stdEff)}`)
  );
  for (let i = points.length - 1; i >= 0; i--) {
    const p = points[i] as CurvePoint;
    pathBand.push(`L ${x(p.N)} ${y(p.meanEff - p.stdEff)}`);
  }
  pathBand.push('Z');
  const pathLine: string[] = points.map(
    (p, i) => `${i === 0 ? 'M' : 'L'} ${x(p.N)} ${y(p.meanEff)}`
  );
  return (
    <svg width={W} height={H} className="plot">
      <rect x={0} y={0} width={W} height={H} fill="#222831" />
      {[0, 0.25, 0.5, 0.75, 1].map((e) =>
        e <= maxEff ? (
          <g key={e}>
            <line
              x1={pad.l}
              y1={y(e)}
              x2={W - pad.r}
              y2={y(e)}
              stroke="#333a44"
              strokeDasharray="2 3"
            />
            <text x={pad.l - 4} y={y(e) + 3} fontSize={9} fill="#999" textAnchor="end">
              {e}
            </text>
          </g>
        ) : null
      )}
      {showRefs &&
        PACKING_REFERENCES.filter((r) => r.density <= maxEff).map((r) => (
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
              x={W - pad.r - 4}
              y={y(r.density) - 2}
              fontSize={8}
              fill={r.color}
              textAnchor="end"
            >
              {r.label} {r.density.toFixed(3)}
            </text>
          </g>
        ))}
      <path d={pathBand.join(' ')} fill="#5fa8e3" fillOpacity={0.25} />
      <path d={pathLine.join(' ')} stroke="#5fa8e3" fill="none" strokeWidth={2} />
      {points.map((p) => (
        <circle key={p.N} cx={x(p.N)} cy={y(p.meanEff)} r={3} fill="#5fa8e3" />
      ))}
      <text x={W - 4} y={H - 4} fontSize={9} fill="#999" textAnchor="end">
        N = {maxN}
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
              <td title={r.note}>{r.citation}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </details>
  );
}
