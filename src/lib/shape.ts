// Shape descriptors for a 3D point cloud (assembly vertices or centroids).
//
// The gyration tensor Σ_{ij} = (1/N) Σ_α (r_α - r_cm)_i (r_α - r_cm)_j has
// eigenvalues λ₁ ≥ λ₂ ≥ λ₃. From these:
//
//   • R_g² = tr Σ = λ₁ + λ₂ + λ₃               radius of gyration squared
//   • asphericity   κ² = (1/2)·((λ₁−λ₂)² + (λ₂−λ₃)² + (λ₃−λ₁)²) / R_g⁴
//                       Equivalent (and more common):
//                       b  = λ₁ − (λ₂+λ₃)/2     prolateness-aware
//                       κ² = b² + (3/4) c²       where c is acylindricity
//   • acylindricity c = λ₂ − λ₃
//   • prolateness   S = (3λ₁ − tr) (3λ₂ − tr) (3λ₃ − tr) / (tr)³
//                       S > 0 prolate (rod-like), S < 0 oblate (disc-like)
//
// References:
//   Theodorou & Suter, Macromolecules 18, 1206 (1985).
//   Rudnick & Gaspari, J. Phys. A 19, L191 (1986).

import type { Vec3 } from './vec.js';

export interface ShapeDescriptors {
  /** Centroid of the cloud. */
  com: Vec3;
  /** Sorted eigenvalues λ₁ ≥ λ₂ ≥ λ₃ of the gyration tensor. */
  lambdas: [number, number, number];
  /** Orthonormal eigenvectors corresponding to lambdas (columns). */
  axes: [Vec3, Vec3, Vec3];
  /** Radius of gyration  R_g = √(λ₁+λ₂+λ₃). */
  rg: number;
  /**
   * Rudnick–Gaspari asphericity  b = λ₁ − ½(λ₂+λ₃).
   * Has units of length²; 0 for spherical, up to (3/2)·R_g² for a perfect rod.
   */
  asphericity: number;
  /** Acylindricity  c = λ₂ − λ₃ ≥ 0  (units of length²). */
  acylindricity: number;
  /**
   * Relative shape anisotropy  κ² = (b² + ¾c²) / (tr Σ)² ∈ [0, 1].
   * 0 = isotropic (sphere-like); 1 = rod-like (all mass on one axis).
   * (Theodorou–Suter / Rudnick–Gaspari normalization.)
   */
  kappaSq: number;
  /**
   * Prolateness parameter  S = (3λ₁−tr)(3λ₂−tr)(3λ₃−tr) / (tr)³ ∈ [−¼, 2].
   * S > 0 prolate (rod-like); S < 0 oblate (disc-like); 0 spherical.
   */
  prolateness: number;
}

/** 3×3 symmetric matrix eigendecomposition via Jacobi sweeps. Stable and
 * sufficient for the well-conditioned gyration tensor. Returns eigenvalues
 * sorted descending with corresponding eigenvectors as columns. */
