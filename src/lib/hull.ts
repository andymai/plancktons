// Convex hull volume + bounding box, using quickhull3d.

import qh from 'quickhull3d';
import type { Vec3 } from './vec.js';
import { cross, dot, sub } from './vec.js';

export interface HullResult {
  /** Faces as triangles of vertex indices into the input point array. */
  faces: ReadonlyArray<readonly [number, number, number]>;
  /** All input points (faces index into this). */
  points: ReadonlyArray<Vec3>;
  /** Signed volume (always positive after we apply Math.abs in computeHull). */
  volume: number;
  /** Axis-aligned bounding box. */
  bbox: { min: Vec3; max: Vec3; volume: number; size: Vec3 };
}

function pointsToArray(pts: ReadonlyArray<Vec3>): Array<[number, number, number]> {
  return pts.map((p) => [p[0], p[1], p[2]] as [number, number, number]);
}

export function computeHull(points: ReadonlyArray<Vec3>): HullResult | null {
  if (points.length < 4) return null;
  let faces: number[][];
  try {
    faces = qh(pointsToArray(points)) as number[][];
  } catch {
    return null;
  }
  // quickhull3d returns triangular faces by default.
  const typedFaces = faces
    .filter((f) => f.length >= 3)
    .map((f) => [f[0] as number, f[1] as number, f[2] as number] as [number, number, number]);
  // Signed-tet-fan volume around point[0].
  const origin = points[0] as Vec3;
  let vol = 0;
  for (const [i, j, k] of typedFaces) {
    const a = sub(points[i] as Vec3, origin);
    const b = sub(points[j] as Vec3, origin);
    const c = sub(points[k] as Vec3, origin);
    vol += dot(a, cross(b, c)) / 6;
  }
  return {
    faces: typedFaces,
    points,
    volume: Math.abs(vol),
    bbox: computeBBox(points),
  };
}

export function computeBBox(points: ReadonlyArray<Vec3>): {
  min: Vec3;
  max: Vec3;
  volume: number;
  size: Vec3;
} {
  let min: Vec3 = [Infinity, Infinity, Infinity];
  let max: Vec3 = [-Infinity, -Infinity, -Infinity];
  for (const p of points) {
    if (p[0] < min[0]) min = [p[0], min[1], min[2]];
    if (p[1] < min[1]) min = [min[0], p[1], min[2]];
    if (p[2] < min[2]) min = [min[0], min[1], p[2]];
    if (p[0] > max[0]) max = [p[0], max[1], max[2]];
    if (p[1] > max[1]) max = [max[0], p[1], max[2]];
    if (p[2] > max[2]) max = [max[0], max[1], p[2]];
  }
  const size: Vec3 = [max[0] - min[0], max[1] - min[1], max[2] - min[2]];
  return { min, max, size, volume: size[0] * size[1] * size[2] };
}
