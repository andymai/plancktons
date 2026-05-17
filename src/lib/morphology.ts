// Morphological hull V_morph: a third, physically meaningful container
// volume for the assembly. Computed by voxelizing the union of Plancktons,
// then morphologically closing the voxel grid with a ball of radius α.
//
// Why a "third η"
//   η_C = V*/V_hull    convex hull compactness (upper bound by hull slack)
//   η_B = V*/V_bbox    bbox packing fraction (literature-comparable)
//   η_M = V*/V_morph   morphological-hull / "probe-sphere" packing fraction
//
// V_morph is the volume a sphere of radius α cannot reach if it stays
// strictly outside the aggregate. Equivalently: dilate the aggregate by α,
// then erode by α (morphological closing). Pockets smaller than 2α are
// filled in; larger ones remain.
//
// Implementation: voxelize at resolution `voxelSize`, run a Chamfer-3D
// Euclidean-approximation distance transform twice (one for dilation, one
// for erosion), threshold, count.

import type { Vec3 } from './vec.js';
import type { Planckton } from './planckton.js';

export interface MorphologyResult {
  /** V_morph: closed volume in physical units (L³). */
  volume: number;
  /** Voxel side length used. */
  voxelSize: number;
  /** Grid dimensions [nx, ny, nz]. */
  dims: [number, number, number];
  /** Origin of voxel (0,0,0)'s lower-left corner in world coords. */
  origin: Vec3;
  /** Count of "inside" voxels after closing (V_morph = count × voxelSize³). */
  insideCount: number;
}

export interface MorphologyOptions {
  /** Voxel side length, in same units as tet vertices. Default L/12. */
  voxelSize?: number;
  /** Closing radius α in same units. Default L (one Planckton edge). */
  alpha?: number;
  /** Padding around aggregate bbox, in voxels, so the dilation has room. */
  padVoxels?: number;
}

/**
 * Build the morphological-hull volume for an aggregate of Plancktons.
 * Returns the closed volume (always ≥ V*) along with the underlying grid
 * descriptor for any downstream visualization.
 */
export function morphologicalHull(
  tets: ReadonlyArray<Planckton>,
  L: number,
  opts: MorphologyOptions = {}
): MorphologyResult | null {
  if (tets.length === 0) return null;
  const voxelSize = opts.voxelSize ?? L / 12;
  const alpha = opts.alpha ?? L;
  // Pad must accommodate at least one full dilation radius so the closing
  // doesn't get clipped at the grid boundary.
  const padVoxels = Math.max(opts.padVoxels ?? Math.ceil(alpha / voxelSize) + 2, 2);

  // 1. Bounding box of all vertices.
  let minX = Infinity;
  let minY = Infinity;
  let minZ = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  let maxZ = -Infinity;
  for (const t of tets) {
    for (const v of t.verts) {
      if (v[0] < minX) minX = v[0];
      if (v[0] > maxX) maxX = v[0];
      if (v[1] < minY) minY = v[1];
      if (v[1] > maxY) maxY = v[1];
      if (v[2] < minZ) minZ = v[2];
      if (v[2] > maxZ) maxZ = v[2];
    }
  }
  const origin: Vec3 = [
    minX - padVoxels * voxelSize,
    minY - padVoxels * voxelSize,
    minZ - padVoxels * voxelSize,
  ];
  const dims: [number, number, number] = [
    Math.ceil((maxX - minX) / voxelSize) + 2 * padVoxels,
    Math.ceil((maxY - minY) / voxelSize) + 2 * padVoxels,
    Math.ceil((maxZ - minZ) / voxelSize) + 2 * padVoxels,
  ];

  // 2. Voxelize: mark voxels whose centers lie inside any tet.
  const occupied = voxelize(tets, origin, dims, voxelSize);

  // 3. Closing = dilate(α) then erode(α).
  const closed = morphologicalClose(occupied, dims, alpha / voxelSize);

  // 4. Count + scale.
  let insideCount = 0;
  for (let i = 0; i < closed.length; i++) if (closed[i]) insideCount++;
  return {
    volume: insideCount * voxelSize ** 3,
    voxelSize,
    dims,
    origin,
    insideCount,
  };
}

/**
 * Sign-of-determinant point-in-tetrahedron test. Robust and branch-light.
 * Returns true iff `p` is on the same side of all 4 faces as the opposite
 * vertex (i.e., interior or on the boundary).
 */
