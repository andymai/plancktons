import type { Rng } from './rng.js';
import type { Vec3 } from './vec.js';
import { centroid, cross, dot, norm, sub, unit } from './vec.js';
import type { Chirality, Planckton } from './planckton.js';
import {
  edgeSig,
  faceTriangles,
  matchPerms,
  matePlanckton,
  sigEq,
  tetsOverlap,
  unitPlanckton,
} from './planckton.js';
import {
  createSpatialHash,
  insertTet,
  queryNeighbors,
  tetCentroid,
  type SpatialHash,
} from './spatialHash.js';

export interface FreeFace {
  /** Triangle in world coords */
  tri: readonly [Vec3, Vec3, Vec3];
  /** Index into Assembly.tets */
  tetIdx: number;
  /** Which face (0..3) of that tet */
  faceIdx: number;
}

export type GrowthStrategy = 'uniform' | 'compact';

export interface AssemblyOptions {
  L: number;
  rng: Rng;
  /** 0..1 = fraction right-handed (0.5 = balanced 50/50) */
  chiralityBias: number;
  strategy: GrowthStrategy;
  /**
   * Inverse-temperature β for the 'compact' strategy. p(face_i) ∝ exp(β · n̂ᵢ · ĉᵢ),
   * where n̂ᵢ is the face outward normal and ĉᵢ points from face center to
   * assembly centroid. β=0 ⇒ uniform; β→∞ ⇒ greedy compactification.
   */
  compactBeta?: number;
  maxAttemptsPerStep?: number;
}

export interface Assembly {
  tets: Planckton[];
  freeFaces: FreeFace[];
  opts: AssemblyOptions;
  /** Spatial hash of tet centroids, used to skip far-away tets in SAT. */
  spatialHash: SpatialHash;
}

export function makeAssembly(opts: AssemblyOptions): Assembly {
  const seed = unitPlanckton(opts.L, opts.rng.next() < opts.chiralityBias ? 'R' : 'L');
  // Cell side = 2L. Hill T₁ bounding-sphere radius is √3·L/2 ≈ 0.87L, so
  // any pair of centroids more than 2L apart cannot overlap. A 3×3×3
  // neighborhood query covers everything within √3·2L ≈ 3.46L, comfortably
  // larger than the 2·0.87L cutoff.
  const a: Assembly = {
    tets: [seed],
    freeFaces: [],
    opts,
    spatialHash: createSpatialHash(2 * opts.L),
  };
  insertTet(a.spatialHash, 0, tetCentroid(seed.verts));
  faceTriangles(seed).forEach((tri, fi) => {
    a.freeFaces.push({ tri, tetIdx: 0, faceIdx: fi });
  });
  return a;
}

export type GrowResult = 'grown' | 'closed' | 'jammed';

/**
 * Try to attach one more Planckton.
 *   'grown'  - placed a new tet
 *   'closed' - no free faces (assembly truly maxed out)
 *   'jammed' - free faces exist but every candidate overlapped within maxAttempts
 */
export function growOne(a: Assembly): GrowResult {
  const { opts } = a;
  if (a.freeFaces.length === 0) return 'closed';

  // Phase 1: random sampling. Fast when most candidates work.
  const maxAttempts = opts.maxAttemptsPerStep ?? 80;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const ffIdx = pickFreeFace(a);
    if (tryPlace(a, ffIdx, opts.rng.next() < opts.chiralityBias ? 'R' : 'L', opts.rng)) {
      return 'grown';
    }
  }

  // Phase 2: deterministic exhaustive search over every
  //   (free face × chirality × template face × perm)
  // combination before declaring jammed. Catches dense-packing cases where
  // random sampling kept picking the same overlapping candidates by chance.
  for (let ffIdx = 0; ffIdx < a.freeFaces.length; ffIdx++) {
    for (const chir of ['R', 'L'] as const) {
      if (tryPlaceExhaustive(a, ffIdx, chir)) return 'grown';
    }
  }
  return 'jammed';
}

