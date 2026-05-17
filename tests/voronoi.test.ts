import { describe, expect, it } from 'vitest';
import { etaVFromVoronoi, voronoiCells } from '../src/lib/voronoi.js';
import type { Vec3 } from '../src/lib/vec.js';

describe('voronoiCells', () => {
  it('returns null for empty input', () => {
    expect(voronoiCells([], 1)).toBe(null);
  });

  it('single centroid owns the entire padded bbox', () => {
    const pts: Vec3[] = [[0.5, 0.5, 0.5]];
    const v = voronoiCells(pts, 1, { voxelSize: 0.1, padL: 1 });
    expect(v).not.toBe(null);
    // Padded bbox: from -0.5 to 1.5 in each axis = 2³ = 8.
    expect(v!.totalVolume).toBeCloseTo(8, 2);
    expect(v!.volumes[0]).toBeCloseTo(8, 2);
    // Single cell touches the bbox surface, so it's flagged unbounded.
    expect(v!.bounded[0]).toBe(false);
    expect(v!.interiorCount).toBe(0);
  });

  it('two centroids split the bbox approximately equally', () => {
    const pts: Vec3[] = [
      [-1, 0, 0],
      [1, 0, 0],
    ];
    const v = voronoiCells(pts, 1, { voxelSize: 0.1, padL: 1 });
    expect(v).not.toBe(null);
    expect(v!.volumes[0]).toBeCloseTo(v!.volumes[1]!, 1);
  });

  it('cell volumes sum to total padded bbox volume', () => {
    // 8-point cube-corner cloud: pts at (-1,-1,-1) ... (1,1,1) corners.
    const pts: Vec3[] = [];
    for (const x of [-1, 1]) for (const y of [-1, 1]) for (const z of [-1, 1]) pts.push([x, y, z]);
    const v = voronoiCells(pts, 1, { voxelSize: 0.1, padL: 0.5 });
    expect(v).not.toBe(null);
    const sum = v!.volumes.reduce((s, x) => s + x, 0);
    expect(sum).toBeCloseTo(v!.totalVolume, 6);
    // Symmetry: all 8 cells should have nearly equal volume.
    const mean = sum / 8;
    for (const vol of v!.volumes) {
      expect(vol).toBeCloseTo(mean, 1);
    }
  });

  it('interior cells exclude bbox-boundary cells (3³ lattice)', () => {
    // 27 lattice points spaced by 1. The center (1,1,1) is surrounded on
    // all 6 axes, so its Voronoi cell is the unit cube [0.5,1.5]³ and
    // doesn't touch the padded bbox boundary. Every other point has a cell
    // that extends to the bbox boundary along at least one axis.
    const pts: Vec3[] = [];
    for (let x = 0; x < 3; x++)
      for (let y = 0; y < 3; y++) for (let z = 0; z < 3; z++) pts.push([x, y, z]);
    const v = voronoiCells(pts, 1, { voxelSize: 0.1, padL: 0.5 })!;
    // Find the central point's index (it's at (1,1,1)).
    const centerIdx = pts.findIndex(([x, y, z]) => x === 1 && y === 1 && z === 1);
    expect(v.bounded[centerIdx]).toBe(true);
    expect(v.interiorCount).toBe(1);
  });
});

describe('etaVFromVoronoi', () => {
  it('returns null when no interior cells exist', () => {
    const pts: Vec3[] = [[0, 0, 0]];
    const v = voronoiCells(pts, 1, { voxelSize: 0.2, padL: 0.5 })!;
    expect(etaVFromVoronoi(v, 1)).toBe(null);
  });

  it('is in (0, 1] for a real centroid cloud', () => {
    // 27 centroids in a 3x3x3 cube grid, spacing L=1. The central centroid
    // is interior and should have Voronoi cell ~ 1 (single unit cube),
    // giving η_V = (L³/6) / 1 = 1/6 ≈ 0.167.
    const pts: Vec3[] = [];
    for (let x = 0; x < 3; x++)
      for (let y = 0; y < 3; y++) for (let z = 0; z < 3; z++) pts.push([x, y, z]);
    const v = voronoiCells(pts, 1, { voxelSize: 0.1, padL: 1 })!;
    const eta = etaVFromVoronoi(v, 1);
    expect(eta).not.toBe(null);
    expect(eta!).toBeGreaterThan(0);
    expect(eta!).toBeLessThanOrEqual(1);
    // For unit-cube spacing, interior cell volume ≈ 1 L³ → η_V ≈ 1/6.
    expect(eta!).toBeCloseTo(1 / 6, 1);
  });
});