function pointInTet(p: Vec3, t: Planckton): boolean {
  const v0 = t.verts[0];
  const v1 = t.verts[1];
  const v2 = t.verts[2];
  const v3 = t.verts[3];
  const d0 = orient3d(v0, v1, v2, v3);
  if (d0 === 0) return false; // degenerate tet
  const sign = d0 > 0 ? 1 : -1;
  // Four sub-determinants, each with `p` replacing one vertex. All four must
  // share the sign of d0 (≥ 0 after multiplying by sign).
  if (sign * orient3d(p, v1, v2, v3) < 0) return false;
  if (sign * orient3d(v0, p, v2, v3) < 0) return false;
  if (sign * orient3d(v0, v1, p, v3) < 0) return false;
  if (sign * orient3d(v0, v1, v2, p) < 0) return false;
  return true;
}

/** 6 × signed volume of tet (a,b,c,d): det of (b-a, c-a, d-a). */
function orient3d(a: Vec3, b: Vec3, c: Vec3, d: Vec3): number {
  const ax = b[0] - a[0];
  const ay = b[1] - a[1];
  const az = b[2] - a[2];
  const bx = c[0] - a[0];
  const by = c[1] - a[1];
  const bz = c[2] - a[2];
  const cx = d[0] - a[0];
  const cy = d[1] - a[1];
  const cz = d[2] - a[2];
  return ax * (by * cz - bz * cy) - ay * (bx * cz - bz * cx) + az * (bx * cy - by * cx);
}

function voxelize(
  tets: ReadonlyArray<Planckton>,
  origin: Vec3,
  dims: [number, number, number],
  voxelSize: number
): Uint8Array {
  const [nx, ny, nz] = dims;
  const grid = new Uint8Array(nx * ny * nz);

  // Per-tet bbox sweep: O(N · K³ / N) = O(K³) total across the assembly,
  // where K is the linear grid resolution. Much faster than testing every
  // voxel against every tet.
  for (const t of tets) {
    let tminX = Infinity;
    let tminY = Infinity;
    let tminZ = Infinity;
    let tmaxX = -Infinity;
    let tmaxY = -Infinity;
    let tmaxZ = -Infinity;
    for (const v of t.verts) {
      if (v[0] < tminX) tminX = v[0];
      if (v[0] > tmaxX) tmaxX = v[0];
      if (v[1] < tminY) tminY = v[1];
      if (v[1] > tmaxY) tmaxY = v[1];
      if (v[2] < tminZ) tminZ = v[2];
      if (v[2] > tmaxZ) tmaxZ = v[2];
    }
    const ix0 = Math.max(0, Math.floor((tminX - origin[0]) / voxelSize));
    const ix1 = Math.min(nx - 1, Math.ceil((tmaxX - origin[0]) / voxelSize));
    const iy0 = Math.max(0, Math.floor((tminY - origin[1]) / voxelSize));
    const iy1 = Math.min(ny - 1, Math.ceil((tmaxY - origin[1]) / voxelSize));
    const iz0 = Math.max(0, Math.floor((tminZ - origin[2]) / voxelSize));
    const iz1 = Math.min(nz - 1, Math.ceil((tmaxZ - origin[2]) / voxelSize));
    for (let iz = iz0; iz <= iz1; iz++) {
      const pz = origin[2] + (iz + 0.5) * voxelSize;
      for (let iy = iy0; iy <= iy1; iy++) {
        const py = origin[1] + (iy + 0.5) * voxelSize;
        for (let ix = ix0; ix <= ix1; ix++) {
          const idx = ix + nx * (iy + ny * iz);
          if (grid[idx]) continue;
          const px = origin[0] + (ix + 0.5) * voxelSize;
          if (pointInTet([px, py, pz], t)) grid[idx] = 1;
        }
      }
    }
  }
  return grid;
}

/** Closing = dilate then erode. Both via Chamfer-3D distance threshold. */
function morphologicalClose(
  grid: Uint8Array,
  dims: [number, number, number],
  radius: number
): Uint8Array {
  // Dilate: mark every voxel whose distance to nearest occupied is ≤ radius.
  const distOut = chamferDT3D(grid, dims, /* seedWhere= */ 1);
  const dilated = new Uint8Array(grid.length);
  for (let i = 0; i < grid.length; i++) {
    dilated[i] = distOut[i] <= radius ? 1 : 0;
  }
  // Erode: voxels whose distance to nearest empty (in dilated) is ≥ radius
  // survive the erosion. Inclusive threshold mirrors the dilate's `<=` so
  // closing is extensive (closed ⊇ original) in the discrete grid, modulo
  // Chamfer's ~0.045% per-step error.
  const distIn = chamferDT3D(dilated, dims, /* seedWhere= */ 0);
  const closed = new Uint8Array(grid.length);
  for (let i = 0; i < grid.length; i++) {
    closed[i] = distIn[i] >= radius ? 1 : 0;
  }
  return closed;
}

