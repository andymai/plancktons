// Assembly model: list of Plancktons + free-face tracking + growth strategies.

import type { Rng } from './rng.js';
import type { Vec3 } from './vec.js';
import { centroid, dot, norm, sub, unit } from './vec.js';
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
  maxAttemptsPerStep?: number;
}

export interface Assembly {
  tets: Planckton[];
  freeFaces: FreeFace[];
  opts: AssemblyOptions;
}

export function makeAssembly(opts: AssemblyOptions): Assembly {
  const seed = unitPlanckton(opts.L, opts.rng.next() < opts.chiralityBias ? 'R' : 'L');
  const a: Assembly = { tets: [seed], freeFaces: [], opts };
  faceTriangles(seed).forEach((tri, fi) => {
    a.freeFaces.push({ tri, tetIdx: 0, faceIdx: fi });
  });
  return a;
}

/**
 * Try to attach one more Planckton. Returns true on success.
 */
export function growOne(a: Assembly): boolean {
  const { opts } = a;
  const maxAttempts = opts.maxAttemptsPerStep ?? 80;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    if (a.freeFaces.length === 0) return false;
    const ffIdx = pickFreeFace(a);
    const ff = a.freeFaces[ffIdx];
    if (!ff) continue;
    const tgtSig = edgeSig(ff.tri);
    const chir: Chirality = opts.rng.next() < opts.chiralityBias ? 'R' : 'L';
    const tmpl = unitPlanckton(opts.L, chir);
    const tF = faceTriangles(tmpl);
    const compat: number[] = [];
    for (let i = 0; i < 4; i++) {
      if (sigEq(edgeSig(tF[i] as [Vec3, Vec3, Vec3]), tgtSig)) compat.push(i);
    }
    if (compat.length === 0) continue;
    const tfIdx = compat[opts.rng.int(compat.length)] as number;
    const perms = matchPerms(ff.tri, tF[tfIdx] as [Vec3, Vec3, Vec3]);
    if (perms.length === 0) continue;
    const perm = perms[opts.rng.int(perms.length)] as [number, number, number];
    const newTet = matePlanckton(tmpl, tfIdx, ff.tri, perm);

    // Reject overlap with any non-parent tet.
    let overlap = false;
    for (let ti = 0; ti < a.tets.length; ti++) {
      if (ti === ff.tetIdx) continue;
      if (tetsOverlap(newTet.verts, (a.tets[ti] as Planckton).verts, opts.L)) {
        overlap = true;
        break;
      }
    }
    if (overlap) continue;

    a.tets.push(newTet);
    a.freeFaces.splice(ffIdx, 1);
    const newIdx = a.tets.length - 1;
    faceTriangles(newTet).forEach((tri, fi) => {
      if (fi !== tfIdx) a.freeFaces.push({ tri, tetIdx: newIdx, faceIdx: fi });
    });
    return true;
  }
  return false;
}

function pickFreeFace(a: Assembly): number {
  const { strategy, rng } = a.opts;
  if (strategy === 'uniform') return rng.int(a.freeFaces.length);
  // Compact: prefer free faces whose outward normal points TOWARD the
  // assembly centroid (i.e., faces in "concave" pockets).
  const c = assemblyCentroid(a);
  const weights: number[] = a.freeFaces.map((ff) => {
    const fc = centroid(ff.tri[0], ff.tri[1], ff.tri[2]);
    const dir = unit(sub(c, fc));
    const n = unit(
      cross(sub(ff.tri[1], ff.tri[0]), sub(ff.tri[2], ff.tri[0]))
    );
    // dir · normal:  +1 = normal points toward centroid (concave pocket, prefer)
    //                -1 = normal points outward (skin, deprioritize)
    return Math.exp(3 * dot(dir, n));
  });
  const total = weights.reduce((s, w) => s + w, 0);
  let pick = rng.next() * total;
  for (let i = 0; i < weights.length; i++) {
    pick -= weights[i] as number;
    if (pick <= 0) return i;
  }
  return weights.length - 1;
}

function cross(a: Vec3, b: Vec3): Vec3 {
  return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
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
  for (const t of a.tets) (t.chirality === 'R' ? R++ : L++);
  return { R, L };
}

/** Triangle-shape counts among free faces (isoceles right vs scalene right). */
export function freeFaceShapeCounts(
  a: Assembly
): { isoceles: number; scalene: number } {
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
