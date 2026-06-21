// Contact-coordination metric for a loose (physics-packed) set of Plancktons.
// The face-mating metrics (meanTetCoordination, Steinhardt) need `freeFaces`,
// which a jammed packing does not have — so we derive an analogous coordination
// number directly from the geometric contact graph.
//
// Two tets are "in contact" when, after inflating each slightly about its
// centroid (to bridge the small residual gaps a frictionless settle leaves),
// their SAT test reports overlap. Broadphase uses the same spatial hash as the
// growth kernel.

import type { Vec3 } from './vec.js';
import { add, scl, sub } from './vec.js';
import type { RigidBody } from './rigidTet.js';
import { bodyToPlanckton } from './rigidTet.js';
import { tetsOverlap } from './planckton.js';
import { SPATIAL_HASH_CELL_FACTOR } from './constants.js';
import { createSpatialHash, insertTet, queryNeighbors, tetCentroid } from './spatialHash.js';

export interface ContactGraphResult {
  meanContactCoordination: number;
  maxContactCoordination: number;
  /** Per-tet contact count (for coordination coloring). */
  perTet: Uint8Array;
  edgeCount: number;
}

function inflate(
  verts: readonly [Vec3, Vec3, Vec3, Vec3],
  c: Vec3,
  f: number
): [Vec3, Vec3, Vec3, Vec3] {
  return verts.map((v) => add(c, scl(sub(v, c), f))) as [Vec3, Vec3, Vec3, Vec3];
}

/**
 * @param contactTol fractional inflation (e.g. 0.02 ⇒ tets grown 2%) used to
 *        count resting contacts that leave a small gap.
 */
export function contactGraph(
  bodies: ReadonlyArray<RigidBody>,
  L: number,
  contactTol = 0.02
): ContactGraphResult {
  const n = bodies.length;
  const perTet = new Uint8Array(n);
  if (n === 0)
    return { meanContactCoordination: 0, maxContactCoordination: 0, perTet, edgeCount: 0 };

  const f = 1 + contactTol;
  const verts: [Vec3, Vec3, Vec3, Vec3][] = [];
  const cents: Vec3[] = [];
  const hash = createSpatialHash(SPATIAL_HASH_CELL_FACTOR * L);
  for (let i = 0; i < n; i++) {
    const p = bodyToPlanckton(bodies[i]!);
    const c = tetCentroid(p.verts);
    cents.push(c);
    verts.push(inflate(p.verts, c, f));
    insertTet(hash, i, c);
  }

  let edgeCount = 0;
  for (let i = 0; i < n; i++) {
    const seen = new Set<number>();
    for (const j of queryNeighbors(hash, cents[i]!)) {
      if (j <= i || seen.has(j)) continue;
      seen.add(j);
      if (tetsOverlap(verts[i]!, verts[j]!, L * f)) {
        edgeCount++;
        perTet[i]!++;
        perTet[j]!++;
      }
    }
  }

  let maxCoord = 0;
  for (const c of perTet) if (c > maxCoord) maxCoord = c;
  return {
    meanContactCoordination: (2 * edgeCount) / n,
    maxContactCoordination: maxCoord,
    perTet,
    edgeCount,
  };
}
