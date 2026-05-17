import { describe, expect, it } from 'vitest';
import { pairCorrelation, pairCorrelationAniso } from '../src/lib/paircorr.js';
import type { Vec3 } from '../src/lib/vec.js';

describe('pairCorrelation', () => {
  it('returns empty bins for < 2 particles', () => {
    const pc = pairCorrelation([[0, 0, 0]], 1, 1, 10);
    expect(pc.r).toEqual([]);
    expect(pc.g).toEqual([]);
    expect(pc.rhoBulk).toBe(0);
  });

  it('returns empty bins for V <= 0', () => {
    const pts: Vec3[] = [
      [0, 0, 0],
      [1, 0, 0],
    ];
    expect(pairCorrelation(pts, 0, 1, 10).r).toEqual([]);
    expect(pairCorrelation(pts, -1, 1, 10).r).toEqual([]);
  });

  it('returns empty bins for rMax <= 0', () => {
    const pts: Vec3[] = [
      [0, 0, 0],
      [1, 0, 0],
    ];
    expect(pairCorrelation(pts, 1, 0, 10).r).toEqual([]);
  });

  it('computes ρ_bulk = N / V', () => {
    const pts: Vec3[] = [
      [0, 0, 0],
      [1, 0, 0],
      [0, 1, 0],
      [0, 0, 1],
    ];
    const pc = pairCorrelation(pts, 8, 2, 4);
    expect(pc.rhoBulk).toBeCloseTo(4 / 8, 9);
  });

  it('outputs nBins r values and nBins g values', () => {
    const pts: Vec3[] = [
      [0, 0, 0],
      [1, 0, 0],
      [2, 0, 0],
    ];
    const pc = pairCorrelation(pts, 10, 3, 6);
    expect(pc.r).toHaveLength(6);
    expect(pc.g).toHaveLength(6);
    expect(pc.counts).toHaveLength(6);
  });

  it('places a pair at distance d in the bin containing d', () => {
    // Two points at distance 1.5, nBins=4 over rMax=4 → bin width 1, bin 1 = [1,2).
    const pts: Vec3[] = [
      [0, 0, 0],
      [1.5, 0, 0],
    ];
    const pc = pairCorrelation(pts, 100, 4, 4);
    // Pair (i,j) contributes 2 (symmetric); other bins should be empty.
    expect(pc.counts[0]).toBe(0);
    expect(pc.counts[1]).toBe(2);
    expect(pc.counts[2]).toBe(0);
    expect(pc.counts[3]).toBe(0);
  });

  it('ignores pairs beyond rMax', () => {
    const pts: Vec3[] = [
      [0, 0, 0],
      [10, 0, 0],
    ];
    const pc = pairCorrelation(pts, 1000, 5, 5);
    expect(pc.counts.every((c) => c === 0)).toBe(true);
  });

  it('produces g(r) ≈ 1 for a random uniform cloud (large enough N)', () => {
    // Generate 600 uniform points in a unit cube (deterministic seed).
    const N = 600;
    const pts: Vec3[] = [];
    let seed = 12345;
    const rand = () => {
      seed = (seed * 1103515245 + 12345) & 0x7fffffff;
      return seed / 0x7fffffff;
    };
    for (let i = 0; i < N; i++) pts.push([rand(), rand(), rand()]);
    const V = 1; // unit cube
    // Sample g(r) at small r where boundary correction matters less.
    const pc = pairCorrelation(pts, V, 0.3, 6);
    // Skip the first bin (r < bin width = 0.05) where shell volume is tiny and
    // discrete sampling noise dominates. Average over remaining bins.
    const meanG = pc.g.slice(2).reduce((s, x) => s + x, 0) / (pc.g.length - 2);
    expect(meanG).toBeGreaterThan(0.7);
    expect(meanG).toBeLessThan(1.3);
  });

  it('handles degenerate cases without throwing', () => {
    // All particles coincident: every pair distance is 0, all in bin 0.
    const pts: Vec3[] = [
      [0, 0, 0],
      [0, 0, 0],
      [0, 0, 0],
    ];
    const pc = pairCorrelation(pts, 1, 1, 4);
    expect(pc.counts[0]).toBeGreaterThan(0);
    expect(pc.r).toHaveLength(4);
  });
});

