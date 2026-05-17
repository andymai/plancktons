// Browser-side fan-out for batch study / curve jobs. Splits a single job
// across up to `navigator.hardwareConcurrency - 1` short-lived workers via the
// existing per-call `runOnWorker` machinery, then stitches results back into
// canonical single-worker order. Bit-identical to the unpooled run thanks to
// the seed_t = startSeed + t·9973 contract: a slice {start, count} runs with
// startSeed' = startSeed + start·9973, so local trial t' has the same seed as
// global trial start+t'.
//
// The fan-out functions accept an injectable `runner` (default = runOnWorker)
// so unit tests can exercise orchestration without spinning up Web Workers.

import { runOnWorker, type RunOptions, type StudyJobInput } from './studyClient.js';
import type { StudyResult } from '../worker/study.worker.js';
import type { CurvePoint, StudyParams, TrialResult } from './study.js';
import type { GrowthStrategy } from './assembly.js';
import { SEED_STRIDE } from './constants.js';

/** Worker count: leave 1 core for the UI thread, clamp to [1, 8]. */
export function defaultPoolSize(): number {
  const hc =
    typeof navigator !== 'undefined' && navigator.hardwareConcurrency
      ? navigator.hardwareConcurrency
      : 2;
  return Math.max(1, Math.min(8, hc - 1));
}

export interface TrialSlice {
  /** Global index of this slice's first trial. */
  start: number;
  /** Number of trials this slice covers. */
  count: number;
}

/**
 * Partition `total` trials into ≤ `workers` contiguous slices that together
 * cover [0, total). The first (total mod workers) slices get one extra trial.
 *
 * Contiguous (not round-robin) so each worker's local indices map to a
 * contiguous global range, preserving cache locality in any future SAB-backed
 * variants. With the current seed contract both partitionings are equivalent
 * for determinism.
 */
export function partitionTrials(total: number, workers: number): TrialSlice[] {
  if (total <= 0 || workers <= 0) return [];
  const W = Math.min(workers, total);
  const base = Math.floor(total / W);
  const extra = total - base * W;
  const slices: TrialSlice[] = [];
  let start = 0;
  for (let i = 0; i < W; i++) {
    const count = base + (i < extra ? 1 : 0);
    slices.push({ start, count });
    start += count;
  }
  return slices;
}

/**
 * Partition an array into ≤ `workers` contiguous chunks. Used for curve
 * sweeps where each worker handles a subset of N values — keeping all trials
 * for a given N on one worker avoids two-level merge of CurvePoint stats.
 */
export function partitionArray<T>(items: readonly T[], workers: number): T[][] {
  if (items.length === 0 || workers <= 0) return [];
  const W = Math.min(workers, items.length);
  const base = Math.floor(items.length / W);
  const extra = items.length - base * W;
  const out: T[][] = [];
  let start = 0;
  for (let i = 0; i < W; i++) {
    const count = base + (i < extra ? 1 : 0);
    out.push(items.slice(start, start + count) as T[]);
    start += count;
  }
  return out;
}

/**
 * Reassemble per-slice trial arrays into canonical global order, remapping
 * each trial's local `trial` index to its global counterpart. Slices are
 * concatenated in input order, and the returned array has length
 * Σ sliceTrials[i].length.
 */
export function mergeTrialSlices(
  slices: ReadonlyArray<TrialSlice>,
  sliceTrials: ReadonlyArray<ReadonlyArray<TrialResult>>
): TrialResult[] {
  const out: TrialResult[] = [];
  for (let i = 0; i < slices.length; i++) {
    const start = slices[i]!.start;
    const arr = sliceTrials[i] ?? [];
    for (const t of arr) out.push({ ...t, trial: start + t.trial });
  }
  return out;
}

export interface PoolRunOptions {
  onProgress?: (done: number, total: number) => void;
  signal?: AbortSignal;
  /** Override the auto-detected pool size. */
  maxWorkers?: number;
}

/** Injectable worker runner. Defaults to studyClient.runOnWorker. Mock in tests. */
export type WorkerRunner = <R extends StudyResult>(
  job: StudyJobInput,
  opts?: RunOptions
) => Promise<R>;

