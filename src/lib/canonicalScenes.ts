import type { Vec3 } from './vec.js';
import type { Planckton, Chirality } from './planckton.js';

const RING_IDX: ReadonlyArray<readonly [number, number, number]> = [
  [1, 2, 3],
  [0, 3, 2],
  [0, 1, 3],
  [0, 2, 1],
];

/**
 * Build a tetrahedron from 4 arbitrary points, auto-orienting faces outward.
 *
 * For a Hill orthoscheme, chirality is sign(det(V1-V0, V2-V0, V3-V0)) — which
 * equals the geometric handedness **iff V0→V1→V2→V3 is the Hill path** (three
 * mutually perpendicular consecutive edges of equal length). Pass vertices in
 * Hill-path order; otherwise the determinant trick reports an arbitrary sign
 * based on vertex ordering, not the actual chirality.
 */
export function tetFromPts(pts: readonly [Vec3, Vec3, Vec3, Vec3]): Planckton {
  const [V0, V1, V2, V3] = pts;
  const cx = (V0[0] + V1[0] + V2[0] + V3[0]) / 4;
  const cy = (V0[1] + V1[1] + V2[1] + V3[1]) / 4;
  const cz = (V0[2] + V1[2] + V2[2] + V3[2]) / 4;
  // Determinant sign at one vertex determines chirality.
  const e1: Vec3 = [V1[0] - V0[0], V1[1] - V0[1], V1[2] - V0[2]];
  const e2: Vec3 = [V2[0] - V0[0], V2[1] - V0[1], V2[2] - V0[2]];
  const e3: Vec3 = [V3[0] - V0[0], V3[1] - V0[1], V3[2] - V0[2]];
  const det =
    e1[0] * (e2[1] * e3[2] - e2[2] * e3[1]) -
    e1[1] * (e2[0] * e3[2] - e2[2] * e3[0]) +
    e1[2] * (e2[0] * e3[1] - e2[1] * e3[0]);
  const chirality: Chirality = det >= 0 ? 'R' : 'L';

  const faces = RING_IDX.map(([i, j, k]) => {
    const Vi = pts[i] as Vec3;
    const Vj = pts[j] as Vec3;
    const Vk = pts[k] as Vec3;
    const ux = Vj[0] - Vi[0],
      uy = Vj[1] - Vi[1],
      uz = Vj[2] - Vi[2];
    const vx = Vk[0] - Vi[0],
      vy = Vk[1] - Vi[1],
      vz = Vk[2] - Vi[2];
    const nx = uy * vz - uz * vy;
    const ny = uz * vx - ux * vz;
    const nz = ux * vy - uy * vx;
    const fx = (Vi[0] + Vj[0] + Vk[0]) / 3;
    const fy = (Vi[1] + Vj[1] + Vk[1]) / 3;
    const fz = (Vi[2] + Vj[2] + Vk[2]) / 3;
    return (fx - cx) * nx + (fy - cy) * ny + (fz - cz) * nz >= 0
      ? ([i, j, k] as const)
      : ([i, k, j] as const);
  });
  return { verts: pts, faces, chirality };
}

/**
 * Classical 6-piece cube dissection along the main diagonal (0,0,0)–(L,L,L).
 * Each piece walks a different permutation of (x,y,z); even perms give R,
 * odd perms give L, so the breakdown is exactly 3R + 3L.
 *
 * This is a valid geometric tiling but is NOT realizable from a single Hill
 * T₁ decomposition (which produces 6+2, not 3+3). See `cubeHTRight` /
 * `cubeHTLeft` for the HT-realizable cubes.
 */
export function cubeGeometric(L: number): Planckton[] {
  const e: [Vec3, Vec3, Vec3] = [
    [L, 0, 0],
    [0, L, 0],
    [0, 0, L],
  ];
  const perms: ReadonlyArray<[number, number, number]> = [
    [0, 1, 2],
    [0, 2, 1],
    [1, 0, 2],
    [1, 2, 0],
    [2, 0, 1],
    [2, 1, 0],
  ];
  return perms.map(([a, b, c]) => {
    const V0: Vec3 = [0, 0, 0];
    const V1: Vec3 = [V0[0] + e[a][0], V0[1] + e[a][1], V0[2] + e[a][2]];
    const V2: Vec3 = [V1[0] + e[b][0], V1[1] + e[b][1], V1[2] + e[b][2]];
    const V3: Vec3 = [V2[0] + e[c][0], V2[1] + e[c][1], V2[2] + e[c][2]];
    return tetFromPts([V0, V1, V2, V3]);
  });
}

/** Back-compat alias. Prefer `cubeGeometric` for new code. */
export const cubeTiling = cubeGeometric;

/**
 * Three Hill orthoschemes tiling the y<z half-prism of the unit cube, with
 * chirality 1R + 2L. Each tet's vertex list is in Hill-path order so
 * tetFromPts recovers the geometric chirality.
 */
