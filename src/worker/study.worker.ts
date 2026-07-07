// Dedicated Web Worker for batch study runs. Runs the same kernel as the main
// thread (results are bit-identical) and streams progress events back. Bundled
// by Vite via the `new Worker(new URL(...), { type: 'module' })` syntax in
// studyClient.ts.

import {
  runCurve,
  runStudy,
  type CurvePoint,
  type StudyParams,
  type TrialResult,
} from '../lib/study.js';
import {
  pairCorrelation,
  pairCorrelationAniso,
  type PairCorrelation,
  type PairCorrelationAniso,
} from '../lib/paircorr.js';
import { gyrationDescriptors } from '../lib/shape.js';
import { morphologicalHull, type MorphologyResult } from '../lib/morphology.js';
import { etaVFromVoronoi, voronoiCells, type VoronoiResult } from '../lib/voronoi.js';
import { runMcRefine, type McRefineResult } from '../lib/mcRefine.js';
import { growTrajectory, type KineticsResult } from '../lib/kinetics.js';
import { autocorrelationS2, type AutocorrResult } from '../lib/autocorr.js';
import { steinhardtQl, type SteinhardtResult } from '../lib/steinhardt.js';
import { runVacuumSettle, type VacuumParams, type VacuumTrajectory } from '../lib/vacuum.js';
import { Rng } from '../lib/rng.js';
import { growOne, makeAssembly, type GrowthStrategy } from '../lib/assembly.js';
import { SEED_STRIDE } from '../lib/constants.js';
import { computeHull } from '../lib/hull.js';
import { centroid } from '../lib/vec.js';

export type StudyJob =
  | { kind: 'study'; jobId: number; params: StudyParams }
  | {
      kind: 'curve';
      jobId: number;
      Ns: number[];
      trialsPerN: number;
      startSeed: number;
      chiralityBias: number;
      strategy: GrowthStrategy;
      compactBeta?: number;
    }
  | {
      kind: 'paircorr';
      jobId: number;
      N: number;
      seed: number;
      chiralityBias: number;
      strategy: GrowthStrategy;
      compactBeta: number;
      nTrials: number;
      /** If true, also compute the anisotropic split (gPar / gPerp). */
      aniso?: boolean;
    }
  | {
      kind: 'morph';
      jobId: number;
      growth: GrowthJob;
      voxelSize: number;
      alpha: number;
    }
  | {
      kind: 'voronoi';
      jobId: number;
      growth: GrowthJob;
      voxelSize: number;
      padL: number;
    }
  | {
      kind: 'mc';
      jobId: number;
      growth: GrowthJob;
      steps: number;
      temperature: number;
      mcSeed: number;
    }
  | {
      kind: 'kinetics';
      jobId: number;
      growth: GrowthJob;
    }
  | {
      kind: 'autocorr';
      jobId: number;
      growth: GrowthJob;
      voxelSize: number;
      samples: number;
      nBins: number;
      autocorrSeed: number;
    }
  | {
      kind: 'steinhardt';
      jobId: number;
      N: number;
      seed: number;
      chiralityBias: number;
      strategy: GrowthStrategy;
      compactBeta: number;
      nTrials: number;
      /** Histogram bins for ⟨Q_l⟩ across trials. Default 20. */
      nBins?: number;
    }
  | { kind: 'vacuum'; jobId: number; params: VacuumParams };

/**
 * Common growth parameter block. Every analysis job carries this so the
 * worker can build the assembly on its own thread (instead of the main
 * thread blocking for ~10s at N=1000 before the worker even starts).
 */
export interface GrowthJob {
  L: number;
  N: number;
  seed: number;
  chiralityBias: number;
  strategy: GrowthStrategy;
  compactBeta: number;
}

export type StudyMessage =
  | { kind: 'progress'; jobId: number; done: number; total: number }
  | { kind: 'result'; jobId: number; payload: StudyResult }
  | { kind: 'error'; jobId: number; message: string };

