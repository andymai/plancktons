// Node worker thread entry. Receives a `study`-kind StudyJob via workerData,
// runs it through the same kernel the browser uses, and posts the result
// back. Kept narrow (only the `study` kind) because the CLI doesn't fan out
// any other job kinds today.
//
// Compatibility note: `--import tsx` registers the tsx loader for THIS file
// (the worker entry), but the resolver doesn't transitively apply to
// `.js`-specifier imports of TS source the way it does in the main thread.
// Calling `tsx/esm/api`'s `register()` from inside the worker re-installs
// the hooks before our dynamic import, so the project's `.js` → `.ts`
// resolution convention works again.

import { parentPort, workerData } from 'node:worker_threads';
import { register } from 'tsx/esm/api';

const unregister = register();

const { runStudy } = (await import('../src/lib/study.js')) as typeof import('../src/lib/study.js');
unregister();

interface StudyWorkerJob {
  params: import('../src/lib/study.js').StudyParams;
}

const job = workerData as StudyWorkerJob;
const port = parentPort;
if (!port) {
  throw new Error('_studyWorker.ts must be loaded as a worker_threads worker');
}

const trials = runStudy(job.params, {
  onTrial: (done, total) => port.postMessage({ kind: 'progress', done, total }),
});
port.postMessage({ kind: 'result', trials });
