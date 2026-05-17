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

  it('fires onStep hook after each grown tet', () => {
    const calls: number[] = [];
    growTrajectory(
      {
        L: 1,
        N: 8,
        seed: 5,
        chiralityBias: 0.5,
        strategy: 'compact',
        compactBeta: 3,
      },
      { onStep: (step) => calls.push(step) }
    );
    // Steps start at 1 (after the seed); we get at most N-1 = 7 calls.
    expect(calls.length).toBeGreaterThan(0);
    expect(calls[0]).toBe(1);
    for (let i = 1; i < calls.length; i++) expect(calls[i]).toBe(calls[i - 1]! + 1);
  });

  it('N=1 yields a length-1 trajectory and fit=null (etaInf >= eta0 branch)', () => {
    const r = growTrajectory({
      L: 1,
      N: 1,
      seed: 1,
      chiralityBias: 0.5,
      strategy: 'compact',
      compactBeta: 3,
    });
    expect(r.trajectory).toHaveLength(1);
    expect(r.fit).toBe(null);
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
  it('returns null for too few points or invalid (eta0, etaInf)', () => {
    // eta0 must be > etaInf for the transformed fraction X to be in (0, 1).
    expect(avramiFit([0.5], 1, 0)).toBe(null);
    expect(avramiFit([0.5, 0.7], 1, 0)).toBe(null);
    expect(avramiFit([0.5, 0.6, 0.7], 0.5, 0.5)).toBe(null); // denom == 0
  });

  it('returns null when every X is out of (0,1) (no usable points)', () => {
    // η stays at η₀ → X=0 → continue at every step → n < 3 → null.
    expect(avramiFit([1, 1, 1, 1, 1, 1], 1, 0)).toBe(null);
  });

  it('returns null for a degenerate single-t trajectory (sxx=0 path)', () => {
    // Two trajectory points at X∈(0,1) collapse to a single (t=1, ly) pair.
    // n=1 < 3 → null.
    expect(avramiFit([1, 0.5], 1, 0)).toBe(null);
  });

  it('recovers n ≈ 1 from a synthetic η_C(t) that drops from η₀=1 to η_∞=0.2 as 1-exp(-K·t)', () => {
    // η(t) such that X(t) = (η₀ − η)/(η₀ − η_∞) = 1 − exp(−0.3 · t^1).
    // Equivalently η(t) = η₀ − (η₀ − η_∞)·(1 − exp(−K·t^n)).
    const eta0 = 1;
    const etaInf = 0.2;
    const K = 0.3;
    const n = 1;
    const traj: number[] = [];
    for (let t = 0; t <= 30; t++) {
      const X = 1 - Math.exp(-K * Math.pow(t, n));
      traj.push(eta0 - (eta0 - etaInf) * X);
    }
    const fit = avramiFit(traj, eta0, etaInf)!;
    expect(fit.n).toBeCloseTo(n, 1);
    expect(fit.K).toBeCloseTo(K, 1);
    expect(fit.r2).toBeGreaterThan(0.99);
  });

  it('recovers n ≈ 3 from a synthetic t^3 trajectory', () => {
    const eta0 = 1;
    const etaInf = 0.4;
    const K = 0.005;
    const n = 3;
    const traj: number[] = [];
    for (let t = 0; t <= 20; t++) {
      const X = 1 - Math.exp(-K * Math.pow(t, n));
      traj.push(eta0 - (eta0 - etaInf) * X);
    }
    const fit = avramiFit(traj, eta0, etaInf)!;
    expect(fit.n).toBeCloseTo(n, 1);
    expect(fit.r2).toBeGreaterThan(0.99);
  });

  it('produces a usable fit on the actual decreasing η_C(t) trajectory (issue from the cleanup review)', () => {
    // The previous Avrami implementation dropped every point because it
    // computed (1 - η/η∞) which is ≤ 0 when η ≥ η∞ (always, for a
    // monotone-decreasing trajectory). Regression check: a real growth
    // trajectory now produces a non-null fit.
    const r = growTrajectory({
      L: 1,
      N: 30,
      seed: 7,
      chiralityBias: 0.5,
      strategy: 'compact',
      compactBeta: 3,
    });
    if (r.trajectory.length < 5) return;
    expect(r.fit).not.toBe(null);
    expect(Number.isFinite(r.fit!.n)).toBe(true);
  });
});
