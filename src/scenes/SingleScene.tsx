import { useMemo } from 'react';
import { useStore } from '../lib/store.js';
import { unitPlanckton } from '../lib/planckton.js';
import { PlancktonMesh } from './PlancktonMesh.js';

export const L = 1;

/** Two Plancktons side-by-side: right (red) and left (white) chirality. */
export function SingleScene() {
  const singleChirality = useStore((s) => s.singleChirality);
  // Always show both, but emphasize the selected one (other is half-opaque).
  const right = useMemo(() => unitPlanckton(L, 'R'), []);
  const left = useMemo(() => unitPlanckton(L, 'L'), []);
  const gap = 0.35;
  return (
    <group>
      <group position={[gap, -L / 2, -L / 2]}>
        <PlancktonMesh
          planckton={right}
          opacity={singleChirality === 'R' ? 1.0 : 0.35}
        />
      </group>
      <group position={[-gap, -L / 2, -L / 2]}>
        <PlancktonMesh
          planckton={left}
          opacity={singleChirality === 'L' ? 1.0 : 0.35}
        />
      </group>
    </group>
  );
}
