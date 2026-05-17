import { Rng } from './rng.js';
import {
  chiralityCounts,
  growOne,
  makeAssembly,
  partVolumeTotal,
  freeSurfaceArea,
  vertexCoordination,
} from './assembly.js';
import { computeHull } from './hull.js';
import { gyrationDescriptors } from './shape.js';
import type { GrowthStrategy } from './assembly.js';

export interface TrialResult {
  trial: number;
  N: number;
  seed: number;
  V: number;
  Vstar: number;
  efficiency: number;
  surface: number;
  rg: number;
  kappaSq: number;
  prolateness: number;
  meanCoord: number;
  maxCoord: number;
  chirR: number;
  ms: number;
}

export interface StudyParams {
  N: number;
  trials: number;
  startSeed: number;
  chiralityBias: number;
  strategy: GrowthStrategy;
  compactBeta?: number;
}

export function runStudy(p: StudyParams): TrialResult[] {
  const out: TrialResult[] = [];
  for (let t = 0; t < p.trials; t++) {
    const seed = p.startSeed + t * 9973;
    const t0 = performance.now();
    const a = makeAssembly({
      L: 1,
      rng: new Rng(seed),
      chiralityBias: p.chiralityBias,
      strategy: p.strategy,
      ...(p.compactBeta !== undefined ? { compactBeta: p.compactBeta } : {}),
    });
    while (a.tets.length < p.N) {
      if (growOne(a) !== 'grown') break;
    }
    const allV = a.tets.flatMap((tt) => [...tt.verts]);
    const hull = computeHull(allV);
    const ms = performance.now() - t0;
    if (!hull) continue;
    const Vstar = partVolumeTotal(a);
    const shape = gyrationDescriptors(allV);
    const coord = vertexCoordination(a);
    const chir = chiralityCounts(a);
    out.push({
      trial: t,
      N: a.tets.length,
      seed,
      V: hull.volume,
      Vstar,
      efficiency: Vstar / hull.volume,
      surface: freeSurfaceArea(a),
      rg: shape?.rg ?? NaN,
      kappaSq: shape?.kappaSq ?? NaN,
      prolateness: shape?.prolateness ?? NaN,
      meanCoord: coord.meanCoord,
      maxCoord: coord.maxCoord,
      chirR: chir.R,
      ms,
    });
  }
  return out;
}

export interface CurvePoint {
  N: number;
  meanEff: number;
  stdEff: number;
  meanV: number;
  meanVstar: number;
}

export function runCurve(
  Ns: number[],
  trialsPerN: number,
  startSeed: number,
  chiralityBias: number,
  strategy: GrowthStrategy,
  compactBeta?: number
): CurvePoint[] {
  return Ns.map((N) => {
    const trials = runStudy({
      N,
      trials: trialsPerN,
      startSeed,
      chiralityBias,
      strategy,
      ...(compactBeta !== undefined ? { compactBeta } : {}),
    });
    if (trials.length === 0) {
      return { N, meanEff: NaN, stdEff: NaN, meanV: NaN, meanVstar: NaN };
    }
    const effs = trials.map((t) => t.efficiency);
    const mean = effs.reduce((s, x) => s + x, 0) / effs.length;
    const variance = effs.reduce((s, x) => s + (x - mean) ** 2, 0) / effs.length;
    return {
      N,
      meanEff: mean,
      stdEff: Math.sqrt(variance),
      meanV: trials.reduce((s, t) => s + t.V, 0) / trials.length,
      meanVstar: trials.reduce((s, t) => s + t.Vstar, 0) / trials.length,
    };
  });
}

export function trialsToCSV(trials: ReadonlyArray<TrialResult>): string {
  const header =
    'trial,N,seed,V,Vstar,efficiency,surface,rg,kappaSq,prolateness,meanCoord,maxCoord,chirR,ms';
  const rows = trials.map(
    (t) =>
      `${t.trial},${t.N},${t.seed},${t.V},${t.Vstar},${t.efficiency},${t.surface},${t.rg},${t.kappaSq},${t.prolateness},${t.meanCoord},${t.maxCoord},${t.chirR},${t.ms}`
  );
  return [header, ...rows].join('\n');
}

export function downloadCSV(csv: string, filename: string): void {
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