export type StudyResult =
  | { kind: 'study'; trials: TrialResult[] }
  | { kind: 'curve'; points: CurvePoint[] }
  | {
      kind: 'paircorr';
      pc: PairCorrelation | null;
      pcAniso: PairCorrelationAniso | null;
    }
  | { kind: 'morph'; morph: MorphologyResult | null }
  | { kind: 'voronoi'; voronoi: VoronoiResult | null; etaV: number | null }
  | { kind: 'mc'; mc: McRefineResult }
  | { kind: 'kinetics'; kinetics: KineticsResult }
  | { kind: 'autocorr'; autocorr: AutocorrResult | null }
  | {
      kind: 'steinhardt';
      /** Per-trial ⟨Q_4⟩ ensemble values (trials with no neighbors omitted). */
      q4PerTrial: number[];
      /** Per-trial ⟨Q_6⟩ ensemble values. */
      q6PerTrial: number[];
      /** Per-tet Q_6 distribution from the representative (first) assembly. */
      q6PerTet: number[];
      /** Trials that produced ≥1 valid contributing tet. */
      contributingTrials: number;
    }
  | { kind: 'vacuum'; trajectory: VacuumTrajectory };

const ctx = self as unknown as DedicatedWorkerGlobalScope;

function postProgress(jobId: number, done: number, total: number): void {
  ctx.postMessage({ kind: 'progress', jobId, done, total } satisfies StudyMessage);
}

function postResult(jobId: number, payload: StudyResult): void {
  ctx.postMessage({ kind: 'result', jobId, payload } satisfies StudyMessage);
}

type JobOf<K extends StudyJob['kind']> = Extract<StudyJob, { kind: K }>;
type ResultOf<K extends StudyJob['kind']> = Extract<StudyResult, { kind: K }>;

type JobHandlers = {
  [K in StudyJob['kind']]: (
    job: JobOf<K>,
    progress: (done: number, total: number) => void
  ) => ResultOf<K>;
};

