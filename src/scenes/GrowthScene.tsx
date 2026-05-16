import { useEffect, useMemo, useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { useStore } from '../lib/store.js';
import { Rng } from '../lib/rng.js';
import {
  type Assembly,
  type FreeFace,
  freeFaceShapeCounts,
  freeSurfaceArea,
  growOne,
  makeAssembly,
  partVolumeTotal,
} from '../lib/assembly.js';
import { computeHull } from '../lib/hull.js';
import { PlancktonMesh } from './PlancktonMesh.js';
import { HullMesh } from './HullMesh.js';

export const GROWTH_L = 1;

export interface GrowthMetrics {
  N: number;
  Vstar: number;
  V: number;
  efficiency: number;
  surfaceArea: number;
  freeIso: number;
  freeScalene: number;
  bboxVolume: number;
  bboxSize: [number, number, number];
}

interface ScenePayload {
  assembly: Assembly;
  hullPoints: ReadonlyArray<[number, number, number]>;
  hullFaces: ReadonlyArray<readonly [number, number, number]>;
  metrics: GrowthMetrics | null;
}

export function GrowthScene({
  onMetrics,
}: {
  onMetrics?: (m: GrowthMetrics) => void;
}) {
  const growth = useStore((s) => s.growth);
  const animationMode = useStore((s) => s.animationMode);
  const animSpeed = useStore((s) => s.animSpeed);
  const color = useStore((s) => s.color);

  // Step targets — for instant/animated we want N tets; for step mode the
  // currentN state advances independently.
  const [currentN, setCurrentN] = useState(growth.N);

  // Reset currentN when parameters that invalidate the assembly change.
  useEffect(() => {
    if (animationMode === 'animated') setCurrentN(1);
    else if (animationMode === 'step') setCurrentN(1);
    else setCurrentN(growth.N);
  }, [growth.seed, growth.strategy, growth.chiralityBias, animationMode, growth.N]);

  // Animated growth: advance currentN over time.
  const accumRef = useRef(0);
  useFrame((_, delta) => {
    if (animationMode !== 'animated') return;
    accumRef.current += delta * animSpeed;
    const inc = Math.floor(accumRef.current);
    if (inc > 0) {
      accumRef.current -= inc;
      setCurrentN((n) => Math.min(growth.N, n + inc));
    }
  });

  // Rebuild assembly whenever inputs change.
  const payload = useMemo<ScenePayload>(() => {
    const rng = new Rng(growth.seed);
    const a = makeAssembly({
      L: GROWTH_L,
      rng,
      chiralityBias: growth.chiralityBias,
      strategy: growth.strategy,
    });
    while (a.tets.length < currentN && growOne(a)) {
      // empty
    }
    const allV = a.tets.flatMap((t) => [...t.verts]);
    const hull = computeHull(allV);
    let metrics: GrowthMetrics | null = null;
    if (hull) {
      const fs = freeFaceShapeCounts(a);
      metrics = {
        N: a.tets.length,
        Vstar: partVolumeTotal(a),
        V: hull.volume,
        efficiency: partVolumeTotal(a) / hull.volume,
        surfaceArea: freeSurfaceArea(a),
        freeIso: fs.isoceles,
        freeScalene: fs.scalene,
        bboxVolume: hull.bbox.volume,
        bboxSize: [hull.bbox.size[0], hull.bbox.size[1], hull.bbox.size[2]],
      };
    }
    return {
      assembly: a,
      hullPoints: hull?.points ?? [],
      hullFaces: hull?.faces ?? [],
      metrics,
    };
  }, [growth.seed, growth.strategy, growth.chiralityBias, currentN]);

  useEffect(() => {
    if (payload.metrics) onMetrics?.(payload.metrics);
  }, [payload.metrics, onMetrics]);

  // Centroid for camera framing
  const center = useMemo<[number, number, number]>(() => {
    if (payload.assembly.tets.length === 0) return [0, 0, 0];
    let cx = 0,
      cy = 0,
      cz = 0,
      n = 0;
    for (const t of payload.assembly.tets) {
      for (const v of t.verts) {
        cx += v[0];
        cy += v[1];
        cz += v[2];
        n++;
      }
    }
    return [-cx / n, -cy / n, -cz / n];
  }, [payload.assembly]);

  return (
    <group position={center}>
      {payload.assembly.tets.map((p, i) => (
        <PlancktonMesh key={i} planckton={p} />
      ))}
      {color.showHull && payload.hullPoints.length > 0 && (
        <HullMesh points={payload.hullPoints} faces={payload.hullFaces} />
      )}
    </group>
  );
}

/** Hook exposing the currently-rendered metrics. */
export function useGrowthMetrics() {
  const [m, setM] = useState<GrowthMetrics | null>(null);
  return { metrics: m, setMetrics: setM };
}

// Re-export for parent access pattern.
export type { FreeFace };
