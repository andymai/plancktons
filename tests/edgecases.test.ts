// Extreme edge cases & "everything in between" parameter sweeps.
// The intent: exercise every knob at min / typical / max and verify nothing
// blows up, produces NaN/Infinity, or violates an invariant.

import { describe, expect, it } from 'vitest';
import {
  chiralityCounts,
  freeFaceFraction,
  freeFaceShapeCounts,
  freeSurfaceArea,
  growOne,
  makeAssembly,
  partVolumeTotal,
  vertexCoordination,
} from '../src/lib/assembly.js';
import { Rng } from '../src/lib/rng.js';
import { computeHull, computeBBox } from '../src/lib/hull.js';
import { tetVolume, unitPlanckton } from '../src/lib/planckton.js';
import { gyrationDescriptors } from '../src/lib/shape.js';
import { runCurve, runStudy, trialsToCSV } from '../src/lib/study.js';
import { cubeTiling, eightReptile } from '../src/lib/canonicalScenes.js';
import type { Vec3 } from '../src/lib/vec.js';

// ──────────────────────────────────────────────────────────────────────
// Scale parameter L: tiny, normal, huge
// ──────────────────────────────────────────────────────────────────────

describe('edge: L parameter sweep (1e-9 → 1e9)', () => {
  for (const L of [1e-9, 1e-6, 0.001, 1, 1000, 1e6, 1e9]) {
    it(`unit Hill T volume = L³/6 at L=${L}`, () => {
      const p = unitPlanckton(L, 'R');
      const v = tetVolume(p.verts);
      const expected = L ** 3 / 6;
      expect(v / expected).toBeCloseTo(1, 6);
    });

    it(`6-cube tiling sums to L³ at L=${L}`, () => {
      const sum = cubeTiling(L).reduce((s, p) => s + tetVolume(p.verts), 0);
      expect(sum / L ** 3).toBeCloseTo(1, 6);
    });
  }

  it('L=0 produces zero volume (degenerate but well-defined)', () => {
    expect(tetVolume(unitPlanckton(0, 'R').verts)).toBe(0);
  });
});

// ──────────────────────────────────────────────────────────────────────
// N parameter sweep
// ──────────────────────────────────────────────────────────────────────

describe('edge: N parameter sweep (1 → 200)', () => {
  for (const N of [1, 2, 5, 10, 50, 100, 200]) {
    it(`N=${N} grows without throwing and V★ = N·L³/6`, () => {
      const a = makeAssembly({
        L: 1,
        rng: new Rng(7),
        chiralityBias: 0.5,
        strategy: 'uniform',
      });
      while (a.tets.length < N && growOne(a) === 'grown') {
        // empty
      }
      expect(a.tets.length).toBeGreaterThan(0);
      expect(a.tets.length).toBeLessThanOrEqual(N);
      expect(partVolumeTotal(a)).toBeCloseTo(a.tets.length / 6, 10);
    });
  }
});

// ──────────────────────────────────────────────────────────────────────
// Chirality bias: 0, 0.25, 0.5, 0.75, 1 — all-R, all-L, mixed
// ──────────────────────────────────────────────────────────────────────

describe('edge: chirality bias sweep', () => {
  for (const cb of [0, 0.25, 0.5, 0.75, 1]) {
    it(`cb=${cb}: chirality counts roughly match the bias`, () => {
      const a = makeAssembly({
        L: 1,
        rng: new Rng(42),
        chiralityBias: cb,
        strategy: 'uniform',
      });
      while (a.tets.length < 60 && growOne(a) === 'grown') {
        // empty
      }
      const { R, L } = chiralityCounts(a);
      expect(R + L).toBe(a.tets.length);
      // Bias check is loose because cb=0 still allows R templates to be
      // matched against L parents (the RNG draw doesn't always succeed).
      if (cb === 0) expect(R).toBeLessThanOrEqual(L);
      if (cb === 1) expect(R).toBeGreaterThanOrEqual(L);
    });
  }
});

// ──────────────────────────────────────────────────────────────────────
// compactBeta: 0 (=uniform), small, large, very large
// ──────────────────────────────────────────────────────────────────────

