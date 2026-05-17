import { useEffect, useMemo, useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { useStore } from '../lib/store.js';
import { Rng } from '../lib/rng.js';
import {
  type Assembly,
  type GrowResult,
  assemblyCentroid,
  chiralityCounts,
  freeFaceFraction,
  freeFaceShapeCounts,
  freeSurfaceArea,
  growOne,
  makeAssembly,
  partVolumeTotal,
  vertexCoordination,
} from '../lib/assembly.js';
import { computeHull } from '../lib/hull.js';
import { gyrationDescriptors, type ShapeDescriptors } from '../lib/shape.js';
import { PlancktonMesh } from './PlancktonMesh.js';
import { HullMesh } from './HullMesh.js';
import { InertiaEllipsoid } from './InertiaEllipsoid.js';

export const GROWTH_L = 1;

export interface GrowthMetrics {
  N: number;
  targetN: number;
  Vstar: number;
  V: number;
  efficiency: number;
  surfaceArea: number;
  freeIso: number;
  freeScalene: number;
  bboxVolume: number;
  bboxSize: [number, number, number];
  hullOk: boolean;
  stalled: boolean;
  // physics
  rg: number;                       // radius of gyration
  asphericity: number;              // b / R_g² ∈ [0, 1]
  kappaSq: number;                  // shape anisotropy
  prolateness: number;              // S, sign = rod (+) / disc (−)
  chirR: number;
  chirL: number;
  freeFaceFrac: number;             // free faces / (4·N)
  meanVertexCoord: number;          // ⟨coordination⟩
  maxVertexCoord: number;
  shape: ShapeDescriptors | null;   // full descriptors for ellipsoid overlay
}

function useGrownAssembly(
  seed: number,
  strategy: 'uniform' | 'compact',
  chiralityBias: number,
  compactBeta: number,
  targetN: number
): { assembly: Assembly; stalled: boolean } {
  const ref = useRef<{
    assembly: Assembly;
    key: string;
    stalled: boolean;
  } | null>(null);
  const key = `${seed}|${strategy}|${chiralityBias}|${compactBeta}`;
  const cached = ref.current;
  const needsReset = cached === null || cached.key !== key;
  const assembly = needsReset
    ? makeAssembly({
        L: GROWTH_L,
        rng: new Rng(seed),
        chiralityBias,
        strategy,
        compactBeta,
      })
    : cached!.assembly;
  let stalled = needsReset ? false : cached!.stalled;
  while (assembly.tets.length < targetN) {
    const r: GrowResult = growOne(assembly);
    if (r !== 'grown') {
      stalled = true;
      break;
    }
  }
  ref.current = { assembly, key, stalled };
  return { assembly, stalled };
}

export function GrowthScene({
  onMetrics,
}: {
  onMetrics?: (m: GrowthMetrics) => void;
}) {
  const growth = useStore((s) => s.growth);
  const animationMode = useStore((s) => s.animationMode);
  const animSpeed = useStore((s) => s.animSpeed);
  const stepTrigger = useStore((s) => s.stepTrigger);
  const color = useStore((s) => s.color);

  // currentN drives all three animation modes: instant tracks growth.N directly,
  // animated ramps over time, step increments on user request.
  const [currentN, setCurrentN] = useState(growth.N);

  useEffect(() => {
    if (animationMode === 'instant') setCurrentN(growth.N);
    else setCurrentN(1);
  }, [animationMode, growth.seed, growth.strategy, growth.chiralityBias, growth.compactBeta]);

  useEffect(() => {
    if (animationMode === 'instant') setCurrentN(growth.N);
  }, [growth.N, animationMode]);

  useEffect(() => {
    if (animationMode !== 'step') return;
    setCurrentN((n) => Math.min(growth.N, n + 1));
  }, [stepTrigger, animationMode, growth.N]);

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

  const { assembly, stalled } = useGrownAssembly(
    growth.seed,
    growth.strategy,
    growth.chiralityBias,
    growth.compactBeta,
    currentN
  );

  const { hullPoints, hullFaces, metrics } = useMemo(() => {
    const allV = assembly.tets.flatMap((t) => [...t.verts]);
    const hull = computeHull(allV);
    const Vstar = partVolumeTotal(assembly);
    const fs = freeFaceShapeCounts(assembly);
    const chir = chiralityCounts(assembly);
    const coord = vertexCoordination(assembly);
    const ffrac = freeFaceFraction(assembly);
    const shape = gyrationDescriptors(allV);
    const N = assembly.tets.length;
    const stalledNow = stalled && N < growth.N;
    const surfaceArea = freeSurfaceArea(assembly);
    const baseMetrics = {
      N,
      targetN: growth.N,
      Vstar,
      surfaceArea,
      freeIso: fs.isoceles,
      freeScalene: fs.scalene,
      stalled: stalledNow,
      rg: shape?.rg ?? NaN,
      asphericity: shape?.asphericity ?? NaN,
      kappaSq: shape?.kappaSq ?? NaN,
      prolateness: shape?.prolateness ?? NaN,
      chirR: chir.R,
      chirL: chir.L,
      freeFaceFrac: ffrac,
      meanVertexCoord: coord.meanCoord,
      maxVertexCoord: coord.maxCoord,
      shape,
    };
    if (!hull) {
      return {
        hullPoints: [] as ReadonlyArray<[number, number, number]>,
        hullFaces: [] as ReadonlyArray<readonly [number, number, number]>,
        metrics: {
          ...baseMetrics,
          V: NaN,
          efficiency: NaN,
          bboxVolume: NaN,
          bboxSize: [NaN, NaN, NaN] as [number, number, number],
          hullOk: false,
        } satisfies GrowthMetrics,
      };
    }
    return {
      hullPoints: hull.points,
      hullFaces: hull.faces,
      metrics: {
        ...baseMetrics,
        V: hull.volume,
        efficiency: Vstar / hull.volume,
        bboxVolume: hull.bbox.volume,
        bboxSize: hull.bbox.size,
        hullOk: true,
      } satisfies GrowthMetrics,
    };
  }, [assembly, currentN, growth.N, stalled]);

  // Use a ref to detect actual value changes so we don't refire on parent
  // re-renders that change onMetrics identity.
  const lastReportedRef = useRef<GrowthMetrics | null>(null);
  useEffect(() => {
    if (lastReportedRef.current === metrics) return;
    lastReportedRef.current = metrics;
    onMetrics?.(metrics);
  }, [metrics, onMetrics]);

  const center = useMemo<[number, number, number]>(() => {
    const c = assemblyCentroid(assembly);
    return [-c[0], -c[1], -c[2]];
  }, [assembly, currentN]);

  const colorMode = useStore((s) => s.color.colorMode);
  const colorByDepth = colorMode === 'depth';
  const depthHue = (i: number) =>
    `hsl(${Math.round((i * 360) / Math.max(1, assembly.tets.length))}, 65%, 55%)`;

  return (
    <group position={center}>
      {assembly.tets.map((p, i) => (
        <PlancktonMesh
          key={i}
          planckton={p}
          colorOverride={colorByDepth ? depthHue(i) : undefined}
        />
      ))}
      {color.showHull && hullPoints.length > 0 && (
        <HullMesh points={hullPoints} faces={hullFaces} />
      )}
      {color.showEllipsoid && metrics.shape && (
        <InertiaEllipsoid shape={metrics.shape} />
      )}
    </group>
  );
}
