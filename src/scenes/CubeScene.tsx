import { useMemo } from 'react';
import { useStore } from '../lib/store.js';
import { cubeTiling, explode } from '../lib/canonicalScenes.js';
import { PlancktonMesh } from './PlancktonMesh.js';

export const CUBE_L = 1;

export function CubeScene() {
  const cubeExplode = useStore((s) => s.cubeExplode);
  const pieces = useMemo(() => {
    const raw = cubeTiling(CUBE_L);
    const exploded = explode(raw, cubeExplode * CUBE_L * 1.2);
    return exploded;
  }, [cubeExplode]);
  return (
    <group position={[-CUBE_L / 2, -CUBE_L / 2, -CUBE_L / 2]}>
      {pieces.map((p, i) => (
        <PlancktonMesh key={i} planckton={p} />
      ))}
    </group>
  );
}
