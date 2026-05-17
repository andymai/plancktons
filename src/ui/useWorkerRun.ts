import { useCallback, useRef, useState } from 'react';
import { runOnWorker, type RunOptions, type StudyJobInput } from '../lib/studyClient.js';
import type { StudyResult } from '../worker/study.worker.js';

export interface WorkerRunState<R> {
  running: boolean;
  err: string | null;
  progress: { done: number; total: number } | null;
  result: R | null;
}

/**
 * Hook that runs one study job on a Web worker. Tracks running/progress/error
 * state. If a new run starts while one is in flight, aborts the in-flight job.
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
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setState({ running: true, err: null, progress: null, result: null });
    try {
      const result = await runOnWorker<R>(job, {
        signal: ctrl.signal,
        onProgress: (done, total) => {
          opts?.onProgress?.(done, total);
          setState((s) => ({ ...s, progress: { done, total } }));
        },
      });
      if (ctrl.signal.aborted) return;
      setState({ running: false, err: null, progress: null, result });
    } catch (e) {
      if ((e as { name?: string }).name === 'AbortError') return;
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
