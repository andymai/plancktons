// Morphological hull V_morph: a third container volume for the assembly,
// alongside the convex hull (η_C = V*/V_hull) and bbox (η_B = V*/V_bbox).
// V_morph is the volume a sphere of radius α cannot reach if it stays strictly
// outside the aggregate — equivalently the morphological closing (dilate by α,
// then erode by α). Pockets smaller than 2α are filled in; larger ones remain.
// Implemented by voxelizing then running a Chamfer-3D distance transform twice
// (once for dilation, once for erosion).

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
  // Pad must accommodate one full dilation radius or the closing gets clipped.
  const padVoxels = Math.max(opts.padVoxels ?? Math.ceil(alpha / voxelSize) + 2, 2);

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

  const occupied = voxelizeTets(tets, origin, dims, voxelSize);
  const closed = morphologicalClose(occupied, dims, alpha / voxelSize);

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
 * Sign-of-determinant point-in-tetrahedron test: p lies inside iff each of the
 * four sub-determinants (replacing one vertex with p) has the same sign as the
 * tet's own orientation. Includes the boundary.
 */
export function pointInTet(p: Vec3, t: Planckton): boolean {
  const v0 = t.verts[0];
  const v1 = t.verts[1];
  const v2 = t.verts[2];
  const v3 = t.verts[3];
  const d0 = orient3d(v0, v1, v2, v3);
  if (d0 === 0) return false;
  const sign = d0 > 0 ? 1 : -1;
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

/**
 * Build an occupancy indicator grid for a tet aggregate. Per-tet bbox sweep:
 * O(K³) total across the assembly (K = linear grid res), vs O(N · K³) for
 * testing every voxel against every tet.
 */
export function voxelizeTets(
  tets: ReadonlyArray<Planckton>,
  origin: Vec3,
  dims: [number, number, number],
  voxelSize: number
): Uint8Array {
  const [nx, ny, nz] = dims;
  const grid = new Uint8Array(nx * ny * nz);
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
  // Dilate: distance to nearest occupied ≤ radius.
  const distOut = chamferDT3D(grid, dims, 1);
  const dilated = new Uint8Array(grid.length);
  for (let i = 0; i < grid.length; i++) {
    dilated[i] = distOut[i] <= radius ? 1 : 0;
  }
  // Erode: distance to nearest empty (in dilated) ≥ radius. Inclusive
  // threshold mirrors dilate's `<=`, keeping closing extensive (closed ⊇
  // original) modulo Chamfer's ~0.045% per-step error.
  const distIn = chamferDT3D(dilated, dims, 0);
  const closed = new Uint8Array(grid.length);
  for (let i = 0; i < grid.length; i++) {
    closed[i] = distIn[i] >= radius ? 1 : 0;
  }
  return closed;
}

// Chamfer-3D Euclidean approximation weights (max error ~0.045% vs true L₂):
// 1 = face neighbor (6), √2 = edge neighbor (12), √3 = corner neighbor (8).
const A = 1;
const B = Math.SQRT2;
const C = Math.sqrt(3);

// 13 causal neighbors in scan order: the z-1 plane (9), the (y-1, z) row (3),
// and (x-1, y, z) (1). The backward pass uses the same offsets negated.
const FWD_NEIGHBORS: ReadonlyArray<readonly [number, number, number, number]> = [
  [0, 0, -1, A],
  [0, -1, -1, B],
  [-1, -1, -1, C],
  [1, -1, -1, C],
  [-1, 0, -1, B],
  [1, 0, -1, B],
  [0, 1, -1, B],
  [-1, 1, -1, C],
  [1, 1, -1, C],
  [0, -1, 0, A],
  [-1, -1, 0, B],
  [1, -1, 0, B],
  [-1, 0, 0, A],
];

/**
 * 3D Chamfer distance transform. For each voxel, returns the (approximate
 * Euclidean) distance to the nearest voxel where `grid[i] === seedWhere`.
 * Two-pass scan: forward then backward over the 13 causal neighbors.
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

  for (let z = 0; z < nz; z++) {
    for (let y = 0; y < ny; y++) {
      for (let x = 0; x < nx; x++) {
        let best = dist[x + nx * (y + ny * z)] as number;
        for (const [dx, dy, dz, w] of FWD_NEIGHBORS) {
          const nxp = x + dx;
          const nyp = y + dy;
          const nzp = z + dz;
          if (nxp < 0 || nxp >= nx || nyp < 0 || nyp >= ny || nzp < 0 || nzp >= nz) continue;
          const candidate = (dist[nxp + nx * (nyp + ny * nzp)] as number) + w;
          if (candidate < best) best = candidate;
        }
        dist[x + nx * (y + ny * z)] = best;
      }
    }
  }

  for (let z = nz - 1; z >= 0; z--) {
    for (let y = ny - 1; y >= 0; y--) {
      for (let x = nx - 1; x >= 0; x--) {
        let best = dist[x + nx * (y + ny * z)] as number;
        for (const [dx, dy, dz, w] of FWD_NEIGHBORS) {
          const nxp = x - dx;
          const nyp = y - dy;
          const nzp = z - dz;
          if (nxp < 0 || nxp >= nx || nyp < 0 || nyp >= ny || nzp < 0 || nzp >= nz) continue;
          const candidate = (dist[nxp + nx * (nyp + ny * nzp)] as number) + w;
          if (candidate < best) best = candidate;
        }
        dist[x + nx * (y + ny * z)] = best;
      }
    }
  }
  return dist;
}
