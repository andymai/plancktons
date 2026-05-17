#!/usr/bin/env -S npx tsx
/**
 * Find and dump the FIRST overlap-producing pair in a small assembly so we can
 * see what placement produced the bad geometry.
 */
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

const ocMod = (await import('brepjs-opencascade')) as unknown as {
  default: () => Promise<unknown>;
};

const L = 1;
const oc = await ocMod.default();
initFromOC(oc as never);

const templateR = unwrap(
  polyhedron(
    [
      [0, 0, 0],
      [L, 0, 0],
      [L, L, 0],
      [L, L, L],
    ],
    [
      [0, 2, 1],
      [1, 2, 3],
      [0, 3, 2],
      [0, 1, 3],
    ]
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
    [
      [1, 2, 0],
      [3, 2, 1],
      [2, 3, 0],
      [3, 1, 0],
    ]
  )
);

function toSolid(p: Planckton): ValidSolid {
  const tmpl: Solid = p.chirality === 'R' ? templateR : templateL;
  const m = rigidMatrixFromVerts(p.verts, p.chirality);
  return unwrap(validSolid(unwrap(applyMatrix(tmpl, m))));
}

// Find first overlapping pair in small uniform assembly.
const a = makeAssembly({ L, rng: new Rng(1), chiralityBias: 0.5, strategy: 'uniform' });
while (a.tets.length < 8 && growOne(a) === 'grown') {
  // empty
}
console.log(`Assembly: ${a.tets.length} tets`);
for (let i = 0; i < a.tets.length; i++) {
  console.log(`  [${i}] ${a.tets[i]!.chirality} verts=${JSON.stringify(a.tets[i]!.verts)}`);
}

console.log('\nPairwise brepjs intersection volume:');
const solids = a.tets.map(toSolid);
for (let i = 0; i < solids.length; i++) {
  for (let j = i + 1; j < solids.length; j++) {
    const inter = intersect(solids[i] as ValidSolid, solids[j] as ValidSolid);
    if (!inter.ok || isEmpty(inter.value)) {
      console.log(`  (${i},${j}): empty`);
      continue;
    }
    const v = measureVolume(inter.value);
    if (!v.ok) {
      console.log(`  (${i},${j}): volume failed`);
      continue;
    }
    if (v.value > 1e-9) console.log(`  (${i},${j}): OVERLAP V = ${v.value.toExponential(3)}`);
    else console.log(`  (${i},${j}): face-shared (V ≈ 0)`);
  }
}
