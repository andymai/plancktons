// Multi-trial statistical study utilities.
//
// Runs synchronously (UI may stutter at huge sample counts); for production we'd
// move this into a Web Worker. For ~500 trials at N≤50 this completes in a
// fraction of a second.

import { Rng } from './rng.js';
import { growOne, makeAssembly, partVolumeTotal, freeSurfaceArea } from './assembly.js';
import { computeHull } from './hull.js';
import type { GrowthStrategy } from './assembly.js';

export interface TrialResult {
  trial: number;
  N: number;
  seed: number;
  V: number;
  Vstar: number;
  efficiency: number;
  surface: number;
  ms: number;
}

export interface StudyParams {
  N: number;
  trials: number;
  startSeed: number;
  chiralityBias: number;
  strategy: GrowthStrategy;
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
    });
    while (a.tets.length < p.N && growOne(a)) {
      // empty
    }
    const allV = a.tets.flatMap((tt) => [...tt.verts]);
    const hull = computeHull(allV);
    const ms = performance.now() - t0;
    if (!hull) continue;
    out.push({
      trial: t,
      N: a.tets.length,
      seed,
      V: hull.volume,
      Vstar: partVolumeTotal(a),
      efficiency: partVolumeTotal(a) / hull.volume,
      surface: freeSurfaceArea(a),
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
  strategy: GrowthStrategy
): CurvePoint[] {
  return Ns.map((N) => {
    const trials = runStudy({ N, trials: trialsPerN, startSeed, chiralityBias, strategy });
    const effs = trials.map((t) => t.efficiency);
    const mean = effs.reduce((s, x) => s + x, 0) / effs.length;
    const variance = effs.reduce((s, x) => s + (x - mean) ** 2, 0) / Math.max(1, effs.length);
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
  const header = 'trial,N,seed,V,Vstar,efficiency,surface,ms';
  const rows = trials.map(
    (t) =>
      `${t.trial},${t.N},${t.seed},${t.V},${t.Vstar},${t.efficiency},${t.surface},${t.ms}`
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
