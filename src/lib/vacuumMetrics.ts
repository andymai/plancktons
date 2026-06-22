// Final-frame metrics for a vacuum-bag packing. Reuses the same estimators the
// growth scene uses, so η values are directly comparable — the only difference
// is the input is a jammed physics packing rather than a face-mated aggregate.
// Coordination comes from the geometric contact graph (no freeFaces exist).

import type { Vec3 } from './vec.js';
import { computeHull } from './hull.js';
import { morphologicalHull } from './morphology.js';
import { voronoiCells, etaVFromVoronoi } from './voronoi.js';
import { gyrationDescriptors, type ShapeDescriptors } from './shape.js';
import { tetVolume } from './planckton.js';
import { tetCentroid } from './spatialHash.js';
import type { RigidBody } from './rigidTet.js';
import { bodyToPlanckton } from './rigidTet.js';
import { contactGraph } from './contactGraph.js';

export interface VacuumMetrics {
  N: number;
  /** Σ tet volume = N·L³/6. */
  Vstar: number;
  /** η_C = V★/V_hull (convex compactness; not literature-comparable). */
  etaC: number;
  /** η_B = V★/V_bbox (literature-comparable packing fraction). */
  etaB: number;
  /** η_M = V★/V_morph (morphological hull). */
  etaM: number;
  /** η_V = (L³/6)/⟨V_voronoi⟩ over interior cells, or null if undefined. */
  etaV: number | null;
  gyration: ShapeDescriptors | null;
  meanContactCoordination: number;
  maxContactCoordination: number;
  /** False if the convex hull was degenerate (η_C/η_B fall back to 0). */
  hullOk: boolean;
}

export interface VacuumMetricsOptions {
  /** Morphology voxel size (default L/12). */
  voxelSize?: number;
  /** Morphology closing radius (default L). */
  alpha?: number;
  /** Voronoi bbox padding in L (default 1). */
  voronoiPadL?: number;
}

export function vacuumMetrics(
  bodies: ReadonlyArray<RigidBody>,
  L: number,
  opts: VacuumMetricsOptions = {}
): VacuumMetrics {
  const N = bodies.length;
  const tets = bodies.map(bodyToPlanckton);
  const Vstar = tets.reduce((s, t) => s + tetVolume(t.verts), 0);
  const allVerts: Vec3[] = [];
  const centroids: Vec3[] = [];
  for (const t of tets) {
    for (const v of t.verts) allVerts.push(v);
    centroids.push(tetCentroid(t.verts));
  }

  const hull = computeHull(allVerts);
  const hullOk = hull !== null && hull.volume > 0;
  const etaC = hullOk ? Vstar / hull!.volume : 0;
  const etaB = hullOk && hull!.bbox.volume > 0 ? Vstar / hull!.bbox.volume : 0;

  const morph = morphologicalHull(tets, L, { voxelSize: opts.voxelSize, alpha: opts.alpha });
  const etaM = morph && morph.volume > 0 ? Vstar / morph.volume : 0;

  const vor = voronoiCells(centroids, L, { padL: opts.voronoiPadL });
  const etaV = vor ? etaVFromVoronoi(vor, L) : null;

  const cg = contactGraph(bodies, L);

  return {
    N,
    Vstar,
    etaC,
    etaB,
    etaM,
    etaV,
    gyration: gyrationDescriptors(allVerts),
    meanContactCoordination: cg.meanContactCoordination,
    maxContactCoordination: cg.maxContactCoordination,
    hullOk,
  };
}
