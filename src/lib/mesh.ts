// Plancktons → THREE.BufferGeometry helpers.

import * as THREE from 'three';
import type { Vec3 } from './vec.js';
import { sub, cross } from './vec.js';
import type { Planckton } from './planckton.js';

/** Build a triangulated geometry for one Planckton with per-face flat shading. */
export function plancktonGeometry(p: Planckton): THREE.BufferGeometry {
  const positions: number[] = [];
  const normals: number[] = [];
  for (const [i, j, k] of p.faces) {
    const a = p.verts[i] as Vec3;
    const b = p.verts[j] as Vec3;
    const c = p.verts[k] as Vec3;
    const n = cross(sub(b, a), sub(c, a));
    const len = Math.hypot(n[0], n[1], n[2]) || 1;
    const nx = n[0] / len;
    const ny = n[1] / len;
    const nz = n[2] / len;
    positions.push(a[0], a[1], a[2], b[0], b[1], b[2], c[0], c[1], c[2]);
    normals.push(nx, ny, nz, nx, ny, nz, nx, ny, nz);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  return g;
}

/** Edge geometry for outlining (12 edges of a tet, but skipping shared faces internal edges). */
export function plancktonEdgesGeometry(p: Planckton): THREE.BufferGeometry {
  const segs: number[] = [];
  const edges: ReadonlyArray<readonly [number, number]> = [
    [0, 1], [0, 2], [0, 3], [1, 2], [1, 3], [2, 3],
  ];
  for (const [i, j] of edges) {
    const a = p.verts[i] as Vec3;
    const b = p.verts[j] as Vec3;
    segs.push(a[0], a[1], a[2], b[0], b[1], b[2]);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(segs, 3));
  return g;
}

/** Build a single merged BufferGeometry from many Plancktons (for STL export). */
export function mergedPlancktonsGeometry(pts: ReadonlyArray<Planckton>): THREE.BufferGeometry {
  const positions: number[] = [];
  const normals: number[] = [];
  for (const p of pts) {
    for (const [i, j, k] of p.faces) {
      const a = p.verts[i] as Vec3;
      const b = p.verts[j] as Vec3;
      const c = p.verts[k] as Vec3;
      const n = cross(sub(b, a), sub(c, a));
      const len = Math.hypot(n[0], n[1], n[2]) || 1;
      const nx = n[0] / len;
      const ny = n[1] / len;
      const nz = n[2] / len;
      positions.push(a[0], a[1], a[2], b[0], b[1], b[2], c[0], c[1], c[2]);
      normals.push(nx, ny, nz, nx, ny, nz, nx, ny, nz);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  return g;
}

/** Geometry of a convex hull (triangle faces from quickhull3d). */
export function hullGeometry(
  points: ReadonlyArray<Vec3>,
  faces: ReadonlyArray<readonly [number, number, number]>
): THREE.BufferGeometry {
  const positions: number[] = [];
  const normals: number[] = [];
  for (const [i, j, k] of faces) {
    const a = points[i] as Vec3;
    const b = points[j] as Vec3;
    const c = points[k] as Vec3;
    const n = cross(sub(b, a), sub(c, a));
    const len = Math.hypot(n[0], n[1], n[2]) || 1;
    const nx = n[0] / len;
    const ny = n[1] / len;
    const nz = n[2] / len;
    positions.push(a[0], a[1], a[2], b[0], b[1], b[2], c[0], c[1], c[2]);
    normals.push(nx, ny, nz, nx, ny, nz, nx, ny, nz);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  return g;
}
