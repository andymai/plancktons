import { describe, expect, it } from 'vitest';
import { tetContact, tetsOverlap, unitPlanckton } from '../src/lib/planckton.js';
import { Rng } from '../src/lib/rng.js';
import { add, dot } from '../src/lib/vec.js';
import type { Vec3 } from '../src/lib/vec.js';

const shift = (verts: readonly [Vec3, Vec3, Vec3, Vec3], d: Vec3) =>
  verts.map((v) => add(v, d)) as [Vec3, Vec3, Vec3, Vec3];

describe('tetContact', () => {
  it('coincident tets report positive penetration', () => {
    const A = unitPlanckton(1, 'R').verts;
    const c = tetContact(A, A, 1);
    expect(c).not.toBeNull();
    expect(c!.depth).toBeGreaterThan(0);
  });

  it('far-apart tets report no contact', () => {
    const A = unitPlanckton(1, 'R').verts;
    const B = shift(A, [10, 0, 0]);
    expect(tetContact(A, B, 1)).toBeNull();
  });

  it('agrees with the tetsOverlap boolean on randomized placements', () => {
    const rng = new Rng(12345);
    const A = unitPlanckton(1, 'R').verts;
    for (let i = 0; i < 2000; i++) {
      const d: Vec3 = [(rng.next() - 0.5) * 4, (rng.next() - 0.5) * 4, (rng.next() - 0.5) * 4];
      const B = shift(A, d);
      const overlap = tetsOverlap(A, B, 1);
      const contact = tetContact(A, B, 1);
      expect(contact !== null).toBe(overlap);
    }
  });

  it('depth shrinks monotonically as B slides out along +X', () => {
    const A = unitPlanckton(1, 'R').verts;
    let prev = Infinity;
    for (let t = 0; t <= 1.2; t += 0.1) {
      const c = tetContact(A, shift(A, [t, 0, 0]), 1);
      if (!c) break;
      expect(c.depth).toBeLessThanOrEqual(prev + 1e-9);
      prev = c.depth;
    }
  });

  it('normal pushes B away from A (A→B orientation)', () => {
    const A = unitPlanckton(1, 'R').verts;
    const B = shift(A, [0.3, 0, 0]); // B nudged in +X
    const c = tetContact(A, B, 1)!;
    expect(c).not.toBeNull();
    expect(dot(c.normal, [1, 0, 0])).toBeGreaterThan(0);
  });
});