function eigSymmetric3(
  m: [[number, number, number], [number, number, number], [number, number, number]]
): { values: [number, number, number]; vectors: [Vec3, Vec3, Vec3] } {
  const a: number[][] = m.map((row) => [...row]);
  const v: number[][] = [
    [1, 0, 0],
    [0, 1, 0],
    [0, 0, 1],
  ];
  for (let sweep = 0; sweep < 50; sweep++) {
    let off = 0;
    for (let i = 0; i < 3; i++)
      for (let j = 0; j < 3; j++) if (i !== j) off += a[i]![j]! * a[i]![j]!;
    if (off < 1e-22) break;
    for (let p = 0; p < 2; p++) {
      for (let q = p + 1; q < 3; q++) {
        const apq = a[p]![q]!;
        if (Math.abs(apq) < 1e-18) continue;
        const app = a[p]![p]!;
        const aqq = a[q]![q]!;
        const theta = (aqq - app) / (2 * apq);
        const t =
          theta >= 0
            ? 1 / (theta + Math.sqrt(1 + theta * theta))
            : 1 / (theta - Math.sqrt(1 + theta * theta));
        const c = 1 / Math.sqrt(1 + t * t);
        const s = t * c;
        a[p]![p] = app - t * apq;
        a[q]![q] = aqq + t * apq;
        a[p]![q] = 0;
        a[q]![p] = 0;
        for (let i = 0; i < 3; i++) {
          if (i !== p && i !== q) {
            const aip = a[i]![p]!;
            const aiq = a[i]![q]!;
            a[i]![p] = c * aip - s * aiq;
            a[i]![q] = s * aip + c * aiq;
            a[p]![i] = a[i]![p]!;
            a[q]![i] = a[i]![q]!;
          }
          const vip = v[i]![p]!;
          const viq = v[i]![q]!;
          v[i]![p] = c * vip - s * viq;
          v[i]![q] = s * vip + c * viq;
        }
      }
    }
  }
  const eigs: Array<{ lam: number; vec: Vec3 }> = [
    { lam: a[0]![0]!, vec: [v[0]![0]!, v[1]![0]!, v[2]![0]!] },
    { lam: a[1]![1]!, vec: [v[0]![1]!, v[1]![1]!, v[2]![1]!] },
    { lam: a[2]![2]!, vec: [v[0]![2]!, v[1]![2]!, v[2]![2]!] },
  ];
  eigs.sort((x, y) => y.lam - x.lam);
  return {
    values: [eigs[0]!.lam, eigs[1]!.lam, eigs[2]!.lam],
    vectors: [eigs[0]!.vec, eigs[1]!.vec, eigs[2]!.vec],
  };
}

export function gyrationDescriptors(points: ReadonlyArray<Vec3>): ShapeDescriptors | null {
  if (points.length < 2) return null;
  let cx = 0,
    cy = 0,
    cz = 0;
  for (const p of points) {
    cx += p[0];
    cy += p[1];
    cz += p[2];
  }
  cx /= points.length;
  cy /= points.length;
  cz /= points.length;
  let xx = 0,
    yy = 0,
    zz = 0,
    xy = 0,
    xz = 0,
    yz = 0;
  for (const p of points) {
    const dx = p[0] - cx;
    const dy = p[1] - cy;
    const dz = p[2] - cz;
    xx += dx * dx;
    yy += dy * dy;
    zz += dz * dz;
    xy += dx * dy;
    xz += dx * dz;
    yz += dy * dz;
  }
  xx /= points.length;
  yy /= points.length;
  zz /= points.length;
  xy /= points.length;
  xz /= points.length;
  yz /= points.length;
  const m: [[number, number, number], [number, number, number], [number, number, number]] = [
    [xx, xy, xz],
    [xy, yy, yz],
    [xz, yz, zz],
  ];
  const { values, vectors } = eigSymmetric3(m);
  const [l1, l2, l3] = values;
  const tr = l1 + l2 + l3;
  const rg = Math.sqrt(Math.max(0, tr));
  // Asphericity in the Rudnick-Gaspari normalization,
  //   b = l1 − (l2 + l3)/2,   c = l2 − l3,   κ² = (b² + 0.75 c²) / tr² ∈ [0, 1]
  const b = l1 - (l2 + l3) / 2;
  const c = l2 - l3;
  const kappaSq = tr > 1e-15 ? (b * b + 0.75 * c * c) / (tr * tr) : 0;
  // Prolateness S (range [−0.25, 2])
  const meanL = tr / 3;
  const num = (l1 - meanL) * (l2 - meanL) * (l3 - meanL);
  const denom = meanL * meanL * meanL;
  const prolateness = denom > 1e-15 ? num / denom : 0;
  return {
    com: [cx, cy, cz],
    lambdas: [l1, l2, l3],
    axes: vectors,
    rg,
    asphericity: b,       // literature b (length²) — not yet normalized
    acylindricity: c,     // literature c (length²)
    kappaSq,              // dimensionless ∈ [0, 1]
    prolateness,
  };
}
