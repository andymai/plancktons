import { describe, expect, it } from 'vitest';
import { add, centroid, cross, dot, norm, scl, sub, unit } from '../src/lib/vec.js';

describe('vec', () => {
  it('add / sub / scl', () => {
    expect(add([1, 2, 3], [10, 20, 30])).toEqual([11, 22, 33]);
    expect(sub([10, 20, 30], [1, 2, 3])).toEqual([9, 18, 27]);
    expect(scl([1, 2, 3], 2)).toEqual([2, 4, 6]);
  });

  it('dot / cross / norm', () => {
    expect(dot([1, 0, 0], [0, 1, 0])).toBe(0);
    expect(dot([1, 2, 3], [4, 5, 6])).toBe(32);
    expect(cross([1, 0, 0], [0, 1, 0])).toEqual([0, 0, 1]);
    expect(norm([3, 4, 0])).toBeCloseTo(5, 12);
  });

  it('unit normalizes to length 1', () => {
    const u = unit([3, 0, 0]);
    expect(u).toEqual([1, 0, 0]);
    expect(norm(unit([1, 2, 3]))).toBeCloseTo(1, 12);
  });

  it('unit on zero vector returns zero (no NaN propagation)', () => {
    expect(unit([0, 0, 0])).toEqual([0, 0, 0]);
  });

  it('centroid averages an arbitrary number of points', () => {
    expect(centroid([0, 0, 0], [2, 0, 0])).toEqual([1, 0, 0]);
    expect(centroid([0, 0, 0], [3, 0, 0], [0, 3, 0])).toEqual([1, 1, 0]);
    const c = centroid([1, 1, 1], [2, 2, 2], [3, 3, 3], [4, 4, 4]);
    expect(c).toEqual([2.5, 2.5, 2.5]);
  });
});
