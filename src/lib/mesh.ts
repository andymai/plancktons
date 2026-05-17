import * as THREE from 'three';
import type { Vec3 } from './vec.js';
import { sub, cross } from './vec.js';
import type { Planckton } from './planckton.js';

function buildFlatGeometry(tris: ReadonlyArray<readonly [Vec3, Vec3, Vec3]>): THREE.BufferGeometry {
  const positions: number[] = [];
  const normals: number[] = [];
  for (const [a, b, c] of tris) {
    const n = cross(sub(b, a), sub(c, a));
    const len = Math.hypot(n[0], n[1], n[2]) || 1;
    const nx = n[0] / len,
      ny = n[1] / len,
      nz = n[2] / len;
    positions.push(a[0], a[1], a[2], b[0], b[1], b[2], c[0], c[1], c[2]);
    normals.push(nx, ny, nz, nx, ny, nz, nx, ny, nz);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  return g;
}

function plancktonTris(p: Planckton): Array<[Vec3, Vec3, Vec3]> {
  return p.faces.map(([i, j, k]) => [p.verts[i] as Vec3, p.verts[j] as Vec3, p.verts[k] as Vec3]);
}

export function plancktonGeometry(p: Planckton): THREE.BufferGeometry {
  return buildFlatGeometry(plancktonTris(p));
}

export function plancktonEdgesGeometry(p: Planckton): THREE.BufferGeometry {
  const segs: number[] = [];
  for (const [i, j] of [
    [0, 1],
    [0, 2],
    [0, 3],
    [1, 2],
    [1, 3],
    [2, 3],
  ] as const) {
    const a = p.verts[i] as Vec3,
      b = p.verts[j] as Vec3;
    segs.push(a[0], a[1], a[2], b[0], b[1], b[2]);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(segs, 3));
  return g;
}

export function mergedPlancktonsGeometry(pts: ReadonlyArray<Planckton>): THREE.BufferGeometry {
  return buildFlatGeometry(pts.flatMap(plancktonTris));
}

export function hullGeometry(
  points: ReadonlyArray<Vec3>,
  faces: ReadonlyArray<readonly [number, number, number]>
): THREE.BufferGeometry {
  return buildFlatGeometry(
    faces.map(([i, j, k]) => [points[i] as Vec3, points[j] as Vec3, points[k] as Vec3])
  );
}
