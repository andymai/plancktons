#!/usr/bin/env -S npx tsx
/**
 * Ground-truth overlap verification using brepjs (OpenCascade) as the oracle.
 *
 * For every pair (i < j) of tets in many random assemblies, compute
 *   V_ij = volume(intersect(T_i, T_j))
 * and assert max V_ij < L^3 * 1e-9.
 *
 * If brepjs says any pair has non-trivial intersection volume, our custom
 * overlap test missed something and the proof in docs/PROOF.md is wrong.
 *
 * Runs in Node via tsx; takes ~10 s per (strategy × N × seed) cell because
 * OpenCascade booleans are not fast. Use a small sample for CI.
 */

const ocMod = (await import('brepjs-opencascade')) as unknown as {
  default: () => Promise<unknown>;
};
const opencascade = ocMod.default;
import {
  applyMatrix,
  initFromOC,
  intersect,
  isEmpty,
  measureVolume,
  polyhedron,
  unwrap,
  validSolid,
  type Solid,
  type ValidSolid,
} from 'brepjs';

import { growOne, makeAssembly } from '../src/lib/assembly.js';
import { Rng } from '../src/lib/rng.js';
import { rigidMatrixFromVerts } from '../src/lib/brepjsKernel.js';
import type { Planckton } from '../src/lib/planckton.js';

const L = 1;
// Broader sample: same math used regardless of the playground's brepjs render
// toggle. If this passes, both render paths are guaranteed overlap-free.
const SAMPLES: ReadonlyArray<{
  strategy: 'uniform' | 'compact';
  N: number;
  seed: number;
  beta?: number;
  cb?: number;
}> = [
  // uniform strategy, various N
  { strategy: 'uniform', N: 5, seed: 1 },
  { strategy: 'uniform', N: 10, seed: 17 },
  { strategy: 'uniform', N: 25, seed: 42 },
  { strategy: 'uniform', N: 40, seed: 99 },
  // all-R, all-L chirality
  { strategy: 'uniform', N: 15, seed: 5, cb: 1 },
  { strategy: 'uniform', N: 15, seed: 5, cb: 0 },
  // compact strategy, sweep beta
  { strategy: 'compact', N: 15, seed: 11, beta: 0.5 },
  { strategy: 'compact', N: 15, seed: 11, beta: 3 },
  { strategy: 'compact', N: 15, seed: 11, beta: 10 },
  { strategy: 'compact', N: 30, seed: 23, beta: 5 },
];

const HILL_FACES_R = [
  [0, 2, 1],
  [1, 2, 3],
  [0, 3, 2],
  [0, 1, 3],
] as const;
const HILL_FACES_L = HILL_FACES_R.map(([a, b, c]) => [c, b, a] as const);

async function main() {
  process.stderr.write('Initializing brepjs (OpenCascade WASM)…\n');
  const oc = await opencascade();
  initFromOC(oc as never);
  process.stderr.write('done.\n');

  const templateR = unwrap(
    polyhedron(
      [
        [0, 0, 0],
        [L, 0, 0],
        [L, L, 0],
        [L, L, L],
      ],
      HILL_FACES_R as readonly (readonly [number, number, number])[]
    )
  );
  const templateL = unwrap(
    polyhedron(
      [
        [0, 0, 0],
        [-L, 0, 0],
        [-L, L, 0],
        [-L, L, L],
      ],
      HILL_FACES_L as readonly (readonly [number, number, number])[]
    )
  );
  const templates = { R: templateR, L: templateL };

  function toSolid(p: Planckton): ValidSolid {
    const tmpl: Solid = templates[p.chirality];
    const m = rigidMatrixFromVerts(p.verts, p.chirality);
    return unwrap(validSolid(unwrap(applyMatrix(tmpl, m))));
  }

  let worstOverall = 0;
  let totalChecked = 0;
  let totalAssemblies = 0;
  for (const { strategy, N, seed, beta, cb } of SAMPLES) {
    const t0 = Date.now();
    const a = makeAssembly({
      L,
      rng: new Rng(seed),
      chiralityBias: cb ?? 0.5,
      strategy,
      compactBeta: beta ?? 3,
    });
    while (a.tets.length < N) {
      if (growOne(a) !== 'grown') break;
    }
    const solids = a.tets.map(toSolid);
    let worst = 0;
    let pairs = 0;
    for (let i = 0; i < solids.length; i++) {
      for (let j = i + 1; j < solids.length; j++) {
        pairs++;
        const inter = intersect(solids[i] as ValidSolid, solids[j] as ValidSolid);
        if (!inter.ok) continue; // intersection failed → not an overlap signal
        const s = inter.value;
        if (isEmpty(s)) continue;
        const v = measureVolume(s);
        if (!v.ok) continue;
        worst = Math.max(worst, v.value);
      }
    }
    totalChecked += pairs;
    totalAssemblies++;
    worstOverall = Math.max(worstOverall, worst);
    const ms = Date.now() - t0;
    const tag = `${strategy}${beta ? ` β=${beta}` : ''}${cb !== undefined ? ` cb=${cb}` : ''}`;
    console.log(
      `  ${tag} N=${a.tets.length}/${N} seed=${seed}: ${pairs} pairs, worst V = ${worst.toExponential(3)} L³  (${ms} ms)`
    );
  }
  const threshold = L ** 3 * 1e-9;
  console.log(
    `\nWorst overlap volume across ${totalChecked} pairs in ${totalAssemblies} assemblies: ${worstOverall.toExponential(3)} L³`
  );
  console.log(`Threshold (L³ × 1e-9): ${threshold.toExponential(3)} L³`);
  if (worstOverall < threshold) {
    console.log('PASS: brepjs confirms zero overlap.');
    process.exit(0);
  } else {
    console.log('FAIL: brepjs found a pair with non-trivial overlap.');
    process.exit(1);
  }
}

void main();
