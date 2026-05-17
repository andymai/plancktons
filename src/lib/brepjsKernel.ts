// Lazy, idempotent brepjs initialization. The Hill T polyhedron template is
// built ONCE per chirality after the kernel is up; assemblies clone it via
// rigid transforms (applyMatrix) and fuse the clones for rendering.

import type { Solid, Vec3, Matrix4x4 } from 'brepjs';

let initPromise: Promise<void> | null = null;
let templates: { R: Solid; L: Solid } | null = null;

const HILL_FACES_R: ReadonlyArray<readonly [number, number, number]> = [
  [0, 2, 1],
  [1, 2, 3],
  [0, 3, 2],
  [0, 1, 3],
];
const HILL_FACES_L: ReadonlyArray<readonly [number, number, number]> = HILL_FACES_R.map(
  ([a, b, c]) => [c, b, a] as const
);

export async function ensureBrepjs(): Promise<void> {
  if (initPromise) return initPromise;
  initPromise = (async () => {
    const [{ initFromOC, polyhedron, unwrap }, ocModule] = await Promise.all([
      import('brepjs'),
      import('brepjs-opencascade'),
    ]);
    // brepjs-opencascade default export is the WASM factory.
    const factory = (ocModule.default ?? ocModule) as () => Promise<unknown>;
    const oc = await factory();
    initFromOC(oc as never);
    const Lunit = 1;
    const vertsR: Vec3[] = [
      [0, 0, 0],
      [Lunit, 0, 0],
      [Lunit, Lunit, 0],
      [Lunit, Lunit, Lunit],
    ];
    const vertsL: Vec3[] = vertsR.map((v) => [-v[0], v[1], v[2]] as Vec3);
    templates = {
      R: unwrap(polyhedron(vertsR, [...HILL_FACES_R])),
      L: unwrap(polyhedron(vertsL, [...HILL_FACES_L])),
    };
  })();
  return initPromise;
}

export function getTemplate(chirality: 'R' | 'L'): Solid {
  if (!templates) throw new Error('brepjs kernel not initialized — call ensureBrepjs() first');
  return templates[chirality];
}

/** Build the rigid transform that maps the L=1 canonical Hill T (of given
 * chirality) onto the world-space vertices `verts`. The first 3 input vertices
 * pin the rotation + translation; the 4th is implied by chirality. */
export function rigidMatrixFromVerts(
  verts: readonly [Vec3, Vec3, Vec3, Vec3],
  chirality: 'R' | 'L'
): Matrix4x4 {
  // Canonical edges from V0:
  const s = chirality === 'R' ? 1 : -1;
  // sU = (s, 0, 0)  sV = (s, 1, 0) − (s,0,0) = (0,1,0)  sW = (s,1,1) − (s,1,0) = (0,0,1)
  // Target frame at V0:
  const [V0, V1, V2, V3] = verts;
  const u: Vec3 = [(V1[0] - V0[0]) / s, (V1[1] - V0[1]) / s, (V1[2] - V0[2]) / s];
  const v: Vec3 = [V2[0] - V1[0], V2[1] - V1[1], V2[2] - V1[2]];
  const w: Vec3 = [V3[0] - V2[0], V3[1] - V2[1], V3[2] - V2[2]];
  // World = R · canonical + t.  R maps (1,0,0)→u·s, (0,1,0)→v, (0,0,1)→w.
  // So column 0 = u·s, column 1 = v, column 2 = w.  Translation = V0.
  return [
    [s * u[0], v[0], w[0], V0[0]],
    [s * u[1], v[1], w[1], V0[1]],
    [s * u[2], v[2], w[2], V0[2]],
    [0, 0, 0, 1],
  ];
}
