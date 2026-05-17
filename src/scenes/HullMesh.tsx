import { useMemo } from 'react';
import { hullGeometry } from '../lib/mesh.js';
import type { Vec3 } from '../lib/vec.js';

export interface HullMeshProps {
  points: ReadonlyArray<Vec3>;
  faces: ReadonlyArray<readonly [number, number, number]>;
  color?: string;
  opacity?: number;
}

export function HullMesh({ points, faces, color = '#5fa8e3', opacity = 0.22 }: HullMeshProps) {
  const geom = useMemo(() => hullGeometry(points, faces), [points, faces]);
  return (
    <mesh geometry={geom}>
      <meshStandardMaterial
        color={color}
        transparent
        opacity={opacity}
        depthWrite={false}
        side={2}
        flatShading
      />
    </mesh>
  );
}
