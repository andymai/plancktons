import { useMemo } from 'react';
import * as THREE from 'three';
import type { ShapeDescriptors } from '../lib/shape.js';

const UNIT_SPHERE = new THREE.SphereGeometry(1, 32, 24);

// scaleFactor = √5: for a uniform solid ellipsoid, Iᵢ = aᵢ²/5, so
// aᵢ = √(5 λᵢ) makes the visual ellipsoid match the gyration tensor exactly.
export function InertiaEllipsoid({
  shape,
  scaleFactor = Math.sqrt(5),
  color = '#5fa8e3',
  opacity = 0.18,
}: {
  shape: ShapeDescriptors;
  scaleFactor?: number;
  color?: string;
  opacity?: number;
}) {
  const matrix = useMemo(() => {
    const [l1, l2, l3] = shape.lambdas;
    const a = Math.sqrt(Math.max(0, l1)) * scaleFactor;
    const b = Math.sqrt(Math.max(0, l2)) * scaleFactor;
    const c = Math.sqrt(Math.max(0, l3)) * scaleFactor;
    const e = shape.axes;
    return new THREE.Matrix4().set(
      e[0][0] * a, e[1][0] * b, e[2][0] * c, shape.com[0],
      e[0][1] * a, e[1][1] * b, e[2][1] * c, shape.com[1],
      e[0][2] * a, e[1][2] * b, e[2][2] * c, shape.com[2],
      0, 0, 0, 1
    );
  }, [shape, scaleFactor]);
  return (
    <mesh matrixAutoUpdate={false} matrix={matrix} geometry={UNIT_SPHERE}>
      <meshStandardMaterial
        color={color}
        transparent
        opacity={opacity}
        depthWrite={false}
        side={THREE.DoubleSide}
      />
    </mesh>
  );
}

export function PrincipalAxes({
  shape,
  scaleFactor = Math.sqrt(5),
  colors = ['#ff5252', '#52ff7d', '#52a3ff'] as const,
}: {
  shape: ShapeDescriptors;
  scaleFactor?: number;
  colors?: readonly [string, string, string];
}) {
  const lines = useMemo(() => {
    const [l1, l2, l3] = shape.lambdas;
    const lens = [
      Math.sqrt(Math.max(0, l1)) * scaleFactor,
      Math.sqrt(Math.max(0, l2)) * scaleFactor,
      Math.sqrt(Math.max(0, l3)) * scaleFactor,
    ] as const;
    return shape.axes.map((axis, i) => {
      const len = lens[i] as number;
      const p0: [number, number, number] = [
        shape.com[0] - axis[0] * len,
        shape.com[1] - axis[1] * len,
        shape.com[2] - axis[2] * len,
      ];
      const p1: [number, number, number] = [
        shape.com[0] + axis[0] * len,
        shape.com[1] + axis[1] * len,
        shape.com[2] + axis[2] * len,
      ];
      const geom = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(...p0),
        new THREE.Vector3(...p1),
      ]);
      return { geom, color: colors[i] as string, key: i };
    });
  }, [shape, scaleFactor, colors]);
  return (
    <group>
      {lines.map((l) => (
        <lineSegments key={l.key} geometry={l.geom}>
          <lineBasicMaterial color={l.color} linewidth={2} />
        </lineSegments>
      ))}
    </group>
  );
}
