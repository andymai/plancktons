// Planckton = Hill tetrahedron.
//
// Right-handed unit Hill T:  V0=(0,0,0)  V1=(L,0,0)  V2=(L,L,0)  V3=(L,L,L)
// Volume = L^3 / 6.  Faces (outward winding):
//   F0 = (V0,V2,V1)  isoceles right triangle (L, L, L√2), normal -Z
//   F1 = (V1,V2,V3)  isoceles right triangle (L, L, L√2), normal +X
//   F2 = (V0,V3,V2)  scalene right triangle  (L, L√2, L√3)
//   F3 = (V0,V1,V3)  scalene right triangle  (L, L√2, L√3)
//
// Left-handed = mirror across YZ. Mirroring flips face windings, so we reverse
// each face's vertex order to keep normals outward.

import type { Vec3 } from './vec.js';
import { add, centroid, cross, dot, norm, sub, unit } from './vec.js';
import { EDGE_LENGTH_EPS, SAT_MARGIN_FRAC } from './constants.js';

export type Chirality = 'R' | 'L';

export interface Planckton {
  /** 4 vertices in world coordinates */
  verts: readonly [Vec3, Vec3, Vec3, Vec3];
  /** 4 faces as vertex-index triples (winding gives outward normal) */
  faces: ReadonlyArray<readonly [number, number, number]>;
  chirality: Chirality;
}

const HILL_FACES_R: ReadonlyArray<readonly [number, number, number]> = [
  [0, 2, 1],
  [1, 2, 3],
  [0, 3, 2],
  [0, 1, 3],
];
const HILL_FACES_L: ReadonlyArray<readonly [number, number, number]> = HILL_FACES_R.map(
  ([a, b, c]) => [c, b, a] as const
);

export function unitPlanckton(L: number, chirality: Chirality): Planckton {
  const s = chirality === 'R' ? 1 : -1;
  return {
    verts: [
      [0, 0, 0],
      [s * L, 0, 0],
      [s * L, L, 0],
      [s * L, L, L],
    ],
    faces: chirality === 'R' ? HILL_FACES_R : HILL_FACES_L,
    chirality,
  };
}

export function faceTriangles(p: Planckton): Array<[Vec3, Vec3, Vec3]> {
  return p.faces.map(([i, j, k]) => [p.verts[i] as Vec3, p.verts[j] as Vec3, p.verts[k] as Vec3]);
}

export function faceNormal(tri: readonly [Vec3, Vec3, Vec3]): Vec3 {
  return unit(cross(sub(tri[1], tri[0]), sub(tri[2], tri[0])));
}

export function faceCenter(tri: readonly [Vec3, Vec3, Vec3]): Vec3 {
  return centroid(tri[0], tri[1], tri[2]);
}

/** Exact volume of a tetrahedron from its 4 vertices. */
export function tetVolume(verts: readonly [Vec3, Vec3, Vec3, Vec3]): number {
  const a = sub(verts[1], verts[0]);
  const b = sub(verts[2], verts[0]);
  const c = sub(verts[3], verts[0]);
  return Math.abs(dot(a, cross(b, c))) / 6;
}

/** Sorted edge-length signature; two triangles are congruent iff signatures match. */
export function edgeSig(tri: readonly [Vec3, Vec3, Vec3]): [number, number, number] {
  return [norm(sub(tri[1], tri[0])), norm(sub(tri[2], tri[1])), norm(sub(tri[0], tri[2]))].sort(
    (a, b) => a - b
  ) as [number, number, number];
}

export function sigEq(a: [number, number, number], b: [number, number, number]): boolean {
  return (
    Math.abs(a[0] - b[0]) < EDGE_LENGTH_EPS &&
    Math.abs(a[1] - b[1]) < EDGE_LENGTH_EPS &&
    Math.abs(a[2] - b[2]) < EDGE_LENGTH_EPS
  );
}

/**
 * Cyclic rotations of triangle B that align its edge-length sequence with A.
 * Returns 0, 1, or 2 permutations (1 for scalene faces, 2 for isoceles).
 */
