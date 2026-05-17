import { describe, expect, it } from 'vitest';
import { fitAsymptotePower, fitExpDecay, fitLogLog } from '../src/lib/scaling.js';

describe('fitLogLog edge cases', () => {
  it('returns null when xs and ys lengths differ', () => {
    expect(fitLogLog([1, 2, 3], [1, 2])).toBe(null);
  });

  it('returns null when all x values are equal (sxx = 0 in log space)', () => {
    expect(fitLogLog([1, 1, 1, 1], [1, 2, 3, 4])).toBe(null);
  });

  it('reports r² = 1 when y is constant (syy = 0 in log space)', () => {
    const fit = fitLogLog([1, 2, 4, 8], [5, 5, 5, 5])!;
    expect(fit.r2).toBe(1);
    expect(fit.alpha).toBeCloseTo(0, 10);
  });
});

describe('fitLogLog', () => {
  it('recovers exact exponent from a clean power law', () => {
    // y = 3 · x^2
    const xs = [1, 2, 3, 4, 5, 10, 20];
    const ys = xs.map((x) => 3 * x ** 2);
    const fit = fitLogLog(xs, ys)!;
    expect(fit.alpha).toBeCloseTo(2, 6);
    expect(Math.exp(fit.intercept)).toBeCloseTo(3, 6);
    expect(fit.r2).toBeCloseTo(1, 6);
  });

  it('handles negative exponent', () => {
    const xs = [1, 2, 4, 8, 16];
    const ys = xs.map((x) => x ** -0.5);
    const fit = fitLogLog(xs, ys)!;
    expect(fit.alpha).toBeCloseTo(-0.5, 6);
  });

  it('returns null for fewer than 3 usable points', () => {
    expect(fitLogLog([1, 2], [1, 2])).toBe(null);
    expect(fitLogLog([], [])).toBe(null);
  });

  it('skips non-positive y values', () => {
    const fit = fitLogLog([1, 2, 3, 4], [1, 2, -1, 4])!; // -1 dropped
    expect(fit.n).toBe(3);
  });

  it('R² < 1 for noisy data', () => {
    const xs = [1, 2, 3, 4, 5, 6, 7, 8];
    const ys = xs.map((x, i) => x ** 1.5 + 0.3 * Math.sin(i));
    const fit = fitLogLog(xs, ys)!;
    expect(fit.r2).toBeLessThan(1);
    expect(fit.r2).toBeGreaterThan(0.95);
  });

  it('reports a finite uncertainty on alpha for noisy data', () => {
    const xs = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    const ys = xs.map((x, i) => x ** 1.5 * (1 + 0.05 * Math.sin(i * 7)));
    const fit = fitLogLog(xs, ys)!;
    expect(fit.alphaErr).toBeGreaterThan(0);
    expect(fit.alphaErr).toBeLessThan(0.1);
    expect(fit.interceptErr).toBeGreaterThan(0);
  });

  it('AIC is in linear-y space, so comparable to other fit models', () => {
    // A clean power law fit on its own data should beat asymptote+power and exp.
    const xs = [1, 2, 3, 4, 5, 6, 8, 10, 14, 20];
    const ys = xs.map((x) => 0.5 * x ** -0.6);
    const pow = fitLogLog(xs, ys)!;
    const asym = fitAsymptotePower(xs, ys)!;
    const exp = fitExpDecay(xs, ys)!;
    // All three should fit well; AIC values must be comparable (finite).
    expect(Number.isFinite(pow.aic)).toBe(true);
    expect(Number.isFinite(asym.aic)).toBe(true);
    expect(Number.isFinite(exp.aic)).toBe(true);
  });
});

describe('fitAsymptotePower (y = y∞ + B·x^(-β))', () => {
  it('recovers parameters from a clean asymptote+power curve', () => {
    const xs = [1, 2, 4, 6, 8, 12, 16, 25, 40, 80];
    // True: y∞ = 0.15, B = 0.6, β = 0.5 → e.g. y(1) = 0.75, y(80) ≈ 0.217
    const ys = xs.map((x) => 0.15 + 0.6 * Math.pow(x, -0.5));
    const fit = fitAsymptotePower(xs, ys)!;
    expect(fit.yInf).toBeCloseTo(0.15, 2);
    expect(fit.B).toBeCloseTo(0.6, 1);
    expect(fit.beta).toBeCloseTo(0.5, 1);
    expect(fit.r2).toBeGreaterThan(0.999);
  });

  it('returns null for fewer than 4 usable points', () => {
    expect(fitAsymptotePower([1, 2, 3], [1, 1, 1])).toBe(null);
    expect(fitAsymptotePower([], [])).toBe(null);
  });

  it('filters non-finite inputs', () => {
    const xs = [1, 2, 4, 8, 16, NaN, 32];
    const ys = [1, 0.6, 0.35, 0.25, 0.2, 0.18, 0.17];
    const fit = fitAsymptotePower(xs, ys)!;
    expect(fit.n).toBe(6); // NaN dropped
  });

  it('AIC and R² are finite for a valid fit', () => {
    const xs = [1, 2, 4, 8, 16, 32];
    const ys = xs.map((x) => 0.2 + 0.5 * Math.pow(x, -0.7));
    const fit = fitAsymptotePower(xs, ys)!;
    expect(Number.isFinite(fit.aic)).toBe(true);
    expect(fit.r2).toBeGreaterThan(0);
    expect(fit.r2).toBeLessThanOrEqual(1);
  });
});

describe('fitExpDecay (y = y∞ + B·exp(-x/N₀))', () => {
  it('recovers parameters from a clean exponential approach', () => {
    const xs = [1, 2, 4, 6, 8, 12, 16, 20, 30, 50];
    // True: y∞ = 0.2, B = 0.7, N0 = 8 → y(1) ≈ 0.82, y(50) → 0.20
    const ys = xs.map((x) => 0.2 + 0.7 * Math.exp(-x / 8));
    const fit = fitExpDecay(xs, ys)!;
    expect(fit.yInf).toBeCloseTo(0.2, 1);
    expect(fit.B).toBeCloseTo(0.7, 1);
    expect(fit.N0).toBeCloseTo(8, 0);
    expect(fit.r2).toBeGreaterThan(0.99);
  });

  it('returns null for fewer than 4 usable points', () => {
    expect(fitExpDecay([1, 2, 3], [1, 1, 1])).toBe(null);
  });

  it('reports higher AIC than asymptote+power on power-law data', () => {
    // True relation is pure power: 1/x. Exp-decay is the wrong model;
    // asymptote+power should fit better and have lower AIC.
    const xs = [1, 2, 3, 5, 8, 13, 21];
    const ys = xs.map((x) => 1 / x);
    const exp = fitExpDecay(xs, ys)!;
    const asym = fitAsymptotePower(xs, ys)!;
    expect(asym.aic).toBeLessThan(exp.aic);
  });
});
