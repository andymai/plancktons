import { describe, expect, it } from 'vitest';
import { Rng } from '../src/lib/rng.js';
import { buildKdTree, nearest } from '../src/lib/kdtree.js';
import type { Vec3 } from '../src/lib/vec.js';

function bruteForceNearest(points: ReadonlyArray<Vec3>, q: Vec3): number {
  // Mirror voronoi.ts's strict-inequality tie-break: first-seen wins on equal
  // distance, which under 0..N-1 iteration is the lowest index.
  let best = Infinity;
  let bestIdx = -1;
  for (let k = 0; k < points.length; k++) {
    const p = points[k] as Vec3;
    const dx = p[0] - q[0];
    const dy = p[1] - q[1];
    const dz = p[2] - q[2];
    const d2 = dx * dx + dy * dy + dz * dz;
    if (d2 < best) {
      best = d2;
      bestIdx = k;
    }
  }
  return bestIdx;
}

describe('kdtree (3D)', () => {
  it('empty tree returns -1', () => {
    const tree = buildKdTree([]);
    expect(nearest(tree, [0, 0, 0])).toBe(-1);
  });

  it('single point is always nearest', () => {
    const tree = buildKdTree([[1, 2, 3] as Vec3]);
    expect(nearest(tree, [0, 0, 0])).toBe(0);
    expect(nearest(tree, [100, 100, 100])).toBe(0);
  });

  it('matches brute-force on random clouds (property test)', () => {
    const rng = new Rng(42);
    // 50 centroids, 500 random queries — matches the order of magnitude of
    // typical Voronoi workloads (N=200 centroids × K³ voxels per cell).
    const points: Vec3[] = [];
    for (let i = 0; i < 50; i++) {
      points.push([rng.next() * 10, rng.next() * 10, rng.next() * 10]);
    }
    const tree = buildKdTree(points);
    for (let q = 0; q < 500; q++) {
      const query: Vec3 = [rng.next() * 12 - 1, rng.next() * 12 - 1, rng.next() * 12 - 1];
      const got = nearest(tree, query);
      const want = bruteForceNearest(points, query);
      expect(got).toBe(want);
    }
  });

  it('exact tie resolves to lowest original index', () => {
    // Two equidistant points; tree-build order is arbitrary, but the contract
    // is that nearest() returns the lower index.
    const points: Vec3[] = [
      [1, 0, 0],
      [-1, 0, 0],
    ];
    const tree = buildKdTree(points);
    expect(nearest(tree, [0, 0, 0])).toBe(0);
  });

  it('three-way tie also resolves to lowest index', () => {
    const points: Vec3[] = [
      [0, 0, 1],
      [1, 0, 0],
      [0, 1, 0],
    ];
    const tree = buildKdTree(points);
    expect(nearest(tree, [0, 0, 0])).toBe(0);
  });

  it('matches brute-force on lattice points (no ties)', () => {
    const points: Vec3[] = [];
    for (let x = 0; x < 4; x++)
      for (let y = 0; y < 4; y++) for (let z = 0; z < 4; z++) points.push([x, y, z]);
    const tree = buildKdTree(points);
    const rng = new Rng(7);
    for (let q = 0; q < 100; q++) {
      const query: Vec3 = [rng.next() * 4 - 0.5, rng.next() * 4 - 0.5, rng.next() * 4 - 0.5];
      expect(nearest(tree, query)).toBe(bruteForceNearest(points, query));
    }
  });
});
