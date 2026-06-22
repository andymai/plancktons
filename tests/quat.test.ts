import { describe, expect, it } from 'vitest';
import {
  QUAT_IDENTITY,
  integrateQuat,
  quatConjugate,
  quatFromAxisAngle,
  quatMul,
  quatNormalize,
  quatToMat3,
  rotateVec,
  type Quat,
} from '../src/lib/quat.js';
import { mat3mulVec } from '../src/lib/mat3.js';
import type { Vec3 } from '../src/lib/vec.js';

const close = (a: Vec3, b: Vec3, p = 12) => {
  for (let i = 0; i < 3; i++) expect(a[i]).toBeCloseTo(b[i]!, p);
};

describe('quat', () => {
  it('identity rotates nothing', () => {
    close(rotateVec(QUAT_IDENTITY, [1, 2, 3]), [1, 2, 3]);
  });

  it('90° about Z maps +X → +Y', () => {
    const q = quatFromAxisAngle([0, 0, 1], Math.PI / 2);
    close(rotateVec(q, [1, 0, 0]), [0, 1, 0]);
  });

  it('rotateVec agrees with quatToMat3', () => {
    const q = quatNormalize([0.3, -0.5, 0.2, 0.8]);
    const v: Vec3 = [1.5, -2, 0.7];
    close(rotateVec(q, v), mat3mulVec(quatToMat3(q), v), 12);
  });

  it('conjugate undoes rotation', () => {
    const q = quatNormalize([0.1, 0.4, -0.2, 0.9]);
    const v: Vec3 = [2, -1, 3];
    close(rotateVec(quatConjugate(q), rotateVec(q, v)), v, 12);
  });

  it('composition: quatMul applies second operand first', () => {
    const z90 = quatFromAxisAngle([0, 0, 1], Math.PI / 2);
    const composed = quatMul(z90, z90); // 180° about Z
    close(rotateVec(composed, [1, 0, 0]), [-1, 0, 0], 12);
  });

  it('rotation preserves length', () => {
    const q = quatNormalize([1, 2, 3, 4]);
    const v: Vec3 = [3, -4, 12];
    const r = rotateVec(q, v);
    const len = (w: Vec3) => Math.sqrt(w[0] * w[0] + w[1] * w[1] + w[2] * w[2]);
    expect(len(r)).toBeCloseTo(len(v), 12);
  });

  it('integrateQuat about a fixed axis approaches the closed-form rotation', () => {
    const omega: Vec3 = [0, 0, 1]; // 1 rad/s about Z
    let q: Quat = [...QUAT_IDENTITY];
    const dt = 1e-4;
    for (let i = 0; i < 10000; i++) q = integrateQuat(q, omega, dt); // ~1 rad total
    const exact = quatFromAxisAngle([0, 0, 1], 1);
    close(rotateVec(q, [1, 0, 0]), rotateVec(exact, [1, 0, 0]), 4);
  });

  it('quatNormalize yields a unit quaternion', () => {
    const q = quatNormalize([3, 0, 0, 4]);
    expect(q[0] * q[0] + q[1] * q[1] + q[2] * q[2] + q[3] * q[3]).toBeCloseTo(1, 12);
  });
});
