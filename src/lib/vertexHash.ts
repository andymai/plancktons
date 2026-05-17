import type { Vec3 } from './vec.js';

/** Default fractional tolerance for vertex coincidence: 1e-6 of edge length L.
 *  Tight enough to distinguish any two non-mated Hill T₁ vertices in practice,
 *  loose enough to absorb compounded float round-off from successive mate ops. */
export const VERTEX_HASH_EPS_REL = 1e-6;

/** Inverse epsilon for the supplied edge length L. */
export function vertexHashInv(L: number, relEps: number = VERTEX_HASH_EPS_REL): number {
  return 1 / (relEps * L);
}

/** Quantize a vertex to a canonical string key for hash-bucket coincidence. */
export function vertexKey(v: Vec3, inv: number): string {
  return `${Math.round(v[0] * inv)},${Math.round(v[1] * inv)},${Math.round(v[2] * inv)}`;
}

/** Canonical key for an unordered triangle: sort the three vertex keys so any
 *  permutation maps to the same string. */
export function triangleKey(tri: readonly [Vec3, Vec3, Vec3], inv: number): string {
  return [vertexKey(tri[0], inv), vertexKey(tri[1], inv), vertexKey(tri[2], inv)].sort().join('|');
}
