import { describe, expect, it, vi } from 'vitest';
import {
  defaultPoolSize,
  mergeTrialSlices,
  partitionArray,
  partitionTrials,
  runCurvePooled,
  runStudyPooled,
  type TrialSlice,
  type WorkerRunner,
} from '../src/lib/workerPool.js';
import { runStudy, runCurve, type TrialResult } from '../src/lib/study.js';
import type { StudyResult } from '../src/worker/study.worker.js';

describe('partitionTrials', () => {
  it('empty / non-positive input returns []', () => {
    expect(partitionTrials(0, 4)).toEqual([]);
    expect(partitionTrials(-1, 4)).toEqual([]);
    expect(partitionTrials(10, 0)).toEqual([]);
  });

  it('one slice when workers=1', () => {
    expect(partitionTrials(7, 1)).toEqual([{ start: 0, count: 7 }]);
  });

  it('clamps W to total when workers > total', () => {
    const slices = partitionTrials(3, 8);
    expect(slices).toHaveLength(3);
    expect(slices.every((s) => s.count === 1)).toBe(true);
  });

  it('slices are contiguous and cover [0, total) exactly once', () => {
    const slices = partitionTrials(100, 7);
    expect(slices.reduce((s, x) => s + x.count, 0)).toBe(100);
    for (let i = 1; i < slices.length; i++) {
      expect(slices[i]!.start).toBe(slices[i - 1]!.start + slices[i - 1]!.count);
    }
    expect(slices[0]!.start).toBe(0);
  });

  it('imbalanced totals spread the remainder to the first slices', () => {
    // 17 trials across 5 workers: 4 with 4, 1 with 3 + first two get +1 each.
    // 17 = 3*5 + 2, so two slices get one extra ⇒ counts [4,4,3,3,3].
    const slices = partitionTrials(17, 5);
    expect(slices.map((s) => s.count)).toEqual([4, 4, 3, 3, 3]);
  });
});

describe('partitionArray', () => {
  it('empty input returns []', () => {
    expect(partitionArray([], 4)).toEqual([]);
  });

  it('contiguous chunks in input order', () => {
    expect(partitionArray([1, 2, 3, 4, 5, 6, 7], 3)).toEqual([
      [1, 2, 3],
      [4, 5],
      [6, 7],
    ]);
  });

  it('returns at most `workers` chunks even if items < workers', () => {
    expect(partitionArray([10, 20], 8)).toEqual([[10], [20]]);
  });
});

describe('mergeTrialSlices', () => {
  it('remaps local trial indices to global', () => {
    const slices: TrialSlice[] = [
      { start: 0, count: 2 },
      { start: 2, count: 3 },
    ];
    const sliceTrials: TrialResult[][] = [
      [fakeTrial(0, 1), fakeTrial(1, 2)],
      [fakeTrial(0, 3), fakeTrial(1, 4), fakeTrial(2, 5)],
    ];
    const merged = mergeTrialSlices(slices, sliceTrials);
    expect(merged.map((t) => t.trial)).toEqual([0, 1, 2, 3, 4]);
    expect(merged.map((t) => t.V)).toEqual([1, 2, 3, 4, 5]);
  });

  it('preserves all non-trial fields of the trial', () => {
    const slices: TrialSlice[] = [{ start: 5, count: 1 }];
    const t = fakeTrial(0, 42);
    const [merged] = mergeTrialSlices(slices, [[t]]);
    expect(merged!.trial).toBe(5);
    expect(merged!.efficiency).toBe(t.efficiency);
    expect(merged!.seed).toBe(t.seed);
  });
});

describe('defaultPoolSize', () => {
  it('returns at least 1 and clamps to [1, 8]', () => {
    const n = defaultPoolSize();
    expect(n).toBeGreaterThanOrEqual(1);
    expect(n).toBeLessThanOrEqual(8);
  });
});

