// Minimal 3×3 matrix algebra, row-major. Used by the vacuum physics for the
// tetrahedron inertia tensor and its world-frame rotation R·Iᵇ⁻¹·Rᵀ. Kept
// dependency-light (only the Vec3 type) so it stays pure and unit-testable.

import type { Vec3 } from './vec.js';

/** Row-major 3×3 matrix: rows[i] is the i-th row. */
export type Mat3 = [Vec3, Vec3, Vec3];

export const MAT3_IDENTITY: Mat3 = [
  [1, 0, 0],
  [0, 1, 0],
  [0, 0, 1],
];

export function mat3mulVec(m: Mat3, v: Vec3): Vec3 {
  return [
    m[0][0] * v[0] + m[0][1] * v[1] + m[0][2] * v[2],
    m[1][0] * v[0] + m[1][1] * v[1] + m[1][2] * v[2],
    m[2][0] * v[0] + m[2][1] * v[1] + m[2][2] * v[2],
  ];
}

export function mat3mul(a: Mat3, b: Mat3): Mat3 {
  const r = [
    [0, 0, 0],
    [0, 0, 0],
    [0, 0, 0],
  ] as Mat3;
  for (let i = 0; i < 3; i++) {
    for (let j = 0; j < 3; j++) {
      let s = 0;
      for (let k = 0; k < 3; k++) s += (a[i] as Vec3)[k]! * (b[k] as Vec3)[j]!;
      (r[i] as Vec3)[j] = s;
    }
  }
  return r;
}

export function mat3transpose(m: Mat3): Mat3 {
  return [
    [m[0][0], m[1][0], m[2][0]],
    [m[0][1], m[1][1], m[2][1]],
    [m[0][2], m[1][2], m[2][2]],
  ];
}

export function mat3scale(m: Mat3, s: number): Mat3 {
  return [
    [m[0][0] * s, m[0][1] * s, m[0][2] * s],
    [m[1][0] * s, m[1][1] * s, m[1][2] * s],
    [m[2][0] * s, m[2][1] * s, m[2][2] * s],
  ];
}

export function mat3sub(a: Mat3, b: Mat3): Mat3 {
  return [
    [a[0][0] - b[0][0], a[0][1] - b[0][1], a[0][2] - b[0][2]],
    [a[1][0] - b[1][0], a[1][1] - b[1][1], a[1][2] - b[1][2]],
    [a[2][0] - b[2][0], a[2][1] - b[2][1], a[2][2] - b[2][2]],
  ];
}

/** Outer product a·bᵀ. */
export function mat3outer(a: Vec3, b: Vec3): Mat3 {
  return [
    [a[0] * b[0], a[0] * b[1], a[0] * b[2]],
    [a[1] * b[0], a[1] * b[1], a[1] * b[2]],
    [a[2] * b[0], a[2] * b[1], a[2] * b[2]],
  ];
}

export function mat3det(m: Mat3): number {
  return (
    m[0][0] * (m[1][1] * m[2][2] - m[1][2] * m[2][1]) -
    m[0][1] * (m[1][0] * m[2][2] - m[1][2] * m[2][0]) +
    m[0][2] * (m[1][0] * m[2][1] - m[1][1] * m[2][0])
  );
}

/** Inverse via cofactors. Throws if singular (|det| below tolerance). */
export function mat3inverse(m: Mat3): Mat3 {
  const det = mat3det(m);
  if (Math.abs(det) < 1e-18) throw new Error('mat3inverse: singular matrix');
  const id = 1 / det;
  return [
    [
      (m[1][1] * m[2][2] - m[1][2] * m[2][1]) * id,
      (m[0][2] * m[2][1] - m[0][1] * m[2][2]) * id,
      (m[0][1] * m[1][2] - m[0][2] * m[1][1]) * id,
    ],
    [
      (m[1][2] * m[2][0] - m[1][0] * m[2][2]) * id,
      (m[0][0] * m[2][2] - m[0][2] * m[2][0]) * id,
      (m[0][2] * m[1][0] - m[0][0] * m[1][2]) * id,
    ],
    [
      (m[1][0] * m[2][1] - m[1][1] * m[2][0]) * id,
      (m[0][1] * m[2][0] - m[0][0] * m[2][1]) * id,
      (m[0][0] * m[1][1] - m[0][1] * m[1][0]) * id,
    ],
  ];
}
