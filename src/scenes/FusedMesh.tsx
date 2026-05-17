// Optional brepjs-backed renderer: fuses all tets into a single solid and
// renders that. The fused solid has only the EXTERNAL boundary — internal
// shared faces are gone, so z-fighting at shared faces is impossible.
//
// Cost: WASM init (~3 s once), fuseAll is O(N) booleans (~50 ms/tet).
// Recommended for N ≤ 50; for larger N the per-tet renderer is faster.

import { useEffect, useMemo, useState } from 'react';
import * as THREE from 'three';
import type { Planckton } from '../lib/planckton.js';
import { ensureBrepjs, getTemplate, rigidMatrixFromVerts } from '../lib/brepjsKernel.js';
import { useStore } from '../lib/store.js';

interface FusedState {
  geometry: THREE.BufferGeometry | null;
  loading: boolean;
  err: string | null;
}

export function FusedMesh({ tets }: { tets: ReadonlyArray<Planckton> }) {
  const color = useStore((s) => s.color);
  const [state, setState] = useState<FusedState>({ geometry: null, loading: true, err: null });

  useEffect(() => {
    let cancelled = false;
    // setState in effect is the right pattern here: we kick off async work in
    // response to a prop change. Standard React.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setState({ geometry: null, loading: true, err: null });
    void (async () => {
      try {
        await ensureBrepjs();
        if (cancelled) return;
        const { applyMatrix, fuseAll, unwrap, mesh, validSolid } = await import('brepjs');
        if (tets.length === 0) {
          setState({ geometry: new THREE.BufferGeometry(), loading: false, err: null });
          return;
        }
        const clones = tets.map((p) => {
          const tmpl = getTemplate(p.chirality);
          const m = rigidMatrixFromVerts(p.verts, p.chirality);
          return unwrap(validSolid(unwrap(applyMatrix(tmpl, m))));
        });
        const fused = clones.length === 1 ? clones[0]! : unwrap(fuseAll(clones));
        if (cancelled) return;
        const m = mesh(fused, { tolerance: 1e-3 });
        const geom = new THREE.BufferGeometry();
        geom.setAttribute('position', new THREE.BufferAttribute(m.vertices, 3));
        geom.setAttribute('normal', new THREE.BufferAttribute(m.normals, 3));
        geom.setIndex(new THREE.BufferAttribute(m.triangles, 1));
        setState({ geometry: geom, loading: false, err: null });
      } catch (e) {
        if (cancelled) return;
        setState({
          geometry: null,
          loading: false,
          err: e instanceof Error ? e.message : String(e),
        });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [tets]);

  const fallbackColor = useMemo(() => color.rightColor, [color.rightColor]);
  if (state.err) console.warn('FusedMesh:', state.err);
  if (!state.geometry || state.loading) return null;
  return (
    <mesh geometry={state.geometry} castShadow receiveShadow>
      <meshStandardMaterial
        color={fallbackColor}
        flatShading
        roughness={0.55}
        metalness={0.05}
        side={THREE.DoubleSide}
      />
    </mesh>
  );
}
