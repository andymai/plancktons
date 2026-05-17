import { describe, expect, it } from 'vitest';
import { computeHull } from '../src/lib/hull.js';
import { unitPlanckton } from '../src/lib/planckton.js';

describe('computeHull', () => {
  it('returns null for < 4 points', () => {
    expect(computeHull([])).toBe(null);
    expect(
      computeHull([
        [0, 0, 0],
        [1, 0, 0],
        [0, 1, 0],
      ])
    ).toBe(null);
  });

  it('hull of a Hill T equals tet volume', () => {
    const p = unitPlanckton(1, 'R');
    const hull = computeHull([...p.verts])!;
    expect(hull.volume).toBeCloseTo(1 / 6, 6);
  });

  it('hull of a unit cube corners has volume 1', () => {
    const hull = computeHull([
      [0, 0, 0],
      [1, 0, 0],
      [0, 1, 0],
      [0, 0, 1],
      [1, 1, 0],
      [1, 0, 1],
      [0, 1, 1],
      [1, 1, 1],
    ])!;
    expect(hull.volume).toBeCloseTo(1, 6);
    expect(hull.bbox.volume).toBeCloseTo(1, 6);
    expect(hull.bbox.size[0]).toBeCloseTo(1);
  });
});
