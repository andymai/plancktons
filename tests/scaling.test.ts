import { describe, expect, it } from 'vitest';
import { fitLogLog } from '../src/lib/scaling.js';

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
});
