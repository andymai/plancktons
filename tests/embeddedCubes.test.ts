import { describe, expect, it } from 'vitest';
import { Rng } from '../src/lib/rng.js';
import { growOne, makeAssembly, rebuildFromTets } from '../src/lib/assembly.js';
import { findEmbeddedCubes } from '../src/lib/embeddedCubes.js';
import { cubeTiling } from '../src/lib/canonicalScenes.js';

describe('findEmbeddedCubes', () => {
  it('finds 1 canonical cube in the explicit Hill cube tiling', () => {
    // cubeTiling returns 6 tets that form a perfect cube. Wrap them into an
    // Assembly via rebuildFromTets so the face graph and spatial hash are
    // populated.
    const tets = cubeTiling(1);
    const a = rebuildFromTets(tets, {
      L: 1,
      rng: new Rng(0),
      chiralityBias: 0.5,
      strategy: 'compact',
    });
    const result = findEmbeddedCubes(a);
    expect(result.canonical).toHaveLength(1);
    expect(result.canonical[0]!.chirR).toBe(3);
    expect(result.canonical[0]!.chirL).toBe(3);
    expect(result.canonical[0]!.tetIndices).toHaveLength(6);
  });

  it('seed-only assembly has no embedded cubes', () => {
    const a = makeAssembly({
      L: 1,
      rng: new Rng(1),
      chiralityBias: 0.5,
      strategy: 'compact',
      compactBeta: 3,
    });
    const result = findEmbeddedCubes(a);
    expect(result.groups).toHaveLength(0);
    expect(result.canonical).toHaveLength(0);
  });

  it('counts groups even when not canonical (≥ 6 tets on a diagonal)', () => {
    // Grow a moderate assembly and check the result type fields.
    const a = makeAssembly({
      L: 1,
      rng: new Rng(7),
      chiralityBias: 0.5,
      strategy: 'compact',
      compactBeta: 3,
    });
    for (let i = 0; i < 40; i++) if (growOne(a) !== 'grown') break;
    const result = findEmbeddedCubes(a);
    // groups field should exist; the count is non-deterministic but the
    // canonical subset is always ≤ groups length.
    expect(result.canonical.length).toBeLessThanOrEqual(result.groups.length);
    for (const c of result.canonical) {
      expect(c.chirR + c.chirL).toBe(6);
      expect(c.tetIndices).toHaveLength(6);
    }
  });
});
