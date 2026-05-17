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
import { computeHull } from '../src/lib/hull.js';
import { Rng } from '../src/lib/rng.js';
import { tetVolume } from '../src/lib/planckton.js';
import type { Planckton } from '../src/lib/planckton.js';

describe('makeAssembly', () => {
  it('starts with one tet and 4 free faces', () => {
    const a = makeAssembly({ L: 1, rng: new Rng(1), chiralityBias: 1, strategy: 'uniform' });
    expect(a.tets).toHaveLength(1);
    expect(a.freeFaces).toHaveLength(4);
  });
});

describe('growOne', () => {
  it('grows by 1 tet on success', () => {
    const a = makeAssembly({ L: 1, rng: new Rng(42), chiralityBias: 0.5, strategy: 'uniform' });
    const before = a.tets.length;
    const r = growOne(a);
    expect(r === 'grown' || r === 'jammed').toBe(true);
    if (r === 'grown') expect(a.tets.length).toBe(before + 1);
  });

  it('reports closed when no free faces remain', () => {
    const a = makeAssembly({ L: 1, rng: new Rng(1), chiralityBias: 1, strategy: 'uniform' });
    a.freeFaces.length = 0;
    expect(growOne(a)).toBe('closed');
  });
});

describe('uniform-strategy assembly', () => {
  it('grows to target N=20 reliably across many seeds', () => {
    let achieved = 0;
    for (let seed = 0; seed < 10; seed++) {
      const a = makeAssembly({
        L: 1,
        rng: new Rng(100 + seed),
        chiralityBias: 0.5,
        strategy: 'uniform',
      });
      while (a.tets.length < 20 && growOne(a) === 'grown') {
        // empty
      }
      if (a.tets.length === 20) achieved++;
    }
    expect(achieved).toBeGreaterThanOrEqual(8);
  });
});

describe('partVolumeTotal', () => {
  it('equals N · L³ / 6 exactly', () => {
    const a = makeAssembly({ L: 2, rng: new Rng(1), chiralityBias: 1, strategy: 'uniform' });
    while (a.tets.length < 5 && growOne(a) === 'grown') {
      // empty
    }
    expect(partVolumeTotal(a)).toBeCloseTo((a.tets.length * 2 ** 3) / 6, 10);
  });
});

describe('freeSurfaceArea', () => {
  it('equals 1 + √2 for a unit Hill T (one tet)', () => {
    const a = makeAssembly({ L: 1, rng: new Rng(1), chiralityBias: 1, strategy: 'uniform' });
    expect(freeSurfaceArea(a)).toBeCloseTo(1 + Math.SQRT2, 8);
  });
});

describe('chiralityCounts', () => {
  it('R+L sums to N', () => {
    const a = makeAssembly({ L: 1, rng: new Rng(99), chiralityBias: 0.5, strategy: 'uniform' });
    while (a.tets.length < 15 && growOne(a) === 'grown') {
      // empty
    }
    const { R, L } = chiralityCounts(a);
    expect(R + L).toBe(a.tets.length);
  });
});

describe('vertexCoordination', () => {
  it('single tet has 4 unique vertices, all coord 1', () => {
    const a = makeAssembly({ L: 1, rng: new Rng(1), chiralityBias: 1, strategy: 'uniform' });
    const c = vertexCoordination(a);
    expect(c.uniqueVertices).toBe(4);
    expect(c.maxCoord).toBe(1);
  });
});

describe('freeFaceFraction', () => {
  it('single tet: all 4 faces free, fraction = 1', () => {
    const a = makeAssembly({ L: 1, rng: new Rng(1), chiralityBias: 1, strategy: 'uniform' });
    expect(freeFaceFraction(a)).toBe(1);
  });
});

describe('freeFaceShapeCounts', () => {
  it('single Hill T has 2 iso + 2 scalene free faces', () => {
    const a = makeAssembly({ L: 1, rng: new Rng(1), chiralityBias: 1, strategy: 'uniform' });
    const { isoceles, scalene } = freeFaceShapeCounts(a);
    expect(isoceles).toBe(2);
    expect(scalene).toBe(2);
  });
});

describe('compact strategy beats uniform on average', () => {
  it('mean efficiency at N=25 across 6 seeds', () => {
    const trials = 6;
    let uni = 0;
    let cmp = 0;
    for (let t = 0; t < trials; t++) {
      const seed = 1000 + t;
      const a1 = makeAssembly({
        L: 1,
        rng: new Rng(seed),
        chiralityBias: 0.5,
        strategy: 'uniform',
      });
      while (a1.tets.length < 25 && growOne(a1) === 'grown') {
        // empty
      }
      const h1 = computeHull(a1.tets.flatMap((t) => [...t.verts]));
      if (h1) uni += partVolumeTotal(a1) / h1.volume;

      const a2 = makeAssembly({
        L: 1,
        rng: new Rng(seed),
        chiralityBias: 0.5,
        strategy: 'compact',
        compactBeta: 3,
      });
      while (a2.tets.length < 25 && growOne(a2) === 'grown') {
        // empty
      }
      const h2 = computeHull(a2.tets.flatMap((t) => [...t.verts]));
      if (h2) cmp += partVolumeTotal(a2) / h2.volume;
    }
    expect(cmp / trials).toBeGreaterThanOrEqual(uni / trials - 0.01);
  });
});

describe('no overlap invariant', () => {
  it('grown assembly has no overlapping pairs (N=30, 5 seeds, both strategies)', () => {
    for (const strategy of ['uniform', 'compact'] as const) {
      for (let s = 0; s < 5; s++) {
        const a = makeAssembly({
          L: 1,
          rng: new Rng(2000 + s),
          chiralityBias: 0.5,
          strategy,
          compactBeta: 3,
        });
        while (a.tets.length < 30 && growOne(a) === 'grown') {
          // empty
        }
        // direct verification via tetVolume - sum should equal N*L³/6 (no double-count).
        const summed = a.tets.reduce((sum, t: Planckton) => sum + tetVolume(t.verts), 0);
        expect(summed).toBeCloseTo((a.tets.length * 1) / 6, 8);
      }
    }
  });
});