const handlers: JobHandlers = {
  study: (job, progress) => ({
    kind: 'study',
    trials: runStudy(job.params, { onTrial: progress }),
  }),
  curve: (job, progress) => {
    // Two-level progress collapsed to one bar: total trials across all Ns.
    const totalTrials = job.Ns.length * job.trialsPerN;
    let doneTrials = 0;
    const points = runCurve(
      job.Ns,
      job.trialsPerN,
      job.startSeed,
      job.chiralityBias,
      job.strategy,
      job.compactBeta,
      {
        onTrial: () => {
          doneTrials++;
          progress(doneTrials, totalTrials);
        },
      }
    );
    return { kind: 'curve', points };
  },
  paircorr: (job, progress) => {
    const { pc, pcAniso } = computePairCorrelationEnsemble(job, progress);
    return { kind: 'paircorr', pc, pcAniso };
  },
  morph: (job) => {
    const a = growToTarget(job.growth);
    const morph = morphologicalHull(a.tets, job.growth.L, {
      voxelSize: job.voxelSize,
      alpha: job.alpha,
    });
    return { kind: 'morph', morph };
  },
  voronoi: (job) => {
    const a = growToTarget(job.growth);
    const centroids = a.tets.map((t) => centroid(t.verts[0], t.verts[1], t.verts[2], t.verts[3]));
    const voronoi = voronoiCells(centroids, job.growth.L, {
      voxelSize: job.voxelSize,
      padL: job.padL,
    });
    const etaV = voronoi ? etaVFromVoronoi(voronoi, job.growth.L) : null;
    return { kind: 'voronoi', voronoi, etaV };
  },
  mc: (job, progress) => {
    const initial = growToTarget(job.growth);
    const mc = runMcRefine(
      { initial, steps: job.steps, temperature: job.temperature, seed: job.mcSeed },
      { onStep: progress }
    );
    return { kind: 'mc', mc };
  },
  kinetics: (job, progress) => {
    const kinetics = growTrajectory(
      {
        L: job.growth.L,
        N: job.growth.N,
        seed: job.growth.seed,
        chiralityBias: job.growth.chiralityBias,
        strategy: job.growth.strategy,
        compactBeta: job.growth.compactBeta,
      },
      { onStep: progress }
    );
    return { kind: 'kinetics', kinetics };
  },
  autocorr: (job) => {
    const a = growToTarget(job.growth);
    const autocorr = autocorrelationS2(a.tets, job.growth.L, {
      voxelSize: job.voxelSize,
      samples: job.samples,
      nBins: job.nBins,
      seed: job.autocorrSeed,
    });
    return { kind: 'autocorr', autocorr };
  },
  steinhardt: (job, progress) => {
    const q4PerTrial: number[] = [];
    const q6PerTrial: number[] = [];
    let q6PerTet: number[] = [];
    let contributingTrials = 0;
    for (let t = 0; t < job.nTrials; t++) {
      const seed = job.seed + t * SEED_STRIDE;
      const a = makeAssembly({
        L: 1,
        rng: new Rng(seed),
        chiralityBias: job.chiralityBias,
        strategy: job.strategy,
        compactBeta: job.compactBeta,
      });
      while (a.tets.length < job.N) {
        if (growOne(a) !== 'grown') break;
      }
      const q4: SteinhardtResult = steinhardtQl(a, 4);
      const q6: SteinhardtResult = steinhardtQl(a, 6);
      if (q4.contributing > 0) q4PerTrial.push(q4.ensemble);
      if (q6.contributing > 0) q6PerTrial.push(q6.ensemble);
      if (q4.contributing > 0 || q6.contributing > 0) contributingTrials++;
      if (t === 0) q6PerTet = q6.perTet.filter((v) => Number.isFinite(v));
      progress(t + 1, job.nTrials);
    }
    return { kind: 'steinhardt', q4PerTrial, q6PerTrial, q6PerTet, contributingTrials };
  },
  vacuum: (job, progress) => ({
    kind: 'vacuum',
    trajectory: runVacuumSettle(job.params, { onProgress: progress }),
  }),
};

/** Grow an assembly to the target N inside the worker. Moves all the
 *  multi-second work off the main thread for large N. */
function growToTarget(g: GrowthJob) {
  const a = makeAssembly({
    L: g.L,
    rng: new Rng(g.seed),
    chiralityBias: g.chiralityBias,
    strategy: g.strategy,
    compactBeta: g.compactBeta,
  });
  while (a.tets.length < g.N) {
    if (growOne(a) !== 'grown') break;
  }
  return a;
}

ctx.addEventListener('message', (event: MessageEvent<StudyJob>) => {
  const job = event.data;
  try {
    // `JobHandlers` mapped type enforces a handler per `StudyJob['kind']` at
    // compile time. The defensive `if (!handler)` covers the runtime case
    // where a stale main-thread bundle posts a kind the worker doesn't know
    // (mid-deploy cache miss): without it the promise in useWorkerRun would
    // hang forever in `running=true`.
    const handler = handlers[job.kind] as
      ((j: StudyJob, p: (done: number, total: number) => void) => StudyResult) | undefined;
    if (!handler) {
      throw new Error(`unknown job kind: ${(job as { kind: string }).kind}`);
    }
    const result = handler(job, (done, total) => postProgress(job.jobId, done, total));
    postResult(job.jobId, result);
  } catch (err) {
    ctx.postMessage({
      kind: 'error',
      jobId: job.jobId,
      message: err instanceof Error ? err.message : String(err),
    } satisfies StudyMessage);
  }
});

