import { useCallback, useRef, useState } from 'react';
import { runOnWorker, type RunOptions, type StudyJobInput } from '../lib/studyClient.js';
import type { StudyResult } from '../worker/study.worker.js';
import { runCurvePooled, runStudyPooled } from '../lib/workerPool.js';

export interface WorkerRunState<R> {
  running: boolean;
  err: string | null;
  progress: { done: number; total: number } | null;
  result: R | null;
}

/**
 * Runs one study job, tracking running/progress/error state. A new run()
 * aborts any in-flight job.
 *
 * `study` and `curve` jobs fan out across the worker pool (one worker per
 * core, minus one for the UI); other job kinds run on a single worker as
 * before. Aborting either path terminate()s the underlying workers.
 */
export function useWorkerRun<R extends StudyResult>() {
  const [state, setState] = useState<WorkerRunState<R>>({
    running: false,
    err: null,
    progress: null,
    result: null,
  });
  const abortRef = useRef<AbortController | null>(null);

  const run = useCallback(async (job: StudyJobInput, opts?: Pick<RunOptions, 'onProgress'>) => {
    const prev = abortRef.current;
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    // Aborting the prior run schedules an AbortError in its catch handler.
    // That handler now clears running:true — but only if it's still the
    // active controller, so we don't undo this new run's own setState below.
    prev?.abort();
    setState({ running: true, err: null, progress: null, result: null });
    const onProgress = (done: number, total: number) => {
      if (ctrl.signal.aborted) return;
      opts?.onProgress?.(done, total);
      setState((s) => ({ ...s, progress: { done, total } }));
    };
    try {
      const result = await dispatch<R>(job, ctrl.signal, onProgress);
      if (ctrl.signal.aborted) return;
      setState({ running: false, err: null, progress: null, result });
    } catch (e) {
      const aborted = (e as { name?: string }).name === 'AbortError';
      if (aborted) {
        if (abortRef.current === ctrl) {
          setState({ running: false, err: null, progress: null, result: null });
        }
        return;
      }
      setState({
        running: false,
        err: e instanceof Error ? e.message : String(e),
        progress: null,
        result: null,
      });
    }
  }, []);

  const cancel = useCallback(() => abortRef.current?.abort(), []);

  return { ...state, run, cancel };
}

async function dispatch<R extends StudyResult>(
  job: StudyJobInput,
  signal: AbortSignal,
  onProgress: (done: number, total: number) => void
): Promise<R> {
  if (job.kind === 'study') {
    const trials = await runStudyPooled(job.params, { signal, onProgress });
    return { kind: 'study', trials } as unknown as R;
  }
  if (job.kind === 'curve') {
    const points = await runCurvePooled(
      {
        Ns: job.Ns,
        trialsPerN: job.trialsPerN,
        startSeed: job.startSeed,
        chiralityBias: job.chiralityBias,
        strategy: job.strategy,
        ...(job.compactBeta !== undefined ? { compactBeta: job.compactBeta } : {}),
      },
      { signal, onProgress }
    );
    return { kind: 'curve', points } as unknown as R;
  }
  return runOnWorker<R>(job, { signal, onProgress });
}