describe('runStudyPooled', () => {
  // The pool's correctness invariant: for any (params, workers), pooled output
  // must equal the single-threaded runStudy(params) modulo `ms` timing.
  it('is bit-identical to single-threaded runStudy', async () => {
    const params = {
      N: 10,
      trials: 13,
      startSeed: 42,
      chiralityBias: 0.5,
      strategy: 'uniform' as const,
    };
    const expected = runStudy(params);
    const got = await runStudyPooled(params, { maxWorkers: 4 }, fakeRunner());
    expect(got.length).toBe(expected.length);
    for (let i = 0; i < expected.length; i++) {
      expect(got[i]!.trial).toBe(expected[i]!.trial);
      expect(got[i]!.seed).toBe(expected[i]!.seed);
      expect(got[i]!.V).toBeCloseTo(expected[i]!.V, 12);
      expect(got[i]!.Vstar).toBeCloseTo(expected[i]!.Vstar, 12);
      expect(got[i]!.efficiency).toBeCloseTo(expected[i]!.efficiency, 12);
    }
  });

  it('result is identical across pool sizes', async () => {
    const params = {
      N: 8,
      trials: 11,
      startSeed: 7,
      chiralityBias: 0.5,
      strategy: 'uniform' as const,
    };
    const r1 = await runStudyPooled(params, { maxWorkers: 1 }, fakeRunner());
    const r3 = await runStudyPooled(params, { maxWorkers: 3 }, fakeRunner());
    const r7 = await runStudyPooled(params, { maxWorkers: 7 }, fakeRunner());
    expect(r1.map((t) => t.seed)).toEqual(r3.map((t) => t.seed));
    expect(r1.map((t) => t.seed)).toEqual(r7.map((t) => t.seed));
    expect(r1.map((t) => t.V)).toEqual(r3.map((t) => t.V));
  });

  it('aggregates progress across workers', async () => {
    const params = {
      N: 6,
      trials: 8,
      startSeed: 1,
      chiralityBias: 0.5,
      strategy: 'uniform' as const,
    };
    const onProgress = vi.fn();
    await runStudyPooled(params, { maxWorkers: 4, onProgress }, fakeRunner());
    expect(onProgress).toHaveBeenCalled();
    const last = onProgress.mock.calls[onProgress.mock.calls.length - 1];
    expect(last?.[0]).toBe(params.trials);
    expect(last?.[1]).toBe(params.trials);
    for (const [done, total] of onProgress.mock.calls) {
      expect(done).toBeLessThanOrEqual(total);
      expect(total).toBe(params.trials);
    }
  });

  it('trials = 0 returns []', async () => {
    const r = await runStudyPooled(
      { N: 5, trials: 0, startSeed: 1, chiralityBias: 0.5, strategy: 'uniform' },
      { maxWorkers: 4 },
      fakeRunner()
    );
    expect(r).toEqual([]);
  });
});