function computePairCorrelationEnsemble(
  job: JobOf<'paircorr'>,
  progress: (done: number, total: number) => void
): { pc: PairCorrelation | null; pcAniso: PairCorrelationAniso | null } {
  // Fixed rMax across all trials so the bin edges are identical and trial-
  // level g(r) values stack correctly into the ensemble average. A varying
  // rMax (per-trial bbox-based) would shift bin centres between trials and
  // average values from different r-ranges into the same accumulator slot.
  // Scale rMax with the expected cluster radius: R_g ∼ N^(1/3) · L for a
  // compact 3D aggregate, so 2·N^(1/3)·L covers diameter with a safety margin
  // at typical compact-strategy aggregates. Clamped to [2L, 12L] for sanity.
  const rMax = Math.max(2, Math.min(12, 2 * Math.cbrt(job.N)));
  const nBins = 60;
  let accumG: number[] = [];
  let countSum: number[] = [];
  let rArr: number[] = [];
  let totalRho = 0;
  let used = 0;
  let accumPar: number[] = [];
  let accumPerp: number[] = [];
  let countParSum: number[] = [];
  let countPerpSum: number[] = [];
  for (let t = 0; t < job.nTrials; t++) {
    const seed = job.seed + t * SEED_STRIDE;
    const a = makeAssembly({
      L: 1,
      rng: new Rng(seed),
      chiralityBias: job.chiralityBias,
      strategy: job.strategy,
      compactBeta: job.compactBeta,
    });
    while (a.tets.length < job.N) {
      if (growOne(a) !== 'grown') break;
    }
    if (a.tets.length < 2) continue;
    const allV = a.tets.flatMap((tt) => [...tt.verts]);
    const hull = computeHull(allV);
    if (!hull) continue;
    const cents = a.tets.map((tt) => centroid(tt.verts[0], tt.verts[1], tt.verts[2], tt.verts[3]));
    const single = pairCorrelation(cents, hull.volume, rMax, nBins);
    if (single.r.length === 0) continue;
    if (accumG.length === 0) {
      accumG = [...single.g];
      countSum = [...single.counts];
      rArr = [...single.r];
    } else {
      for (let k = 0; k < accumG.length; k++) {
        accumG[k]! += single.g[k] ?? 0;
        countSum[k]! += single.counts[k] ?? 0;
      }
    }
    totalRho += single.rhoBulk;
    if (job.aniso) {
      // Principal axis on the centroid cloud (not vertex cloud) so it tracks
      // aggregate elongation rather than per-tet vertex spread.
      const shape = gyrationDescriptors(cents);
      if (shape) {
        const axis = shape.axes[0];
        const aniso = pairCorrelationAniso(cents, axis, hull.volume, rMax, nBins);
        if (accumPar.length === 0) {
          accumPar = [...aniso.gPar];
          accumPerp = [...aniso.gPerp];
          countParSum = [...aniso.countsPar];
          countPerpSum = [...aniso.countsPerp];
        } else {
          for (let k = 0; k < accumPar.length; k++) {
            accumPar[k]! += aniso.gPar[k] ?? 0;
            accumPerp[k]! += aniso.gPerp[k] ?? 0;
            countParSum[k]! += aniso.countsPar[k] ?? 0;
            countPerpSum[k]! += aniso.countsPerp[k] ?? 0;
          }
        }
      }
    }
    used++;
    progress(used, job.nTrials);
  }
  if (used === 0) return { pc: null, pcAniso: null };
  const pc: PairCorrelation = {
    r: rArr,
    g: accumG.map((v) => v / used),
    counts: countSum,
    rhoBulk: totalRho / used,
  };
  const pcAniso: PairCorrelationAniso | null =
    job.aniso && accumPar.length > 0
      ? {
          r: rArr,
          gPar: accumPar.map((v) => v / used),
          gPerp: accumPerp.map((v) => v / used),
          countsPar: countParSum,
          countsPerp: countPerpSum,
          rhoBulk: totalRho / used,
        }
      : null;
  return { pc, pcAniso };
}
