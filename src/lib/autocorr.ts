// Two-point volume autocorrelation S₂(r) for a voxelized aggregate.
//
//   S₂(r) = P( I(x) = 1  AND  I(x + r·n̂) = 1 )
//
// where I is the binary indicator of "inside the aggregate" and the
// probability is over uniform x and isotropic n̂. Limits:
//
//   S₂(0) = φ      (volume fraction φ inside the aggregate)
//   S₂(∞) = φ²     (the two points become statistically independent)
//
// Intermediate S₂(r) reveals characteristic length scales: the "correlation
// length" where S₂ falls from φ to φ² approximates the typical feature size.
// Directly comparable to small-angle scattering data via Fourier transform:
//   I(q) ∝ FT{ S₂(r) − φ² }
//
// Computed by Monte Carlo sampling of voxel pairs (uniform from the bbox).
// Cost is O(samples), independent of voxel count, so we can use many samples
// (10^5) for smooth curves.

import type { Planckton } from './planckton.js';
import { Rng } from './rng.js';
import { voxelizeTets } from './morphology.js';

export interface AutocorrResult {
  /** Bin centers in units of L. */
  r: number[];
  /** S₂(r) — both-inside probability per bin. */
  s2: number[];
  /** Sample count per bin (denominator). */
  counts: number[];
  /** Estimated volume fraction φ = S₂(0). */
  phi: number;
  /** φ² asymptote. */
  phi2: number;
  /** Voxel side used for the indicator. */
  voxelSize: number;
}

export interface AutocorrOptions {
  /** Voxel side. Default L/10. */
  voxelSize?: number;
  /** Padding around the aggregate bbox in L units. Default 0.5 L. */
  padL?: number;
  /** Number of voxel-pair samples. Default 1e5. */
  samples?: number;
  /** Number of radial bins from 0 to rMax. Default 60. */
  nBins?: number;
  /** Maximum r in L units. Default = bbox diagonal. */
  rMax?: number;
  /** RNG seed for the Monte Carlo pair sampling. Default 1. */
  seed?: number;
}

/**
 * S₂(r) via Monte Carlo pair sampling on the voxelized aggregate.
 */
export function autocorrelationS2(
  tets: ReadonlyArray<Planckton>,
  L: number,
  opts: AutocorrOptions = {}
): AutocorrResult | null {
  if (tets.length === 0) return null;
  const voxelSize = opts.voxelSize ?? L / 10;
  const padL = opts.padL ?? 0.5 * L;
  const samples = opts.samples ?? 100_000;
  const nBins = opts.nBins ?? 60;
  const seed = opts.seed ?? 1;

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
  const ox = minX - padL;
  const oy = minY - padL;
  const oz = minZ - padL;
  const sx = maxX - minX + 2 * padL;
  const sy = maxY - minY + 2 * padL;
  const sz = maxZ - minZ + 2 * padL;
  const rMax = opts.rMax ?? Math.sqrt(sx * sx + sy * sy + sz * sz);
  const dr = rMax / nBins;

  const nx = Math.max(1, Math.ceil(sx / voxelSize));
  const ny = Math.max(1, Math.ceil(sy / voxelSize));
  const nz = Math.max(1, Math.ceil(sz / voxelSize));
  const indicator = voxelizeTets(tets, [ox, oy, oz], [nx, ny, nz], voxelSize);

  let insideCount = 0;
  for (let i = 0; i < indicator.length; i++) if (indicator[i]) insideCount++;
  const phi = insideCount / indicator.length;

  const numerator = new Float64Array(nBins);
  const denominator = new Float64Array(nBins);
  const rng = new Rng(seed);
  // Sampling directly on voxel indices (uniform over the grid) makes the
  // indicator lookups O(1) and avoids interpolation.
  for (let s = 0; s < samples; s++) {
    const i1 = (rng.int(nx) + nx * (rng.int(ny) + ny * rng.int(nz))) | 0;
    const i2 = (rng.int(nx) + nx * (rng.int(ny) + ny * rng.int(nz))) | 0;
    if (i1 === i2) continue;
    const v1z = Math.floor(i1 / (nx * ny));
    const v1y = Math.floor((i1 - v1z * nx * ny) / nx);
    const v1x = i1 - v1z * nx * ny - v1y * nx;
    const v2z = Math.floor(i2 / (nx * ny));
    const v2y = Math.floor((i2 - v2z * nx * ny) / nx);
    const v2x = i2 - v2z * nx * ny - v2y * nx;
    const dx = (v2x - v1x) * voxelSize;
    const dy = (v2y - v1y) * voxelSize;
    const dz = (v2z - v1z) * voxelSize;
    const r = Math.sqrt(dx * dx + dy * dy + dz * dz);
    if (r >= rMax) continue;
    const bin = Math.min(nBins - 1, Math.floor(r / dr));
    denominator[bin]! += 1;
    if (indicator[i1] && indicator[i2]) numerator[bin]! += 1;
  }
  const r: number[] = [];
  const s2: number[] = [];
  const counts: number[] = [];
  for (let k = 0; k < nBins; k++) {
    r.push((k + 0.5) * dr);
    s2.push(denominator[k]! > 0 ? numerator[k]! / denominator[k]! : NaN);
    counts.push(denominator[k]!);
  }
  return { r, s2, counts, phi, phi2: phi * phi, voxelSize };
}
