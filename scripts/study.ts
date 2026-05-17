#!/usr/bin/env -S npx tsx
/**
 * Headless batch study CLI. Reuses the same simulation kernel as the browser
 * playground so results are bit-identical across environments.
 *
 * Usage examples
 *
 *   # 200 trials at N=30, uniform strategy → CSV to stdout
 *   npx tsx scripts/study.ts --N 30 --trials 200 --strategy uniform
 *
 *   # 100 trials at each N ∈ {10,20,50,100} with compact β=4 → CSV file
 *   npx tsx scripts/study.ts --sweep-N 10,20,50,100 --trials 100 \
 *       --strategy compact --beta 4 --out results.csv
 *
 *   # JSON Lines (one trial per line) for streaming pipelines
 *   npx tsx scripts/study.ts --N 50 --trials 500 --format jsonl --out results.jsonl
 *
 * Per-trial columns:
 *   trial, N, seed, V (hull), Vstar (= N·L³/6), efficiency = Vstar/V,
 *   surface (free-face area), rg (radius of gyration), kappaSq (shape
 *   anisotropy ∈ [0,1]), prolateness (S ∈ [-¼,2]), meanCoord (mean vertex
 *   coordination), maxCoord, chirR (right-handed tet count), ms (wall time)
 */

import { writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { Worker } from 'node:worker_threads';
import { fileURLToPath } from 'node:url';
import { cpus } from 'node:os';
import { runStudy, trialsToCSV, type TrialResult } from '../src/lib/study.js';
import { SEED_STRIDE } from '../src/lib/constants.js';

// __BUILD_COMMIT__ is normally injected by Vite. When running via tsx the
// import returns 'dev' — useless for reproducibility of CLI-generated data.
// Resolve at startup from git via execFile (no shell, no injection vector)
// and shove it into the global namespace before provenance.ts's typeof check
// fires.
try {
  const sha = execFileSync('git', ['rev-parse', '--short', 'HEAD'], { encoding: 'utf-8' }).trim();
  (globalThis as Record<string, unknown>).__BUILD_COMMIT__ = sha;
  (globalThis as Record<string, unknown>).__BUILD_TIME__ = new Date().toISOString();
} catch {
  // Outside a git checkout (CI on a tarball, etc.); leave the 'dev' fallback.
}

type Args = {
  N?: number;
  sweepN?: number[];
  trials: number;
  startSeed: number;
  strategy: 'uniform' | 'compact';
  chirality: number;
  beta: number;
  format: 'csv' | 'jsonl';
  out?: string;
  workers: number;
};

function parseArgs(argv: string[]): Args {
  const a: Args = {
    trials: 100,
    startSeed: 1,
    strategy: 'uniform',
    chirality: 0.5,
    beta: 3,
    format: 'csv',
    workers: 1,
  };
  for (let i = 0; i < argv.length; i++) {
    const k = argv[i];
    const v = argv[i + 1];
    const need = () => {
      if (v === undefined) {
        console.error(`flag ${k} needs a value`);
        process.exit(1);
      }
      return v;
    };
    switch (k) {
      case '--N':
        a.N = parseInt(need(), 10);
        i++;
        break;
      case '--sweep-N':
        a.sweepN = need()
          .split(',')
          .map((s) => parseInt(s, 10))
          .filter((n) => Number.isFinite(n) && n > 0);
        i++;
        break;
      case '--trials':
        a.trials = parseInt(need(), 10);
        i++;
        break;
      case '--seed':
      case '--start-seed':
        a.startSeed = parseInt(need(), 10);
        i++;
        break;
      case '--strategy': {
        const v2 = need();
        if (v2 !== 'uniform' && v2 !== 'compact') {
          console.error(`--strategy must be 'uniform' or 'compact', got '${v2}'`);
          process.exit(1);
        }
        a.strategy = v2;
        i++;
        break;
      }
      case '--chirality':
      case '--cb':
        a.chirality = parseFloat(need());
        i++;
        break;
      case '--beta':
      case '--b':
        a.beta = parseFloat(need());
        i++;
        break;
      case '--format':
      case '--fmt': {
        const v2 = need();
        if (v2 !== 'csv' && v2 !== 'jsonl') {
          console.error(`--format must be 'csv' or 'jsonl', got '${v2}'`);
          process.exit(1);
        }
        a.format = v2;
        i++;
        break;
      }
      case '--out':
      case '-o':
        a.out = need();
        i++;
        break;
      case '--workers':
      case '-w': {
        const w = need();
        if (w === 'auto') {
          // -1 to leave a core for OS/this process, clamp to [1, 8].
          a.workers = Math.max(1, Math.min(8, cpus().length - 1));
        } else {
          a.workers = Math.max(1, parseInt(w, 10) || 1);
        }
        i++;
        break;
      }
      case '-h':
      case '--help':
        console.log(USAGE);
        process.exit(0);
        break;
    }
  }
  if (!a.N && !a.sweepN) {
    console.error('Specify --N <int> or --sweep-N <n1,n2,...>');
    process.exit(1);
  }
  return a;
}

const USAGE = `plancktons study CLI

  --N <int>             single value of N
  --sweep-N n1,n2,...   sweep N across multiple values
  --trials <int>        trials per N (default 100)
  --seed <int>          starting seed (default 1; per-trial = seed + t·9973)
  --strategy <name>     'uniform' or 'compact' (default uniform)
  --chirality <0..1>    fraction right-handed (default 0.5)
  --beta <float>        inverse-temperature for 'compact' (default 3)
  --format <csv|jsonl>  output format (default csv)
  --out <path>          write to file instead of stdout
  --workers <int|auto>  parallel slices via node:worker_threads (default 1).
                        'auto' = max(1, min(8, cpus()-1)). Output is
                        bit-identical to single-worker thanks to the
                        seed_t = startSeed + t·SEED_STRIDE contract.
`;

function trialsToJsonl(trials: ReadonlyArray<TrialResult>): string {
  return trials.map((t) => JSON.stringify(t)).join('\n');
}

function emit(text: string, out?: string) {
  if (out) writeFileSync(out, text);
  else process.stdout.write(text + '\n');
}

function runOne(args: Args, N: number): TrialResult[] {
  return runStudy({
    N,
    trials: args.trials,
    startSeed: args.startSeed,
    chiralityBias: args.chirality,
    strategy: args.strategy,
    compactBeta: args.beta,
  });
}

interface WorkerSlice {
  start: number;
  count: number;
}

function partitionSlices(total: number, workers: number): WorkerSlice[] {
  if (workers <= 1 || total <= 1) return [{ start: 0, count: total }];
  const base = Math.floor(total / workers);
  const extra = total - base * workers;
  const slices: WorkerSlice[] = [];
  let cur = 0;
  for (let i = 0; i < workers; i++) {
    const c = base + (i < extra ? 1 : 0);
    if (c === 0) continue;
    slices.push({ start: cur, count: c });
    cur += c;
  }
  return slices;
}

function runOneSliceInWorker(args: Args, N: number, slice: WorkerSlice): Promise<TrialResult[]> {
  return new Promise((resolve, reject) => {
    const worker = new Worker(fileURLToPath(new URL('./_studyWorker.ts', import.meta.url)), {
      // tsx isn't bundled with Node; spawn the worker with the tsx loader so
      // it can resolve the .ts source via the conventional `.js` import
      // specifier the rest of the codebase uses.
      execArgv: ['--import', 'tsx'],
      workerData: {
        params: {
          N,
          trials: slice.count,
          startSeed: args.startSeed + slice.start * SEED_STRIDE,
          chiralityBias: args.chirality,
          strategy: args.strategy,
          compactBeta: args.beta,
        },
      },
    });
    worker.on(
      'message',
      (msg: { kind: 'result'; trials: TrialResult[] } | { kind: 'progress' }) => {
        if (msg.kind === 'result') {
          worker.terminate();
          // Remap local trial indices to global, matching workerPool.mergeTrialSlices.
          const remapped = msg.trials.map((t) => ({ ...t, trial: slice.start + t.trial }));
          resolve(remapped);
        }
      }
    );
    worker.on('error', (err) => {
      worker.terminate();
      reject(err);
    });
  });
}

async function runOneParallel(args: Args, N: number): Promise<TrialResult[]> {
  if (args.workers <= 1) return runOne(args, N);
  const slices = partitionSlices(args.trials, args.workers);
  const results = await Promise.all(slices.map((slice) => runOneSliceInWorker(args, N, slice)));
  const flat: TrialResult[] = [];
  for (const slice of results) flat.push(...slice);
  return flat;
}

const args = parseArgs(process.argv.slice(2));
const Ns = args.sweepN ?? [args.N as number];
const allTrials: TrialResult[] = [];
const t0 = Date.now();
const workerNote = args.workers > 1 ? ` (${args.workers} workers)` : '';
for (const N of Ns) {
  process.stderr.write(`  N=${N} × ${args.trials} trials${workerNote}...\n`);
  const trials = await runOneParallel(args, N);
  allTrials.push(...trials);
}
process.stderr.write(`done in ${(Date.now() - t0) / 1000}s - ${allTrials.length} trials\n`);

const text =
  args.format === 'jsonl'
    ? trialsToJsonl(allTrials)
    : trialsToCSV(allTrials, {
        studyParams: {
          startSeed: args.startSeed,
          chiralityBias: args.chirality,
          strategy: args.strategy,
          compactBeta: args.beta,
          ...(args.N !== undefined ? { N: args.N } : {}),
        },
        ...(args.sweepN ? { note: `sweep_N=[${args.sweepN.join(',')}]` } : {}),
      });
emit(text, args.out);
