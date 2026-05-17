// Uniform-grid spatial hash for fast neighbor lookup during growth's SAT
// overlap test. Keyed by tet centroid; cell side is sized so that any pair
// of Plancktons whose centroids land in non-adjacent cells is GUARANTEED
// non-overlapping by their bounding-sphere radius.
//
// Hill T₁ at edge L has bounding sphere radius r_b = √3·L/2 (from a vertex to
// the centroid of the opposite face's diagonal). Two tets overlap only if
// centroid distance < 2·r_b = √3·L ≈ 1.73 L. So a cell side of 2L is safe:
// any pair NOT sharing a cell-3×3×3 neighborhood is provably non-overlapping
// and can be skipped without invoking SAT.

import type { Vec3 } from './vec.js';

export interface SpatialHash {
  /** Cell side in world units. */
  cell: number;
  /** Map from "ix,iy,iz" to tet indices in that cell. */
  buckets: Map<string, number[]>;
}

export function createSpatialHash(cell: number): SpatialHash {
  return { cell, buckets: new Map() };
}

function key(ix: number, iy: number, iz: number): string {
  return `${ix},${iy},${iz}`;
}

function indexOf(h: SpatialHash, p: Vec3): [number, number, number] {
  return [Math.floor(p[0] / h.cell), Math.floor(p[1] / h.cell), Math.floor(p[2] / h.cell)];
}

export function insertTet(h: SpatialHash, idx: number, centroid: Vec3): void {
  const [ix, iy, iz] = indexOf(h, centroid);
  const k = key(ix, iy, iz);
  const bucket = h.buckets.get(k);
  if (bucket) bucket.push(idx);
  else h.buckets.set(k, [idx]);
}

/**
 * Returns indices of all tets whose centroids lie in the 3×3×3 neighborhood
 * of the query centroid's cell. With cell = 2L and Hill T bounding radius
 * √3·L/2, no two tets outside this neighborhood can possibly overlap.
 */
export function queryNeighbors(h: SpatialHash, centroid: Vec3): number[] {
  const [cx, cy, cz] = indexOf(h, centroid);
  const out: number[] = [];
  for (let dx = -1; dx <= 1; dx++) {
    for (let dy = -1; dy <= 1; dy++) {
      for (let dz = -1; dz <= 1; dz++) {
        const bucket = h.buckets.get(key(cx + dx, cy + dy, cz + dz));
        if (bucket) for (const i of bucket) out.push(i);
      }
    }
  }
  return out;
}

/** Centroid of a 4-vertex tet. */
export function tetCentroid(verts: readonly [Vec3, Vec3, Vec3, Vec3]): Vec3 {
  return [
    (verts[0][0] + verts[1][0] + verts[2][0] + verts[3][0]) / 4,
    (verts[0][1] + verts[1][1] + verts[2][1] + verts[3][1]) / 4,
    (verts[0][2] + verts[1][2] + verts[2][2] + verts[3][2]) / 4,
  ];
}
