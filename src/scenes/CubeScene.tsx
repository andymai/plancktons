import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Text } from '@react-three/drei';
import { useStore } from '../lib/store.js';
import { cubeGeometric, cubeHTLeft, cubeHTRight, explode } from '../lib/canonicalScenes.js';
import type { Planckton } from '../lib/planckton.js';
import { PlancktonMesh } from './PlancktonMesh.js';

export const CUBE_L = 1;
const CUBE_GAP = 2.4 * CUBE_L; // centre-to-centre spacing

interface CubeVariant {
  name: string;
  counts: string;
  pieces: Planckton[];
  cx: number;
}

export function CubeScene() {
  const cubeExplode = useStore((s) => s.cubeExplode);
  const cubeAutoplay = useStore((s) => s.cubeAutoplay);
  const setCubeExplode = useStore((s) => s.setCubeExplode);
  const tRef = useRef(0);
  // Autoplay drives a single explode value across all three cubes so viewers
  // can compare structure at every phase of the breath cycle.
  useFrame((_, delta) => {
    if (!cubeAutoplay) return;
    tRef.current += delta;
    setCubeExplode(0.5 - 0.5 * Math.cos(tRef.current * 2.5));
  });

  const variants = useMemo<CubeVariant[]>(
    () => [
      { name: 'HT (left hand)', counts: '2 R · 4 L', pieces: cubeHTLeft(CUBE_L), cx: -CUBE_GAP },
      { name: 'Geometric', counts: '3 R · 3 L', pieces: cubeGeometric(CUBE_L), cx: 0 },
      { name: 'HT (right hand)', counts: '4 R · 2 L', pieces: cubeHTRight(CUBE_L), cx: CUBE_GAP },
    ],
    []
  );

  // Lower explode magnitude than the original single-cube scene (1.2 → 0.5)
  // so adjacent triptych cubes don't intrude on each other at peak explode.
  const explodeAmt = cubeExplode * CUBE_L * 0.5;

  return (
    <>
      {variants.map((v) => (
        <group key={v.name} position={[v.cx, 0, 0]}>
          <group position={[-CUBE_L / 2, -CUBE_L / 2, -CUBE_L / 2]}>
            {explode(v.pieces, explodeAmt).map((p, i) => (
              <PlancktonMesh key={i} planckton={p} />
            ))}
          </group>
          <Text
            position={[0, -CUBE_L * 0.72, 0]}
            fontSize={CUBE_L * 0.085}
            anchorX="center"
            anchorY="top"
            color="#d8dbe0"
            outlineWidth={0.003}
            outlineColor="#15181c"
          >
            {v.name}
          </Text>
          <Text
            position={[0, -CUBE_L * 0.92, 0]}
            fontSize={CUBE_L * 0.065}
            anchorX="center"
            anchorY="top"
            color="#9aa3ad"
            outlineWidth={0.002}
            outlineColor="#15181c"
          >
            {v.counts}
          </Text>
        </group>
      ))}
    </>
  );
}
