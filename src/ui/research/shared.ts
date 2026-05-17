import type { TrialResult } from '../../lib/study.js';
import type { AsymptotePowerFit, ExpDecayFit, LogLogFit } from '../../lib/scaling.js';

export type FitModel = 'power' | 'asymptote+power' | 'exp';
export type YMetric = 'etaC' | 'etaB';

export interface CombinedFit {
  power: LogLogFit | null;
  asym: AsymptotePowerFit | null;
  exp: ExpDecayFit | null;
}

export function bestFitModel(f: CombinedFit): FitModel {
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
export const DEFAULT_NS = [1, 2, 4, 6, 8, 12, 16, 20, 25, 30, 40, 50, 70, 100, 150, 200];

export interface SavedRun {
  label: string;
  trials: TrialResult[];
}

export function statsOf(trials: TrialResult[]) {
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

export function paramLabel(growth: {
  N: number;
  strategy: string;
  compactBeta: number;
  chiralityBias: number;
}) {
  const beta = growth.strategy === 'compact' ? ` β=${growth.compactBeta}` : '';
  return `${growth.strategy}${beta} cR=${growth.chiralityBias.toFixed(2)} N=${growth.N}`;
}
