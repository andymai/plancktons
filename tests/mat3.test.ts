import { describe, expect, it } from 'vitest';
import {
  MAT3_IDENTITY,
  mat3det,
  mat3inverse,
  mat3mul,
  mat3mulVec,
  mat3outer,
  mat3transpose,
  type Mat3,
} from '../src/lib/mat3.js';

const M: Mat3 = [
  [1, 2, 3],
  [0, 1, 4],
  [5, 6, 0],
];

describe('mat3', () => {
  it('identity is multiplicative neutral', () => {
    expect(mat3mul(M, MAT3_IDENTITY)).toEqual(M);
    expect(mat3mul(MAT3_IDENTITY, M)).toEqual(M);
  });

  it('mulVec matches row dot products', () => {
    expect(mat3mulVec(M, [1, 1, 1])).toEqual([6, 5, 11]);
  });

  it('transpose is an involution', () => {
    expect(mat3transpose(mat3transpose(M))).toEqual(M);
  });

  it('inverse · M = identity', () => {
    const inv = mat3inverse(M);
    const prod = mat3mul(inv, M);
    for (let i = 0; i < 3; i++)
      for (let j = 0; j < 3; j++) expect(prod[i]![j]!).toBeCloseTo(i === j ? 1 : 0, 12);
  });

  it('det of identity is 1, singular matrix throws on inverse', () => {
    expect(mat3det(MAT3_IDENTITY)).toBe(1);
    const singular: Mat3 = [
      [1, 2, 3],
      [2, 4, 6],
      [1, 1, 1],
    ];
    expect(() => mat3inverse(singular)).toThrow();
  });

  it('outer product is rank-1 with expected entries', () => {
    expect(mat3outer([1, 2, 3], [4, 5, 6])).toEqual([
      [4, 5, 6],
      [8, 10, 12],
      [12, 15, 18],
    ]);
  });
});
