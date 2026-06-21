// Mass properties (mass + inertia tensor about the centroid) of a solid
// tetrahedron of uniform density. Used to give each Planckton rigid-body
// dynamics in the vacuum-bag settle.
//
// Method: map the canonical corner simplex T0 = {0, e1, e2, e3} onto the target
// tet by the affine map x = v0 + A·u (A = [v1−v0, v2−v0, v3−v0] as columns).
// The canonical second-moment-about-origin matrix M0 (∫ uᵢuⱼ dV over T0) is
// constant; transform it, shift to the centroid via the parallel-axis theorem,
// then convert the covariance C to the inertia tensor I = tr(C)·I₃ − C.

import type { Vec3 } from './vec.js';
import { centroid, cross, dot, sub } from './vec.js';
import type { Mat3 } from './mat3.js';
import { mat3inverse, mat3outer, mat3scale, mat3sub } from './mat3.js';

export interface BodyInertia {
  /** mass = density · volume. */
  mass: number;
  /** Inertia tensor about the centroid, in the frame the verts are given. */
  inertiaBody: Mat3;
  /** Inverse of inertiaBody (for impulse response). */
  inertiaBodyInv: Mat3;
  /** centroid − verts[0]. */
  comOffsetBody: Vec3;
}

// ∫_{T0} uᵢuⱼ dV over the canonical simplex (vertices 0,e1,e2,e3, volume 1/6):
//   diagonal = 1/60, off-diagonal = 1/120.
const M0: Mat3 = [
  [1 / 60, 1 / 120, 1 / 120],
  [1 / 120, 1 / 60, 1 / 120],
  [1 / 120, 1 / 120, 1 / 60],
];
// First moment ∫_{T0} u dV = V0·g0 = (1/6)(1/4,1/4,1/4).
const FM0: Vec3 = [1 / 24, 1 / 24, 1 / 24];
const V0 = 1 / 6;

export function tetInertia(verts: readonly [Vec3, Vec3, Vec3, Vec3], density = 1): BodyInertia {
  const v0 = verts[0];
  // Columns of A.
  const c0 = sub(verts[1], v0);
  const c1 = sub(verts[2], v0);
  const c2 = sub(verts[3], v0);
  const detA = dot(c0, cross(c1, c2));
  const absDet = Math.abs(detA);
  const vol = absDet / 6;
  const mass = density * vol;

  // A·M0·Aᵀ, with A = [c0 c1 c2] as columns (so A row i = [c0ᵢ, c1ᵢ, c2ᵢ]).
  const A: Mat3 = [
    [c0[0], c1[0], c2[0]],
    [c0[1], c1[1], c2[1]],
    [c0[2], c1[2], c2[2]],
  ];
  const AM0AT = mat3MulSymTimesAT(A, M0);

  // A·FM0 (first moment mapped through the linear part).
  const Afm: Vec3 = [
    A[0][0] * FM0[0] + A[0][1] * FM0[1] + A[0][2] * FM0[2],
    A[1][0] * FM0[0] + A[1][1] * FM0[1] + A[1][2] * FM0[2],
    A[2][0] * FM0[0] + A[2][1] * FM0[1] + A[2][2] * FM0[2],
  ];

  // Second moment about the origin:
  //   M = density·|detA|·[ v0 v0ᵀ·V0 + v0 (Afm)ᵀ + (Afm) v0ᵀ + A M0 Aᵀ ].
  const scaleC = density * absDet;
  const v0v0 = mat3scale(mat3outer(v0, v0), V0);
  const cross1 = mat3outer(v0, Afm);
  const cross2 = mat3outer(Afm, v0);
  const inner = mat3add4(v0v0, cross1, cross2, AM0AT);
  const Morigin = mat3scale(inner, scaleC);

  // Shift to centroid: C = Morigin − mass·g gᵀ (parallel axis for 2nd moments).
  const g = centroid(verts[0], verts[1], verts[2], verts[3]);
  const cCentroid = mat3sub(Morigin, mat3scale(mat3outer(g, g), mass));

  // Inertia tensor I = tr(C)·I₃ − C.
  const tr = cCentroid[0][0] + cCentroid[1][1] + cCentroid[2][2];
  const inertiaBody: Mat3 = [
    [tr - cCentroid[0][0], -cCentroid[0][1], -cCentroid[0][2]],
    [-cCentroid[1][0], tr - cCentroid[1][1], -cCentroid[1][2]],
    [-cCentroid[2][0], -cCentroid[2][1], tr - cCentroid[2][2]],
  ];

  return {
    mass,
    inertiaBody,
    inertiaBodyInv: mat3inverse(inertiaBody),
    comOffsetBody: sub(g, v0),
  };
}

/** A·S·Aᵀ for symmetric S (S = M0 here). Returned matrix is symmetric. */
function mat3MulSymTimesAT(A: Mat3, S: Mat3): Mat3 {
  // (A·S)
  const AS: Mat3 = [
    [0, 0, 0],
    [0, 0, 0],
    [0, 0, 0],
  ];
  for (let i = 0; i < 3; i++) {
    for (let j = 0; j < 3; j++) {
      let s = 0;
      for (let k = 0; k < 3; k++) s += (A[i] as Vec3)[k]! * (S[k] as Vec3)[j]!;
      (AS[i] as Vec3)[j] = s;
    }
  }
  // (A·S)·Aᵀ
  const out: Mat3 = [
    [0, 0, 0],
    [0, 0, 0],
    [0, 0, 0],
  ];
  for (let i = 0; i < 3; i++) {
    for (let j = 0; j < 3; j++) {
      let s = 0;
      for (let k = 0; k < 3; k++) s += (AS[i] as Vec3)[k]! * (A[j] as Vec3)[k]!;
      (out[i] as Vec3)[j] = s;
    }
  }
  return out;
}

function mat3add4(a: Mat3, b: Mat3, c: Mat3, d: Mat3): Mat3 {
  const out: Mat3 = [
    [0, 0, 0],
    [0, 0, 0],
    [0, 0, 0],
  ];
  for (let i = 0; i < 3; i++) {
    for (let j = 0; j < 3; j++) {
      (out[i] as Vec3)[j] =
        (a[i] as Vec3)[j]! + (b[i] as Vec3)[j]! + (c[i] as Vec3)[j]! + (d[i] as Vec3)[j]!;
    }
  }
  return out;
}