/** Try a single random placement on free face `ffIdx` with chirality `chir`. */
function tryPlace(a: Assembly, ffIdx: number, chir: Chirality, rng: Rng): boolean {
  const ff = a.freeFaces[ffIdx];
  if (!ff) return false;
  const tgtSig = edgeSig(ff.tri);
  const tmpl = unitPlanckton(a.opts.L, chir);
  const tF = faceTriangles(tmpl);
  const compat: number[] = [];
  for (let i = 0; i < 4; i++) {
    if (sigEq(edgeSig(tF[i] as [Vec3, Vec3, Vec3]), tgtSig)) compat.push(i);
  }
  if (compat.length === 0) return false;
  const tfIdx = compat[rng.int(compat.length)] as number;
  const perms = matchPerms(ff.tri, tF[tfIdx] as [Vec3, Vec3, Vec3]);
  if (perms.length === 0) return false;
  const perm = perms[rng.int(perms.length)] as [number, number, number];
  return commitIfClear(a, ff, ffIdx, tmpl, tfIdx, perm);
}

/**
 * Deterministically iterate every compatible template face × perm for the
 * given free face + chirality. Used as the exhaustive fallback in growOne.
 */
function tryPlaceExhaustive(a: Assembly, ffIdx: number, chir: Chirality): boolean {
  const ff = a.freeFaces[ffIdx];
  if (!ff) return false;
  const tgtSig = edgeSig(ff.tri);
  const tmpl = unitPlanckton(a.opts.L, chir);
  const tF = faceTriangles(tmpl);
  for (let tfIdx = 0; tfIdx < 4; tfIdx++) {
    if (!sigEq(edgeSig(tF[tfIdx] as [Vec3, Vec3, Vec3]), tgtSig)) continue;
    const perms = matchPerms(ff.tri, tF[tfIdx] as [Vec3, Vec3, Vec3]);
    for (const perm of perms) {
      if (commitIfClear(a, ff, ffIdx, tmpl, tfIdx, perm)) return true;
    }
  }
  return false;
}

/**
 * Mate the template, run the SAT overlap test against every nearby tet (via
 * spatial hash; far tets are provably non-overlapping by bounding-sphere
 * radius), and append on success. Returns true iff the placement was
 * committed. SAT cost goes from O(N) per attempt to O(neighbors) ≈ O(1) once
 * the aggregate is large enough that most tets are far from the candidate.
 */
function commitIfClear(
  a: Assembly,
  ff: FreeFace,
  ffIdx: number,
  tmpl: Planckton,
  tfIdx: number,
  perm: readonly [number, number, number]
): boolean {
  const newTet = matePlanckton(tmpl, tfIdx, ff.tri, perm);
  const newCent = tetCentroid(newTet.verts);
  for (const ti of queryNeighbors(a.spatialHash, newCent)) {
    if (ti === ff.tetIdx) continue;
    if (tetsOverlap(newTet.verts, (a.tets[ti] as Planckton).verts, a.opts.L)) return false;
  }
  a.tets.push(newTet);
  a.freeFaces.splice(ffIdx, 1);
  const newIdx = a.tets.length - 1;
  insertTet(a.spatialHash, newIdx, newCent);
  faceTriangles(newTet).forEach((tri, fi) => {
    if (fi !== tfIdx) a.freeFaces.push({ tri, tetIdx: newIdx, faceIdx: fi });
  });
  return true;
}

function pickFreeFace(a: Assembly): number {
  const { strategy, rng } = a.opts;
  if (strategy === 'uniform') return rng.int(a.freeFaces.length);
  // Compact: prefer free faces whose outward normal points TOWARD the
  // assembly centroid (i.e., faces in "concave" pockets).
  const beta = a.opts.compactBeta ?? 3;
  const c = assemblyCentroid(a);
  const weights: number[] = a.freeFaces.map((ff) => {
    const fc = centroid(ff.tri[0], ff.tri[1], ff.tri[2]);
    const dir = unit(sub(c, fc));
    const n = unit(cross(sub(ff.tri[1], ff.tri[0]), sub(ff.tri[2], ff.tri[0])));
    // dir · normal:  +1 = normal points toward centroid (concave pocket, prefer)
    //                -1 = normal points outward (skin, deprioritize)
    return Math.exp(beta * dot(dir, n));
  });
  const total = weights.reduce((s, w) => s + w, 0);
  let pick = rng.next() * total;
  for (let i = 0; i < weights.length; i++) {
    pick -= weights[i] as number;
    if (pick <= 0) return i;
  }
  return weights.length - 1;
}

