import { useMemo, useState } from 'react';
import { useStore } from '../../lib/store.js';
import { type CurvePoint } from '../../lib/study.js';
import { PACKING_REFERENCES } from '../../lib/references.js';
import { fitAsymptotePower, fitExpDecay, fitLogLog, type LogLogFit } from '../../lib/scaling.js';
import { useWorkerRun } from '../useWorkerRun.js';
import { ProgressBar } from '../ProgressBar.js';
import { SvgPlot } from '../SvgPlot.js';
import { CloseIcon, PinIcon } from '../icons.js';
import {
  bestFitModel,
  DEFAULT_NS,
  paramLabel,
  type CombinedFit,
  type FitModel,
  type YMetric,
} from './shared.js';

export function Curve() {
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
