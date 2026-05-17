// Planckton = Hill tetrahedron.
//
// Right-handed unit Hill T:  V0=(0,0,0)  V1=(L,0,0)  V2=(L,L,0)  V3=(L,L,L)
// Volume = L^3 / 6.  Faces (outward winding):
//   F0 = (V0,V2,V1)  isoceles right triangle (L, L, L√2), normal -Z
//   F1 = (V1,V2,V3)  isoceles right triangle (L, L, L√2), normal +X
//   F2 = (V0,V3,V2)  scalene right triangle  (L, L√2, L√3)
//   F3 = (V0,V1,V3)  scalene right triangle  (L, L√2, L√3)
//
// Left-handed = mirror across YZ. Mirroring flips face windings, so we reverse
// each face's vertex order to keep normals outward.

import type { Vec3 } from './vec.js';
import { add, centroid, cross, dot, norm, scl, sub, unit } from './vec.js';

export type Chirality = 'R' | 'L';

export interface Planckton {
  /** 4 vertices in world coordinates */
  verts: readonly [Vec3, Vec3, Vec3, Vec3];
  /** 4 faces as vertex-index triples (winding gives outward normal) */
  faces: ReadonlyArray<readonly [number, number, number]>;
  chirality: Chirality;
}

const HILL_FACES_R: ReadonlyArray<readonly [number, number, number]> = [
  [0, 2, 1],
  [1, 2, 3],
  [0, 3, 2],
  [0, 1, 3],
];
const HILL_FACES_L: ReadonlyArray<readonly [number, number, number]> = HILL_FACES_R.map(
  ([a, b, c]) => [c, b, a] as const
);

export function unitPlanckton(L: number, chirality: Chirality): Planckton {
  const s = chirality === 'R' ? 1 : -1;
  return {
    verts: [
      [0, 0, 0],
      [s * L, 0, 0],
      [s * L, L, 0],
      [s * L, L, L],
    ],
    faces: chirality === 'R' ? HILL_FACES_R : HILL_FACES_L,
    chirality,
  };
}

export function faceTriangles(p: Planckton): Array<[Vec3, Vec3, Vec3]> {
  return p.faces.map(([i, j, k]) => [p.verts[i] as Vec3, p.verts[j] as Vec3, p.verts[k] as Vec3]);
}

export function faceNormal(tri: readonly [Vec3, Vec3, Vec3]): Vec3 {
  return unit(cross(sub(tri[1], tri[0]), sub(tri[2], tri[0])));
}

export function faceCenter(tri: readonly [Vec3, Vec3, Vec3]): Vec3 {
  return centroid(tri[0], tri[1], tri[2]);
}

/** Exact volume of a tetrahedron from its 4 vertices. */
export function tetVolume(verts: readonly [Vec3, Vec3, Vec3, Vec3]): number {
  const a = sub(verts[1], verts[0]);
  const b = sub(verts[2], verts[0]);
  const c = sub(verts[3], verts[0]);
  return Math.abs(dot(a, cross(b, c))) / 6;
}

/** Sorted edge-length signature; two triangles are congruent iff signatures match. */
export function edgeSig(tri: readonly [Vec3, Vec3, Vec3]): [number, number, number] {
  return [norm(sub(tri[1], tri[0])), norm(sub(tri[2], tri[1])), norm(sub(tri[0], tri[2]))].sort(
    (a, b) => a - b
  ) as [number, number, number];
}

const EPS = 1e-6;
export function sigEq(a: [number, number, number], b: [number, number, number]): boolean {
  return Math.abs(a[0] - b[0]) < EPS && Math.abs(a[1] - b[1]) < EPS && Math.abs(a[2] - b[2]) < EPS;
}

/**
 * Cyclic rotations of triangle B that align its edge-length sequence with A.
 * Returns 0, 1, or 2 permutations (1 for scalene faces, 2 for isoceles).
 */
export function matchPerms(
  A: readonly [Vec3, Vec3, Vec3],
  B: readonly [Vec3, Vec3, Vec3]
): Array<[number, number, number]> {
  const ae: [number, number, number] = [
    norm(sub(A[1], A[0])),
    norm(sub(A[2], A[1])),
    norm(sub(A[0], A[2])),
  ];
  const be: [number, number, number] = [
    norm(sub(B[1], B[0])),
    norm(sub(B[2], B[1])),
    norm(sub(B[0], B[2])),
  ];
  const out: Array<[number, number, number]> = [];
  for (let s = 0; s < 3; s++) {
    const e0 = be[s % 3] as number;
    const e1 = be[(s + 1) % 3] as number;
    const e2 = be[(s + 2) % 3] as number;
    if (Math.abs(e0 - ae[0]) < EPS && Math.abs(e1 - ae[1]) < EPS && Math.abs(e2 - ae[2]) < EPS) {
      out.push([s, (s + 1) % 3, (s + 2) % 3]);
    }
  }
  return out;
}

/**
 * Mate a template planckton so its face `tfIdx` (cyclically rotated by `perm`)
 * lies on `target` with the opposite outward normal. Returns a new Planckton in
 * world coordinates.
 */
