import { describe, expect, it } from 'vitest';
import { vacuumMetrics } from '../src/lib/vacuumMetrics.js';
import { createRigidBody } from '../src/lib/rigidTet.js';
import { quatFromAxisAngle } from '../src/lib/quat.js';

describe('vacuumMetrics', () => {
  it('computes comparable packing fractions on a small cluster', () => {
    const L = 1;
    const bodies = [];
    let s = 1;
    const rnd = () => {
      s = (s * 1103515245 + 12345) & 0x7fffffff;
      return s / 0x7fffffff;
    };
    for (let i = 0; i < 8; i++) {
      const pos: [number, number, number] = [
        (rnd() - 0.5) * 1.5,
        (rnd() - 0.5) * 1.5,
        (rnd() - 0.5) * 1.5,
      ];
      const q = quatFromAxisAngle([rnd(), rnd(), rnd()], rnd() * Math.PI);
      bodies.push(createRigidBody(L, i % 2 === 0 ? 'R' : 'L', pos, q));
    }
    const m = vacuumMetrics(bodies, L);
    expect(m.N).toBe(8);
    expect(m.Vstar).toBeCloseTo((8 * L ** 3) / 6, 9);
    expect(m.hullOk).toBe(true);
    expect(m.etaC).toBeGreaterThan(0);
    expect(m.etaC).toBeLessThanOrEqual(1.0001);
    expect(m.etaB).toBeGreaterThan(0);
    expect(m.etaB).toBeLessThanOrEqual(1.0001);
    expect(m.etaM).toBeGreaterThan(0);
    expect(m.gyration).not.toBeNull();
    expect(Number.isFinite(m.gyration!.rg)).toBe(true);
    expect(m.meanContactCoordination).toBeGreaterThanOrEqual(0);
  });
});