describe('pairCorrelationAniso', () => {
  it('returns empty bins for < 2 particles', () => {
    const pc = pairCorrelationAniso([[0, 0, 0]], [1, 0, 0], 1, 1, 10);
    expect(pc.r).toEqual([]);
    expect(pc.gPar).toEqual([]);
    expect(pc.gPerp).toEqual([]);
  });

  it('all-parallel chain → gPar high, gPerp near zero', () => {
    // 10 particles along x axis at spacing 0.5. Every pair r_ij is parallel
    // to x, so cos²(angle to x-axis) = 1 > 0.5 → all pairs go to gPar.
    const axis: Vec3 = [1, 0, 0];
    const pts: Vec3[] = [];
    for (let i = 0; i < 10; i++) pts.push([i * 0.5, 0, 0]);
    const pc = pairCorrelationAniso(pts, axis, 100, 5, 10);
    // Every counted pair is parallel; perpendicular counts must be zero.
    for (const c of pc.countsPerp) expect(c).toBe(0);
    // At least one bin in the parallel band has counts.
    expect(pc.countsPar.some((c) => c > 0)).toBe(true);
  });

  it('all-perpendicular ring → gPerp dominant', () => {
    // 12 particles uniformly around a y-z plane circle (r=1), axis = x.
    // r_ij vectors all lie in the y-z plane → perpendicular to x.
    const axis: Vec3 = [1, 0, 0];
    const pts: Vec3[] = [];
    for (let i = 0; i < 12; i++) {
      const θ = (2 * Math.PI * i) / 12;
      pts.push([0, Math.cos(θ), Math.sin(θ)]);
    }
    const pc = pairCorrelationAniso(pts, axis, 100, 2.5, 8);
    // All pairs perpendicular → zero in parallel band.
    for (const c of pc.countsPar) expect(c).toBe(0);
    expect(pc.countsPerp.some((c) => c > 0)).toBe(true);
  });

  it('gPar ≈ gPerp for an isotropic cloud (within noise)', () => {
    // Deterministic uniform-ish cloud in a unit cube.
    let seed = 12345;
    const rand = () => {
      seed = (seed * 1103515245 + 12345) & 0x7fffffff;
      return seed / 0x7fffffff;
    };
    const pts: Vec3[] = [];
    for (let i = 0; i < 500; i++) pts.push([rand(), rand(), rand()]);
    const pc = pairCorrelationAniso(pts, [1, 0, 0], 1, 0.3, 6);
    const meanPar = pc.gPar.slice(2).reduce((s, x) => s + x, 0) / (pc.gPar.length - 2);
    const meanPerp = pc.gPerp.slice(2).reduce((s, x) => s + x, 0) / (pc.gPerp.length - 2);
    // For an isotropic cloud both bands should be near 1.
    expect(meanPar).toBeGreaterThan(0.5);
    expect(meanPar).toBeLessThan(1.5);
    expect(meanPerp).toBeGreaterThan(0.5);
    expect(meanPerp).toBeLessThan(1.5);
    // And they should be similar to each other (within 50%).
    expect(Math.abs(meanPar - meanPerp) / Math.max(meanPar, meanPerp)).toBeLessThan(0.5);
  });

  it('normalizes axis defensively (un-normalized input works)', () => {
    const pts: Vec3[] = [
      [0, 0, 0],
      [1, 0, 0],
      [2, 0, 0],
    ];
    // Pass a long axis vector; should behave identically to the unit version.
    const a = pairCorrelationAniso(pts, [5, 0, 0], 100, 3, 6);
    const b = pairCorrelationAniso(pts, [1, 0, 0], 100, 3, 6);
    expect(a.countsPar).toEqual(b.countsPar);
    expect(a.countsPerp).toEqual(b.countsPerp);
  });
});
