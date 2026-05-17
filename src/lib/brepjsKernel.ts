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

/**
 * Build the rigid transform that maps the L=1 canonical Hill T (of given
 * chirality) onto the world-space vertices `verts`.
 *
 * The canonical R tet has V0=(0,0,0), V1=(1,0,0), V2=(1,1,0), V3=(1,1,1):
 *   canonical edges e1 = V1−V0 = (1,0,0), e2 = V2−V1 = (0,1,0), e3 = V3−V2 = (0,0,1).
 * The canonical L tet mirrors x: V1=(−1,0,0), …, so canonical e1 = (−1,0,0)
 * but e2 and e3 are unchanged.
 *
 * The rotation R must map canonical e1, e2, e3 onto the world edges
 *   E1 = V1−V0, E2 = V2−V1, E3 = V3−V2.
 * Since canonical_e1 = (s, 0, 0) with s = ±1, column 0 of R is R·(1,0,0) =
 * E1 / s. Columns 1 and 2 are E2 and E3 directly. Translation = V0.
 *
 * For a same-chirality assembly this produces det = +1 (a proper rotation);
 * the s in the denominator is essential and was previously wrong.
 */
export function rigidMatrixFromVerts(
  verts: readonly [Vec3, Vec3, Vec3, Vec3],
  chirality: 'R' | 'L'
): Matrix4x4 {
  const s = chirality === 'R' ? 1 : -1;
  const [V0, V1, V2, V3] = verts;
  const c0: Vec3 = [(V1[0] - V0[0]) / s, (V1[1] - V0[1]) / s, (V1[2] - V0[2]) / s];
  const c1: Vec3 = [V2[0] - V1[0], V2[1] - V1[1], V2[2] - V1[2]];
  const c2: Vec3 = [V3[0] - V2[0], V3[1] - V2[1], V3[2] - V2[2]];
  return [
    [c0[0], c1[0], c2[0], V0[0]],
    [c0[1], c1[1], c2[1], V0[1]],
    [c0[2], c1[2], c2[2], V0[2]],
    [0, 0, 0, 1],
  ];
}
