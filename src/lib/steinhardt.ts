// Steinhardt bond-orientational order parameters Q_l. The standard
// amorphous-vs-crystalline diagnostic in condensed-matter physics: Q_l is
// rotation-invariant, vanishes for an isotropic distribution of bond
// directions, and takes characteristic values for ordered structures.
//
// For each particle i with N_b face-shared neighbors, the unit bond
// directions r_ij = (r_j - r_i) / |r_j - r_i| are decomposed onto spherical
// harmonics Y_lm:
//
//   q_lm(i) = (1/N_b) Σ_j Y_lm(θ_ij, φ_ij)
//   Q_l(i)  = sqrt(4π / (2l+1)) · sqrt(Σ_m |q_lm(i)|²)
//
// The Σ_m can be evaluated in closed form via the spherical harmonic
// addition theorem:
//
//   Σ_m Y_lm*(â) Y_lm(b̂) = ((2l+1) / 4π) · P_l(â · b̂)
//
// so Σ_m |q_lm(i)|² = ((2l+1) / 4π) · (1/N_b²) · Σ_{j,k} P_l(cos γ_jk),
// and Q_l(i) = (1/N_b) · sqrt(Σ_{j,k} P_l(r̂_ij · r̂_ik)). No spherical
// harmonics or complex arithmetic needed.
//
// Reference values (l=6):
//   FCC / HCP : Q_6 ≈ 0.575
//   BCC       : Q_6 ≈ 0.510
//   Hard-sphere glass : Q_6 ≈ 0.40
//   Random / ideal gas: Q_6 ≈ 0
//   Hill T₁ cube tiling (each tet has 4 face-shared neighbors at the cube
//   diagonal): empirically TBD - this is the canonical reference value we
//   want for comparison.
//
// Reference: P. J. Steinhardt, D. R. Nelson, M. Ronchetti, "Bond-
// orientational order in liquids and glasses", Phys. Rev. B 28, 784 (1983).

import type { Vec3 } from './vec.js';
import type { Assembly } from './assembly.js';
import { faceTriangles } from './planckton.js';

export interface SteinhardtResult {
  /** Q_l per tet, aligned with assembly.tets. Tets with z=0 (no neighbors) get NaN. */
  perTet: number[];
  /** Mean Q_l over tets with N_b ≥ 1. */
  ensemble: number;
  /** Number of tets contributing to the ensemble average. */
  contributing: number;
}

/**
 * Steinhardt bond-orientational order Q_l for the assembly. Uses face-shared
 * neighbors (the natural bond graph for face-mated Plancktons).
 *
 * @param a - assembly (vertex-coincident face mating is required for the
 *            neighbor detection to work; see issue #7's fix in #8)
 * @param l - order; 4 and 6 are the canonical choices
 */
export function steinhardtQl(a: Assembly, l: 4 | 6): SteinhardtResult {
  const N = a.tets.length;
  const neighbors = tetNeighbors(a);
  const centroids = a.tets.map((t) => tetCentroid(t.verts));
  const perTet = new Array<number>(N).fill(NaN);
  let sum = 0;
  let count = 0;
  for (let i = 0; i < N; i++) {
    const ngh = neighbors[i]!;
    if (ngh.length === 0) continue;
    const dirs: Vec3[] = ngh.map((j) => {
      const dx = centroids[j]![0] - centroids[i]![0];
      const dy = centroids[j]![1] - centroids[i]![1];
      const dz = centroids[j]![2] - centroids[i]![2];
      const len = Math.sqrt(dx * dx + dy * dy + dz * dz) || 1;
      return [dx / len, dy / len, dz / len];
    });
    let s = 0;
    for (const d1 of dirs) {
      for (const d2 of dirs) {
        const cosG = d1[0] * d2[0] + d1[1] * d2[1] + d1[2] * d2[2];
        s += legendreP(l, cosG);
      }
    }
    perTet[i] = Math.sqrt(Math.max(0, s)) / dirs.length;
    sum += perTet[i]!;
    count++;
  }
  return { perTet, ensemble: count > 0 ? sum / count : 0, contributing: count };
}

/**
 * Build the face-sharing neighbor graph for the assembly. Two tets are
 * neighbors iff they share a face triangle (same 3 vertex positions, up to
 * floating-point round-off). Requires the matePlanckton fix (#8) for the
 * vertex coincidence to actually hold.
 */
export function tetNeighbors(a: Assembly): number[][] {
  const N = a.tets.length;
  const out: number[][] = Array.from({ length: N }, () => []);
  // Hash each face by its canonical vertex-set key. Faces hashing to the
  // same bucket are shared (since two Plancktons can't share more than one
  // face by the SAT non-overlap invariant).
  const eps = 1e-6 * a.opts.L;
  const inv = 1 / eps;
  const quant = (v: Vec3): string =>
    `${Math.round(v[0] * inv)},${Math.round(v[1] * inv)},${Math.round(v[2] * inv)}`;
  const keyOf = (tri: readonly [Vec3, Vec3, Vec3]): string =>
    [quant(tri[0]), quant(tri[1]), quant(tri[2])].sort().join('|');
  const seen = new Map<string, number>();
  for (let i = 0; i < N; i++) {
    const faces = faceTriangles(a.tets[i]!);
    for (let f = 0; f < 4; f++) {
      const k = keyOf(faces[f] as [Vec3, Vec3, Vec3]);
      const prev = seen.get(k);
      if (prev !== undefined) {
        out[i]!.push(prev);
        out[prev]!.push(i);
        seen.delete(k);
      } else {
        seen.set(k, i);
      }
    }
  }
  return out;
}

/** Centroid of a tet's 4 vertices. */
function tetCentroid(v: readonly [Vec3, Vec3, Vec3, Vec3]): Vec3 {
  return [
    (v[0][0] + v[1][0] + v[2][0] + v[3][0]) / 4,
    (v[0][1] + v[1][1] + v[2][1] + v[3][1]) / 4,
    (v[0][2] + v[1][2] + v[2][2] + v[3][2]) / 4,
  ];
}

/** Legendre polynomial P_l(x). Only l ∈ {4, 6} are used here. */
function legendreP(l: 4 | 6, x: number): number {
  if (l === 4) {
    const x2 = x * x;
    return (35 * x2 * x2 - 30 * x2 + 3) / 8;
  }
  // l === 6
  const x2 = x * x;
  const x4 = x2 * x2;
  const x6 = x4 * x2;
  return (231 * x6 - 315 * x4 + 105 * x2 - 5) / 16;
}
