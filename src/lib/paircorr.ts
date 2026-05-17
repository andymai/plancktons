// Pair correlation function g(r) for the assembly's tet centroids.
//
// Definition:
//   g(r) = ⟨ρ(r)⟩ / ρ_bulk
// where ρ(r) is the local density at distance r from a particle averaged over
// all particles, and ρ_bulk = N / V is the bulk number density. For a uniform
// random distribution g(r) → 1; for a periodic crystal g(r) shows sharp peaks
// at lattice distances; for an amorphous solid g(r) shows broad peaks decaying
// to 1.
//
// We use the convex hull volume for ρ_bulk so g(r) is comparable across
// different cluster sizes. The shell volume normalization 4π·r²·dr assumes
// 3D isotropy; for the small clusters here that's an approximation that
// over-counts near the boundary, but it's the standard form.

import type { Vec3 } from './vec.js';

export interface PairCorrelation {
  /** Bin centers (units of L). */
  r: number[];
  /** g(r) values. */
  g: number[];
  /** Number of pairs contributing to each bin (for SEM if desired). */
  counts: number[];
  /** Bulk number density ρ = N / V used for normalization. */
  rhoBulk: number;
}

/**
 * Compute g(r) from a set of centroids inside a container of volume V.
 *
 * @param centroids tet centroid positions
 * @param V         container volume (use convex hull volume of the aggregate)
 * @param rMax      maximum r to consider (units of length)
 * @param nBins     number of radial bins
 */
export function pairCorrelation(
  centroids: ReadonlyArray<Vec3>,
  V: number,
  rMax: number,
  nBins: number
): PairCorrelation {
  const N = centroids.length;
  const dr = rMax / nBins;
  const counts = new Array(nBins).fill(0);
  if (N < 2 || V <= 0 || dr <= 0) {
    return { r: [], g: [], counts, rhoBulk: 0 };
  }
  // Pair distances: each unordered pair contributes 2 to the per-particle
  // shell count (i sees j at distance r_ij, j sees i at the same distance).
  for (let i = 0; i < N; i++) {
    const a = centroids[i] as Vec3;
    for (let j = i + 1; j < N; j++) {
      const b = centroids[j] as Vec3;
      const dx = a[0] - b[0];
      const dy = a[1] - b[1];
      const dz = a[2] - b[2];
      const d = Math.sqrt(dx * dx + dy * dy + dz * dz);
      if (d >= rMax) continue;
      const k = Math.min(nBins - 1, Math.floor(d / dr));
      counts[k] += 2;
    }
  }
  const rhoBulk = N / V;
  const r: number[] = [];
  const g: number[] = [];
  for (let k = 0; k < nBins; k++) {
    const rLo = k * dr;
    const rHi = rLo + dr;
    const shellV = (4 / 3) * Math.PI * (rHi ** 3 - rLo ** 3);
    const ideal = N * rhoBulk * shellV; // expected pair count in shell for uniform random
    r.push((rLo + rHi) / 2);
    g.push(ideal > 0 ? counts[k] / ideal : 0);
  }
  return { r, g, counts, rhoBulk };
}
