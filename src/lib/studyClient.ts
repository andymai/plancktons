// React-friendly client for the study.worker.ts dedicated worker. Each call
// to runOnWorker(...) opens a short-lived worker, runs one job, and resolves
// with the result (or rejects on error). Progress events flow through an
// optional callback.
//
// Why a fresh worker per call: jobs are independent and we don't want job
// queueing complexity. Worker spinup is <10ms on modern engines.

import type { StudyJob, StudyMessage, StudyResult } from '../worker/study.worker.js';

export interface RunOptions {
  onProgress?: (done: number, total: number) => void;
  signal?: AbortSignal;
}

// Distributive Omit: `Omit<A | B, 'k'>` collapses the union, losing the
// discriminant variant. Distributing over the union preserves each shape.
type StudyJobInput = StudyJob extends infer J
  ? J extends { jobId: number }
    ? Omit<J, 'jobId'>
    : never
  : never;

let nextJobId = 1;

/**
 * Runs a job on a fresh worker instance. Resolves with the typed result.
 * Throws on error or abort. Worker is terminated when the job settles.
 */
export function runOnWorker<R extends StudyResult>(
  job: StudyJobInput,
  opts?: RunOptions
): Promise<R> {
  return new Promise((resolve, reject) => {
    const jobId = nextJobId++;
    const worker = new Worker(new URL('../worker/study.worker.ts', import.meta.url), {
      type: 'module',
    });
    let settled = false;
    const cleanup = () => {
      if (settled) return;
      settled = true;
      worker.terminate();
    };
    const onAbort = () => {
      cleanup();
      reject(new DOMException('Aborted', 'AbortError'));
    };
    opts?.signal?.addEventListener('abort', onAbort, { once: true });

    worker.onmessage = (event: MessageEvent<StudyMessage>) => {
      const msg = event.data;
      if (msg.jobId !== jobId) return;
      if (msg.kind === 'progress') {
        opts?.onProgress?.(msg.done, msg.total);
      } else if (msg.kind === 'result') {
        cleanup();
        opts?.signal?.removeEventListener('abort', onAbort);
        resolve(msg.payload as R);
      } else if (msg.kind === 'error') {
        cleanup();
        opts?.signal?.removeEventListener('abort', onAbort);
        reject(new Error(msg.message));
      }
    };
    worker.onerror = (e) => {
      cleanup();
      opts?.signal?.removeEventListener('abort', onAbort);
      reject(new Error(e.message || 'Worker error'));
    };

    worker.postMessage({ ...job, jobId } as unknown as StudyJob);
  });
}

export type { StudyJobInput };
