// Pair correlation g(r) = ⟨ρ(r)⟩ / ρ_bulk for tet centroids. ρ_bulk uses the
// convex hull volume so g(r) is comparable across cluster sizes; shell volume
// 4π·r²·dr assumes 3D isotropy and over-counts near the boundary, but matches
// the standard form used in the literature.

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
  // Each unordered pair contributes 2: i sees j at r_ij, j sees i at same r.
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

export interface PairCorrelationAniso {
  r: number[];
  /** g(r) for pairs whose r_ij makes angle θ < π/4 with the axis (parallel). */
  gPar: number[];
  /** g(r) for pairs with θ > π/4 (perpendicular to the axis). */
  gPerp: number[];
  /** Pair counts per bin, parallel band. */
  countsPar: number[];
  /** Pair counts per bin, perpendicular band. */
  countsPerp: number[];
  rhoBulk: number;
}

/**
 * Pair correlation split by the angle between r_ij and a principal axis.
 * Parallel band: cos²θ > 0.5 (cone of solid angle (1−√2/2)·4π, ≈ 29%);
 * perpendicular: the remaining ≈ 71%. Each band is normalized by its own
 * ideal shell density, so a uniform isotropic cloud yields gPar ≈ gPerp ≈ 1.
 */
export function pairCorrelationAniso(
  centroids: ReadonlyArray<Vec3>,
  axis: Vec3,
  V: number,
  rMax: number,
  nBins: number
): PairCorrelationAniso {
  const N = centroids.length;
  const dr = rMax / nBins;
  const countsPar = new Array<number>(nBins).fill(0);
  const countsPerp = new Array<number>(nBins).fill(0);
  if (N < 2 || V <= 0 || dr <= 0) {
    return { r: [], gPar: [], gPerp: [], countsPar, countsPerp, rhoBulk: 0 };
  }
  // Solid-angle fractions: ω_par/4π = 1 − √2/2 ≈ 0.293, ω_perp/4π = √2/2.
  const OMEGA_PAR = 1 - Math.SQRT1_2;
  const OMEGA_PERP = Math.SQRT1_2;
  const len = Math.sqrt(axis[0] ** 2 + axis[1] ** 2 + axis[2] ** 2) || 1;
  const ax: Vec3 = [axis[0] / len, axis[1] / len, axis[2] / len];
  // Compare cos²θ to 0.5 to avoid sqrt-per-pair; equivalent to |θ| < π/4.
  const COS_SQ_45 = 0.5;
  for (let i = 0; i < N; i++) {
    const a = centroids[i] as Vec3;
    for (let j = i + 1; j < N; j++) {
      const b = centroids[j] as Vec3;
      const dx = a[0] - b[0];
      const dy = a[1] - b[1];
      const dz = a[2] - b[2];
      const d2 = dx * dx + dy * dy + dz * dz;
      const d = Math.sqrt(d2);
      if (d >= rMax || d === 0) continue;
      const cosVal = (dx * ax[0] + dy * ax[1] + dz * ax[2]) / d;
      const cosSq = cosVal * cosVal;
      const k = Math.min(nBins - 1, Math.floor(d / dr));
      if (cosSq > COS_SQ_45) countsPar[k]! += 2;
      else countsPerp[k]! += 2;
    }
  }
  const rhoBulk = N / V;
  const r: number[] = [];
  const gPar: number[] = [];
  const gPerp: number[] = [];
  for (let k = 0; k < nBins; k++) {
    const rLo = k * dr;
    const rHi = rLo + dr;
    const shellV = (4 / 3) * Math.PI * (rHi ** 3 - rLo ** 3);
    const idealPar = N * rhoBulk * shellV * OMEGA_PAR;
    const idealPerp = N * rhoBulk * shellV * OMEGA_PERP;
    r.push((rLo + rHi) / 2);
    gPar.push(idealPar > 0 ? (countsPar[k] as number) / idealPar : 0);
    gPerp.push(idealPerp > 0 ? (countsPerp[k] as number) / idealPerp : 0);
  }
  return { r, gPar, gPerp, countsPar, countsPerp, rhoBulk };
}
