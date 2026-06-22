import { describe, expect, it } from 'vitest';
import { tetInertia } from '../src/lib/inertia.js';
import { mat3mul } from '../src/lib/mat3.js';
import { tetVolume, unitPlanckton } from '../src/lib/planckton.js';
import type { Vec3 } from '../src/lib/vec.js';

const CANON: [Vec3, Vec3, Vec3, Vec3] = [
  [0, 0, 0],
  [1, 0, 0],
  [0, 1, 0],
  [0, 0, 1],
];

describe('tetInertia', () => {
  it('mass equals density · volume', () => {
    const p = unitPlanckton(2, 'R');
    const bi = tetInertia(p.verts, 3);
    expect(bi.mass).toBeCloseTo(3 * tetVolume(p.verts), 12);
  });

  it('canonical corner simplex matches the analytic inertia tensor', () => {
    // I_centroid for unit simplex (density 1): diag 1/80, off-diag 1/480.
    const bi = tetInertia(CANON, 1);
    const I = bi.inertiaBody;
    for (let i = 0; i < 3; i++)
      for (let j = 0; j < 3; j++) expect(I[i]![j]!).toBeCloseTo(i === j ? 1 / 80 : 1 / 480, 12);
  });

  it('inertia tensor is symmetric and positive-definite', () => {
    const bi = tetInertia(unitPlanckton(1, 'R').verts, 1);
    const I = bi.inertiaBody;
    expect(I[0]![1]).toBeCloseTo(I[1]![0]!, 12);
    expect(I[0]![2]).toBeCloseTo(I[2]![0]!, 12);
    expect(I[1]![2]).toBeCloseTo(I[2]![1]!, 12);
    // Sylvester's criterion: leading principal minors > 0.
    expect(I[0]![0]!).toBeGreaterThan(0);
    expect(I[0]![0]! * I[1]![1]! - I[0]![1]! * I[1]![0]!).toBeGreaterThan(0);
  });

  it('inverse · inertia = identity', () => {
    const bi = tetInertia(unitPlanckton(1.5, 'R').verts, 2);
    const prod = mat3mul(bi.inertiaBodyInv, bi.inertiaBody);
    for (let i = 0; i < 3; i++)
      for (let j = 0; j < 3; j++) expect(prod[i]![j]!).toBeCloseTo(i === j ? 1 : 0, 9);
  });

  it('inertia scales as mass·L² (≈ density·L⁵)', () => {
    const i1 = tetInertia(unitPlanckton(1, 'R').verts, 1).inertiaBody[0]![0]!;
    const i2 = tetInertia(unitPlanckton(2, 'R').verts, 1).inertiaBody[0]![0]!;
    expect(i2 / i1).toBeCloseTo(2 ** 5, 9);
  });

  it('comOffsetBody is centroid − verts[0]', () => {
    const p = unitPlanckton(1, 'R');
    const bi = tetInertia(p.verts, 1);
    expect(bi.comOffsetBody).toEqual([3 / 4, 1 / 2, 1 / 4]);
  });
});
