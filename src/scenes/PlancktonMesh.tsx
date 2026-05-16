import { useMemo } from 'react';
import * as THREE from 'three';
import type { Planckton } from '../lib/planckton.js';
import { plancktonGeometry, plancktonEdgesGeometry } from '../lib/mesh.js';
import { useStore } from '../lib/store.js';

export interface PlancktonMeshProps {
  planckton: Planckton;
  /** Override color (otherwise determined by chirality). */
  colorOverride?: string;
  opacity?: number;
  onPointerDown?: (e: THREE.Event) => void;
}

/** Render one Planckton as a flat-shaded mesh + edge outline. */
export function PlancktonMesh({
  planckton,
  colorOverride,
  opacity = 1,
}: PlancktonMeshProps) {
  const color = useStore((s) => s.color);
  const geom = useMemo(() => plancktonGeometry(planckton), [planckton]);
  const edges = useMemo(() => plancktonEdgesGeometry(planckton), [planckton]);
  const baseColor = colorOverride ?? (planckton.chirality === 'R' ? color.rightColor : color.leftColor);
  return (
    <group>
      <mesh geometry={geom} castShadow receiveShadow>
        <meshStandardMaterial
          color={baseColor}
          flatShading
          roughness={0.55}
          metalness={0.05}
          transparent={opacity < 1}
          opacity={opacity}
        />
      </mesh>
      {color.showEdges && (
        <lineSegments geometry={edges}>
          <lineBasicMaterial
            color="#222"
            transparent
            opacity={color.edgeOpacity}
            depthTest
          />
        </lineSegments>
      )}
    </group>
  );
}
