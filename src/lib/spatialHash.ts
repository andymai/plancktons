// Uniform-grid spatial hash for fast neighbor lookup during growth's SAT
// overlap test, keyed by tet centroid.
//
// Hill T₁ at edge L has vertices (0,0,0), (L,0,0), (L,L,0), (L,L,L); centroid
// (3L/4, L/2, L/4). The farthest vertices (V0 and V3) are at distance √14/4·L
// ≈ 0.935·L from the centroid, so the bounding-sphere radius is r_b = √14/4·L
// and two tets are guaranteed non-overlapping when centroid distance exceeds
// 2 r_b = √14/2·L ≈ 1.87 L.
//
// With cell side 2L, two tets in cells more than 1 cell apart in any axis are
// separated by at least 2L > 1.87 L, so the 3×3×3 cell neighborhood is a
// sound (conservative) candidate set for SAT testing. Margin = 0.13 L; shrink
// the cell or use a tighter test only with a fresh proof.

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
 * Returns indices of all tets whose centroids lie in the 3×3×3 cell
 * neighborhood of the query centroid's cell. With cell = 2L, no two tets
 * outside this neighborhood can possibly overlap.
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

export function tetCentroid(verts: readonly [Vec3, Vec3, Vec3, Vec3]): Vec3 {
  return [
    (verts[0][0] + verts[1][0] + verts[2][0] + verts[3][0]) / 4,
    (verts[0][1] + verts[1][1] + verts[2][1] + verts[3][1]) / 4,
    (verts[0][2] + verts[1][2] + verts[2][2] + verts[3][2]) / 4,
  ];
}