export function matchPerms(
  A: readonly [Vec3, Vec3, Vec3],
  B: readonly [Vec3, Vec3, Vec3]
): Array<[number, number, number]> {
  const ae: [number, number, number] = [
    norm(sub(A[1], A[0])),
    norm(sub(A[2], A[1])),
    norm(sub(A[0], A[2])),
  ];
  const be: [number, number, number] = [
    norm(sub(B[1], B[0])),
    norm(sub(B[2], B[1])),
    norm(sub(B[0], B[2])),
  ];
  const out: Array<[number, number, number]> = [];
  for (let s = 0; s < 3; s++) {
    const e0 = be[s % 3] as number;
    const e1 = be[(s + 1) % 3] as number;
    const e2 = be[(s + 2) % 3] as number;
    if (
      Math.abs(e0 - ae[0]) < EDGE_LENGTH_EPS &&
      Math.abs(e1 - ae[1]) < EDGE_LENGTH_EPS &&
      Math.abs(e2 - ae[2]) < EDGE_LENGTH_EPS
    ) {
      out.push([s, (s + 1) % 3, (s + 2) % 3]);
    }
  }
  return out;
}

/**
 * Mate a template planckton so its face `tfIdx` (cyclically rotated by `perm`)
 * lies on `target` with the opposite outward normal. Returns a new Planckton in
 * world coordinates.
 */
/**
 * Mate a template Planckton onto a target face triangle in world coordinates,
 * producing the new Planckton whose face `tfIdx` (permuted by `perm`) is
 * vertex-coincident with `target` and whose apex lies on the opposite side of
 * the shared face plane from the template's interior.
 *
 * Face mating is a reflection through the shared face plane (the unique rigid
 * motion that vertex-aligns one congruent triangle to another while putting
 * the bodies on opposite sides). Reflections flip chirality, so the result's
 * `chirality` field is the OPPOSITE of the template's. This matches the Hill
 * cube tiling, which is necessarily 3R + 3L with alternating chirality around
 * each shared edge.
 *
 * Callers requesting a result of chirality C must therefore supply a template
 * of chirality flip(C). `unitPlanckton(L, flip(C))` is the convenient way.
 */
export function matePlanckton(
  template: Planckton,
  tfIdx: number,
  target: readonly [Vec3, Vec3, Vec3],
  perm: readonly [number, number, number]
): Planckton {
  const F = faceTriangles(template)[tfIdx] as [Vec3, Vec3, Vec3];
  const Fp: [Vec3, Vec3, Vec3] = [
    F[perm[0] as 0 | 1 | 2],
    F[perm[1] as 0 | 1 | 2],
    F[perm[2] as 0 | 1 | 2],
  ];
  const sC = centroid(Fp[0], Fp[1], Fp[2]);
  const sU = unit(sub(Fp[1], Fp[0]));
  const sN = faceNormal(Fp);
  const sV = cross(sN, sU);

  const tC = centroid(target[0], target[1], target[2]);
  const tU = unit(sub(target[1], target[0]));
  const tN = faceNormal(target);
  const tV = cross(tN, tU);

  // Proper rotation R: sU→tU, sV→tV, sN→tN. Maps Fp[i] → target[i] for
  // i ∈ {0,1,2} vertex-coincidently (both faces are congruent with matching
  // cyclic edge orientation, courtesy of matchPerms). To put the apex on the
  // OPPOSITE side of the shared face from the existing tet, additionally
  // reflect through the face plane: flip the N component before recomposing.
  // The combined transform = rotation ∘ reflection, det = -1, hence the
  // chirality flip in the returned Planckton.
  const apply = (v: Vec3): Vec3 => {
    const d = sub(v, sC);
    const cU = dot(d, sU);
    const cV = dot(d, sV);
    const cN = dot(d, sN);
    return add(tC, [
      cU * tU[0] + cV * tV[0] - cN * tN[0],
      cU * tU[1] + cV * tV[1] - cN * tN[1],
      cU * tU[2] + cV * tV[2] - cN * tN[2],
    ]);
  };
  const newVerts = template.verts.map(apply) as [Vec3, Vec3, Vec3, Vec3];
  const newChir: Chirality = template.chirality === 'R' ? 'L' : 'R';
  return {
    verts: newVerts,
    // Faces are vertex-index triples; mirroring reverses each face's winding
    // so the outward normal stays outward in world space. The HILL_FACES_L
    // table is precisely HILL_FACES_R reversed (see `unitPlanckton`).
    faces: newChir === 'R' ? HILL_FACES_R : HILL_FACES_L,
    chirality: newChir,
  };
}

