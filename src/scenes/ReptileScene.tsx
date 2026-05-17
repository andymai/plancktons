import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { useStore } from '../lib/store.js';
import { eightReptile, explode, tetFromPts } from '../lib/canonicalScenes.js';
import type { Planckton } from '../lib/planckton.js';
import type { Vec3 } from '../lib/vec.js';
import { PlancktonMesh } from './PlancktonMesh.js';

export const REPTILE_L = 0.5;

const mid = (a: Vec3, b: Vec3): Vec3 => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2];

/** Split one tetrahedron into 8 sub-tets via midpoint subdivision (corners + octahedron diagonal). */
function subdivideOne(verts: readonly [Vec3, Vec3, Vec3, Vec3]): Planckton[] {
  const [V0, V1, V2, V3] = verts;
  const M01 = mid(V0, V1);
  const M02 = mid(V0, V2);
  const M03 = mid(V0, V3);
  const M12 = mid(V1, V2);
  const M13 = mid(V1, V3);
  const M23 = mid(V2, V3);
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
  return inner.map(tetFromPts);
}

/** Apply the 8-reptile dissection `depth` times. depth=k → 8^k pieces. */
function recursiveReptile(L: number, depth: number): Planckton[] {
  let pieces = eightReptile(L);
  for (let d = 1; d < depth; d++) {
    pieces = pieces.flatMap((p) => subdivideOne(p.verts));
  }
  return pieces;
}

export function ReptileScene() {
  const reptileExplode = useStore((s) => s.reptileExplode);
  const reptileDepth = useStore((s) => s.reptileDepth);
  const autoplay = useStore((s) => s.reptileAutoplay);
  const setExplode = useStore((s) => s.setReptileExplode);
  const tRef = useRef(0);
  // Cycle the explode 0 ↔ 1 at ~0.4 Hz so the sub-Plancktons visibly fly
  // out and re-pack into the parent shape. The constructive demonstration
  // of self-similar dissection: 8 (or 64, or 512) of THESE are ONE of the
  // bigger thing.
  useFrame((_, delta) => {
    if (!autoplay) return;
    tRef.current += delta;
    setExplode(0.5 - 0.5 * Math.cos(tRef.current * 2.5));
  });
  // Split the memo so 60Hz autoplay (which updates reptileExplode every frame)
  // doesn't rebuild the 8^depth subdivision — at depth=3 that's 512 pieces.
  const subdivided = useMemo(() => recursiveReptile(REPTILE_L, reptileDepth), [reptileDepth]);
  const pieces = useMemo(
    () => explode(subdivided, reptileExplode * REPTILE_L * 2),
    [subdivided, reptileExplode]
  );
  return (
    <group position={[-REPTILE_L, -REPTILE_L, -REPTILE_L]}>
      {pieces.map((p, i) => (
        <PlancktonMesh key={i} planckton={p} />
      ))}
    </group>
  );
}
