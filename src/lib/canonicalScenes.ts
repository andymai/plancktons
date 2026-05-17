import type { Vec3 } from './vec.js';
import type { Planckton, Chirality } from './planckton.js';

const RING_IDX: ReadonlyArray<readonly [number, number, number]> = [
  [1, 2, 3],
  [0, 3, 2],
  [0, 1, 3],
  [0, 2, 1],
];

/** Build a tetrahedron from 4 arbitrary points, auto-orienting faces outward. */
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

/** The 6-piece cube tiling. Each piece walks a different permutation of (x,y,z). */
export function cubeTiling(L: number): Planckton[] {
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
    // 4 corner sub-tets
    [W0, M01, M02, M03],
    [M01, W1, M12, M13],
    [M02, M12, W2, M23],
    [M03, M13, M23, W3],
    // 4 octahedron sub-tets sharing the diagonal M02—M13
    [M02, M13, M01, M03],
    [M02, M13, M03, M23],
    [M02, M13, M23, M12],
    [M02, M13, M12, M01],
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
