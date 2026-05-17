import { Rng } from './rng.js';
import {
  chiralityCounts,
  growOne,
  makeAssembly,
  meanTetCoordination,
  partVolumeTotal,
  freeSurfaceArea,
  vertexCoordination,
} from './assembly.js';
import { computeHull } from './hull.js';
import { gyrationDescriptors } from './shape.js';
import type { GrowthStrategy } from './assembly.js';
import { provenanceCsvHeader } from './provenance.js';

export interface TrialResult {
  trial: number;
  N: number;
  seed: number;
  V: number;
  Vbbox: number;
  Vstar: number;
  /** η_C = Vstar / V_hull (convex compactness, not comparable to literature packing densities). */
  efficiency: number;
  /** η_B = Vstar / V_bbox (bbox packing fraction, comparable to literature RCP/RLP/FCC). */
  bboxEfficiency: number;
  surface: number;
  rg: number;
  kappaSq: number;
  prolateness: number;
  meanCoord: number;
  maxCoord: number;
  /** Mean tet-tet coordination: average number of face-shared neighbors per tet. 4 in a perfect tiling. */
  meanTetCoord: number;
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
      Vbbox: hull.bbox.volume,
      Vstar,
      efficiency: Vstar / hull.volume,
      bboxEfficiency: hull.bbox.volume > 0 ? Vstar / hull.bbox.volume : NaN,
      surface: freeSurfaceArea(a),
      rg: shape?.rg ?? NaN,
      kappaSq: shape?.kappaSq ?? NaN,
      prolateness: shape?.prolateness ?? NaN,
      meanCoord: coord.meanCoord,
      maxCoord: coord.maxCoord,
      meanTetCoord: meanTetCoordination(a),
      chirR: chir.R,
      ms,
    });
  }
  return out;
}

export interface CurvePoint {
  N: number;
  /** Mean η_C (hull compactness). */
  meanEff: number;
  stdEff: number;
  /** SEM = stdEff / √n. */
  semEff: number;
  /** Mean η_B (bbox packing fraction, comparable to literature). */
  meanBboxEff: number;
  stdBboxEff: number;
  semBboxEff: number;
  /** Mean radius of gyration. Slope of ln(rg) vs ln(N) gives fractal dimension D_f via rg ~ N^(1/D_f). */
  meanRg: number;
  /** Mean tet-tet face coordination ⟨z⟩. */
  meanZ: number;
  meanV: number;
  meanVstar: number;
  nReached: number;
}

function meanStd(xs: number[]): { mean: number; std: number; sem: number } {
  if (xs.length === 0) return { mean: NaN, std: NaN, sem: NaN };
  const m = xs.reduce((s, x) => s + x, 0) / xs.length;
  const v = xs.reduce((s, x) => s + (x - m) ** 2, 0) / xs.length;
  const std = Math.sqrt(v);
  return { mean: m, std, sem: std / Math.sqrt(xs.length) };
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
      return {
        N,
        meanEff: NaN,
        stdEff: NaN,
        semEff: NaN,
        meanBboxEff: NaN,
        stdBboxEff: NaN,
        semBboxEff: NaN,
        meanRg: NaN,
        meanZ: NaN,
        meanV: NaN,
        meanVstar: NaN,
        nReached: 0,
      };
    }
    const eff = meanStd(trials.map((t) => t.efficiency));
    const beff = meanStd(trials.map((t) => t.bboxEfficiency).filter((x) => Number.isFinite(x)));
    const rg = meanStd(trials.map((t) => t.rg).filter((x) => Number.isFinite(x)));
    const z = meanStd(trials.map((t) => t.meanTetCoord));
    return {
      N,
      meanEff: eff.mean,
      stdEff: eff.std,
      semEff: eff.sem,
      meanBboxEff: beff.mean,
      stdBboxEff: beff.std,
      semBboxEff: beff.sem,
      meanRg: rg.mean,
      meanZ: z.mean,
      meanV: trials.reduce((s, t) => s + t.V, 0) / trials.length,
      meanVstar: trials.reduce((s, t) => s + t.Vstar, 0) / trials.length,
      nReached: trials.filter((t) => t.N >= N).length,
    };
  });
}

const CSV_COLUMNS = [
  'trial',
  'N',
  'seed',
  'V',
  'Vbbox',
  'Vstar',
  'efficiency',
  'bboxEfficiency',
  'surface',
  'rg',
  'kappaSq',
  'prolateness',
  'meanCoord',
  'maxCoord',
  'meanTetCoord',
  'chirR',
  'ms',
] as const;

export interface CsvProvenance {
  studyParams?: Partial<StudyParams>;
  note?: string;
}

export function trialsToCSV(trials: ReadonlyArray<TrialResult>, meta?: CsvProvenance): string {
  const header = CSV_COLUMNS.join(',');
  const rows = trials.map((t) => CSV_COLUMNS.map((col) => t[col]).join(','));
  const prov = provenanceCsvHeader({
    n_trials: trials.length,
    ...(meta?.studyParams ?? {}),
    ...(meta?.note ? { note: meta.note } : {}),
  });
  return [prov, header, ...rows].join('\n');
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
