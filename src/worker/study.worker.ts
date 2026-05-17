// Dedicated Web Worker for batch study runs. Receives a job description,
// runs the same kernel as the main thread (so results are bit-identical), and
// streams progress events back. Vite handles the bundling via the
// `new Worker(new URL(...), { type: 'module' })` syntax in studyClient.ts.

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
import { Rng } from '../lib/rng.js';
import { growOne, makeAssembly, type GrowthStrategy } from '../lib/assembly.js';
import { computeHull } from '../lib/hull.js';
import { centroid } from '../lib/vec.js';
import type { Planckton } from '../lib/planckton.js';

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
      // Tets pre-serialized (only verts + chirality - faces are reconstructed
      // from the canonical Hill T₁ face table client-side if needed).
      tets: { verts: [number, number, number][]; chirality: 'R' | 'L' }[];
      L: number;
      voxelSize: number;
      alpha: number;
    };

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
  | { kind: 'morph'; morph: MorphologyResult | null };

const ctx = self as unknown as DedicatedWorkerGlobalScope;

ctx.addEventListener('message', (event: MessageEvent<StudyJob>) => {
  const job = event.data;
  try {
    if (job.kind === 'study') {
      const trials = runStudy(job.params, {
        onTrial: (done, total) =>
          ctx.postMessage({
            kind: 'progress',
            jobId: job.jobId,
            done,
            total,
          } satisfies StudyMessage),
      });
      ctx.postMessage({
        kind: 'result',
        jobId: job.jobId,
        payload: { kind: 'study', trials },
      } satisfies StudyMessage);
    } else if (job.kind === 'curve') {
      // Two-level progress: total = sum over Ns of trialsPerN. We collapse to
      // (done trials so far) / (total trials across all Ns) so a single bar
      // moves smoothly across the whole sweep.
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
            ctx.postMessage({
              kind: 'progress',
              jobId: job.jobId,
              done: doneTrials,
              total: totalTrials,
            } satisfies StudyMessage);
          },
        }
      );
      ctx.postMessage({
        kind: 'result',
        jobId: job.jobId,
        payload: { kind: 'curve', points },
      } satisfies StudyMessage);
    } else if (job.kind === 'paircorr') {
      const { pc, pcAniso } = computePairCorrelationEnsemble(job);
      ctx.postMessage({
        kind: 'result',
        jobId: job.jobId,
        payload: { kind: 'paircorr', pc, pcAniso },
      } satisfies StudyMessage);
    } else if (job.kind === 'morph') {
      // Reconstruct minimal Planckton objects from serialized verts. faces
      // and other fields aren't needed by morphologicalHull (it only reads
      // .verts) so we cast through unknown to keep the postMessage payload
      // small.
      const tets = job.tets as unknown as Planckton[];
      const morph = morphologicalHull(tets, job.L, {
        voxelSize: job.voxelSize,
        alpha: job.alpha,
      });
      ctx.postMessage({
        kind: 'result',
        jobId: job.jobId,
        payload: { kind: 'morph', morph },
      } satisfies StudyMessage);
    }
  } catch (err) {
    ctx.postMessage({
      kind: 'error',
      jobId: job.jobId,
      message: err instanceof Error ? err.message : String(err),
    } satisfies StudyMessage);
  }
});

function computePairCorrelationEnsemble(job: {
  jobId: number;
  N: number;
  seed: number;
  chiralityBias: number;
  strategy: GrowthStrategy;
  compactBeta: number;
  nTrials: number;
  aniso?: boolean;
}): { pc: PairCorrelation | null; pcAniso: PairCorrelationAniso | null } {
  let accumG: number[] = [];
  let countSum: number[] = [];
  let rArr: number[] = [];
  let totalRho = 0;
  let used = 0;
  // Aniso accumulators (only filled if job.aniso).
  let accumPar: number[] = [];
  let accumPerp: number[] = [];
  let countParSum: number[] = [];
  let countPerpSum: number[] = [];
  for (let t = 0; t < job.nTrials; t++) {
    const seed = job.seed + t * 9973;
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
    const bsize = hull.bbox.size;
    const rMax = 0.6 * Math.sqrt(bsize[0] ** 2 + bsize[1] ** 2 + bsize[2] ** 2);
    const single = pairCorrelation(cents, hull.volume, rMax, 60);
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
      // Principal axis from the gyration tensor's largest eigenvalue. We
      // compute it on the centroid cloud (not the vertex cloud) so the axis
      // tracks the aggregate's overall elongation, not its vertex spread.
      const shape = gyrationDescriptors(cents);
      if (shape) {
        const axis = shape.axes[0];
        const aniso = pairCorrelationAniso(cents, axis, hull.volume, rMax, 60);
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
    ctx.postMessage({
      kind: 'progress',
      jobId: job.jobId,
      done: used,
      total: job.nTrials,
    } satisfies StudyMessage);
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
