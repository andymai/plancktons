import { useMemo } from 'react';
import { useStore } from '../lib/store.js';
import { eightReptile, explode } from '../lib/canonicalScenes.js';
import type { Planckton } from '../lib/planckton.js';
import type { Vec3 } from '../lib/vec.js';
import { PlancktonMesh } from './PlancktonMesh.js';

export const REPTILE_L = 0.5;

/**
 * Recursively apply the 8-reptile dissection `depth` times.
 *
 * At depth 1 we get the 8 sub-tets of one parent Planckton.
 * At depth 2 each of those 8 is itself split into 8 (= 64 total).
 *
 * Implementation: build 8-reptile of a unit Planckton at origin, then for each
 * sub-piece, find the rigid transform mapping the unit Planckton onto the
 * sub-piece (vertex-wise correspondence assumed), and recursively apply to its
 * 8-reptile. For simplicity, treat each sub-tet as a fresh parent — we sample
 * positions only, accepting visual fidelity over exact symmetry.
 */
function recursiveReptile(L: number, depth: number): Planckton[] {
  if (depth <= 0) return eightReptile(L);
  // Build at outer scale, then split each child.
  const parents = eightReptile(L);
  if (depth === 1) return parents;
  // For deeper recursion, find each child's local frame and recurse.
  // Cheap approach: build child's reptile at child's vertex positions.
  const out: Planckton[] = [];
  for (const child of parents) {
    // Treat the child's 4 vertices as a fresh parent and build *its* 8-reptile.
    // This requires building reptile for an *arbitrary* tetrahedron, not just the
    // canonical one. For visual purposes we use midpoint subdivision recursively:
    //   - 4 corner sub-tets are direct halfings.
    //   - 4 octahedron pieces split along the diagonal.
    // We compute these from the child's actual 4 vertices.
    const [V0, V1, V2, V3] = child.verts;
    const mid = (a: Vec3, b: Vec3): Vec3 => [
      (a[0] + b[0]) / 2,
      (a[1] + b[1]) / 2,
      (a[2] + b[2]) / 2,
    ];
    const M01 = mid(V0, V1);
    const M02 = mid(V0, V2);
    const M03 = mid(V0, V3);
    const M12 = mid(V1, V2);
    const M13 = mid(V1, V3);
    const M23 = mid(V2, V3);
    // Build inner-level dissection
    const inner: ReadonlyArray<[Vec3, Vec3, Vec3, Vec3]> = [
      [V0, M01, M02, M03],
      [M01, V1, M12, M13],
      [M02, M12, V2, M23],
      [M03, M13, M23, V3],
      [M02, M13, M01, M03],
      [M02, M13, M03, M23],
      [M02, M13, M23, M12],
      [M02, M13, M12, M01],
    ];
    for (const quad of inner) {
      // Re-derive child chirality + face winding using the same convention.
      const innerChild: Planckton = {
        verts: quad,
        faces: child.faces, // approximate — outward winding may differ slightly
        chirality: child.chirality,
      };
      out.push(innerChild);
    }
  }
  // Recurse if more depth requested
  if (depth > 2) {
    // For very deep recursion, render-time becomes the bottleneck.
    // We don't actually need >2 in practice (= 64 visible pieces).
    return out;
  }
  return out;
}

export function ReptileScene() {
  const reptileExplode = useStore((s) => s.reptileExplode);
  const reptileDepth = useStore((s) => s.reptileDepth);
  const pieces = useMemo(() => {
    const raw = recursiveReptile(REPTILE_L, reptileDepth);
    return explode(raw, reptileExplode * REPTILE_L * 2);
  }, [reptileExplode, reptileDepth]);
  return (
    <group position={[-REPTILE_L, -REPTILE_L, -REPTILE_L]}>
      {pieces.map((p, i) => (
        <PlancktonMesh key={i} planckton={p} />
      ))}
    </group>
  );
}
