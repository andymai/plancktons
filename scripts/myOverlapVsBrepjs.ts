#!/usr/bin/env -S npx tsx
// For each pair flagged by brepjs as overlapping, also run my custom
// tetsOverlap and report the disagreement.
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
import { tetsOverlap, type Planckton } from '../src/lib/planckton.js';

const ocMod = (await import('brepjs-opencascade')) as unknown as {
  default: () => Promise<unknown>;
};
const oc = await ocMod.default();
initFromOC(oc as never);

const L = 1;
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

const a = makeAssembly({
  L,
  rng: new Rng(11),
  chiralityBias: 0.5,
  strategy: 'compact',
  compactBeta: 3,
});
while (a.tets.length < 9 && growOne(a) === 'grown') {
  // empty
}
console.log(`Assembly: ${a.tets.length} tets (compact seed=11)`);

const solids = a.tets.map(toSolid);

for (let i = 0; i < solids.length; i++) {
  for (let j = i + 1; j < solids.length; j++) {
    const inter = intersect(solids[i] as ValidSolid, solids[j] as ValidSolid);
    if (!inter.ok || isEmpty(inter.value)) continue;
    const v = measureVolume(inter.value);
    if (!v.ok || v.value < 1e-6) continue;

    // brepjs says they overlap. What does my test say?
    const myTest = tetsOverlap(a.tets[i]!.verts, a.tets[j]!.verts, L);
    console.log(
      `  (${i},${j}) brepjs V=${v.value.toExponential(3)}  myTest=${myTest ? 'OVERLAP' : 'no-overlap (BUG)'}`
    );
    if (!myTest) {
      console.log(`    tet ${i} (${a.tets[i]!.chirality}): ${JSON.stringify(a.tets[i]!.verts)}`);
      console.log(`    tet ${j} (${a.tets[j]!.chirality}): ${JSON.stringify(a.tets[j]!.verts)}`);
    }
  }
}