// ---------------------------------------------------------------------------
// Overlap detection (SAT - Separating Axis Theorem)
// ---------------------------------------------------------------------------

const TET_EDGES: ReadonlyArray<readonly [number, number]> = [
  [0, 1],
  [0, 2],
  [0, 3],
  [1, 2],
  [1, 3],
  [2, 3],
];
const TET_FACES: ReadonlyArray<readonly [number, number, number]> = [
  [1, 2, 3],
  [0, 3, 2],
  [0, 1, 3],
  [0, 2, 1],
];

/**
 * Project the 4 tet vertices onto axis `axis` and return [min, max] interval.
 */
function projectTet(t: readonly [Vec3, Vec3, Vec3, Vec3], axis: Vec3): [number, number] {
  let min = Infinity;
  let max = -Infinity;
  for (const v of t) {
    const p = v[0] * axis[0] + v[1] * axis[1] + v[2] * axis[2];
    if (p < min) min = p;
    if (p > max) max = p;
  }
  return [min, max];
}

/**
 * Two tets `A` and `B` overlap iff their open interiors share volume.
 *
 * Uses the **Separating Axis Theorem**: two convex polyhedra are disjoint iff
 * there exists an axis on which their projections do not overlap. For two
 * tetrahedra, the candidate axes are:
 *   - 4 face normals of A
 *   - 4 face normals of B
 *   - 6 × 6 = 36 cross products of (edge of A) × (edge of B)
 *
 * Total: 44 axes. If any axis separates them (intervals disjoint with margin),
 * the tets do NOT overlap. Otherwise they do.
 *
 * The margin is `edgeLen · 1e-4` - large enough to tolerate floating-point
 * error in the rigid transform pipeline (~10⁻¹⁴ · L), small enough that
 * legitimate face/edge/vertex contact does NOT count as overlap. This is the
 * mathematically rigorous test; the earlier vertex/edge-face test was unsound
 * for two tets sharing a face with apexes on the same side.
 */
export function tetsOverlap(
  A: readonly [Vec3, Vec3, Vec3, Vec3],
  B: readonly [Vec3, Vec3, Vec3, Vec3],
  edgeLen: number
): boolean {
  const margin = edgeLen * SAT_MARGIN_FRAC;

  // Face normals (4 per tet).
  for (const t of [A, B]) {
    for (const [i, j, k] of TET_FACES) {
      const n = cross(sub(t[j] as Vec3, t[i] as Vec3), sub(t[k] as Vec3, t[i] as Vec3));
      const len = Math.sqrt(n[0] * n[0] + n[1] * n[1] + n[2] * n[2]);
      if (len < 1e-15) continue;
      const axis: Vec3 = [n[0] / len, n[1] / len, n[2] / len];
      const [aMin, aMax] = projectTet(A, axis);
      const [bMin, bMax] = projectTet(B, axis);
      if (aMax < bMin + margin || bMax < aMin + margin) return false;
    }
  }

  // 36 edge-edge cross products.
  for (const [ai, aj] of TET_EDGES) {
    const ea = sub(A[aj] as Vec3, A[ai] as Vec3);
    for (const [bi, bj] of TET_EDGES) {
      const eb = sub(B[bj] as Vec3, B[bi] as Vec3);
      const n = cross(ea, eb);
      const len = Math.sqrt(n[0] * n[0] + n[1] * n[1] + n[2] * n[2]);
      if (len < 1e-12) continue; // parallel edges - useless axis
      const axis: Vec3 = [n[0] / len, n[1] / len, n[2] / len];
      const [aMin, aMax] = projectTet(A, axis);
      const [bMin, bMax] = projectTet(B, axis);
      if (aMax < bMin + margin || bMax < aMin + margin) return false;
    }
  }

  // No separating axis found → overlap.
  return true;
}