function halfPrismYltZ(L: number): Planckton[] {
  const V000: Vec3 = [0, 0, 0];
  const VL00: Vec3 = [L, 0, 0];
  const V00L: Vec3 = [0, 0, L];
  const VL0L: Vec3 = [L, 0, L];
  const V0LL: Vec3 = [0, L, L];
  const VLLL: Vec3 = [L, L, L];
  return [
    tetFromPts([V000, VL00, VL0L, VLLL]), // edges x, z, y → L
    tetFromPts([V000, V00L, VL0L, VLLL]), // edges z, x, y → R
    tetFromPts([V000, V00L, V0LL, VLLL]), // edges z, y, x → L
  ];
}

/**
 * Orientation-preserving 180° rotation around the line (t, L/2, L/2). Maps
 * (x, y, z) → (x, L−y, L−z). Swaps the y<z prism with the y>z prism while
 * fixing the cube [0,L]³. det = +1, so chirality is preserved on each piece.
 */
function rot180YZ(p: Planckton, L: number): Planckton {
  const newVerts = p.verts.map((v) => [v[0], L - v[1], L - v[2]] as Vec3) as [
    Vec3,
    Vec3,
    Vec3,
    Vec3,
  ];
  return tetFromPts(newVerts);
}

/** Reflection through x = L/2. det = −1, so chirality flips on every piece. */
function mirrorX(p: Planckton, L: number): Planckton {
  const newVerts = p.verts.map((v) => [L - v[0], v[1], v[2]] as Vec3) as [Vec3, Vec3, Vec3, Vec3];
  return tetFromPts(newVerts);
}

/**
 * HT-realizable cube with majority-L chirality (2R + 4L). Built as two copies
 * of the 1R+2L half-prism, joined by an orientation-preserving rotation.
 * This is the cube that physical Plancktons drawn from a single L-parent HT
 * decomposition can assemble.
 */
export function cubeHTLeft(L: number): Planckton[] {
  const lower = halfPrismYltZ(L);
  const upper = lower.map((p) => rot180YZ(p, L));
  return [...lower, ...upper];
}

/** Mirror of `cubeHTLeft`: 4R + 2L, from an R-parent HT decomposition. */
export function cubeHTRight(L: number): Planckton[] {
  return cubeHTLeft(L).map((p) => mirrorX(p, L));
}

/** The 8-reptile: 8 unit Plancktons tile a doubled Planckton. */
export function eightReptile(L: number): Planckton[] {
  const W0: Vec3 = [0, 0, 0];
  const W1: Vec3 = [2 * L, 0, 0];
  const W2: Vec3 = [2 * L, 2 * L, 0];
  const W3: Vec3 = [2 * L, 2 * L, 2 * L];
  const mid = (a: Vec3, b: Vec3): Vec3 => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2];
  const M01 = mid(W0, W1);
  const M02 = mid(W0, W2);
  const M03 = mid(W0, W3);
  const M12 = mid(W1, W2);
  const M13 = mid(W1, W3);
  const M23 = mid(W2, W3);
  const pieces: ReadonlyArray<[Vec3, Vec3, Vec3, Vec3]> = [
    // 4 corner sub-tets — each in Hill-path order, inheriting parent chirality.
    [W0, M01, M02, M03],
    [M01, W1, M12, M13],
    [M02, M12, W2, M23],
    [M03, M13, M23, W3],
    // 4 octahedron sub-tets sharing the M02-M13 axis. Each is given in its own
    // Hill-path order so tetFromPts recovers the correct geometric chirality.
    // Algebraically (parent edges a,b,c): the four paths have edge triples
    // (b,c,a), (c,a,b), (a,c,b), (b,a,c) — the first two preserve parent
    // chirality, the last two flip it, giving the 6+2 split.
    [M01, M02, M03, M13],
    [M02, M03, M13, M23],
    [M02, M12, M13, M23],
    [M01, M02, M12, M13],
  ];
  return pieces.map(tetFromPts);
}

export function explode(pieces: ReadonlyArray<Planckton>, amount: number): Planckton[] {
  if (amount === 0) return [...pieces];
  let cx = 0,
    cy = 0,
    cz = 0,
    n = 0;
  for (const p of pieces)
    for (const v of p.verts) {
      cx += v[0];
      cy += v[1];
      cz += v[2];
      n++;
    }
  cx /= n;
  cy /= n;
  cz /= n;
  return pieces.map((p) => {
    let pcx = 0,
      pcy = 0,
      pcz = 0;
    for (const v of p.verts) {
      pcx += v[0];
      pcy += v[1];
      pcz += v[2];
    }
    pcx /= 4;
    pcy /= 4;
    pcz /= 4;
    const dx = pcx - cx;
    const dy = pcy - cy;
    const dz = pcz - cz;
    const len = Math.hypot(dx, dy, dz) || 1;
    const ox = (dx / len) * amount;
    const oy = (dy / len) * amount;
    const oz = (dz / len) * amount;
    const newVerts = p.verts.map((v) => [v[0] + ox, v[1] + oy, v[2] + oz] as Vec3) as [
      Vec3,
      Vec3,
      Vec3,
      Vec3,
    ];
    return { ...p, verts: newVerts };
  });
}
