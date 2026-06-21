import { describe, expect, it } from 'vitest';
import { marchingCubes } from '../src/lib/marchingCubes.js';
import type { Vec3 } from '../src/lib/vec.js';

/** Sample a signed-distance sphere on a grid: field < 0 inside. */
function sphereField(
  n: number,
  voxelSize: number,
  origin: Vec3,
  center: Vec3,
  radius: number
): Float32Array {
  const f = new Float32Array(n * n * n);
  for (let k = 0; k < n; k++)
    for (let j = 0; j < n; j++)
      for (let i = 0; i < n; i++) {
        const x = origin[0] + i * voxelSize;
        const y = origin[1] + j * voxelSize;
        const z = origin[2] + k * voxelSize;
        const d = Math.hypot(x - center[0], y - center[1], z - center[2]);
        f[i + n * (j + n * k)] = d - radius;
      }
  return f;
}

/** Every undirected edge of a closed 2-manifold is shared by exactly 2 tris. */
function edgeManifold(indices: Uint32Array): boolean {
  const count = new Map<string, number>();
  const bump = (a: number, b: number) => {
    const key = a < b ? `${a}_${b}` : `${b}_${a}`;
    count.set(key, (count.get(key) ?? 0) + 1);
  };
  for (let t = 0; t < indices.length; t += 3) {
    const a = indices[t]!;
    const b = indices[t + 1]!;
    const c = indices[t + 2]!;
    bump(a, b);
    bump(b, c);
    bump(c, a);
  }
  for (const v of count.values()) if (v !== 2) return false;
  return true;
}

describe('marchingCubes', () => {
  it('empty (all-positive) field yields no triangles', () => {
    const n = 8;
    const f = new Float32Array(n * n * n).fill(1);
    const m = marchingCubes(f, [n, n, n], [0, 0, 0], 1, 0);
    expect(m.positions.length).toBe(0);
    expect(m.indices.length).toBe(0);
  });

  it('a sphere field produces a closed manifold (χ ≈ 2)', () => {
    const n = 24;
    const vox = 1;
    const origin: Vec3 = [-12, -12, -12];
    const f = sphereField(n, vox, origin, [0, 0, 0], 7);
    const m = marchingCubes(f, [n, n, n], origin, vox, 0);
    expect(m.indices.length).toBeGreaterThan(0);
    expect(edgeManifold(m.indices)).toBe(true);
    const V = m.positions.length / 3;
    const F = m.indices.length / 3;
    const E = (3 * F) / 2;
    expect(V - E + F).toBe(2); // sphere has Euler characteristic 2
  });

  it('extracted sphere vertices lie near the target radius', () => {
    const n = 24;
    const vox = 1;
    const origin: Vec3 = [-12, -12, -12];
    const R = 7;
    const m = marchingCubes(sphereField(n, vox, origin, [0, 0, 0], R), [n, n, n], origin, vox, 0);
    for (let i = 0; i < m.positions.length; i += 3) {
      const r = Math.hypot(m.positions[i]!, m.positions[i + 1]!, m.positions[i + 2]!);
      expect(Math.abs(r - R)).toBeLessThan(vox); // within one voxel
    }
  });

  it('higher resolution yields more vertices', () => {
    const coarse = marchingCubes(
      sphereField(16, 1, [-8, -8, -8], [0, 0, 0], 5),
      [16, 16, 16],
      [-8, -8, -8],
      1,
      0
    );
    const fine = marchingCubes(
      sphereField(32, 0.5, [-8, -8, -8], [0, 0, 0], 5),
      [32, 32, 32],
      [-8, -8, -8],
      0.5,
      0
    );
    expect(fine.positions.length).toBeGreaterThan(coarse.positions.length);
  });
});
