import { useLayoutEffect, useMemo } from 'react';
import * as THREE from 'three';

export interface VacuumBagMeshProps {
  /** Final wrinkled-skin vertices (flat xyz), from the worker's marching cubes. */
  positions: Float32Array;
  indices: Uint32Array;
  center: [number, number, number];
  /** Current bag wall radius (the loose sphere the skin blends out to). */
  wallRadius: number;
  /** 0 = full of air (smooth sphere) … 1 = sealed (wrinkled skin). */
  airRemoved: number;
  color?: string;
  opacity?: number;
}

const smoothstep = (t: number): number => {
  const x = Math.min(1, Math.max(0, t));
  return x * x * (3 - 2 * x);
};

/**
 * The vacuum bag: a single mesh that interpolates each final-skin vertex
 * between a sphere of the current wall radius (lots of air) and its true
 * morphological-skin position (sealed). Cheap per-frame morph — no marching
 * cubes at playback time.
 */
export function VacuumBagMesh({
  positions,
  indices,
  center,
  wallRadius,
  airRemoved,
  color = '#7fb8e6',
  opacity = 0.26,
}: VacuumBagMeshProps) {
  const geom = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(positions.length), 3));
    if (indices.length > 0) g.setIndex(new THREE.BufferAttribute(indices, 1));
    return g;
  }, [positions, indices]);

  useLayoutEffect(() => () => geom.dispose(), [geom]);

  useLayoutEffect(() => {
    const attr = geom.getAttribute('position') as THREE.BufferAttribute;
    const arr = attr.array as Float32Array;
    const t = smoothstep(airRemoved);
    const [cx, cy, cz] = center;
    for (let i = 0; i < positions.length; i += 3) {
      const dx = positions[i]! - cx;
      const dy = positions[i + 1]! - cy;
      const dz = positions[i + 2]! - cz;
      const len = Math.hypot(dx, dy, dz) || 1;
      const sx = cx + (dx / len) * wallRadius;
      const sy = cy + (dy / len) * wallRadius;
      const sz = cz + (dz / len) * wallRadius;
      arr[i] = sx + (positions[i]! - sx) * t;
      arr[i + 1] = sy + (positions[i + 1]! - sy) * t;
      arr[i + 2] = sz + (positions[i + 2]! - sz) * t;
    }
    attr.needsUpdate = true;
    geom.computeVertexNormals();
  }, [geom, positions, center, wallRadius, airRemoved]);

  if (positions.length === 0) return null;
  return (
    <mesh geometry={geom}>
      <meshPhysicalMaterial
        color={color}
        transparent
        opacity={opacity}
        depthWrite={false}
        side={THREE.DoubleSide}
        roughness={0.12}
        metalness={0}
        clearcoat={1}
        clearcoatRoughness={0.2}
        transmission={0.25}
      />
    </mesh>
  );
}
