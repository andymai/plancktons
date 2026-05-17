import { describe, expect, it } from 'vitest';
import {
  edgeSig,
  faceNormal,
  faceTriangles,
  matchPerms,
  matePlanckton,
  sigEq,
  tetVolume,
  tetsOverlap,
  unitPlanckton,
} from '../src/lib/planckton.js';

describe('unitPlanckton', () => {
  it('R chirality has volume L³/6', () => {
    const p = unitPlanckton(1, 'R');
    expect(tetVolume(p.verts)).toBeCloseTo(1 / 6, 10);
  });

  it('volume scales as L³', () => {
    for (const L of [0.5, 1, 2, 7]) {
      expect(tetVolume(unitPlanckton(L, 'R').verts)).toBeCloseTo(L ** 3 / 6, 8);
    }
  });

  it('L chirality is mirror of R (same volume, opposite signed determinant)', () => {
    const R = unitPlanckton(1, 'R').verts;
    const L = unitPlanckton(1, 'L').verts;
    expect(tetVolume(R)).toBeCloseTo(tetVolume(L), 10);
    expect(R[1][0]).toBe(1);
    expect(L[1][0]).toBe(-1);
  });

  it('R outward normals point AWAY from the opposite vertex', () => {
    const p = unitPlanckton(1, 'R');
    const tris = faceTriangles(p);
    const c = [
      (p.verts[0][0] + p.verts[1][0] + p.verts[2][0] + p.verts[3][0]) / 4,
      (p.verts[0][1] + p.verts[1][1] + p.verts[2][1] + p.verts[3][1]) / 4,
      (p.verts[0][2] + p.verts[1][2] + p.verts[2][2] + p.verts[3][2]) / 4,
    ] as const;
    for (const tri of tris) {
      const n = faceNormal(tri);
      const fc = [
        (tri[0][0] + tri[1][0] + tri[2][0]) / 3,
        (tri[0][1] + tri[1][1] + tri[2][1]) / 3,
        (tri[0][2] + tri[1][2] + tri[2][2]) / 3,
      ] as const;
      const dot = n[0] * (fc[0] - c[0]) + n[1] * (fc[1] - c[1]) + n[2] * (fc[2] - c[2]);
      expect(dot).toBeGreaterThan(0);
    }
  });
});

describe('edgeSig + sigEq', () => {
  it('returns sorted edge lengths', () => {
    const sig = edgeSig([
      [0, 0, 0],
      [3, 0, 0],
      [0, 4, 0],
    ]);
    expect(sig[0]).toBeCloseTo(3);
    expect(sig[1]).toBeCloseTo(4);
    expect(sig[2]).toBeCloseTo(5);
  });

  it('sigEq within EPS', () => {
    expect(sigEq([1, 2, 3], [1.0000001, 2, 3])).toBe(true);
    expect(sigEq([1, 2, 3], [1.01, 2, 3])).toBe(false);
  });
});

describe('matchPerms', () => {
  it('finds 1 cyclic perm for a scalene face', () => {
    const A: [[number, number, number], [number, number, number], [number, number, number]] = [
      [0, 0, 0],
      [3, 0, 0],
      [0, 4, 0],
    ];
    const perms = matchPerms(A, A);
    expect(perms.length).toBeGreaterThanOrEqual(1);
  });

  it('finds at most 3 perms for any triangle', () => {
    const tri: [[number, number, number], [number, number, number], [number, number, number]] = [
      [0, 0, 0],
      [1, 0, 0],
      [0, 1, 0],
    ];
    expect(matchPerms(tri, tri).length).toBeLessThanOrEqual(3);
  });
});

describe('matePlanckton', () => {
  it('places new tet on opposite side of shared face from template', () => {
    const tmpl = unitPlanckton(1, 'R');
    const target = faceTriangles(tmpl)[0]!;
    const perms = matchPerms(target, faceTriangles(tmpl)[0]!);
    expect(perms.length).toBeGreaterThan(0);
    const mated = matePlanckton(tmpl, 0, target, perms[0]!);
    // The mated tet's centroid should be opposite the template's centroid
    // across the shared face plane.
    const n = faceNormal(target);
    const a = target[0];
    const tmplC = [
      (tmpl.verts[0][0] + tmpl.verts[1][0] + tmpl.verts[2][0] + tmpl.verts[3][0]) / 4,
      (tmpl.verts[0][1] + tmpl.verts[1][1] + tmpl.verts[2][1] + tmpl.verts[3][1]) / 4,
      (tmpl.verts[0][2] + tmpl.verts[1][2] + tmpl.verts[2][2] + tmpl.verts[3][2]) / 4,
    ] as const;
    const matedC = [
      (mated.verts[0][0] + mated.verts[1][0] + mated.verts[2][0] + mated.verts[3][0]) / 4,
      (mated.verts[0][1] + mated.verts[1][1] + mated.verts[2][1] + mated.verts[3][1]) / 4,
      (mated.verts[0][2] + mated.verts[1][2] + mated.verts[2][2] + mated.verts[3][2]) / 4,
    ] as const;
    const dT = n[0] * (tmplC[0] - a[0]) + n[1] * (tmplC[1] - a[1]) + n[2] * (tmplC[2] - a[2]);
    const dM = n[0] * (matedC[0] - a[0]) + n[1] * (matedC[1] - a[1]) + n[2] * (matedC[2] - a[2]);
    expect(Math.sign(dT)).not.toBe(Math.sign(dM));
  });
});

describe('tetsOverlap', () => {
  it('returns false for two distant tets', () => {
    const A = unitPlanckton(1, 'R').verts;
    const B: [
      [number, number, number],
      [number, number, number],
      [number, number, number],
      [number, number, number],
    ] = [
      [10, 10, 10],
      [11, 10, 10],
      [11, 11, 10],
      [11, 11, 11],
    ];
    expect(tetsOverlap(A, B, 1)).toBe(false);
  });

  it('returns false for face-sharing tets (margin allows boundary)', () => {
    const A = unitPlanckton(1, 'R').verts;
    // Mirror across z=0 face: V3 -> (1,1,-1) on the other side
    const B: [
      [number, number, number],
      [number, number, number],
      [number, number, number],
      [number, number, number],
    ] = [
      [0, 0, 0],
      [1, 0, 0],
      [1, 1, 0],
      [1, 1, -1],
    ];
    expect(tetsOverlap(A, B, 1)).toBe(false);
  });

  it('returns true when a vertex is deep inside another tet', () => {
    const A = unitPlanckton(1, 'R').verts;
    const B: [
      [number, number, number],
      [number, number, number],
      [number, number, number],
      [number, number, number],
    ] = [
      [0.5, 0.5, 0.3],
      [2, 0, 0],
      [2, 1, 0],
      [2, 1, 1],
    ];
    // vertex (0.5, 0.5, 0.3) is inside A → overlap detected
    expect(tetsOverlap(A, B, 1)).toBe(true);
  });
});
