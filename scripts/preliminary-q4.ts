#!/usr/bin/env -S npx tsx
// One-off driver for §4.6 Q4: g(r) first-peak location for tet centroids.
// Runs `nTrials` independent face-to-face growth trials at fixed N, averages
// g(r) across the ensemble, and emits the radial bins as CSV. The first-peak
// position is left to the consumer (peak-finding is downstream of the CSV).

import { writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { growOne, makeAssembly } from '../src/lib/assembly.js';
import { computeHull } from '../src/lib/hull.js';
import { pairCorrelation } from '../src/lib/paircorr.js';
import { Rng } from '../src/lib/rng.js';
import { centroid } from '../src/lib/vec.js';
import { provenanceCsvHeader } from '../src/lib/provenance.js';
import { SEED_STRIDE } from '../src/lib/constants.js';

try {
  const sha = execFileSync('git', ['rev-parse', '--short', 'HEAD'], { encoding: 'utf-8' }).trim();
  (globalThis as Record<string, unknown>).__BUILD_COMMIT__ = sha;
  (globalThis as Record<string, unknown>).__BUILD_TIME__ = new Date().toISOString();
} catch {
  /* no git, leave 'dev' */
}

const N = 50;
const nTrials = 100;
const startSeed = 1;
const chiralityBias = 0.5;
const strategy = 'compact';
const compactBeta = 3;
const nBins = 60;
const rMax = 4; // ~ 2·R_g for N=50 compact ≈ 2·1.7 L ≈ 3.4 L; round up to 4 L.

const sumG = new Array(nBins).fill(0);
const sumCounts = new Array(nBins).fill(0);
let rArr: number[] = [];
let used = 0;
for (let t = 0; t < nTrials; t++) {
  const seed = startSeed + t * SEED_STRIDE;
  const a = makeAssembly({
    L: 1,
    rng: new Rng(seed),
    chiralityBias,
    strategy,
    compactBeta,
  });
  while (a.tets.length < N) {
    if (growOne(a) !== 'grown') break;
  }
  if (a.tets.length < 2) continue;
  const allV = a.tets.flatMap((tt) => [...tt.verts]);
  const hull = computeHull(allV);
  if (!hull) continue;
  const cents = a.tets.map((tt) => centroid(tt.verts[0], tt.verts[1], tt.verts[2], tt.verts[3]));
  const pc = pairCorrelation(cents, hull.volume, rMax, nBins);
  if (pc.r.length === 0) continue;
  if (rArr.length === 0) rArr = [...pc.r];
  for (let k = 0; k < nBins; k++) {
    sumG[k] += pc.g[k] ?? 0;
    sumCounts[k] += pc.counts[k] ?? 0;
  }
  used++;
}

const prov = provenanceCsvHeader({
  n_trials: nTrials,
  N,
  startSeed,
  chiralityBias,
  strategy,
  compactBeta,
  rMax,
  nBins,
  note: 'q4 g(r) ensemble average (compact β=3)',
});
const header = 'r,g_r,counts';
const rows = rArr.map((r, k) => `${r},${sumG[k] / used},${sumCounts[k]}`).join('\n');
const csv = [prov, header, rows].join('\n');
writeFileSync('data/preliminary/q4_gr.csv', csv);
process.stderr.write(`done: ${used}/${nTrials} trials → data/preliminary/q4_gr.csv\n`);