export interface Contact {
  /** Unit minimum-translation axis, oriented to push B out of A (A→B). */
  normal: Vec3;
  /** Penetration depth along `normal` (≥ 0). */
  depth: number;
  /** Approximate contact point in world coordinates. */
  point: Vec3;
}

/**
 * Like {@link tetsOverlap}, but when the tets overlap returns the
 * minimum-translation vector (MTV): the separating-axis candidate of least
 * overlap, its penetration depth, and an approximate contact point. Returns
 * `null` exactly when `tetsOverlap` would return `false`.
 *
 * Used by the vacuum-bag settle to resolve frictionless normal-impulse
 * contacts. The 44 candidate axes are identical to `tetsOverlap`'s.
 */
export function tetContact(
  A: readonly [Vec3, Vec3, Vec3, Vec3],
  B: readonly [Vec3, Vec3, Vec3, Vec3],
  edgeLen: number
): Contact | null {
  const margin = edgeLen * SAT_MARGIN_FRAC;
  let bestDepth = Infinity;
  let bestAxis: Vec3 | null = null;

  const consider = (axis: Vec3): boolean => {
    const [aMin, aMax] = projectTet(A, axis);
    const [bMin, bMax] = projectTet(B, axis);
    if (aMax < bMin + margin || bMax < aMin + margin) return false; // separated
    const pen1 = aMax - bMin; // push B toward +axis
    const pen2 = bMax - aMin; // push B toward −axis
    if (pen1 <= pen2) {
      if (pen1 < bestDepth) {
        bestDepth = pen1;
        bestAxis = axis;
      }
    } else if (pen2 < bestDepth) {
      bestDepth = pen2;
      bestAxis = [-axis[0], -axis[1], -axis[2]];
    }
    return true;
  };

  for (const t of [A, B]) {
    for (const [i, j, k] of TET_FACES) {
      const n = cross(sub(t[j] as Vec3, t[i] as Vec3), sub(t[k] as Vec3, t[i] as Vec3));
      const len = Math.sqrt(n[0] * n[0] + n[1] * n[1] + n[2] * n[2]);
      if (len < 1e-15) continue;
      if (!consider([n[0] / len, n[1] / len, n[2] / len])) return null;
    }
  }
  for (const [ai, aj] of TET_EDGES) {
    const ea = sub(A[aj] as Vec3, A[ai] as Vec3);
    for (const [bi, bj] of TET_EDGES) {
      const eb = sub(B[bj] as Vec3, B[bi] as Vec3);
      const n = cross(ea, eb);
      const len = Math.sqrt(n[0] * n[0] + n[1] * n[1] + n[2] * n[2]);
      if (len < 1e-12) continue;
      if (!consider([n[0] / len, n[1] / len, n[2] / len])) return null;
    }
  }
  if (bestAxis === null) return null;
  const normal = bestAxis as Vec3;

  // Contact point ≈ midpoint of the deepest interpenetrating vertices: A's
  // vertex furthest along +normal and B's vertex furthest along −normal.
  let pA = A[0];
  let pAd = -Infinity;
  for (const v of A) {
    const d = dot(v, normal);
    if (d > pAd) {
      pAd = d;
      pA = v;
    }
  }
  let pB = B[0];
  let pBd = Infinity;
  for (const v of B) {
    const d = dot(v, normal);
    if (d < pBd) {
      pBd = d;
      pB = v;
    }
  }
  return {
    normal,
    depth: Math.max(0, bestDepth),
    point: [(pA[0] + pB[0]) / 2, (pA[1] + pB[1]) / 2, (pA[2] + pB[2]) / 2],
  };
}
