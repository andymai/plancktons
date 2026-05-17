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

  it('reports a pair when two tets are forced to coincide', () => {
    // Construct a 2-tet "assembly" by hand where both tets share the same
    // verts → trivially overlapping. This exercises the push branch.
    const p = unitPlanckton(1, 'R');
    const fake = {
      tets: [p, { ...p }],
      opts: { L: 1, rng: new Rng(1), chiralityBias: 0.5, strategy: 'uniform' as const },
    } as unknown as Parameters<typeof findOverlaps>[0];
    const overlaps = findOverlaps(fake, 1);
    expect(overlaps).toHaveLength(1);
    expect(overlaps[0]!.a).toBe(0);
    expect(overlaps[0]!.b).toBe(1);
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
    // A fake "mate" placed on the SAME side as parent - should fail
    const fakeMate = { ...parent, verts: parent.verts };
    const target = [parent.verts[0], parent.verts[2], parent.verts[1]] as const;
    expect(mateOnCorrectSide(fakeMate, target, parent)).toBe(false);
  });

  it('true when mate sits on the opposite side of the target face', () => {
    const parent = unitPlanckton(1, 'R');
    // Mirror the parent across the z=0 plane (face F0). The mirrored tet
    // sits below the xy-plane while parent sits above → centroids on
    // opposite sides of the F0 plane.
    const mirroredVerts = parent.verts.map(
      (v) => [v[0], v[1], -v[2]] as [number, number, number]
    ) as [
      [number, number, number],
      [number, number, number],
      [number, number, number],
      [number, number, number],
    ];
    const mate = { ...parent, verts: mirroredVerts };
    // F0 triangle (verts 0, 2, 1) is shared by parent and mate.
    const target = [parent.verts[0], parent.verts[2], parent.verts[1]] as const;
    expect(mateOnCorrectSide(mate, target, parent)).toBe(true);
  });
});
