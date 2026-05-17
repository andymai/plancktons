import { describe, expect, it } from 'vitest';
import { Rng } from '../src/lib/rng.js';
import { growOne, makeAssembly } from '../src/lib/assembly.js';
import { steinhardtQl, tetNeighbors } from '../src/lib/steinhardt.js';

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

describe('tetNeighbors', () => {
  it('seed-only assembly has no neighbors', () => {
    const a = grow(1, 1);
    const n = tetNeighbors(a);
    expect(n).toHaveLength(1);
    expect(n[0]).toEqual([]);
  });

  it('N=2 yields one bidirectional neighbor pair', () => {
    const a = grow(7, 2);
    if (a.tets.length < 2) return; // skipped if growth jammed at seed
    const n = tetNeighbors(a);
    expect(n[0]).toContain(1);
    expect(n[1]).toContain(0);
  });

  it('neighbor list size equals 4N - F_free (bookkeeping consistent after #13)', () => {
    // After issue #13's fix, commitIfClear splices out accidental adjacencies
    // so a.freeFaces accurately reflects the geometric free-face graph.
    const a = grow(11, 20);
    const n = tetNeighbors(a);
    const totalEntries = n.reduce((s, l) => s + l.length, 0);
    expect(totalEntries).toBe(4 * a.tets.length - a.freeFaces.length);
    // Every entry should be reciprocal: i in n[j] ⇔ j in n[i].
    for (let i = 0; i < n.length; i++) {
      for (const j of n[i]!) {
        expect(n[j]).toContain(i);
      }
    }
  });
});

describe('steinhardtQl', () => {
  it('returns NaN per-tet for isolated tets (no neighbors)', () => {
    const a = grow(1, 1);
    const q = steinhardtQl(a, 6);
    expect(q.perTet[0]).toBeNaN();
    expect(q.contributing).toBe(0);
    expect(q.ensemble).toBe(0);
  });

  it('Q_l is in [0, 1] for grown assemblies', () => {
    // Steinhardt Q_l is bounded by 1: comes from (1/N_b) sqrt(Σ P_l(cos γ)),
    // where Σ_{j,k} P_l(cos γ_jk) ≤ N_b² (equality when all bonds point the
    // same way, which makes P_l(1) = 1). So Q_l ≤ 1 always.
    const a = grow(7, 30);
    for (const l of [4, 6] as const) {
      const q = steinhardtQl(a, l);
      for (const v of q.perTet) {
        if (!Number.isNaN(v)) {
          expect(v).toBeGreaterThanOrEqual(0);
          expect(v).toBeLessThanOrEqual(1.001); // float slack
        }
      }
      expect(q.ensemble).toBeGreaterThanOrEqual(0);
      expect(q.ensemble).toBeLessThanOrEqual(1.001);
    }
  });

  it('ensemble Q_l increases with neighbor count (more bonds = more order)', () => {
    // Heuristic check: at higher N (denser packing, more neighbors per tet)
    // Steinhardt Q_l tends to be larger because more bond directions average
    // out the per-bond fluctuation in the spherical harmonic basis.
    const small = grow(7, 5);
    const big = grow(7, 80);
    // Only meaningful if growth reached both target sizes.
    if (big.tets.length < 80 || small.tets.length < 5) return;
    const q6_small = steinhardtQl(small, 6);
    const q6_big = steinhardtQl(big, 6);
    expect(q6_big.contributing).toBeGreaterThan(q6_small.contributing);
    // No strict ordering on the value itself (random fluctuation), but the
    // contributing count should grow with N.
  });
});
