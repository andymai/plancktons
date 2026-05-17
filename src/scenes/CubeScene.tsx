import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { useStore } from '../lib/store.js';
import { cubeTiling, explode } from '../lib/canonicalScenes.js';
import { PlancktonMesh } from './PlancktonMesh.js';

export const CUBE_L = 1;

export function CubeScene() {
  const cubeExplode = useStore((s) => s.cubeExplode);
  const cubeAutoplay = useStore((s) => s.cubeAutoplay);
  const setCubeExplode = useStore((s) => s.setCubeExplode);
  const tRef = useRef(0);
  // Autoplay: drive explode through a smooth 0 → 1 → 0 cycle at ~0.4 Hz so
  // the assembly visibly "breathes" - pieces fly out and reassemble. The
  // most visceral demonstration of the scissors-congruence property in the
  // app (these 6 pieces ARE a cube).
  useFrame((_, delta) => {
    if (!cubeAutoplay) return;
    tRef.current += delta;
    const v = 0.5 - 0.5 * Math.cos(tRef.current * 2.5);
    setCubeExplode(v);
  });
  const pieces = useMemo(
    () => explode(cubeTiling(CUBE_L), cubeExplode * CUBE_L * 1.2),
    [cubeExplode]
  );
  return (
    <group position={[-CUBE_L / 2, -CUBE_L / 2, -CUBE_L / 2]}>
      {pieces.map((p, i) => (
        <PlancktonMesh key={i} planckton={p} />
      ))}
    </group>
  );
}
