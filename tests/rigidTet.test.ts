import { describe, expect, it } from 'vitest';
import {
  bodyKineticEnergy,
  bodyToPlanckton,
  correctPenetration,
  createRigidBody,
  integrateBody,
  resolveBoundary,
  resolveContact,
} from '../src/lib/rigidTet.js';
import { tetVolume } from '../src/lib/planckton.js';
import { norm } from '../src/lib/vec.js';
import type { Vec3 } from '../src/lib/vec.js';

describe('rigidTet', () => {
  it('bodyToPlanckton reconstructs a translated tet with correct volume', () => {
    const b = createRigidBody(2, 'R', [5, -3, 1]);
    const p = bodyToPlanckton(b);
    expect(p.chirality).toBe('R');
    expect(tetVolume(p.verts)).toBeCloseTo(2 ** 3 / 6, 9);
  });

  it('integrateBody advances position by vel·dt', () => {
    const b = createRigidBody(1, 'R', [0, 0, 0]);
    b.vel = [1, 2, -1];
    integrateBody(b, 0.5);
    expect(b.pos).toEqual([0.5, 1, -0.5]);
  });

  it('elastic head-on contact (e=1) conserves kinetic energy', () => {
    const a = createRigidBody(1, 'R', [-0.5, 0, 0]);
    const b = createRigidBody(1, 'R', [0.5, 0, 0]);
    a.vel = [1, 0, 0];
    b.vel = [-1, 0, 0];
    const before = bodyKineticEnergy(a) + bodyKineticEnergy(b);
    resolveContact(a, b, [1, 0, 0], [0, 0, 0], 1);
    const after = bodyKineticEnergy(a) + bodyKineticEnergy(b);
    expect(after).toBeCloseTo(before, 9);
    // equal masses exchange normal velocity
    expect(a.vel[0]).toBeCloseTo(-1, 9);
    expect(b.vel[0]).toBeCloseTo(1, 9);
  });

  it('inelastic contact (e=0) drains energy and removes approach velocity', () => {
    const a = createRigidBody(1, 'R', [-0.5, 0, 0]);
    const b = createRigidBody(1, 'R', [0.5, 0, 0]);
    a.vel = [1, 0, 0];
    b.vel = [-1, 0, 0];
    const before = bodyKineticEnergy(a) + bodyKineticEnergy(b);
    resolveContact(a, b, [1, 0, 0], [0, 0, 0], 0);
    const after = bodyKineticEnergy(a) + bodyKineticEnergy(b);
    expect(after).toBeLessThan(before);
    const vrel = b.vel[0] - a.vel[0];
    expect(vrel).toBeCloseTo(0, 9);
  });

  it('separating bodies receive no impulse', () => {
    const a = createRigidBody(1, 'R', [-0.5, 0, 0]);
    const b = createRigidBody(1, 'R', [0.5, 0, 0]);
    a.vel = [-1, 0, 0];
    b.vel = [1, 0, 0];
    resolveContact(a, b, [1, 0, 0], [0, 0, 0], 0);
    expect(a.vel).toEqual([-1, 0, 0]);
    expect(b.vel).toEqual([1, 0, 0]);
  });

  it('resolveBoundary clamps a body inside the wall and kills outward velocity', () => {
    const b = createRigidBody(1, 'R', [2, 0, 0]);
    b.vel = [1, 0, 0];
    resolveBoundary(b, [0, 0, 0], 2, 0);
    expect(norm(b.pos) + b.radius).toBeLessThanOrEqual(2 + 1e-9);
    expect(b.vel[0]).toBeLessThanOrEqual(0 + 1e-9);
  });

  it('resolveBoundary leaves an interior body untouched', () => {
    const b = createRigidBody(1, 'R', [0.1, 0, 0]);
    const v: Vec3 = [0.3, -0.2, 0.1];
    b.vel = [...v];
    resolveBoundary(b, [0, 0, 0], 5, 0);
    expect(b.vel).toEqual(v);
  });

  it('correctPenetration pushes equal-mass bodies apart by half the depth each, no velocity change', () => {
    const a = createRigidBody(1, 'R', [0, 0, 0]);
    const b = createRigidBody(1, 'R', [0.4, 0, 0]);
    correctPenetration(a, b, [1, 0, 0], 0.2, 0, 0.5);
    // corr = 0.2·0.5 = 0.1, split evenly ⇒ each moves 0.05 along ∓normal.
    expect(a.pos[0]).toBeCloseTo(-0.05, 12);
    expect(b.pos[0]).toBeCloseTo(0.45, 12);
    expect(a.vel).toEqual([0, 0, 0]);
    expect(b.vel).toEqual([0, 0, 0]);
  });

  it('correctPenetration does nothing within slop', () => {
    const a = createRigidBody(1, 'R', [0, 0, 0]);
    const b = createRigidBody(1, 'R', [0, 0, 0]);
    correctPenetration(a, b, [1, 0, 0], 0.001, 0.01, 0.5);
    expect(a.pos).toEqual([0, 0, 0]);
    expect(b.pos).toEqual([0, 0, 0]);
  });
});
