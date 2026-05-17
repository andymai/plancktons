import { describe, expect, it } from 'vitest';
import { Rng } from '../src/lib/rng.js';
import {
  growOne,
  makeAssembly,
  meanTetCoordination,
  tetCoordinations,
} from '../src/lib/assembly.js';

describe('tetCoordinations', () => {
  it('returns one entry per tet, all initially z=0 for a seed assembly', () => {
    const a = makeAssembly({
      L: 1,
      rng: new Rng(1),
      chiralityBias: 0.5,
      strategy: 'uniform',
    });
    const z = tetCoordinations(a);
    expect(z).toHaveLength(1);
    expect(z[0]).toBe(0); // all 4 faces free → z = 0
  });

  it('sum of per-tet coordinations equals 4N - F_free', () => {
    const a = makeAssembly({
      L: 1,
      rng: new Rng(7),
      chiralityBias: 0.5,
      strategy: 'compact',
      compactBeta: 3,
    });
    for (let i = 0; i < 30; i++) {
      if (growOne(a) !== 'grown') break;
    }
    const z = tetCoordinations(a);
    let sum = 0;
    for (const zi of z) sum += zi;
    expect(sum).toBe(4 * a.tets.length - a.freeFaces.length);
  });

  it('mean of per-tet coordinations equals meanTetCoordination', () => {
    const a = makeAssembly({
      L: 1,
      rng: new Rng(3),
      chiralityBias: 0.5,
      strategy: 'compact',
      compactBeta: 3,
    });
    for (let i = 0; i < 20; i++) {
      if (growOne(a) !== 'grown') break;
    }
    const z = tetCoordinations(a);
    let sum = 0;
    for (const zi of z) sum += zi;
    expect(sum / z.length).toBeCloseTo(meanTetCoordination(a), 9);
  });

  it('every per-tet z is in [0, 4]', () => {
    const a = makeAssembly({
      L: 1,
      rng: new Rng(11),
      chiralityBias: 0.5,
      strategy: 'uniform',
    });
    for (let i = 0; i < 50; i++) {
      if (growOne(a) !== 'grown') break;
    }
    const z = tetCoordinations(a);
    for (const zi of z) {
      expect(zi).toBeGreaterThanOrEqual(0);
      expect(zi).toBeLessThanOrEqual(4);
    }
  });
});
