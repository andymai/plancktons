// Iso-surface extraction from a scalar field sampled on a regular grid, used to
// build the vacuum bag's wrinkled "vacuum-seal" skin from the morphological
// signed-distance field. Pure data-in/data-out (no THREE) — the scene wraps the
// returned positions/indices in a BufferGeometry, mirroring mesh.ts.
//
// Implemented as marching *tetrahedra* (each grid cell split into 6 tets): this
// is a member of the marching-cubes family that is inherently watertight and
// manifold, avoiding the error-prone 256-case cube tables. Interior edges are
// shared by exactly two triangles, so the surface is a closed 2-manifold.

import type { Vec3 } from './vec.js';

export interface MeshData {
  /** Flat xyz triples. */
  positions: Float32Array;
  /** Triangle index triples into `positions`. */
  indices: Uint32Array;
}

// Cube corner offsets (di, dj, dk), standard numbering.
const CORNERS: ReadonlyArray<readonly [number, number, number]> = [
  [0, 0, 0],
  [1, 0, 0],
  [1, 1, 0],
  [0, 1, 0],
  [0, 0, 1],
  [1, 0, 1],
  [1, 1, 1],
  [0, 1, 1],
];

// Six tetrahedra sharing the 0–6 space diagonal — a valid, gap-free cube split.
const TETS: ReadonlyArray<readonly [number, number, number, number]> = [
  [0, 5, 1, 6],
  [0, 1, 2, 6],
  [0, 2, 3, 6],
  [0, 3, 7, 6],
  [0, 7, 4, 6],
  [0, 4, 5, 6],
];

export function marchingCubes(
  field: Float32Array,
  dims: [number, number, number],
  origin: Vec3,
  voxelSize: number,
  iso: number
): MeshData {
  const [nx, ny, nz] = dims;
  const positions: number[] = [];
  const indices: number[] = [];
  const vertexCache = new Map<number, number>();

  const nodeIdx = (i: number, j: number, k: number): number => i + nx * (j + ny * k);

  // Interpolated vertex on the edge between two grid nodes, deduplicated by the
  // ordered node-index pair so neighboring tets share the vertex.
  const edgeVertex = (na: number, nb: number): number => {
    const key = na < nb ? na * field.length + nb : nb * field.length + na;
    const cached = vertexCache.get(key);
    if (cached !== undefined) return cached;
    const va = field[na]!;
    const vb = field[nb]!;
    const denom = vb - va;
    const t = denom !== 0 ? (iso - va) / denom : 0.5;
    const ax = na % nx;
    const ay = Math.floor(na / nx) % ny;
    const az = Math.floor(na / (nx * ny));
    const bx = nb % nx;
    const by = Math.floor(nb / nx) % ny;
    const bz = Math.floor(nb / (nx * ny));
    const x = origin[0] + (ax + t * (bx - ax)) * voxelSize;
    const y = origin[1] + (ay + t * (by - ay)) * voxelSize;
    const z = origin[2] + (az + t * (bz - az)) * voxelSize;
    const idx = positions.length / 3;
    positions.push(x, y, z);
    vertexCache.set(key, idx);
    return idx;
  };

  const cornerNode = new Array<number>(8);
  for (let k = 0; k < nz - 1; k++) {
    for (let j = 0; j < ny - 1; j++) {
      for (let i = 0; i < nx - 1; i++) {
        for (let c = 0; c < 8; c++) {
          const o = CORNERS[c]!;
          cornerNode[c] = nodeIdx(i + o[0], j + o[1], k + o[2]);
        }
        for (const tet of TETS) processTet(tet, cornerNode, field, iso, edgeVertex, indices);
      }
    }
  }

  return { positions: Float32Array.from(positions), indices: Uint32Array.from(indices) };
}

function processTet(
  tet: readonly [number, number, number, number],
  cornerNode: number[],
  field: Float32Array,
  iso: number,
  edgeVertex: (a: number, b: number) => number,
  indices: number[]
): void {
  const node = [cornerNode[tet[0]]!, cornerNode[tet[1]]!, cornerNode[tet[2]]!, cornerNode[tet[3]]!];
  const inside = [
    field[node[0]!]! < iso,
    field[node[1]!]! < iso,
    field[node[2]!]! < iso,
    field[node[3]!]! < iso,
  ];
  const inCount =
    (inside[0] ? 1 : 0) + (inside[1] ? 1 : 0) + (inside[2] ? 1 : 0) + (inside[3] ? 1 : 0);
  if (inCount === 0 || inCount === 4) return;

  const ev = (a: number, b: number): number => edgeVertex(node[a]!, node[b]!);

  if (inCount === 1 || inCount === 3) {
    // One vertex on its own side; triangle on the three edges from it.
    const lone = inCount === 1 ? inside.indexOf(true) : inside.indexOf(false);
    const others = [0, 1, 2, 3].filter((v) => v !== lone);
    indices.push(ev(lone, others[0]!), ev(lone, others[1]!), ev(lone, others[2]!));
    return;
  }

  // inCount === 2: quad across four crossing edges. Order so consecutive edges
  // share a vertex (a,c)–(b,c)–(b,d)–(a,d), avoiding a bowtie.
  const ins = [0, 1, 2, 3].filter((v) => inside[v]);
  const out = [0, 1, 2, 3].filter((v) => !inside[v]);
  const [a, b] = ins as [number, number];
  const [c, d] = out as [number, number];
  const q0 = ev(a, c);
  const q1 = ev(b, c);
  const q2 = ev(b, d);
  const q3 = ev(a, d);
  indices.push(q0, q1, q2, q0, q2, q3);
}
