import { useMemo, useState } from 'react';
import { useStore } from '../../lib/store.js';
import { downloadCSV, trialsToCSV, type TrialResult } from '../../lib/study.js';
import { useWorkerRun } from '../useWorkerRun.js';
import { ProgressBar } from '../ProgressBar.js';
import { SvgPlot } from '../SvgPlot.js';
import { CloseIcon, DownloadIcon, PinIcon } from '../icons.js';
import { paramLabel, statsOf, type SavedRun } from './shared.js';

export function Histogram() {
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