// Chamfer-3D Euclidean approximation weights (max error ~0.045% vs true L₂):
//   a = 1     face neighbor (6)
//   b = √2    edge neighbor (12)
//   c = √3    corner neighbor (8)
const A = 1;
const B = Math.SQRT2;
const C = Math.sqrt(3);

/**
 * 3D Chamfer distance transform. For each voxel, returns the (approximate
 * Euclidean) distance to the nearest voxel where `grid[i] === seedWhere`.
 * Two-pass scan: forward then backward.
 */
function chamferDT3D(
  grid: Uint8Array,
  dims: [number, number, number],
  seedWhere: 0 | 1
): Float32Array {
  const [nx, ny, nz] = dims;
  const N = grid.length;
  const dist = new Float32Array(N);
  for (let i = 0; i < N; i++) dist[i] = grid[i] === seedWhere ? 0 : Infinity;

  const idx = (x: number, y: number, z: number): number => x + nx * (y + ny * z);

  // Forward pass: each voxel checks the 13 already-processed neighbors.
  for (let z = 0; z < nz; z++) {
    for (let y = 0; y < ny; y++) {
      for (let x = 0; x < nx; x++) {
        const here = idx(x, y, z);
        let best = dist[here] as number;
        // z-1 plane: 9 neighbors (all already processed).
        if (z > 0) {
          best = relax(best, dist, idx(x, y, z - 1), A);
          if (y > 0) {
            best = relax(best, dist, idx(x, y - 1, z - 1), B);
            if (x > 0) best = relax(best, dist, idx(x - 1, y - 1, z - 1), C);
            if (x < nx - 1) best = relax(best, dist, idx(x + 1, y - 1, z - 1), C);
          }
          if (x > 0) best = relax(best, dist, idx(x - 1, y, z - 1), B);
          if (x < nx - 1) best = relax(best, dist, idx(x + 1, y, z - 1), B);
          if (y < ny - 1) {
            best = relax(best, dist, idx(x, y + 1, z - 1), B);
            if (x > 0) best = relax(best, dist, idx(x - 1, y + 1, z - 1), C);
            if (x < nx - 1) best = relax(best, dist, idx(x + 1, y + 1, z - 1), C);
          }
        }
        // z plane, y-1 row: 3 neighbors.
        if (y > 0) {
          best = relax(best, dist, idx(x, y - 1, z), A);
          if (x > 0) best = relax(best, dist, idx(x - 1, y - 1, z), B);
          if (x < nx - 1) best = relax(best, dist, idx(x + 1, y - 1, z), B);
        }
        // z plane, y row, x-1: 1 neighbor.
        if (x > 0) best = relax(best, dist, idx(x - 1, y, z), A);
        dist[here] = best;
      }
    }
  }

  // Backward pass: 13 not-yet-relaxed neighbors.
  for (let z = nz - 1; z >= 0; z--) {
    for (let y = ny - 1; y >= 0; y--) {
      for (let x = nx - 1; x >= 0; x--) {
        const here = idx(x, y, z);
        let best = dist[here] as number;
        if (z < nz - 1) {
          best = relax(best, dist, idx(x, y, z + 1), A);
          if (y < ny - 1) {
            best = relax(best, dist, idx(x, y + 1, z + 1), B);
            if (x > 0) best = relax(best, dist, idx(x - 1, y + 1, z + 1), C);
            if (x < nx - 1) best = relax(best, dist, idx(x + 1, y + 1, z + 1), C);
          }
          if (x > 0) best = relax(best, dist, idx(x - 1, y, z + 1), B);
          if (x < nx - 1) best = relax(best, dist, idx(x + 1, y, z + 1), B);
          if (y > 0) {
            best = relax(best, dist, idx(x, y - 1, z + 1), B);
            if (x > 0) best = relax(best, dist, idx(x - 1, y - 1, z + 1), C);
            if (x < nx - 1) best = relax(best, dist, idx(x + 1, y - 1, z + 1), C);
          }
        }
        if (y < ny - 1) {
          best = relax(best, dist, idx(x, y + 1, z), A);
          if (x > 0) best = relax(best, dist, idx(x - 1, y + 1, z), B);
          if (x < nx - 1) best = relax(best, dist, idx(x + 1, y + 1, z), B);
        }
        if (x < nx - 1) best = relax(best, dist, idx(x + 1, y, z), A);
        dist[here] = best;
      }
    }
  }
  return dist;
}

function relax(best: number, dist: Float32Array, i: number, w: number): number {
  const candidate = (dist[i] as number) + w;
  return candidate < best ? candidate : best;
}
