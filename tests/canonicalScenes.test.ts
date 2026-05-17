import { describe, expect, it } from 'vitest';
import { cubeTiling, eightReptile, explode, tetFromPts } from '../src/lib/canonicalScenes.js';
import { tetVolume } from '../src/lib/planckton.js';
import type { Vec3 } from '../src/lib/vec.js';

describe('cubeTiling', () => {
  it('produces 6 tets', () => {
    expect(cubeTiling(1)).toHaveLength(6);
  });

  it('total volume equals L³', () => {
    for (const L of [1, 2, 5]) {
      const sum = cubeTiling(L).reduce((s, p) => s + tetVolume(p.verts), 0);
      expect(sum).toBeCloseTo(L ** 3, 8);
    }
  });

  it('chirality split is 3 R + 3 L (even vs odd permutations)', () => {
    const pieces = cubeTiling(1);
    const R = pieces.filter((p) => p.chirality === 'R').length;
    const L = pieces.filter((p) => p.chirality === 'L').length;
    expect(R).toBe(3);
    expect(L).toBe(3);
  });
});

describe('eightReptile', () => {
  it('produces 8 tets each of volume L³/6', () => {
    const pieces = eightReptile(1);
    expect(pieces).toHaveLength(8);
    for (const p of pieces) expect(tetVolume(p.verts)).toBeCloseTo(1 / 6, 8);
  });

  it('total volume equals (2L)³/6 for various L', () => {
    for (const L of [0.5, 1, 3]) {
      const sum = eightReptile(L).reduce((s, p) => s + tetVolume(p.verts), 0);
      expect(sum).toBeCloseTo((2 * L) ** 3 / 6, 8);
    }
  });
});

describe('recursive midpoint subdivision (depth 2, 3)', () => {
  function subdivide(verts: readonly [Vec3, Vec3, Vec3, Vec3]) {
    const [V0, V1, V2, V3] = verts;
    const m = (a: Vec3, b: Vec3): Vec3 => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2];
    const M01 = m(V0, V1),
      M02 = m(V0, V2),
      M03 = m(V0, V3);
    const M12 = m(V1, V2),
      M13 = m(V1, V3),
      M23 = m(V2, V3);
    return [
      [V0, M01, M02, M03],
      [M01, V1, M12, M13],
      [M02, M12, V2, M23],
      [M03, M13, M23, V3],
      [M02, M13, M01, M03],
      [M02, M13, M03, M23],
      [M02, M13, M23, M12],
      [M02, M13, M12, M01],
    ] as Array<[Vec3, Vec3, Vec3, Vec3]>;
  }

  it('depth=2 yields 64 pieces each of volume L³/48', () => {
    let pieces: Array<[Vec3, Vec3, Vec3, Vec3]> = eightReptile(1).map(
      (p) => [...p.verts] as [Vec3, Vec3, Vec3, Vec3]
    );
    pieces = pieces.flatMap(subdivide);
    expect(pieces).toHaveLength(64);
    for (const p of pieces) expect(tetVolume(p)).toBeCloseTo(1 / 48, 10);
  });

  it('depth=3 yields 512 pieces each of volume L³/384', () => {
    let pieces: Array<[Vec3, Vec3, Vec3, Vec3]> = eightReptile(1).map(
      (p) => [...p.verts] as [Vec3, Vec3, Vec3, Vec3]
    );
    pieces = pieces.flatMap(subdivide).flatMap(subdivide);
    expect(pieces).toHaveLength(512);
    for (const p of pieces) expect(tetVolume(p)).toBeCloseTo(1 / 384, 10);
  });
});

describe('explode', () => {
  it('amount=0 returns a shallow copy without mutating verts', () => {
    const pieces = cubeTiling(1);
    const out = explode(pieces, 0);
    expect(out).not.toBe(pieces);
    expect(out).toHaveLength(pieces.length);
    for (let i = 0; i < pieces.length; i++) {
      expect(out[i]!.verts).toEqual(pieces[i]!.verts);
    }
  });

  it('preserves tet volume (rigid translation only)', () => {
    const pieces = cubeTiling(1);
    const out = explode(pieces, 0.5);
    for (let i = 0; i < pieces.length; i++) {
      expect(tetVolume(out[i]!.verts)).toBeCloseTo(tetVolume(pieces[i]!.verts), 10);
    }
  });

  it('moves each piece outward by exactly `amount` from the global centroid', () => {
    const pieces = cubeTiling(1);
    // Global centroid of unit cube tiling is (0.5, 0.5, 0.5).
    const out = explode(pieces, 0.7);
    for (let i = 0; i < pieces.length; i++) {
      const before = pieces[i]!.verts;
      const after = out[i]!.verts;
      // All four verts of a single piece must translate by the same delta.
      const dx0 = after[0][0] - before[0][0];
      const dy0 = after[0][1] - before[0][1];
      const dz0 = after[0][2] - before[0][2];
      for (let k = 1; k < 4; k++) {
        expect(after[k][0] - before[k][0]).toBeCloseTo(dx0, 10);
        expect(after[k][1] - before[k][1]).toBeCloseTo(dy0, 10);
        expect(after[k][2] - before[k][2]).toBeCloseTo(dz0, 10);
      }
      // The translation magnitude must equal `amount`.
      expect(Math.hypot(dx0, dy0, dz0)).toBeCloseTo(0.7, 10);
    }
  });

  it('handles a single piece centered at origin (degenerate dir → fallback)', () => {
    // When a piece's centroid coincides with the global centroid, len=0 and
    // the code falls back to len=1, producing a zero offset.
    const single = cubeTiling(1).slice(0, 1);
    const out = explode(single, 5);
    // Single piece: piece centroid == global centroid → offset is (0,0,0).
    for (let k = 0; k < 4; k++) {
      expect(out[0]!.verts[k]).toEqual(single[0]!.verts[k]);
    }
  });
});

describe('tetFromPts', () => {
  it('detects chirality from signed determinant', () => {
    const R = tetFromPts([
      [0, 0, 0],
      [1, 0, 0],
      [1, 1, 0],
      [1, 1, 1],
    ]);
    expect(R.chirality).toBe('R');
    const L = tetFromPts([
      [0, 0, 0],
      [-1, 0, 0],
      [-1, 1, 0],
      [-1, 1, 1],
    ]);
    expect(L.chirality).toBe('L');
  });
});
