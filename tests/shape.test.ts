import { describe, expect, it } from 'vitest';
import { gyrationDescriptors } from '../src/lib/shape.js';
import { Rng } from '../src/lib/rng.js';
import type { Vec3 } from '../src/lib/vec.js';

describe('gyrationDescriptors', () => {
  it('returns null for < 2 points', () => {
    expect(gyrationDescriptors([])).toBe(null);
    expect(gyrationDescriptors([[0, 0, 0]])).toBe(null);
  });

  it('isotropic sphere cloud: κ² ≪ 1, prolateness ≈ 0', () => {
    const pts: Vec3[] = [];
    const rng = new Rng(7);
    while (pts.length < 400) {
      const x = 2 * rng.next() - 1;
      const y = 2 * rng.next() - 1;
      const z = 2 * rng.next() - 1;
      if (x * x + y * y + z * z <= 1) pts.push([x, y, z]);
    }
    const d = gyrationDescriptors(pts)!;
    expect(d.kappaSq).toBeLessThan(0.02);
    expect(Math.abs(d.prolateness)).toBeLessThan(0.2);
  });

  it('rod along x-axis: κ² → 1, prolateness = 2', () => {
    const pts: Vec3[] = [];
    for (let i = 0; i < 50; i++) pts.push([i, 0, 0]);
    const d = gyrationDescriptors(pts)!;
    expect(d.kappaSq).toBeGreaterThan(0.99);
    expect(d.prolateness).toBeCloseTo(2, 4);
  });

  it('disc in xy-plane: κ² = 1/4, prolateness < 0 (oblate)', () => {
    const pts: Vec3[] = [];
    const rng = new Rng(11);
    while (pts.length < 300) {
      const x = 2 * rng.next() - 1;
      const y = 2 * rng.next() - 1;
      if (x * x + y * y <= 1) pts.push([x, y, 0]);
    }
    const d = gyrationDescriptors(pts)!;
    expect(d.kappaSq).toBeGreaterThan(0.2);
    expect(d.kappaSq).toBeLessThan(0.35);
    expect(d.prolateness).toBeLessThan(0);
  });

  it('R_g² equals tr Σ', () => {
    const pts: Vec3[] = [
      [0, 0, 0],
      [1, 0, 0],
      [0, 1, 0],
      [0, 0, 1],
    ];
    const d = gyrationDescriptors(pts)!;
    const trSigma = d.lambdas[0] + d.lambdas[1] + d.lambdas[2];
    expect(d.rg * d.rg).toBeCloseTo(trSigma, 10);
  });

  it('asphericity is the Rudnick–Gaspari b = λ₁ − ½(λ₂+λ₃)', () => {
    const pts: Vec3[] = [
      [0, 0, 0],
      [5, 0, 0],
      [0, 0.1, 0],
      [0, 0, 0.1],
    ];
    const d = gyrationDescriptors(pts)!;
    expect(d.asphericity).toBeCloseTo(d.lambdas[0] - (d.lambdas[1] + d.lambdas[2]) / 2, 8);
  });

  it('eigenvectors are orthonormal', () => {
    const pts: Vec3[] = [];
    const rng = new Rng(13);
    for (let i = 0; i < 50; i++) pts.push([rng.next(), rng.next() * 2, rng.next() * 0.5]);
    const d = gyrationDescriptors(pts)!;
    const [u, v, w] = d.axes;
    const dot = (a: Vec3, b: Vec3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
    expect(dot(u, u)).toBeCloseTo(1, 6);
    expect(dot(v, v)).toBeCloseTo(1, 6);
    expect(dot(w, w)).toBeCloseTo(1, 6);
    expect(dot(u, v)).toBeCloseTo(0, 6);
    expect(dot(u, w)).toBeCloseTo(0, 6);
    expect(dot(v, w)).toBeCloseTo(0, 6);
  });
});
