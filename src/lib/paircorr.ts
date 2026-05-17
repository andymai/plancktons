// Pair correlation g(r) = ⟨ρ(r)⟩ / ρ_bulk for tet centroids. ρ_bulk uses the
// convex hull volume so g(r) is comparable across cluster sizes; shell
// volume 4π·r²·dr assumes 3D isotropy and over-counts near the boundary,
// but matches the standard form used in the literature.

import type { Vec3 } from './vec.js';

export interface PairCorrelation {
  /** Bin centers (units of L). */
  r: number[];
  g: number[];
  /** Pair count per bin (for SEM if desired). */
  counts: number[];
  /** Bulk number density ρ = N / V used for normalization. */
  rhoBulk: number;
}

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
  // Each unordered pair contributes 2 (i sees j at r_ij, j sees i at same r).
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
    const ideal = N * rhoBulk * shellV;
    r.push((rLo + rHi) / 2);
    g.push(ideal > 0 ? counts[k] / ideal : 0);
  }
  return { r, g, counts, rhoBulk };
}
