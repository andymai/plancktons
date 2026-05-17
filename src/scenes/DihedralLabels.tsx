import { Text } from '@react-three/drei';
import type { Planckton } from '../lib/planckton.js';

// Dihedral angles of the Hill T₁ orthoscheme, keyed by the edge it lives on.
// All rational multiples of π — this is exactly the Dehn-invariant-zero
// property that makes T₁ scissors-congruent to a cube.
const DIHEDRAL_BY_EDGE: Record<string, string> = {
  '0-1': 'π/2',
  '2-3': 'π/2',
  '0-2': 'π/4',
  '1-3': 'π/4',
  '1-2': 'π/3',
  '0-3': 'π/3',
};

const EDGES: [number, number][] = [
  [0, 1],
  [0, 2],
  [0, 3],
  [1, 2],
  [1, 3],
  [2, 3],
];

/**
 * Floats text labels showing the rational-π dihedral angle at each edge
 * midpoint of a Planckton. Most visceral demonstration of the Dehn-zero
 * property: every angle in the rendered solid is shown to be a small rational
 * multiple of π, so the sum collapses modulo π·ℚ.
 */
export function DihedralLabels({
  planckton,
  size = 0.06,
}: {
  planckton: Planckton;
  size?: number;
}) {
  return (
    <group>
      {EDGES.map(([i, j]) => {
        const a = planckton.verts[i]!;
        const b = planckton.verts[j]!;
        const mid: [number, number, number] = [
          (a[0] + b[0]) / 2,
          (a[1] + b[1]) / 2,
          (a[2] + b[2]) / 2,
        ];
        const label = DIHEDRAL_BY_EDGE[`${i}-${j}`] ?? '';
        return (
          <Text
            key={`${i}-${j}`}
            position={mid}
            fontSize={size}
            color="#5fa8e3"
            anchorX="center"
            anchorY="middle"
            outlineWidth={0.004}
            outlineColor="#15181c"
            depthOffset={-1}
          >
            {label}
          </Text>
        );
      })}
    </group>
  );
}
