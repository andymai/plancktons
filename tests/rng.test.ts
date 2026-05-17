import { describe, expect, it } from 'vitest';
import { Rng } from '../src/lib/rng.js';

describe('Rng', () => {
  it('is deterministic - same seed yields same sequence', () => {
    const a = new Rng(1234);
    const b = new Rng(1234);
    for (let i = 0; i < 10; i++) expect(a.next()).toBe(b.next());
  });

  it('produces values in [0, 1)', () => {
    const r = new Rng(7);
    for (let i = 0; i < 1000; i++) {
      const v = r.next();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  it('int(N) returns 0..N-1', () => {
    const r = new Rng(1);
    for (let i = 0; i < 100; i++) {
      const v = r.int(10);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(10);
    }
  });

  it('pick on empty array throws', () => {
    expect(() => new Rng(1).pick([])).toThrow();
  });

  it('reset returns to initial state', () => {
    const r = new Rng(99);
    const first = [r.next(), r.next(), r.next()];
    r.reset();
    const second = [r.next(), r.next(), r.next()];
    expect(second).toEqual(first);
  });

  it('rejects seed 0 (maps to 1)', () => {
    const r = new Rng(0);
    expect(r.seed).toBe(1);
  });
});
