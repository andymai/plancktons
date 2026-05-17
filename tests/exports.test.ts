import { beforeEach, describe, expect, it } from 'vitest';
import { decodeStateFromHash, encodeStateToHash, plancktonsToSTL } from '../src/lib/exports.js';
import { makeAssembly, growOne } from '../src/lib/assembly.js';
import { Rng } from '../src/lib/rng.js';
import { unitPlanckton } from '../src/lib/planckton.js';

// ──────────────────────────────────────────────────────────────────────
// STL
// ──────────────────────────────────────────────────────────────────────

describe('plancktonsToSTL', () => {
  it('empty assembly produces a parseable empty solid', () => {
    const stl = plancktonsToSTL([]);
    expect(stl.startsWith('solid')).toBe(true);
    expect(stl.endsWith('endsolid plancktons')).toBe(true);
    expect(stl.includes('facet')).toBe(false);
  });

  it('single tet produces exactly 4 facets', () => {
    const p = unitPlanckton(1, 'R');
    const stl = plancktonsToSTL([p]);
    const facets = stl.match(/facet normal/g)!;
    expect(facets).toHaveLength(4);
    expect(stl.match(/endfacet/g)).toHaveLength(4);
    expect(stl.match(/outer loop/g)).toHaveLength(4);
    expect(stl.match(/vertex/g)).toHaveLength(12); // 3 per facet × 4
  });

  it('N tets produce 4N facets', () => {
    const a = makeAssembly({ L: 1, rng: new Rng(1), chiralityBias: 1, strategy: 'uniform' });
    while (a.tets.length < 5 && growOne(a) === 'grown') {
      // empty
    }
    const stl = plancktonsToSTL(a.tets);
    expect(stl.match(/facet normal/g)).toHaveLength(4 * a.tets.length);
  });

  it('facet normals are non-zero finite numbers', () => {
    const p = unitPlanckton(1, 'R');
    const stl = plancktonsToSTL([p]);
    const normalMatches = stl.match(/facet normal (\S+) (\S+) (\S+)/g)!;
    for (const m of normalMatches) {
      const parts = m.split(/\s+/).slice(2).map(Number);
      expect(parts.every((n) => Number.isFinite(n))).toBe(true);
      const norm = Math.hypot(...parts);
      expect(norm).toBeCloseTo(1, 6);
    }
  });
});

// ──────────────────────────────────────────────────────────────────────
// URL-hash round-trip
// ──────────────────────────────────────────────────────────────────────

const SAMPLE_STATE = {
  scene: 'growth',
  singleChirality: 'L' as const,
  cubeExplode: 0.3,
  reptileExplode: 0.5,
  reptileDepth: 2,
  growth: { N: 42, seed: 9999, chiralityBias: 0.7, strategy: 'compact', compactBeta: 7.5 },
  advanced: true,
};

describe('URL hash round-trip', () => {
  beforeEach(() => {
    // happy-dom provides window.location; set a clean URL each test
    window.history.replaceState(null, '', '/');
  });

  it('encodes and decodes back identically', () => {
    const url = encodeStateToHash(SAMPLE_STATE);
    expect(url).toMatch(/#/);
    // Load the hash into window.location
    window.history.replaceState(null, '', url);
    const decoded = decodeStateFromHash();
    expect(decoded?.scene).toBe(SAMPLE_STATE.scene);
    expect(decoded?.singleChirality).toBe(SAMPLE_STATE.singleChirality);
    expect(decoded?.cubeExplode).toBeCloseTo(SAMPLE_STATE.cubeExplode);
    expect(decoded?.reptileDepth).toBe(SAMPLE_STATE.reptileDepth);
    expect(decoded?.growth?.N).toBe(SAMPLE_STATE.growth.N);
    expect(decoded?.growth?.seed).toBe(SAMPLE_STATE.growth.seed);
    expect(decoded?.growth?.chiralityBias).toBeCloseTo(SAMPLE_STATE.growth.chiralityBias);
    expect(decoded?.growth?.compactBeta).toBeCloseTo(SAMPLE_STATE.growth.compactBeta);
    expect(decoded?.advanced).toBe(SAMPLE_STATE.advanced);
  });

  it('decodeStateFromHash returns null when no hash', () => {
    window.history.replaceState(null, '', '/');
    expect(decodeStateFromHash()).toBe(null);
  });

  it('decodeStateFromHash returns null on corrupt base64', () => {
    window.history.replaceState(null, '', '/#!!!not-base64!!!');
    expect(decodeStateFromHash()).toBe(null);
  });

  it('decodeStateFromHash returns null on valid base64 but invalid JSON', () => {
    const bad = btoa('not json at all');
    window.history.replaceState(null, '', '/#' + bad);
    expect(decodeStateFromHash()).toBe(null);
  });

  it('handles partial state (missing fields) — fills defaults', () => {
    // Simulate an old hash with only N and seed
    const partial = btoa(JSON.stringify({ g: { N: 5, sd: 99 } }));
    window.history.replaceState(null, '', '/#' + partial);
    const decoded = decodeStateFromHash();
    expect(decoded?.growth?.N).toBe(5);
    expect(decoded?.growth?.seed).toBe(99);
    expect(decoded?.growth?.compactBeta).toBe(3); // default
    expect(decoded?.growth?.strategy).toBe('uniform'); // default
  });
});
