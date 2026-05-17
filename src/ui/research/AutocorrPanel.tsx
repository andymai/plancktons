import { useStore } from '../../lib/store.js';
import { type AutocorrResult } from '../../lib/autocorr.js';
import { useWorkerRun } from '../useWorkerRun.js';
import { SvgPlot } from '../SvgPlot.js';

export function AutocorrPanel() {
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