describe('runCurvePooled', () => {
  it('is bit-identical to single-threaded runCurve', async () => {
    const Ns = [5, 8, 12, 16, 20];
    const expected = runCurve(Ns, 6, 17, 0.5, 'uniform');
    const got = await runCurvePooled(
      { Ns, trialsPerN: 6, startSeed: 17, chiralityBias: 0.5, strategy: 'uniform' },
      { maxWorkers: 3 },
      fakeRunner()
    );
    expect(got.length).toBe(expected.length);
    for (let i = 0; i < expected.length; i++) {
      expect(got[i]!.N).toBe(expected[i]!.N);
      expect(got[i]!.meanEff).toBeCloseTo(expected[i]!.meanEff, 12);
      expect(got[i]!.meanRg).toBeCloseTo(expected[i]!.meanRg, 12);
    }
  });

  it('points come back in input Ns order even when split across workers', async () => {
    const Ns = [2, 4, 6, 8, 10, 12, 14];
    const got = await runCurvePooled(
      { Ns, trialsPerN: 4, startSeed: 1, chiralityBias: 0.5, strategy: 'uniform' },
      { maxWorkers: 3 },
      fakeRunner()
    );
    expect(got.map((p) => p.N)).toEqual(Ns);
  });

  it('uses single-worker fast path when maxWorkers=1', async () => {
    const Ns = [4, 8, 12];
    const got = await runCurvePooled(
      { Ns, trialsPerN: 3, startSeed: 1, chiralityBias: 0.5, strategy: 'uniform' },
      { maxWorkers: 1 },
      fakeRunner()
    );
    expect(got.map((p) => p.N)).toEqual(Ns);
  });

  it('reports aggregated progress across N partitions', async () => {
    const Ns = [3, 5, 7, 9];
    const trialsPerN = 4;
    const onProgress = vi.fn();
    await runCurvePooled(
      { Ns, trialsPerN, startSeed: 1, chiralityBias: 0.5, strategy: 'uniform' },
      { maxWorkers: 2, onProgress },
      fakeRunner()
    );
    const expectedTotal = Ns.length * trialsPerN;
    const last = onProgress.mock.calls[onProgress.mock.calls.length - 1];
    expect(last?.[0]).toBe(expectedTotal);
    expect(last?.[1]).toBe(expectedTotal);
  });

  it('empty Ns returns []', async () => {
    const r = await runCurvePooled(
      { Ns: [], trialsPerN: 5, startSeed: 1, chiralityBias: 0.5, strategy: 'uniform' },
      { maxWorkers: 4 },
      fakeRunner()
    );
    expect(r).toEqual([]);
  });

  it('compactBeta is forwarded when present', async () => {
    const Ns = [4, 8];
    const seen: number[] = [];
    const runner: WorkerRunner = (async (job) => {
      if (job.kind !== 'curve') throw new Error('unexpected job kind');
      seen.push(job.compactBeta ?? -1);
      const points = runCurve(
        job.Ns,
        job.trialsPerN,
        job.startSeed,
        job.chiralityBias,
        job.strategy,
        job.compactBeta
      );
      return { kind: 'curve', points } as unknown as StudyResult;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    }) as any;
    await runCurvePooled(
      {
        Ns,
        trialsPerN: 2,
        startSeed: 1,
        chiralityBias: 0.5,
        strategy: 'compact',
        compactBeta: 3.5,
      },
      { maxWorkers: 2 },
      runner
    );
    expect(seen.every((b) => b === 3.5)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Test runner: same kernel as the real worker, but synchronous and in-process
// so we can assert determinism without spinning up Web Workers (happy-dom has
// no Worker support and the real worker import has dynamic URL resolution).
// ---------------------------------------------------------------------------

function fakeRunner(): WorkerRunner {
  return (async <R extends StudyResult>(
    job: Parameters<WorkerRunner>[0],
    opts?: Parameters<WorkerRunner>[1]
  ): Promise<R> => {
    if (job.kind === 'study') {
      const trials = runStudy(job.params, {
        onTrial: (done, total) => opts?.onProgress?.(done, total),
      });
      return { kind: 'study', trials } as unknown as R;
    }
    if (job.kind === 'curve') {
      // Mirror the real worker (study.worker.ts curve handler): collapse the
      // per-N onTrial events into one cumulative bar across all of this
      // worker's Ns, so done counts up to Ns·trialsPerN.
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
            opts?.onProgress?.(doneTrials, totalTrials);
          },
        }
      );
      return { kind: 'curve', points } as unknown as R;
    }
    throw new Error(`fakeRunner: unsupported job kind ${(job as { kind: string }).kind}`);
  }) as WorkerRunner;
}

function fakeTrial(localTrial: number, V: number): TrialResult {
  return {
    trial: localTrial,
    N: 10,
    seed: 1000 + localTrial,
    V,
    Vbbox: V * 2,
    Vstar: V * 0.5,
    efficiency: 0.5,
    bboxEfficiency: 0.25,
    surface: 1,
    rg: 1,
    kappaSq: 0.1,
    prolateness: 0,
    meanCoord: 4,
    maxCoord: 6,
    meanTetCoord: 2,
    chirR: 5,
    ms: 1,
  };
}
