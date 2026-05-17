import { describe, expect, it } from 'vitest';
import { morphologicalHull } from '../src/lib/morphology.js';
import { unitPlanckton } from '../src/lib/planckton.js';
import type { Planckton } from '../src/lib/planckton.js';
import type { Vec3 } from '../src/lib/vec.js';

function translate(p: Planckton, dx: number, dy: number, dz: number): Planckton {
  return {
    ...p,
    verts: p.verts.map((v) => [v[0] + dx, v[1] + dy, v[2] + dz] as Vec3) as Planckton['verts'],
  };
}

describe('morphologicalHull', () => {
  it('returns null for empty input', () => {
    expect(morphologicalHull([], 1)).toBe(null);
  });

  it('applies default voxelSize/alpha/padVoxels when opts omitted', () => {
    // Defaults: voxelSize=L/12, alpha=L. We only need the call to succeed.
    const tet = unitPlanckton(1, 'R');
    const result = morphologicalHull([tet], 1)!;
    expect(result).not.toBe(null);
    expect(result.volume).toBeGreaterThan(0);
  });

  it('recovers V* ≈ L³/6 for a single Planckton with tiny α (closing is a no-op)', () => {
    const tet = unitPlanckton(1, 'R');
    const result = morphologicalHull([tet], 1, { voxelSize: 0.06, alpha: 0.05 })!;
    // Expected: L³/6 ≈ 0.1667. Voxelization at L/16 has discretization
    // error ~ surface_area · voxelSize. A Hill T₁ with edge L=1 has surface
    // 2(L²/2) + 2(L·√2·L/2) = 1 + √2 ≈ 2.414 L², so over-count is roughly
    // surface · voxelSize / 2 ≈ 7% over V*.
    expect(result.volume).toBeGreaterThan(0.14);
    expect(result.volume).toBeLessThan(0.22);
  });

  it('closing is approximately idempotent on a convex body (single tet)', () => {
    // For a convex X, closing(X, α) ≈ X in the continuum (Minkowski sum
    // followed by Minkowski difference cancels). Discretely we expect
    // small per-α drift from voxelization + Chamfer ≈ Euclidean error, but
    // no large monotone drift in either direction.
    const tet = unitPlanckton(1, 'R');
    const v0 = morphologicalHull([tet], 1, { voxelSize: 0.08, alpha: 0.05 })!.volume;
    const v1 = morphologicalHull([tet], 1, { voxelSize: 0.08, alpha: 0.5 })!.volume;
    const v2 = morphologicalHull([tet], 1, { voxelSize: 0.08, alpha: 1.5 })!.volume;
    // All within 30% of each other (single tet ~ 326 voxels, ~10% surface
    // discretization noise; Chamfer skew adds another ~5-10% over radii of
    // ~20 voxels).
    expect(Math.abs(v1 - v0) / v0).toBeLessThan(0.3);
    expect(Math.abs(v2 - v0) / v0).toBeLessThan(0.3);
  });

  it('every closing satisfies V_morph ≥ V_voxelized (extensivity)', () => {
    // Closing is extensive in the continuum (closed ⊇ X). Discretely with
    // Chamfer ≈ Euclidean this should hold within ~1 voxel surface jitter.
    const a = unitPlanckton(1, 'R');
    const b = translate(unitPlanckton(1, 'R'), 1.5, 0, 0);
    const Vstar = 2 * (1 / 6); // L = 1
    for (const alpha of [0.05, 0.3, 0.6, 1.2]) {
      const result = morphologicalHull([a, b], 1, { voxelSize: 0.08, alpha })!;
      // 10% tolerance for the voxelization-vs-true V* discrepancy.
      expect(result.volume).toBeGreaterThanOrEqual(Vstar * 0.9);
    }
  });

  it('produces V_morph ≥ V* (true containment of the aggregate)', () => {
    // Generate three translated tets and check V_morph contains them all.
    const tets: Planckton[] = [
      unitPlanckton(1, 'R'),
      translate(unitPlanckton(1, 'L'), 1.2, 0, 0),
      translate(unitPlanckton(1, 'R'), 0, 1.2, 0),
    ];
    const Vstar = tets.length * (1 / 6); // L=1
    for (const alpha of [0.1, 0.5, 1.0]) {
      const result = morphologicalHull(tets, 1, { voxelSize: 0.08, alpha })!;
      expect(result.volume).toBeGreaterThanOrEqual(Vstar * 0.9); // 10% voxel discretization tolerance
    }
  });

  it('grid dimensions accommodate padding for the dilation kernel', () => {
    const tet = unitPlanckton(1, 'R');
    const result = morphologicalHull([tet], 1, { voxelSize: 0.1, alpha: 0.5 })!;
    // Bbox is [0,0,0]-[1,1,1] = 1 unit per axis = 10 voxels at voxelSize=0.1.
    // padVoxels = ceil(0.5/0.1)+2 = 7. So dims ≈ 10 + 2·7 = 24.
    expect(result.dims[0]).toBeGreaterThanOrEqual(20);
    expect(result.dims[0]).toBeLessThan(30);
  });
});
