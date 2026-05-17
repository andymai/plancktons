import { describe, expect, it } from 'vitest';
import { findOverlaps, sideOfFace, mateOnCorrectSide } from '../src/lib/validate.js';
import { makeAssembly, growOne } from '../src/lib/assembly.js';
import { Rng } from '../src/lib/rng.js';
import { unitPlanckton } from '../src/lib/planckton.js';

describe('findOverlaps', () => {
  it('reports zero overlaps for valid random assemblies (uniform N=20, 5 seeds)', () => {
    for (let s = 0; s < 5; s++) {
      const a = makeAssembly({
        L: 1,
        rng: new Rng(3000 + s),
        chiralityBias: 0.5,
        strategy: 'uniform',
      });
      while (a.tets.length < 20 && growOne(a) === 'grown') {
        // empty
      }
      expect(findOverlaps(a, 1)).toEqual([]);
    }
  });
});

describe('sideOfFace', () => {
  it('positive on the outward-normal side, negative on the other', () => {
    const tri = [
      [0, 0, 0],
      [1, 0, 0],
      [0, 1, 0],
    ] as const;
    expect(sideOfFace(tri, [0, 0, 1])).toBeGreaterThan(0);
    expect(sideOfFace(tri, [0, 0, -1])).toBeLessThan(0);
    expect(Math.abs(sideOfFace(tri, [0.5, 0.5, 0]))).toBeLessThan(1e-9);
  });
});

describe('mateOnCorrectSide', () => {
  it('false when mate would overlap parent (same-side centroid)', () => {
    const parent = unitPlanckton(1, 'R');
    // A fake "mate" placed on the SAME side as parent — should fail
    const fakeMate = { ...parent, verts: parent.verts };
    const target = [parent.verts[0], parent.verts[2], parent.verts[1]] as const;
    expect(mateOnCorrectSide(fakeMate, target, parent)).toBe(false);
  });
});
