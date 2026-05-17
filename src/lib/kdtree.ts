// 3D static kd-tree on a fixed point cloud. Built once with build(); each
// nearest() call returns the index of the closest point in the original
// array. Ties resolve to the **lowest original index**, matching the
// `if (d2 < best)` strict-inequality tie-break of the brute-force scan it
// replaces in voronoi.ts — bit-identical output.

import type { Vec3 } from './vec.js';

interface Node {
  /** Original index of the point at this node. */
  idx: number;
  /** Splitting axis (0=x, 1=y, 2=z). */
  axis: 0 | 1 | 2;
  /** Children indices into the `nodes` array; -1 = absent. */
  left: number;
  right: number;
}

export interface KdTree3 {
  points: ReadonlyArray<Vec3>;
  nodes: Node[];
  /** Root index in `nodes`; -1 iff points is empty. */
  root: number;
}

export function buildKdTree(points: ReadonlyArray<Vec3>): KdTree3 {
  const n = points.length;
  const tree: KdTree3 = { points, nodes: [], root: -1 };
  if (n === 0) return tree;
  const indices = new Array<number>(n);
  for (let i = 0; i < n; i++) indices[i] = i;
  tree.root = buildRecursive(tree, indices, 0, n, 0);
  return tree;
}

function buildRecursive(
  tree: KdTree3,
  indices: number[],
  lo: number,
  hi: number,
  depth: number
): number {
  if (lo >= hi) return -1;
  const axis = (depth % 3) as 0 | 1 | 2;
  const mid = (lo + hi) >> 1;
  // Quickselect to put the median at indices[mid]. Stable across ties is not
  // required — final tie-break happens in `nearest` against original index.
  quickselect(tree.points, indices, lo, hi - 1, mid, axis);
  const node: Node = {
    idx: indices[mid] as number,
    axis,
    left: -1,
    right: -1,
  };
  const nodeIdx = tree.nodes.length;
  tree.nodes.push(node);
  // Recurse children after pushing self, then fill in their indices.
  const leftIdx = buildRecursive(tree, indices, lo, mid, depth + 1);
  const rightIdx = buildRecursive(tree, indices, mid + 1, hi, depth + 1);
  tree.nodes[nodeIdx]!.left = leftIdx;
  tree.nodes[nodeIdx]!.right = rightIdx;
  return nodeIdx;
}

/** In-place partial sort: after the call, indices[kth] is the kth-smallest
 *  by axis-coordinate, with smaller elements on the left and larger on the
 *  right. O(n) expected. */
function quickselect(
  points: ReadonlyArray<Vec3>,
  indices: number[],
  lo: number,
  hi: number,
  kth: number,
  axis: 0 | 1 | 2
): void {
  while (lo < hi) {
    const pivot = partition(points, indices, lo, hi, axis);
    if (pivot === kth) return;
    if (kth < pivot) hi = pivot - 1;
    else lo = pivot + 1;
  }
}

function partition(
  points: ReadonlyArray<Vec3>,
  indices: number[],
  lo: number,
  hi: number,
  axis: 0 | 1 | 2
): number {
  // Median-of-three pivot to avoid quadratic behaviour on sorted input.
  const mid = (lo + hi) >> 1;
  if (key(points, indices, mid, axis) < key(points, indices, lo, axis)) swap(indices, lo, mid);
  if (key(points, indices, hi, axis) < key(points, indices, lo, axis)) swap(indices, lo, hi);
  if (key(points, indices, mid, axis) < key(points, indices, hi, axis)) swap(indices, mid, hi);
  const pivotKey = key(points, indices, hi, axis);
  let store = lo;
  for (let i = lo; i < hi; i++) {
    if (key(points, indices, i, axis) < pivotKey) {
      swap(indices, store, i);
      store++;
    }
  }
  swap(indices, store, hi);
  return store;
}

function key(points: ReadonlyArray<Vec3>, indices: number[], i: number, axis: 0 | 1 | 2): number {
  return (points[indices[i] as number] as Vec3)[axis];
}

function swap(a: number[], i: number, j: number): void {
  const t = a[i] as number;
  a[i] = a[j] as number;
  a[j] = t;
}

/** Squared distance from query to point at index `i`. */
function sqDist(points: ReadonlyArray<Vec3>, i: number, q: Vec3): number {
  const p = points[i] as Vec3;
  const dx = p[0] - q[0];
  const dy = p[1] - q[1];
  const dz = p[2] - q[2];
  return dx * dx + dy * dy + dz * dz;
}

/**
 * Return the index of the nearest point to `q`. Ties — points at exactly the
 * same squared distance — resolve to the lowest original index, matching the
 * `if (d2 < best)` strict-inequality tie-break used by the brute-force
 * Voronoi scan it replaces.
 */
export function nearest(tree: KdTree3, q: Vec3): number {
  if (tree.root === -1) return -1;
  let bestIdx = -1;
  let bestSq = Infinity;
  // Iterative DFS with manual stack so we don't blow the JS stack on large N.
  const stack: number[] = [tree.root];
  while (stack.length > 0) {
    const ni = stack.pop() as number;
    if (ni === -1) continue;
    const node = tree.nodes[ni] as Node;
    const d2 = sqDist(tree.points, node.idx, q);
    if (
      d2 < bestSq ||
      // On exact-tie, prefer the lower original index — matches brute-force
      // `if (d2 < best)` (first-seen-wins under sequential 0..N iteration).
      (d2 === bestSq && node.idx < bestIdx)
    ) {
      bestSq = d2;
      bestIdx = node.idx;
    }
    const qAxis = q[node.axis];
    const pAxis = (tree.points[node.idx] as Vec3)[node.axis];
    const diff = qAxis - pAxis;
    // Recurse near side first; queue far side only if its splitting plane
    // is closer than the current best.
    const near = diff < 0 ? node.left : node.right;
    const far = diff < 0 ? node.right : node.left;
    if (far !== -1 && diff * diff <= bestSq) stack.push(far);
    if (near !== -1) stack.push(near);
  }
  return bestIdx;
}
