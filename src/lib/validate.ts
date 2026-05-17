// Strict overlap audit for assemblies. Used in tests and (optionally) at
// runtime to catch invalid placements.

import type { Assembly } from './assembly.js';
import { tetsOverlap } from './planckton.js';
import type { Planckton } from './planckton.js';
import { centroid, dot, sub } from './vec.js';
import { faceNormal } from './planckton.js';

export interface OverlapReport {
  a: number;
  b: number;
  ta: Planckton;
  tb: Planckton;
}

/** Return every pair (i<j) of tets whose interiors overlap. */
export function findOverlaps(assembly: Assembly, edgeLen: number): OverlapReport[] {
  const out: OverlapReport[] = [];
  const tets = assembly.tets;
  for (let i = 0; i < tets.length; i++) {
    for (let j = i + 1; j < tets.length; j++) {
      const ti = tets[i] as Planckton;
      const tj = tets[j] as Planckton;
      if (tetsOverlap(ti.verts, tj.verts, edgeLen)) {
        out.push({ a: i, b: j, ta: ti, tb: tj });
      }
    }
  }
  return out;
}

/**
 * Side test: where does B's centroid sit relative to face F (with outward normal n)?
 * Returns the signed distance (positive = on +n side, negative = on -n side).
 */
export function sideOfFace(
  faceTri: readonly [readonly [number, number, number], readonly [number, number, number], readonly [number, number, number]],
  point: readonly [number, number, number]
): number {
  const a = faceTri[0] as [number, number, number];
  const b = faceTri[1] as [number, number, number];
  const c = faceTri[2] as [number, number, number];
  const n = faceNormal([a, b, c]);
  return dot(sub(point as [number, number, number], a), n);
}

/**
 * After mating template onto a target face of parent, the new tet's centroid
 * should be on the +tN side (opposite of where parent sits). Returns false
 * if the new tet ends up on the WRONG side (i.e., overlaps with parent).
 */
export function mateOnCorrectSide(
  newTet: Planckton,
  target: readonly [readonly [number, number, number], readonly [number, number, number], readonly [number, number, number]],
  parent: Planckton
): boolean {
  const newC = centroid(newTet.verts[0], newTet.verts[1], newTet.verts[2], newTet.verts[3]);
  const parC = centroid(parent.verts[0], parent.verts[1], parent.verts[2], parent.verts[3]);
  const sideNew = sideOfFace(target, newC);
  const sideParent = sideOfFace(target, parC);
  // For face-to-face mating, parent and new tet sit on OPPOSITE sides of the face plane.
  return Math.sign(sideNew) !== Math.sign(sideParent) && Math.abs(sideNew) > 1e-9;
}
