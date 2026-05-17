// brepjs-backed fused renderer. Groups tets by chirality so the R/L color
// distinction is preserved: R tets fuse into one solid (rendered red), L tets
// fuse into another (rendered white). Internal shared faces within each group
// disappear from the rendered mesh, eliminating z-fight at shared faces.
//
// Cost: WASM init ~3 s once, fuseAll is O(N) booleans (~50 ms/tet).

import { useEffect, useState } from 'react';
import * as THREE from 'three';
import type { Planckton } from '../lib/planckton.js';
import { ensureBrepjs, getTemplate, rigidMatrixFromVerts } from '../lib/brepjsKernel.js';
import { useStore } from '../lib/store.js';

interface GroupGeom {
  R: THREE.BufferGeometry | null;
  L: THREE.BufferGeometry | null;
}

interface FusedState {
  groups: GroupGeom;
  loading: boolean;
  err: string | null;
}

export function FusedMesh({ tets }: { tets: ReadonlyArray<Planckton> }) {
  const color = useStore((s) => s.color);
  const [state, setState] = useState<FusedState>({
    groups: { R: null, L: null },
    loading: true,
    err: null,
  });

  useEffect(() => {
    let cancelled = false;
    // setState in effect is the right pattern here: we kick off async work in
    // response to a prop change.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setState({ groups: { R: null, L: null }, loading: true, err: null });
    void (async () => {
      try {
        await ensureBrepjs();
        if (cancelled) return;
        const { applyMatrix, fuseAll, unwrap, mesh, validSolid } = await import('brepjs');
        if (tets.length === 0) {
          setState({ groups: { R: null, L: null }, loading: false, err: null });
          return;
        }

        const buildGroup = (chirality: 'R' | 'L'): THREE.BufferGeometry | null => {
          const sub = tets.filter((p) => p.chirality === chirality);
          if (sub.length === 0) return null;
          const clones = sub.map((p) => {
            const tmpl = getTemplate(p.chirality);
            const m = rigidMatrixFromVerts(p.verts, p.chirality);
            return unwrap(validSolid(unwrap(applyMatrix(tmpl, m))));
          });
          const fused = clones.length === 1 ? clones[0]! : unwrap(fuseAll(clones));
          // Tolerance below the typical floating-point error in our rigid-
          // transform vertex placements so brepjs merges shared vertices.
          const m = mesh(fused, { tolerance: 1e-4 });
          const geom = new THREE.BufferGeometry();
          geom.setAttribute('position', new THREE.BufferAttribute(m.vertices, 3));
          geom.setAttribute('normal', new THREE.BufferAttribute(m.normals, 3));
          geom.setIndex(new THREE.BufferAttribute(m.triangles, 1));
          return geom;
        };

        const R = buildGroup('R');
        if (cancelled) return;
        const L = buildGroup('L');
        if (cancelled) return;
        setState({ groups: { R, L }, loading: false, err: null });
      } catch (e) {
        if (cancelled) return;
        setState({
          groups: { R: null, L: null },
          loading: false,
          err: e instanceof Error ? e.message : String(e),
        });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [tets]);

  if (state.err) console.warn('FusedMesh:', state.err);
  if (state.loading) return null;
  const meshes: ReadonlyArray<readonly [THREE.BufferGeometry, string, 'R' | 'L']> = [
    state.groups.R ? [state.groups.R, color.rightColor, 'R' as const] : null,
    state.groups.L ? [state.groups.L, color.leftColor, 'L' as const] : null,
  ].filter((x): x is [THREE.BufferGeometry, string, 'R' | 'L'] => x !== null);
  return (
    <>
      {meshes.map(([geom, col, label]) => (
        <mesh key={label} geometry={geom} castShadow receiveShadow>
          <meshStandardMaterial
            color={col}
            flatShading
            roughness={0.55}
            metalness={0.05}
            polygonOffset
            polygonOffsetFactor={1}
            polygonOffsetUnits={1}
          />
        </mesh>
      ))}
    </>
  );
}
