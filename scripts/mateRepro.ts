#!/usr/bin/env -S npx tsx
// Smallest reproducer: mate a single new tet onto each face of a parent
// (for both child chiralities and every face/perm combo) and check brepjs
// intersection volume.
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

import { rigidMatrixFromVerts } from '../src/lib/brepjsKernel.js';
import {
  edgeSig,
  faceTriangles,
  matchPerms,
  matePlanckton,
  sigEq,
  unitPlanckton,
  type Planckton,
} from '../src/lib/planckton.js';

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

const parent = unitPlanckton(L, 'R');
const parentSolid = toSolid(parent);

console.log('Parent R tet at origin');
console.log('Mating each face × each chirality × each compatible template face:\n');

const parentFaces = faceTriangles(parent);
for (let parentFaceIdx = 0; parentFaceIdx < 4; parentFaceIdx++) {
  const target = parentFaces[parentFaceIdx]!;
  const tgtSig = edgeSig(target);
  console.log(`Parent face ${parentFaceIdx} (sig ${tgtSig.map((x) => x.toFixed(3))}):`);

  for (const childChir of ['R', 'L'] as const) {
    const child = unitPlanckton(L, childChir);
    const cfaces = faceTriangles(child);
    for (let tfIdx = 0; tfIdx < 4; tfIdx++) {
      if (!sigEq(edgeSig(cfaces[tfIdx]!), tgtSig)) continue;
      const perms = matchPerms(target, cfaces[tfIdx]!);
      for (let pi = 0; pi < perms.length; pi++) {
        const perm = perms[pi]!;
        const mated = matePlanckton(child, tfIdx, target, perm);
        const matedSolid = toSolid(mated);
        const inter = intersect(parentSolid, matedSolid);
        if (!inter.ok) {
          console.log(
            `  ${childChir} face ${tfIdx} perm[${pi}] = ${JSON.stringify(perm)}: intersect failed`
          );
          continue;
        }
        if (isEmpty(inter.value)) {
          console.log(
            `  ${childChir} face ${tfIdx} perm[${pi}] = ${JSON.stringify(perm)}: EMPTY (✓)`
          );
          continue;
        }
        const v = measureVolume(inter.value);
        if (!v.ok || v.value < 1e-9) {
          console.log(
            `  ${childChir} face ${tfIdx} perm[${pi}] = ${JSON.stringify(perm)}: face-shared (V≈0)`
          );
        } else {
          console.log(
            `  ${childChir} face ${tfIdx} perm[${pi}] = ${JSON.stringify(perm)}: OVERLAP V=${v.value.toExponential(3)}`
          );
          console.log(`    parent verts: ${JSON.stringify(parent.verts)}`);
          console.log(`    mated verts:  ${JSON.stringify(mated.verts)}`);
        }
      }
    }
  }
}
