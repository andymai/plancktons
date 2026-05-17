import { describe, expect, it } from 'vitest';
import { avramiFit, growTrajectory } from '../src/lib/kinetics.js';

describe('growTrajectory', () => {
  it('records η_C per step + tet count', () => {
    const r = growTrajectory({
      L: 1,
      N: 15,
      seed: 7,
      chiralityBias: 0.5,
      strategy: 'compact',
      compactBeta: 3,
    });
    expect(r.trajectory.length).toBeGreaterThan(1);
    expect(r.trajectory.length).toBe(r.Ns.length);
    // First entry: single seed tet → η_C should be small (single tet's hull
    // is itself, so η_C = V*/V_hull = 1.0 exactly).
    expect(r.trajectory[0]).toBeCloseTo(1, 6);
    expect(r.Ns[0]).toBe(1);
  });

  it('etaInf equals last trajectory point', () => {
    const r = growTrajectory({
      L: 1,
      N: 20,
      seed: 1,
      chiralityBias: 0.5,
      strategy: 'compact',
      compactBeta: 3,
    });
    expect(r.etaInf).toBeCloseTo(r.trajectory[r.trajectory.length - 1]!, 9);
  });
});

describe('avramiFit', () => {
  it('returns null for too few points', () => {
    expect(avramiFit([0.5], 1)).toBe(null);
    expect(avramiFit([0.5, 0.7], 1)).toBe(null);
  });

  it('recovers n ≈ 1 from a synthetic 1-exp(-K·t) trajectory', () => {
    // X(t) = X∞ · (1 - exp(-0.3 · t^1)). 30 points.
    const etaInf = 0.8;
    const K = 0.3;
    const n = 1;
    const traj: number[] = [];
    for (let t = 0; t <= 30; t++) traj.push(etaInf * (1 - Math.exp(-K * Math.pow(t, n))));
    const fit = avramiFit(traj, etaInf)!;
    expect(fit.n).toBeCloseTo(n, 1);
    expect(fit.K).toBeCloseTo(K, 1);
    expect(fit.r2).toBeGreaterThan(0.99);
  });

  it('recovers n ≈ 3 from a synthetic t^3 trajectory', () => {
    const etaInf = 0.5;
    const K = 0.005;
    const n = 3;
    const traj: number[] = [];
    for (let t = 0; t <= 20; t++) traj.push(etaInf * (1 - Math.exp(-K * Math.pow(t, n))));
    const fit = avramiFit(traj, etaInf)!;
    expect(fit.n).toBeCloseTo(n, 1);
    expect(fit.r2).toBeGreaterThan(0.99);
  });
});
