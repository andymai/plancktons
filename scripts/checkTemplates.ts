#!/usr/bin/env -S npx tsx
// Sanity-check that the brepjs L and R templates have correct volume,
// and that their applyMatrix-cloned copies do too.
import { applyMatrix, initFromOC, measureVolume, polyhedron, unwrap, validSolid } from 'brepjs';
import { rigidMatrixFromVerts } from '../src/lib/brepjsKernel.js';

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

console.log('R template volume:', unwrap(measureVolume(templateR)));
console.log('L template volume:', unwrap(measureVolume(templateL)));
console.log('(expected: 1/6 ≈ 0.1667 for each)');

// Now clone the L template to one of the suspect positions:
// Tet 6 verts:
const tet6Verts: [
  [number, number, number],
  [number, number, number],
  [number, number, number],
  [number, number, number],
] = [
  [1, -1, 1 / 3],
  [1, -1, -2 / 3],
  [1, 0, -2 / 3],
  [0, 0, -2 / 3],
];

const m6 = rigidMatrixFromVerts(tet6Verts, 'L');
console.log('\nrigid matrix for tet 6:');
m6.forEach((row) => console.log('  ', row));

const clone6 = unwrap(validSolid(unwrap(applyMatrix(templateL, m6))));
console.log('cloned tet 6 volume:', unwrap(measureVolume(clone6)));
console.log('(expected: 0.1667; if negative, the matrix flipped chirality)');

// Now check tet 7:
const tet7Verts: [
  [number, number, number],
  [number, number, number],
  [number, number, number],
  [number, number, number],
] = [
  [5 / 3, 0, 0],
  [5 / 3, 1, 0],
  [5 / 3, 1, 1],
  [2 / 3, 1, 1],
];
const m7 = rigidMatrixFromVerts(tet7Verts, 'L');
console.log('\nrigid matrix for tet 7:');
m7.forEach((row) => console.log('  ', row));
const clone7 = unwrap(validSolid(unwrap(applyMatrix(templateL, m7))));
console.log('cloned tet 7 volume:', unwrap(measureVolume(clone7)));