export function assemblyCentroid(a: Assembly): Vec3 {
  if (a.tets.length === 0) return [0, 0, 0];
  const sum: Vec3 = [0, 0, 0];
  let n = 0;
  for (const t of a.tets) {
    for (const v of t.verts) {
      sum[0] += v[0];
      sum[1] += v[1];
      sum[2] += v[2];
      n++;
    }
  }
  return [sum[0] / n, sum[1] / n, sum[2] / n];
}

/** Sum of part volumes. Equivalent to N · L³ / 6 since face-to-face never overlaps. */
export function partVolumeTotal(a: Assembly): number {
  return (a.tets.length * a.opts.L ** 3) / 6;
}

/** Surface area = sum of all FREE face areas (interior faces cancel). */
export function freeSurfaceArea(a: Assembly): number {
  let sum = 0;
  for (const ff of a.freeFaces) {
    const e1 = sub(ff.tri[1], ff.tri[0]);
    const e2 = sub(ff.tri[2], ff.tri[0]);
    sum += 0.5 * norm(cross(e1, e2));
  }
  return sum;
}

export function chiralityCounts(a: Assembly): { R: number; L: number } {
  let R = 0;
  let L = 0;
  for (const t of a.tets)
    if (t.chirality === 'R') R++;
    else L++;
  return { R, L };
}

/**
 * Vertex coordination = how many tets share each spatial vertex.
 * Quantizes vertex positions to 1e-6 · L for matching.
 */
export function vertexCoordination(a: Assembly): {
  histogram: number[];
  uniqueVertices: number;
  meanCoord: number;
  maxCoord: number;
} {
  const eps = 1e-6 * a.opts.L;
  const inv = 1 / eps;
  const map = new Map<string, number>();
  for (const t of a.tets) {
    for (const v of t.verts) {
      const key =
        Math.round(v[0] * inv) + ',' + Math.round(v[1] * inv) + ',' + Math.round(v[2] * inv);
      map.set(key, (map.get(key) ?? 0) + 1);
    }
  }
  const counts = Array.from(map.values());
  const maxCoord = counts.length > 0 ? Math.max(...counts) : 0;
  const histogram = new Array(maxCoord + 1).fill(0);
  for (const c of counts) histogram[c]++;
  const sum = counts.reduce((s, c) => s + c, 0);
  return {
    histogram,
    uniqueVertices: map.size,
    meanCoord: counts.length === 0 ? 0 : sum / counts.length,
    maxCoord,
  };
}

/** Fraction of all tet-faces that remain free (no neighbour glued). */
export function freeFaceFraction(a: Assembly): number {
  if (a.tets.length === 0) return 0;
  return a.freeFaces.length / (4 * a.tets.length);
}

/**
 * Mean tet-tet face coordination: average number of face-shared neighbors per
 * Planckton. Each tet has 4 faces; faces not in the free-face list are shared
 * with exactly one neighbor. ⟨z⟩ = 4 in a perfect tiling (cube, m³-reptile),
 * < 4 in any aggregate with surface.
 */
export function meanTetCoordination(a: Assembly): number {
  if (a.tets.length === 0) return 0;
  return (4 * a.tets.length - a.freeFaces.length) / a.tets.length;
}

/**
 * Per-tet face coordination: for each Planckton, the number of its 4 faces
 * that are NOT in the free-face list (i.e. glued to a neighbor). Returns an
 * array aligned with `a.tets`. Used to color the rendered tets by their
 * boundary-vs-interior status.
 */
export function tetCoordinations(a: Assembly): Uint8Array {
  const z = new Uint8Array(a.tets.length).fill(4);
  for (const ff of a.freeFaces) {
    if (ff.tetIdx >= 0 && ff.tetIdx < z.length) (z[ff.tetIdx] as number)--;
  }
  return z;
}

export function freeFaceShapeCounts(a: Assembly): { isoceles: number; scalene: number } {
  const L = a.opts.L;
  const isoSig: [number, number, number] = [L, L, L * Math.SQRT2].sort((x, y) => x - y) as [
    number,
    number,
    number,
  ];
  let iso = 0;
  let sca = 0;
  for (const ff of a.freeFaces) {
    const s = edgeSig(ff.tri);
    if (sigEq(s, isoSig)) iso++;
    else sca++;
  }
  return { isoceles: iso, scalene: sca };
}
