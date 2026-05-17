// Detect Hill cube tilings embedded within a random face-to-face aggregate.
// In the canonical 6-piece cube tiling all six Plancktons share a single
// space diagonal (the unique edge of length √3·L). So we group tets by their
// space-diagonal vertex pair and report any group of size 6 — these are the
// random aggregate's "crystalline domains", local 6-tet subsets that exactly
// reconstruct a cube.
//
// Stricter version also checks the chirality split is 3R + 3L and that the
// 6 tets' vertex set is exactly the 8 corners of a unit cube.

import type { Vec3 } from './vec.js';
import type { Assembly } from './assembly.js';

export interface EmbeddedCube {
  /** The two endpoints of the shared space diagonal. */
  diagonal: [Vec3, Vec3];
  /** Indices of the 6 (or other count) tets sharing this diagonal. */
  tetIndices: number[];
  /** R / L count among those tets. */
  chirR: number;
  chirL: number;
  /** True if the 6 tets' verts span exactly 8 distinct corners of a unit cube. */
  isCanonicalCube: boolean;
}

export interface EmbeddedCubesResult {
  /** All groups of ≥ 6 tets that share a single space diagonal. */
  groups: EmbeddedCube[];
  /** Groups that pass the canonical-cube check (3R + 3L, 8-corner cube). */
  canonical: EmbeddedCube[];
}

export function findEmbeddedCubes(a: Assembly): EmbeddedCubesResult {
  const groups = new Map<string, number[]>();
  // Each Hill T₁ has exactly one edge of length L√3 (the "space diagonal").
  // It connects the right-angle vertex to the apex. Identify by edge-length
  // comparison and hash on the canonical (sorted) vertex pair.
  const target = a.opts.L * Math.sqrt(3);
  const eps = 1e-6 * a.opts.L;
  const tol = 1e-3 * a.opts.L;
  const inv = 1 / eps;
  const quant = (v: Vec3): string =>
    `${Math.round(v[0] * inv)},${Math.round(v[1] * inv)},${Math.round(v[2] * inv)}`;
  for (let i = 0; i < a.tets.length; i++) {
    const v = a.tets[i]!.verts;
    for (let p = 0; p < 4; p++) {
      for (let q = p + 1; q < 4; q++) {
        const dx = v[q][0] - v[p][0];
        const dy = v[q][1] - v[p][1];
        const dz = v[q][2] - v[p][2];
        const d = Math.sqrt(dx * dx + dy * dy + dz * dz);
        if (Math.abs(d - target) < tol) {
          const key = [quant(v[p]), quant(v[q])].sort().join('|');
          const bucket = groups.get(key);
          if (bucket) bucket.push(i);
          else groups.set(key, [i]);
        }
      }
    }
  }
  const result: EmbeddedCube[] = [];
  for (const [key, indices] of groups) {
    if (indices.length < 6) continue;
    // Recover the diagonal endpoints from the key.
    const parts = key.split('|');
    const endpoints = parts.map((p) => {
      const [x, y, z] = p.split(',').map(Number);
      return [(x as number) * eps, (y as number) * eps, (z as number) * eps] as Vec3;
    });
    let chirR = 0;
    let chirL = 0;
    for (const ti of indices) {
      if (a.tets[ti]!.chirality === 'R') chirR++;
      else chirL++;
    }
    const isCanonicalCube =
      indices.length === 6 &&
      chirR === 3 &&
      chirL === 3 &&
      hasEightCubeCorners(
        indices.map((ti) => a.tets[ti]!.verts),
        a.opts.L
      );
    result.push({
      diagonal: [endpoints[0] as Vec3, endpoints[1] as Vec3],
      tetIndices: indices,
      chirR,
      chirL,
      isCanonicalCube,
    });
  }
  return {
    groups: result,
    canonical: result.filter((g) => g.isCanonicalCube),
  };
}

/** Verify the 6 tets' vertex set spans exactly 8 distinct points lying at
 * the corners of a unit cube. The 8 corners differ pairwise by axis-aligned
 * displacements of L, L√2, or L√3 (the cube's three edge classes); summing
 * coordinate sets and checking spans is the simplest robust test. */
function hasEightCubeCorners(tetVerts: ReadonlyArray<readonly Vec3[]>, L: number): boolean {
  const eps = 1e-6 * L;
  const inv = 1 / eps;
  const keys = new Set<string>();
  for (const verts of tetVerts) {
    for (const v of verts) {
      keys.add(`${Math.round(v[0] * inv)},${Math.round(v[1] * inv)},${Math.round(v[2] * inv)}`);
    }
  }
  if (keys.size !== 8) return false;
  // Bbox of those 8 points.
  const pts = Array.from(keys).map((k) => k.split(',').map((s) => parseInt(s, 10) * eps) as Vec3);
  let minX = Infinity;
  let minY = Infinity;
  let minZ = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  let maxZ = -Infinity;
  for (const p of pts) {
    if (p[0] < minX) minX = p[0];
    if (p[0] > maxX) maxX = p[0];
    if (p[1] < minY) minY = p[1];
    if (p[1] > maxY) maxY = p[1];
    if (p[2] < minZ) minZ = p[2];
    if (p[2] > maxZ) maxZ = p[2];
  }
  // All three axes should span exactly L.
  const tol = 1e-3 * L;
  if (Math.abs(maxX - minX - L) > tol) return false;
  if (Math.abs(maxY - minY - L) > tol) return false;
  if (Math.abs(maxZ - minZ - L) > tol) return false;
  // Every point should be at a corner of the bbox.
  const cornerKeys = new Set<string>();
  for (let dx = 0; dx < 2; dx++)
    for (let dy = 0; dy < 2; dy++)
      for (let dz = 0; dz < 2; dz++) {
        const x = dx === 0 ? minX : maxX;
        const y = dy === 0 ? minY : maxY;
        const z = dz === 0 ? minZ : maxZ;
        cornerKeys.add(`${Math.round(x * inv)},${Math.round(y * inv)},${Math.round(z * inv)}`);
      }
  for (const k of keys) {
    if (!cornerKeys.has(k)) return false;
  }
  return true;
}
