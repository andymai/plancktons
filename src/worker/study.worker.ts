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
import { rebuildFromTets } from '../lib/assembly.js';
import { runMcRefine, type McRefineResult } from '../lib/mcRefine.js';
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
      // Pre-serialized: only verts + chirality (faces are reconstructed from
      // the canonical Hill T₁ face table client-side if needed).
      tets: { verts: [number, number, number][]; chirality: 'R' | 'L' }[];
      L: number;
      voxelSize: number;
      alpha: number;
    }
  | {
      kind: 'voronoi';
      jobId: number;
      /** Pre-computed tet centroids; worker doesn't need vertex data here. */
      centroids: [number, number, number][];
      L: number;
      voxelSize: number;
      padL: number;
    }
  | {
      kind: 'mc';
      jobId: number;
      /** Initial assembly: pre-serialized tets (verts + chirality). */
      tets: { verts: [number, number, number][]; chirality: 'R' | 'L' }[];
      L: number;
      chiralityBias: number;
      strategy: GrowthStrategy;
      compactBeta: number;
      /** MC sweep params. */
      steps: number;
      temperature: number;
      mcSeed: number;
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
  | { kind: 'morph'; morph: MorphologyResult | null }
  | { kind: 'voronoi'; voronoi: VoronoiResult | null; etaV: number | null }
  | { kind: 'mc'; mc: McRefineResult };

const ctx = self as unknown as DedicatedWorkerGlobalScope;

function postProgress(jobId: number, done: number, total: number): void {
  ctx.postMessage({ kind: 'progress', jobId, done, total } satisfies StudyMessage);
}

function postResult(jobId: number, payload: StudyResult): void {
  ctx.postMessage({ kind: 'result', jobId, payload } satisfies StudyMessage);
}

ctx.addEventListener('message', (event: MessageEvent<StudyJob>) => {
  const job = event.data;
  try {
    if (job.kind === 'study') {
      const trials = runStudy(job.params, {
        onTrial: (done, total) => postProgress(job.jobId, done, total),
      });
      postResult(job.jobId, { kind: 'study', trials });
    } else if (job.kind === 'curve') {
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
            postProgress(job.jobId, doneTrials, totalTrials);
          },
        }
      );
      postResult(job.jobId, { kind: 'curve', points });
    } else if (job.kind === 'paircorr') {
      const { pc, pcAniso } = computePairCorrelationEnsemble(job);
      postResult(job.jobId, { kind: 'paircorr', pc, pcAniso });
    } else if (job.kind === 'morph') {
      // morphologicalHull only reads .verts; cast keeps the postMessage small.
      const tets = job.tets as unknown as Planckton[];
      const morph = morphologicalHull(tets, job.L, {
        voxelSize: job.voxelSize,
        alpha: job.alpha,
      });
      postResult(job.jobId, { kind: 'morph', morph });
    } else if (job.kind === 'voronoi') {
      const voronoi = voronoiCells(job.centroids, job.L, {
        voxelSize: job.voxelSize,
        padL: job.padL,
      });
      const etaV = voronoi ? etaVFromVoronoi(voronoi, job.L) : null;
      postResult(job.jobId, { kind: 'voronoi', voronoi, etaV });
    } else if (job.kind === 'mc') {
      // Reconstruct an Assembly from the serialized tets + the same growth
      // opts used to build them. The opts here are echoed by the caller so
      // MC's growOne calls produce assemblies with consistent strategy.
      const tetsP = job.tets as unknown as Planckton[];
      const opts = {
        L: job.L,
        rng: new Rng(0),
        chiralityBias: job.chiralityBias,
        strategy: job.strategy,
        compactBeta: job.compactBeta,
      };
      const initial = rebuildFromTets(tetsP, opts);
      const mc = runMcRefine(
        { initial, steps: job.steps, temperature: job.temperature, seed: job.mcSeed },
        {
          onStep: (done, total) => postProgress(job.jobId, done, total),
        }
      );
      postResult(job.jobId, { kind: 'mc', mc });
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
    postProgress(job.jobId, used, job.nTrials);
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