export function matePlanckton(
  template: Planckton,
  tfIdx: number,
  target: readonly [Vec3, Vec3, Vec3],
  perm: readonly [number, number, number]
): Planckton {
  const F = faceTriangles(template)[tfIdx] as [Vec3, Vec3, Vec3];
  const Fp: [Vec3, Vec3, Vec3] = [
    F[perm[0] as 0 | 1 | 2],
    F[perm[1] as 0 | 1 | 2],
    F[perm[2] as 0 | 1 | 2],
  ];
  const sC = centroid(Fp[0], Fp[1], Fp[2]);
  const sU = unit(sub(Fp[1], Fp[0]));
  const sN = faceNormal(Fp);
  const sV = cross(sN, sU);

  const tC = centroid(target[0], target[1], target[2]);
  const tU = unit(sub(target[1], target[0]));
  const tN = faceNormal(target);
  // Flip normal so the new tet sits on the opposite side of the shared face.
  const tWf = scl(tN, -1);
  const tVf = cross(tWf, tU);

  // R · sU = tU, R · sV = tVf, R · sN = tWf
  // Apply: out = tC + R · (v - sC)
  const apply = (v: Vec3): Vec3 => {
    const d = sub(v, sC);
    const cU = dot(d, sU);
    const cV = dot(d, sV);
    const cN = dot(d, sN);
    return add(tC, [
      cU * tU[0] + cV * tVf[0] + cN * tWf[0],
      cU * tU[1] + cV * tVf[1] + cN * tWf[1],
      cU * tU[2] + cV * tVf[2] + cN * tWf[2],
    ]);
  };
  const newVerts = template.verts.map(apply) as [Vec3, Vec3, Vec3, Vec3];
  return { verts: newVerts, faces: template.faces, chirality: template.chirality };
}

// ---------------------------------------------------------------------------
// Overlap detection (vertex + centroid + edge-face)
// ---------------------------------------------------------------------------

function pointStrictlyIn(p: Vec3, t: readonly [Vec3, Vec3, Vec3, Vec3], margin: number): boolean {
  const v0 = sub(t[1], t[0]);
  const v1 = sub(t[2], t[0]);
  const v2 = sub(t[3], t[0]);
  const denom = dot(v0, cross(v1, v2));
  if (Math.abs(denom) < 1e-12) return false;
  const r = sub(p, t[0]);
  const c1 = dot(r, cross(v1, v2)) / denom;
  const c2 = dot(v0, cross(r, v2)) / denom;
  const c3 = dot(v0, cross(v1, r)) / denom;
  const c0 = 1 - c1 - c2 - c3;
  return c0 > margin && c1 > margin && c2 > margin && c3 > margin;
}

function segPlaneHit(p0: Vec3, p1: Vec3, fa: Vec3, fb: Vec3, fc: Vec3): Vec3 | null {
  const n = cross(sub(fb, fa), sub(fc, fa));
  const denom = dot(n, sub(p1, p0));
  if (Math.abs(denom) < 1e-12) return null;
  const t = dot(n, sub(fa, p0)) / denom;
  if (t <= 1e-6 || t >= 1 - 1e-6) return null;
  return [p0[0] + t * (p1[0] - p0[0]), p0[1] + t * (p1[1] - p0[1]), p0[2] + t * (p1[2] - p0[2])];
}

function pointInTri(p: Vec3, a: Vec3, b: Vec3, c: Vec3, margin: number): boolean {
  const v0 = sub(c, a);
  const v1 = sub(b, a);
  const v2 = sub(p, a);
  const d00 = dot(v0, v0);
  const d01 = dot(v0, v1);
  const d02 = dot(v0, v2);
  const d11 = dot(v1, v1);
  const d12 = dot(v1, v2);
  const denom = d00 * d11 - d01 * d01;
  if (Math.abs(denom) < 1e-15) return false;
  const u = (d11 * d02 - d01 * d12) / denom;
  const v = (d00 * d12 - d01 * d02) / denom;
  return u > margin && v > margin && u + v < 1 - margin;
}

const TET_EDGES: ReadonlyArray<readonly [number, number]> = [
  [0, 1],
  [0, 2],
  [0, 3],
  [1, 2],
  [1, 3],
  [2, 3],
];
const TET_FACES: ReadonlyArray<readonly [number, number, number]> = [
  [1, 2, 3],
  [0, 3, 2],
  [0, 1, 3],
  [0, 2, 1],
];

export function tetsOverlap(
  A: readonly [Vec3, Vec3, Vec3, Vec3],
  B: readonly [Vec3, Vec3, Vec3, Vec3],
  edgeLen: number
): boolean {
  const margin = edgeLen * 1e-3;
  if (pointStrictlyIn(centroid(A[0], A[1], A[2], A[3]), B, margin)) return true;
  if (pointStrictlyIn(centroid(B[0], B[1], B[2], B[3]), A, margin)) return true;
  for (const v of A) if (pointStrictlyIn(v, B, margin)) return true;
  for (const v of B) if (pointStrictlyIn(v, A, margin)) return true;
  const triMargin = 1e-3;
  for (const [i, j] of TET_EDGES) {
    for (const [fi, fj, fk] of TET_FACES) {
      const hit = segPlaneHit(
        A[i] as Vec3,
        A[j] as Vec3,
        B[fi] as Vec3,
        B[fj] as Vec3,
        B[fk] as Vec3
      );
      if (hit && pointInTri(hit, B[fi] as Vec3, B[fj] as Vec3, B[fk] as Vec3, triMargin))
        return true;
    }
  }
  for (const [i, j] of TET_EDGES) {
    for (const [fi, fj, fk] of TET_FACES) {
      const hit = segPlaneHit(
        B[i] as Vec3,
        B[j] as Vec3,
        A[fi] as Vec3,
        A[fj] as Vec3,
        A[fk] as Vec3
      );
      if (hit && pointInTri(hit, A[fi] as Vec3, A[fj] as Vec3, A[fk] as Vec3, triMargin))
        return true;
    }
  }
  return false;
}
