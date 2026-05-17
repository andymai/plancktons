import { describe, expect, it } from 'vitest';
import { Rng } from '../src/lib/rng.js';
import { growOne, makeAssembly, rebuildFromTets } from '../src/lib/assembly.js';
import { runMcRefine } from '../src/lib/mcRefine.js';
import { findOverlaps } from '../src/lib/validate.js';

function grow(seed: number, N: number) {
  const a = makeAssembly({
    L: 1,
    rng: new Rng(seed),
    chiralityBias: 0.5,
    strategy: 'compact',
    compactBeta: 3,
  });
  for (let i = 0; i < N - 1; i++) if (growOne(a) !== 'grown') break;
  return a;
}

describe('runMcRefine', () => {
  it('produces a trajectory of length steps+1 with finite η values', () => {
    const initial = grow(11, 15);
    const result = runMcRefine({ initial, steps: 20, temperature: 0.001, seed: 1 });
    expect(result.trajectory).toHaveLength(21);
    for (const v of result.trajectory) {
      expect(Number.isFinite(v)).toBe(true);
      expect(v).toBeGreaterThan(0);
    }
    expect(result.trajectory[0]).toBeCloseTo(result.initialEta, 9);
    expect(result.trajectory[result.trajectory.length - 1]).toBeCloseTo(result.finalEta, 9);
  });

  it('final assembly has no overlapping pairs', () => {
    const initial = grow(11, 15);
    const result = runMcRefine({ initial, steps: 20, temperature: 0.001, seed: 1 });
    const final = rebuildFromTets(result.finalTets, initial.opts);
    expect(findOverlaps(final, 1)).toHaveLength(0);
  });

  it('greedy MC (T → 0) finalEta ≥ initialEta', () => {
    // At T → 0 only improvements are accepted, so the trajectory is
    // monotone non-decreasing.
    const initial = grow(11, 20);
    const result = runMcRefine({ initial, steps: 30, temperature: 1e-9, seed: 1 });
    expect(result.finalEta).toBeGreaterThanOrEqual(result.initialEta);
    // Each trajectory step is monotone too.
    for (let i = 1; i < result.trajectory.length; i++) {
      expect(result.trajectory[i]!).toBeGreaterThanOrEqual(result.trajectory[i - 1]! - 1e-12);
    }
  });

  it('accept count never exceeds proposal count', () => {
    const initial = grow(11, 15);
    const result = runMcRefine({ initial, steps: 30, temperature: 0.01, seed: 1 });
    expect(result.accepted).toBeLessThanOrEqual(result.proposed);
    expect(result.accepted).toBeGreaterThanOrEqual(0);
  });

  it('preserves tet count (N) across all steps', () => {
    // Displace-leaf removes 1 and adds 1, so N is invariant under both
    // proposal and rejection.
    const initial = grow(11, 20);
    const result = runMcRefine({ initial, steps: 25, temperature: 0.001, seed: 1 });
    expect(result.finalTets.length).toBe(initial.tets.length);
  });

  it('empty assembly: etaOf returns 0; no proposals attempted', () => {
    // `makeAssembly` seeds with one tet; rebuildFromTets([]) gives a truly
    // empty assembly so we exercise etaOf's `tets.length === 0` branch.
    const initial = rebuildFromTets([], {
      L: 1,
      rng: new Rng(1),
      chiralityBias: 0.5,
      strategy: 'uniform',
    });
    const result = runMcRefine({ initial, steps: 5, temperature: 0.01, seed: 1 });
    expect(result.initialEta).toBe(0);
    expect(result.finalEta).toBe(0);
    expect(result.trajectory).toHaveLength(6);
    expect(result.proposed).toBe(0);
    expect(result.accepted).toBe(0);
  });

  it('single-tet assembly: no proposals possible (< 2 tets)', () => {
    const initial = grow(11, 1);
    expect(initial.tets.length).toBe(1);
    const result = runMcRefine({ initial, steps: 4, temperature: 0.01, seed: 1 });
    expect(result.proposed).toBe(0);
    expect(result.accepted).toBe(0);
    expect(result.finalTets).toHaveLength(1);
  });

  it('fires onStep hook with progressive step numbers', () => {
    const initial = grow(11, 8);
    const calls: Array<{ step: number; total: number; eta: number }> = [];
    runMcRefine(
      { initial, steps: 5, temperature: 0.001, seed: 1 },
      {
        onStep: (step, total, eta) => calls.push({ step, total, eta }),
      }
    );
    expect(calls).toHaveLength(5);
    expect(calls.map((c) => c.step)).toEqual([1, 2, 3, 4, 5]);
    for (const c of calls) expect(c.total).toBe(5);
  });
});
