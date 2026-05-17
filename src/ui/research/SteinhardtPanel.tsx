import { useState } from 'react';
import { useStore } from '../../lib/store.js';
import { useWorkerRun } from '../useWorkerRun.js';
import { ProgressBar } from '../ProgressBar.js';
import { SvgPlot } from '../SvgPlot.js';
import { Term } from '../Term.js';

interface SteinhardtResultPayload {
  kind: 'steinhardt';
  q4PerTrial: number[];
  q6PerTrial: number[];
  q6PerTet: number[];
  contributingTrials: number;
}

export function SteinhardtPanel() {
  const growth = useStore((s) => s.growth);
  const [nTrials, setNTrials] = useState(20);
  const job = useWorkerRun<SteinhardtResultPayload>();
  const result = job.result ?? null;

  function run() {
    job.run({
      kind: 'steinhardt',
      N: growth.N,
      seed: growth.seed,
      chiralityBias: growth.chiralityBias,
      strategy: growth.strategy,
      compactBeta: growth.compactBeta,
      nTrials,
    });
  }

  const q4Stats = result ? meanStd(result.q4PerTrial) : null;
  const q6Stats = result ? meanStd(result.q6PerTrial) : null;

  return (
    <details className="research-section collapsible">
      <summary className="research-title">
        Bond-orientational <Term name="bondOrder">Q_l</Term> ensemble
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
            title="Independent assemblies. Each contributes one ⟨Q_4⟩ and ⟨Q_6⟩."
          />
        </label>
        <button onClick={run} disabled={job.running}>
          {job.running ? 'Running…' : `Run Q_l at N=${growth.N}`}
        </button>
        {job.running && <button onClick={job.cancel}>cancel</button>}
      </div>
      {job.progress && job.running && (
        <ProgressBar done={job.progress.done} total={job.progress.total} label="trials" />
      )}
      {job.err && <div className="error-line">⚠ {job.err}</div>}
      {result && result.contributingTrials === 0 && !job.running && (
        <div className="error-line">⚠ No trials produced any face-shared neighbors.</div>
      )}
      {result && q4Stats && q6Stats && (
        <>
          <div className="stats-line">
            <strong>⟨Q₄⟩</strong> = {q4Stats.mean.toFixed(3)} ± {q4Stats.sem.toFixed(3)} (SEM, n=
            {q4Stats.n})
          </div>
          <div className="stats-line">
            <strong>⟨Q₆⟩</strong> = {q6Stats.mean.toFixed(3)} ± {q6Stats.sem.toFixed(3)} (SEM, n=
            {q6Stats.n}) — random ≈ 0; FCC/HCP ≈ 0.575; BCC ≈ 0.51; glass ≈ 0.40
          </div>
          {result.q6PerTet.length > 0 && <QlHistogram q6PerTet={result.q6PerTet} />}
        </>
      )}
    </details>
  );
}

function meanStd(xs: number[]): { mean: number; std: number; sem: number; n: number } {
  const n = xs.length;
  if (n === 0) return { mean: NaN, std: NaN, sem: NaN, n: 0 };
  const m = xs.reduce((s, x) => s + x, 0) / n;
  if (n === 1) return { mean: m, std: NaN, sem: NaN, n };
  const variance = xs.reduce((s, x) => s + (x - m) ** 2, 0) / (n - 1);
  const std = Math.sqrt(variance);
  return { mean: m, std, sem: std / Math.sqrt(n), n };
}

function QlHistogram({ q6PerTet }: { q6PerTet: number[] }) {
  const W = 380;
  const H = 140;
  const pad = { l: 4, r: 4, t: 6, b: 22 };
  const nBins = 24;
  const min = Math.min(0, ...q6PerTet);
  const max = Math.max(0.7, ...q6PerTet);
  const span = max - min < 1e-9 ? 1e-9 : max - min;
  const bins = new Array(nBins).fill(0);
  for (const v of q6PerTet) {
    const idx = Math.min(nBins - 1, Math.max(0, Math.floor(((v - min) / span) * nBins)));
    bins[idx]++;
  }
  const maxCount = Math.max(1, ...bins);
  const innerW = W - pad.l - pad.r;
  const innerH = H - pad.t - pad.b;
  return (
    <SvgPlot width={W} height={H} filename="plancktons_q6_per_tet">
      <rect x={0} y={0} width={W} height={H} fill="#222831" />
      {bins.map((c, i) => {
        const x = pad.l + (i / nBins) * innerW;
        const w = innerW / nBins - 0.5;
        const h = (c / maxCount) * innerH;
        return (
          <rect
            key={`b${i}`}
            x={x}
            y={pad.t + innerH - h}
            width={w}
            height={h}
            fill="#5fa8e3"
            fillOpacity={0.85}
          />
        );
      })}
      <text x={pad.l} y={H - 6} fontSize={10} fill="#999">
        {min.toFixed(2)}
      </text>
      <text x={W - pad.r} y={H - 6} fontSize={10} fill="#999" textAnchor="end">
        {max.toFixed(2)}
      </text>
      <text x={W / 2} y={H - 6} fontSize={10} fill="#aaa" textAnchor="middle">
        per-tet Q₆ (seed = first trial)
      </text>
    </SvgPlot>
  );
}