/**
 * Fan-out a study job across the pool. Output is bit-identical (mod `ms`) to
 * runStudy(params) on a single worker: trials are returned in [0, params.trials)
 * order with their global trial index in `trial`.
 */
export async function runStudyPooled(
  params: StudyParams,
  opts: PoolRunOptions = {},
  runner: WorkerRunner = runOnWorker
): Promise<TrialResult[]> {
  const W = opts.maxWorkers ?? defaultPoolSize();
  const slices = partitionTrials(params.trials, W);
  if (slices.length === 0) return [];
  if (slices.length === 1) {
    const r = await runner<Extract<StudyResult, { kind: 'study' }>>(
      { kind: 'study', params },
      buildRunOpts(opts.signal, opts.onProgress)
    );
    return r.trials;
  }
  const perDone = new Array<number>(slices.length).fill(0);
  const totalTrials = params.trials;
  const emit = () => {
    if (!opts.onProgress) return;
    let done = 0;
    for (const d of perDone) done += d;
    opts.onProgress(done, totalTrials);
  };
  const results = await Promise.all(
    slices.map((slice, idx) =>
      runner<Extract<StudyResult, { kind: 'study' }>>(
        {
          kind: 'study',
          params: {
            ...params,
            startSeed: params.startSeed + slice.start * SEED_STRIDE,
            trials: slice.count,
          },
        },
        buildRunOpts(opts.signal, (done) => {
          perDone[idx] = done;
          emit();
        })
      )
    )
  );
  return mergeTrialSlices(
    slices,
    results.map((r) => r.trials)
  );
}

export interface CurveRequest {
  Ns: number[];
  trialsPerN: number;
  startSeed: number;
  chiralityBias: number;
  strategy: GrowthStrategy;
  compactBeta?: number;
}

/**
 * Fan-out a curve sweep by partitioning Ns across workers. All trials for a
 * given N stay on one worker, so each CurvePoint's mean/std is computed from
 * the same trial set as a single-worker run with the same params.
 *
 * Relies on the worker's curve handler emitting a single cumulative progress
 * bar `(doneTrials, Ns·trialsPerN)` rather than per-N events — see the curve
 * handler in study.worker.ts. If that ever changes, the aggregate progress
 * here will desync.
 */
export async function runCurvePooled(
  req: CurveRequest,
  opts: PoolRunOptions = {},
  runner: WorkerRunner = runOnWorker
): Promise<CurvePoint[]> {
  const W = opts.maxWorkers ?? defaultPoolSize();
  const groups = partitionArray(req.Ns, W);
  if (groups.length === 0) return [];
  const buildJob = (Ns: number[]): StudyJobInput => ({
    kind: 'curve',
    Ns,
    trialsPerN: req.trialsPerN,
    startSeed: req.startSeed,
    chiralityBias: req.chiralityBias,
    strategy: req.strategy,
    ...(req.compactBeta !== undefined ? { compactBeta: req.compactBeta } : {}),
  });
  if (groups.length === 1) {
    const r = await runner<Extract<StudyResult, { kind: 'curve' }>>(
      buildJob(req.Ns),
      buildRunOpts(opts.signal, opts.onProgress)
    );
    return r.points;
  }
  const perDone = new Array<number>(groups.length).fill(0);
  const totalTrials = req.Ns.length * req.trialsPerN;
  const emit = () => {
    if (!opts.onProgress) return;
    let done = 0;
    for (const d of perDone) done += d;
    opts.onProgress(done, totalTrials);
  };
  const results = await Promise.all(
    groups.map((grp, idx) =>
      runner<Extract<StudyResult, { kind: 'curve' }>>(
        buildJob(grp),
        buildRunOpts(opts.signal, (done) => {
          perDone[idx] = done;
          emit();
        })
      )
    )
  );
  return results.flatMap((r) => r.points);
}

function buildRunOpts(
  signal: AbortSignal | undefined,
  onProgress: ((done: number, total: number) => void) | undefined
): RunOptions {
  const o: RunOptions = {};
  if (signal) o.signal = signal;
  if (onProgress) o.onProgress = onProgress;
  return o;
}
