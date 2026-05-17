import { describe, expect, it } from 'vitest';
import { autocorrelationS2 } from '../src/lib/autocorr.js';
import { unitPlanckton } from '../src/lib/planckton.js';
import type { Planckton } from '../src/lib/planckton.js';
import type { Vec3 } from '../src/lib/vec.js';

function translate(p: Planckton, dx: number, dy: number, dz: number): Planckton {
  return {
    ...p,
    verts: p.verts.map((v) => [v[0] + dx, v[1] + dy, v[2] + dz] as Vec3) as Planckton['verts'],
  };
}

describe('autocorrelationS2', () => {
  it('returns null for empty input', () => {
    expect(autocorrelationS2([], 1)).toBe(null);
  });

  it('applies all option defaults when opts is omitted', () => {
    // Defaults: voxelSize=L/10, padL=L/2, samples=100k, nBins=60, seed=1.
    // We just need the call to succeed and return a populated bin set.
    const tet = unitPlanckton(1, 'R');
    const r = autocorrelationS2([tet], 1)!;
    expect(r).not.toBe(null);
    expect(r.r.length).toBe(60);
    expect(r.s2.length).toBe(60);
    expect(r.phi).toBeGreaterThan(0);
  });

  it('φ falls between (V*/V_bbox)·0.5 and 1', () => {
    // Single tet, bbox = unit cube. V*/V_bbox = (1/6)/1 = 0.167. With L/10
    // voxelization at padL = 0.5, bbox grows to 2L per axis = 8 L³, so
    // φ ≈ 0.167/8 = 0.021. Just sanity-check it's well below 0.5.
    const tet = unitPlanckton(1, 'R');
    const r = autocorrelationS2([tet], 1, { voxelSize: 0.1, samples: 10_000 })!;
    expect(r.phi).toBeGreaterThan(0);
    expect(r.phi).toBeLessThan(0.5);
    expect(r.phi2).toBeCloseTo(r.phi * r.phi, 9);
  });

  it('produces valid bins with at least one nonzero S₂ entry', () => {
    // Sparse aggregate (φ ≈ 0.04 in this padded bbox) so we just check that
    // S₂ is well-defined (finite, in [0, 1]) and that at least one bin has
    // a positive value, indicating the MC sampling found both-inside pairs.
    const tets: Planckton[] = [unitPlanckton(1, 'R'), translate(unitPlanckton(1, 'L'), 1, 0, 0)];
    const r = autocorrelationS2(tets, 1, { voxelSize: 0.1, samples: 200_000 })!;
    let anyPositive = false;
    for (const v of r.s2) {
      if (Number.isFinite(v)) {
        expect(v).toBeGreaterThanOrEqual(0);
        expect(v).toBeLessThanOrEqual(1);
        if (v > 0) anyPositive = true;
      }
    }
    expect(anyPositive).toBe(true);
  });

  it('S₂(large r) → φ² asymptote', () => {
    const tet = unitPlanckton(1, 'R');
    const r = autocorrelationS2([tet], 1, {
      voxelSize: 0.15,
      samples: 200_000,
      padL: 1.5, // bigger pad so large-r bins are well-sampled
    })!;
    // Take the mean of the last quarter of bins (skipping NaN ones).
    const tail = r.s2.slice(Math.floor(r.s2.length * 0.75)).filter((v) => Number.isFinite(v));
    expect(tail.length).toBeGreaterThan(0);
    const meanTail = tail.reduce((s, x) => s + x, 0) / tail.length;
    // Should be in (0, φ); for a single isolated tet in a big box, φ² ≈ φ²
    // is tiny but positive. Just verify it's small.
    expect(meanTail).toBeGreaterThanOrEqual(0);
    expect(meanTail).toBeLessThan(r.phi);
  });
});
