import { useStore } from '../../lib/store.js';
import { type KineticsResult } from '../../lib/kinetics.js';
import { useWorkerRun } from '../useWorkerRun.js';
import { ProgressBar } from '../ProgressBar.js';
import { SvgPlot } from '../SvgPlot.js';
import { Term } from '../Term.js';

function avramiRegime(n: number): string {
  if (n < 1.5) return 'surface-limited (n ≈ 1)';
  if (n < 2.5) return '2D growth (n ≈ 2)';
  if (n < 3.5) return '3D bulk (n ≈ 3)';
  return 'increasing-rate nucleation (n ≥ 4)';
}

export function KineticsPanel() {
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
      <summary className="research-title">
        Growth kinetics (<Term name="avrami">Avrami</Term>)
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
              {avramiRegime(result.fit.n)}
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
