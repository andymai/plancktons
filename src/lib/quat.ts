// Unit-quaternion rotation math for the vacuum-bag rigid-body settle.
// Convention: Quat = [x, y, z, w] (vector part first, scalar last), representing
// a body→world rotation. Pure; depends only on vec/mat3.

import type { Vec3 } from './vec.js';
import { cross } from './vec.js';
import type { Mat3 } from './mat3.js';

export type Quat = [number, number, number, number];

export const QUAT_IDENTITY: Quat = [0, 0, 0, 1];

/** Hamilton product a⊗b (apply b first, then a). */
export function quatMul(a: Quat, b: Quat): Quat {
  const [ax, ay, az, aw] = a;
  const [bx, by, bz, bw] = b;
  return [
    aw * bx + ax * bw + ay * bz - az * by,
    aw * by - ax * bz + ay * bw + az * bx,
    aw * bz + ax * by - ay * bx + az * bw,
    aw * bw - ax * bx - ay * by - az * bz,
  ];
}

export function quatConjugate(q: Quat): Quat {
  return [-q[0], -q[1], -q[2], q[3]];
}

export function quatNormalize(q: Quat): Quat {
  const n = Math.sqrt(q[0] * q[0] + q[1] * q[1] + q[2] * q[2] + q[3] * q[3]);
  if (n === 0) return [...QUAT_IDENTITY];
  const id = 1 / n;
  return [q[0] * id, q[1] * id, q[2] * id, q[3] * id];
}

/** Rotate vector v by unit quaternion q: v' = v + 2·s×(s×v + w·v), s = q.xyz. */
export function rotateVec(q: Quat, v: Vec3): Vec3 {
  const s: Vec3 = [q[0], q[1], q[2]];
  const w = q[3];
  // t = 2·(s × v)
  const t = cross(s, v);
  t[0] *= 2;
  t[1] *= 2;
  t[2] *= 2;
  const st = cross(s, t);
  return [v[0] + w * t[0] + st[0], v[1] + w * t[1] + st[1], v[2] + w * t[2] + st[2]];
}

/** Quaternion from a (not necessarily unit) axis and angle in radians. */
export function quatFromAxisAngle(axis: Vec3, angle: number): Quat {
  const n = Math.sqrt(axis[0] * axis[0] + axis[1] * axis[1] + axis[2] * axis[2]);
  if (n === 0) return [...QUAT_IDENTITY];
  const h = angle / 2;
  const s = Math.sin(h) / n;
  return [axis[0] * s, axis[1] * s, axis[2] * s, Math.cos(h)];
}

/**
 * First-order orientation update: q' = normalize(q + ½·(ω,0)⊗q·dt), where ω is
 * the world-frame angular velocity. Stable for the small dt the settle uses.
 */
export function integrateQuat(q: Quat, omega: Vec3, dt: number): Quat {
  const wq: Quat = [omega[0], omega[1], omega[2], 0];
  const dq = quatMul(wq, q);
  const h = 0.5 * dt;
  return quatNormalize([q[0] + dq[0] * h, q[1] + dq[1] * h, q[2] + dq[2] * h, q[3] + dq[3] * h]);
}

/** Rotation matrix (body→world) for a unit quaternion. */
export function quatToMat3(q: Quat): Mat3 {
  const [x, y, z, w] = q;
  const xx = x * x;
  const yy = y * y;
  const zz = z * z;
  const xy = x * y;
  const xz = x * z;
  const yz = y * z;
  const wx = w * x;
  const wy = w * y;
  const wz = w * z;
  return [
    [1 - 2 * (yy + zz), 2 * (xy - wz), 2 * (xz + wy)],
    [2 * (xy + wz), 1 - 2 * (xx + zz), 2 * (yz - wx)],
    [2 * (xz - wy), 2 * (yz + wx), 1 - 2 * (xx + yy)],
  ];
}
