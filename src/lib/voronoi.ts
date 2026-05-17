// Voronoi cell volumes via voxel discretization. For each tet centroid we
// compute the volume of points-closer-to-it-than-any-other-centroid within a
// padded bounding box. The fourth packing fraction
//
//   η_V = (L³/6) / ⟨V_voronoi⟩
//
// is the literature standard for random sphere packings (Scott & Kilgour 1969,
// Onoda & Liniger 1990) — V_voronoi is the per-particle "domain" measured
// directly, so η_V is intrinsic to the particle arrangement and unaffected
// by hull slack (unlike η_C) or bbox orientation (unlike η_B).
//
// Boundary cells extend to infinity in unbounded space; we treat the padded
// bbox as the container and flag cells that own any voxel on the bbox surface
// as "boundary" cells. Reported `interior_*` aggregates exclude these so the
// reported ⟨V_voronoi⟩ isn't biased by truncated cells.

import type { Vec3 } from './vec.js';
import { buildKdTree, nearest } from './kdtree.js';

export interface VoronoiResult {
  /** Cell volume per centroid, aligned with input order. */
  volumes: number[];
  /** True if the cell did NOT touch the bbox boundary. */
  bounded: boolean[];
  /** Voxel side used. */
  voxelSize: number;
  /** Grid dimensions [nx, ny, nz]. */
  dims: [number, number, number];
  /** Padded bbox origin (lower-left corner of voxel 0,0,0). */
  origin: Vec3;
  /** Sum of all cell volumes (= bbox volume modulo discretization). */
  totalVolume: number;
  /** Sum of bounded cells' volumes. */
  interiorVolume: number;
  /** Count of bounded cells. */
  interiorCount: number;
}

export interface VoronoiOptions {
  /** Voxel side length. Default L/8 — coarser than morphology, since cell
   * volumes converge quickly with N_voxels per cell. */
  voxelSize?: number;
  /** Bbox padding in units of L; expands the container so boundary cells
   * aren't clipped too aggressively. Default 1·L. */
  padL?: number;
}

/**
 * Voxel-Voronoi tessellation. Each voxel center is assigned to the nearest
 * centroid (Euclidean). Cell volume = (voxels owned) · voxelSize³.
 *
 * Cost: O(K³ · N) where K = grid resolution, N = centroid count. For typical
 * N=40-200 and K=50-80, completes in <100 ms in the worker.
 */
export function voronoiCells(
  centroids: ReadonlyArray<Vec3>,
  L: number,
  opts: VoronoiOptions = {}
): VoronoiResult | null {
  const N = centroids.length;
  if (N === 0) return null;
  const voxelSize = opts.voxelSize ?? L / 8;
  const padL = opts.padL ?? L;

  let minX = Infinity;
  let minY = Infinity;
  let minZ = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  let maxZ = -Infinity;
  for (const c of centroids) {
    if (c[0] < minX) minX = c[0];
    if (c[0] > maxX) maxX = c[0];
    if (c[1] < minY) minY = c[1];
    if (c[1] > maxY) maxY = c[1];
    if (c[2] < minZ) minZ = c[2];
    if (c[2] > maxZ) maxZ = c[2];
  }
  const origin: Vec3 = [minX - padL, minY - padL, minZ - padL];
  const dims: [number, number, number] = [
    Math.max(1, Math.ceil((maxX - minX + 2 * padL) / voxelSize)),
    Math.max(1, Math.ceil((maxY - minY + 2 * padL) / voxelSize)),
    Math.max(1, Math.ceil((maxZ - minZ + 2 * padL) / voxelSize)),
  ];
  const [nx, ny, nz] = dims;

  const volumes = new Array<number>(N).fill(0);
  const bounded = new Array<boolean>(N).fill(true);
  const voxelVol = voxelSize ** 3;

  // Bit-identical to the prior brute-force O(N) inner loop: kd-tree.nearest
  // returns the lowest-index on exact-tie, matching the strict-inequality
  // `if (d2 < best)` tie-break that the inner loop used.
  const tree = buildKdTree(centroids);
  for (let iz = 0; iz < nz; iz++) {
    const pz = origin[2] + (iz + 0.5) * voxelSize;
    const onZBoundary = iz === 0 || iz === nz - 1;
    for (let iy = 0; iy < ny; iy++) {
      const py = origin[1] + (iy + 0.5) * voxelSize;
      const onYBoundary = iy === 0 || iy === ny - 1;
      for (let ix = 0; ix < nx; ix++) {
        const px = origin[0] + (ix + 0.5) * voxelSize;
        const onBoundary = onZBoundary || onYBoundary || ix === 0 || ix === nx - 1;
        const bestIdx = nearest(tree, [px, py, pz]);
        volumes[bestIdx]! += voxelVol;
        if (onBoundary) bounded[bestIdx] = false;
      }
    }
  }

  let totalVolume = 0;
  let interiorVolume = 0;
  let interiorCount = 0;
  for (let k = 0; k < N; k++) {
    totalVolume += volumes[k]!;
    if (bounded[k]) {
      interiorVolume += volumes[k]!;
      interiorCount++;
    }
  }
  return {
    volumes,
    bounded,
    voxelSize,
    dims,
    origin,
    totalVolume,
    interiorVolume,
    interiorCount,
  };
}

/**
 * Compute η_V = V★ / ⟨V_voronoi⟩ from a Voronoi result. Uses interior cells
 * only (cells that don't touch the bbox boundary) so the average isn't
 * skewed by clipped cells. Returns null if no interior cells exist (assembly
 * smaller than 2 padL across).
 */
export function etaVFromVoronoi(v: VoronoiResult, L: number): number | null {
  if (v.interiorCount === 0) return null;
  const meanCellVolume = v.interiorVolume / v.interiorCount;
  const Vstar = L ** 3 / 6;
  return Vstar / meanCellVolume;
}
