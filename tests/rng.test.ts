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

  it('pick returns an element of a non-empty array', () => {
    const r = new Rng(42);
    const arr = ['a', 'b', 'c', 'd'];
    for (let i = 0; i < 20; i++) expect(arr).toContain(r.pick(arr));
  });

  it('pick distribution covers every index over many calls (deterministic)', () => {
    const r = new Rng(7);
    const arr = [0, 1, 2, 3];
    const seen = new Set<number>();
    for (let i = 0; i < 200; i++) seen.add(r.pick(arr));
    expect(seen.size).toBe(4);
  });
});
