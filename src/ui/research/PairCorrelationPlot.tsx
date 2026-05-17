import { useState } from 'react';
import { useStore } from '../../lib/store.js';
import { type PairCorrelation, type PairCorrelationAniso } from '../../lib/paircorr.js';
import { useWorkerRun } from '../useWorkerRun.js';
import { ProgressBar } from '../ProgressBar.js';
import { SvgPlot } from '../SvgPlot.js';
import { Term } from '../Term.js';

export function PairCorrelationPlot() {
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
      <summary className="research-title">
        <Term name="pairCorrelation">Pair correlation g(r)</Term> (tet centroids)
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