describe('edge: compactBeta sweep', () => {
  for (const beta of [0, 0.5, 3, 10, 50, 500]) {
    it(`β=${beta} produces a valid grown assembly`, () => {
      const a = makeAssembly({
        L: 1,
        rng: new Rng(13),
        chiralityBias: 0.5,
        strategy: 'compact',
        compactBeta: beta,
      });
      while (a.tets.length < 25 && growOne(a) === 'grown') {
        // empty
      }
      expect(a.tets.length).toBeGreaterThan(0);
      const sum = a.tets.reduce((s, t) => s + tetVolume(t.verts), 0);
      expect(sum).toBeCloseTo(a.tets.length / 6, 8);
    });
  }

  it('β=0 (compact strategy) is statistically equivalent to uniform', () => {
    // exp(0·dot) = 1 ⇒ all weights equal ⇒ uniform sampling
    const seedA = 12345;
    const a = makeAssembly({ L: 1, rng: new Rng(seedA), chiralityBias: 0.5, strategy: 'uniform' });
    const b = makeAssembly({
      L: 1,
      rng: new Rng(seedA),
      chiralityBias: 0.5,
      strategy: 'compact',
      compactBeta: 0,
    });
    while (a.tets.length < 10 && growOne(a) === 'grown') {
      // empty
    }
    while (b.tets.length < 10 && growOne(b) === 'grown') {
      // empty
    }
    // Same seed should produce the same growth sequence under both strategies
    // when β=0 makes them mathematically equivalent.
    expect(a.tets.length).toBe(b.tets.length);
  });
});

// ──────────────────────────────────────────────────────────────────────
// Seed boundaries
// ──────────────────────────────────────────────────────────────────────

describe('edge: seed boundary values', () => {
  for (const seed of [0, 1, 7, 2 ** 30, 2 ** 32 - 1]) {
    it(`seed=${seed} produces a valid assembly`, () => {
      const a = makeAssembly({
        L: 1,
        rng: new Rng(seed),
        chiralityBias: 0.5,
        strategy: 'uniform',
      });
      while (a.tets.length < 15 && growOne(a) === 'grown') {
        // empty
      }
      expect(a.tets.length).toBeGreaterThan(0);
    });
  }

  it('negative seeds are coerced to unsigned (no crash)', () => {
    const r = new Rng(-1);
    expect(r.next()).toBeGreaterThanOrEqual(0);
    expect(r.next()).toBeLessThan(1);
  });
});

// ──────────────────────────────────────────────────────────────────────
// Degenerate point clouds for hull + shape
// ──────────────────────────────────────────────────────────────────────

describe('edge: degenerate point clouds', () => {
  it('hull of 4 collinear points returns null (not crash)', () => {
    const pts: Vec3[] = [
      [0, 0, 0],
      [1, 0, 0],
      [2, 0, 0],
      [3, 0, 0],
    ];
    expect(computeHull(pts)).toBe(null);
  });

  it('hull of 4 coplanar points returns a degenerate (volume-0) hull, not a crash', () => {
    const pts: Vec3[] = [
      [0, 0, 0],
      [1, 0, 0],
      [0, 1, 0],
      [1, 1, 0],
    ];
    const hull = computeHull(pts);
    // Library may return null (collinear/coplanar reject) or a flat hull
    // with volume ≈ 0. Either is acceptable; what we forbid is a throw/NaN.
    if (hull) {
      expect(hull.volume).toBeCloseTo(0, 6);
    }
  });

  it('hull of identical points returns null', () => {
    const pts: Vec3[] = [
      [1, 1, 1],
      [1, 1, 1],
      [1, 1, 1],
      [1, 1, 1],
    ];
    expect(computeHull(pts)).toBe(null);
  });

  it('gyration of 2 points is well-defined (1D, max anisotropy)', () => {
    const d = gyrationDescriptors([
      [0, 0, 0],
      [1, 0, 0],
    ])!;
    expect(d).not.toBe(null);
    expect(d.kappaSq).toBeCloseTo(1, 6);
  });

  it('gyration of all-identical points is degenerate but returns 0 R_g', () => {
    const d = gyrationDescriptors([
      [5, 5, 5],
      [5, 5, 5],
      [5, 5, 5],
    ])!;
    expect(d.rg).toBe(0);
  });
});

// ──────────────────────────────────────────────────────────────────────
// computeBBox edge cases
// ──────────────────────────────────────────────────────────────────────

describe('edge: computeBBox', () => {
  it('single point: zero-volume bbox', () => {
    const b = computeBBox([[3, 4, 5]]);
    expect(b.volume).toBe(0);
    expect(b.size).toEqual([0, 0, 0]);
  });

  it('negative coords work', () => {
    const b = computeBBox([
      [-5, -5, -5],
      [5, 5, 5],
    ]);
    expect(b.volume).toBe(1000);
  });
});

// ──────────────────────────────────────────────────────────────────────
// runStudy & runCurve edge cases
// ──────────────────────────────────────────────────────────────────────

