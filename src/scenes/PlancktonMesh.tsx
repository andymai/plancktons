import { useMemo } from 'react';
import type { Planckton } from '../lib/planckton.js';
import { plancktonGeometry, plancktonEdgesGeometry } from '../lib/mesh.js';
import { useStore } from '../lib/store.js';
import type { Vec3 } from '../lib/vec.js';

export interface PlancktonMeshProps {
  planckton: Planckton;
  colorOverride?: string;
  opacity?: number;
}

/**
 * Shrink a Planckton toward its centroid by factor (1 − inset).
 * inset = 0 ⇒ original; 0.02 ⇒ 2 % gap, eliminates z-fighting at shared faces
 * without affecting the *measured* geometry (we render shrunk; compute on full).
 */
function shrunk(p: Planckton, inset: number): Planckton {
  if (inset <= 0) return p;
  const cx = (p.verts[0][0] + p.verts[1][0] + p.verts[2][0] + p.verts[3][0]) / 4;
  const cy = (p.verts[0][1] + p.verts[1][1] + p.verts[2][1] + p.verts[3][1]) / 4;
  const cz = (p.verts[0][2] + p.verts[1][2] + p.verts[2][2] + p.verts[3][2]) / 4;
  const s = 1 - inset;
  const shrink = (v: Vec3): Vec3 => [
    cx + (v[0] - cx) * s,
    cy + (v[1] - cy) * s,
    cz + (v[2] - cz) * s,
  ];
  return {
    ...p,
    verts: [shrink(p.verts[0]), shrink(p.verts[1]), shrink(p.verts[2]), shrink(p.verts[3])],
  };
}

export function PlancktonMesh({ planckton, colorOverride, opacity = 1 }: PlancktonMeshProps) {
  const color = useStore((s) => s.color);
  const display = useMemo(
    () => (color.tetInset > 0 ? shrunk(planckton, color.tetInset) : planckton),
    [planckton, color.tetInset]
  );
  const geom = useMemo(() => plancktonGeometry(display), [display]);
  const edges = useMemo(() => plancktonEdgesGeometry(display), [display]);
  const baseColor =
    colorOverride ?? (planckton.chirality === 'R' ? color.rightColor : color.leftColor);
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
          polygonOffset
          polygonOffsetFactor={1}
          polygonOffsetUnits={1}
        />
      </mesh>
      {color.showEdges && (
        <lineSegments geometry={edges}>
          <lineBasicMaterial color="#111" transparent opacity={color.edgeOpacity} depthTest />
        </lineSegments>
      )}
    </group>
  );
}