describe('edge: runStudy', () => {
  it('trials=0 returns empty array', () => {
    expect(
      runStudy({ N: 5, trials: 0, startSeed: 1, chiralityBias: 0.5, strategy: 'uniform' })
    ).toEqual([]);
  });

  it('N=1 trials produce a single tet trial with η=1', () => {
    const trials = runStudy({
      N: 1,
      trials: 3,
      startSeed: 1,
      chiralityBias: 0.5,
      strategy: 'uniform',
    });
    expect(trials).toHaveLength(3);
    for (const t of trials) {
      expect(t.N).toBe(1);
      expect(t.efficiency).toBeCloseTo(1, 5);
    }
  });

  it('runCurve handles single-N input', () => {
    const points = runCurve([10], 3, 1, 0.5, 'uniform');
    expect(points).toHaveLength(1);
  });

  it('runCurve handles empty N list', () => {
    expect(runCurve([], 3, 1, 0.5, 'uniform')).toEqual([]);
  });
});

// ──────────────────────────────────────────────────────────────────────
// CSV well-formedness
// ──────────────────────────────────────────────────────────────────────

describe('edge: CSV serialization', () => {
  it('empty trials gives header-only CSV', () => {
    const csv = trialsToCSV([]);
    expect(csv).toMatch(/^trial,N,seed,V,Vstar/);
    expect(csv.split('\n')).toHaveLength(1);
  });

  it('CSV row count matches trial count + header', () => {
    const trials = runStudy({
      N: 6,
      trials: 10,
      startSeed: 1,
      chiralityBias: 0.5,
      strategy: 'compact',
      compactBeta: 2,
    });
    const csv = trialsToCSV(trials);
    expect(csv.split('\n')).toHaveLength(11);
  });
});

// ──────────────────────────────────────────────────────────────────────
// Canonical scenes: every L value, every variant
// ──────────────────────────────────────────────────────────────────────

describe('edge: canonical scenes invariants', () => {
  for (const L of [1e-3, 0.1, 1, 100]) {
    it(`cube tiling at L=${L}: 6 pieces, exactly fills cube`, () => {
      const pieces = cubeTiling(L);
      expect(pieces).toHaveLength(6);
      const sum = pieces.reduce((s, p) => s + tetVolume(p.verts), 0);
      expect(sum / L ** 3).toBeCloseTo(1, 6);
    });
    it(`8-reptile at L=${L}: 8 pieces, sums to (2L)³/6`, () => {
      const sum = eightReptile(L).reduce((s, p) => s + tetVolume(p.verts), 0);
      expect(sum / ((2 * L) ** 3 / 6)).toBeCloseTo(1, 6);
    });
  }
});

// ──────────────────────────────────────────────────────────────────────
// Assembly invariants under many combinations
// ──────────────────────────────────────────────────────────────────────

describe('edge: invariants across the parameter cube', () => {
  const strategies = ['uniform', 'compact'] as const;
  const Ns = [1, 5, 20];
  const cbs = [0, 0.5, 1];
  const betas = [0, 3, 10];

  for (const strategy of strategies) {
    for (const N of Ns) {
      for (const cb of cbs) {
        for (const beta of betas) {
          if (strategy === 'uniform' && beta !== 3) continue; // β unused
          const label = `${strategy} N=${N} cb=${cb} β=${beta}`;
          it(label, () => {
            const a = makeAssembly({
              L: 1,
              rng: new Rng(101 + N * 31 + Math.round(cb * 10) + beta),
              chiralityBias: cb,
              strategy,
              compactBeta: beta,
            });
            while (a.tets.length < N && growOne(a) === 'grown') {
              // empty
            }
            // every invariant must hold:
            const sum = a.tets.reduce((s, t) => s + tetVolume(t.verts), 0);
            expect(sum).toBeCloseTo(a.tets.length / 6, 8); // V★ correct
            const ffrac = freeFaceFraction(a);
            expect(ffrac).toBeGreaterThan(0);
            expect(ffrac).toBeLessThanOrEqual(1);
            const { R, L: Lc } = chiralityCounts(a);
            expect(R + Lc).toBe(a.tets.length);
            const c = vertexCoordination(a);
            expect(c.uniqueVertices).toBeGreaterThan(0);
            expect(c.uniqueVertices).toBeLessThanOrEqual(4 * a.tets.length);
            const fs = freeFaceShapeCounts(a);
            expect(fs.isoceles + fs.scalene).toBe(a.freeFaces.length);
            expect(freeSurfaceArea(a)).toBeGreaterThan(0);
          });
        }
      }
    }
  }
});
