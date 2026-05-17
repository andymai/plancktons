import { useEffect, useMemo, useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { useStore } from '../lib/store.js';
import { Rng } from '../lib/rng.js';
import {
  type Assembly,
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
import { InertiaEllipsoid, PrincipalAxes } from './InertiaEllipsoid.js';

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
  asphericity: number;              // Rudnick–Gaspari b = λ₁ − ½(λ₂+λ₃), length²
  acylindricity: number;            // c = λ₂ − λ₃, length²
  kappaSq: number;                  // shape anisotropy ∈ [0, 1]
  prolateness: number;              // S, sign = rod (+) / disc (−)
  chirR: number;
  chirL: number;
  freeFaceFrac: number;             // free faces / (4·N)
  meanVertexCoord: number;          // ⟨coordination⟩
  maxVertexCoord: number;
  shape: ShapeDescriptors | null;   // full descriptors for ellipsoid overlay
}

/**
 * The base assembly is rebuilt only when the simulation parameters change;
 * advancing currentN within that family extends the same assembly in place.
 * Returns a fresh wrapper object each time so React notices the change.
 */
function useGrownAssembly(
  seed: number,
  strategy: 'uniform' | 'compact',
  chiralityBias: number,
  compactBeta: number,
  targetN: number
): { assembly: Assembly; stalled: boolean } {
  const baseAssembly = useMemo(
    () =>
      makeAssembly({
        L: GROWTH_L,
        rng: new Rng(seed),
        chiralityBias,
        strategy,
        compactBeta,
      }),
    [seed, strategy, chiralityBias, compactBeta]
  );
  return useMemo(() => {
    let stalled = false;
    while (baseAssembly.tets.length < targetN) {
      if (growOne(baseAssembly) !== 'grown') {
        stalled = true;
        break;
      }
    }
    return { assembly: baseAssembly, stalled };
  }, [baseAssembly, targetN]);
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

  // Reset the rendered tet count whenever the simulation identity changes
  // (mode, seed, strategy, …). Render-time setState is React's documented
  // pattern for "derived state that resets on prop change" — see
  // https://react.dev/reference/react/useState#storing-information-from-previous-renders
  const simKey = `${animationMode}|${growth.seed}|${growth.strategy}|${growth.chiralityBias}|${growth.compactBeta}`;
  const [prevSimKey, setPrevSimKey] = useState(simKey);
  const [grown, setGrown] = useState(growth.N);
  const [prevStep, setPrevStep] = useState(stepTrigger);
  if (prevSimKey !== simKey) {
    setPrevSimKey(simKey);
    setGrown(animationMode === 'instant' ? growth.N : 1);
    setPrevStep(stepTrigger);
  } else if (animationMode === 'step' && prevStep !== stepTrigger) {
    setPrevStep(stepTrigger);
    setGrown((n) => Math.min(growth.N, n + 1));
  }
  // Instant mode tracks growth.N directly; other modes use the grown counter.
  const currentN = animationMode === 'instant' ? growth.N : Math.min(growth.N, grown);

  const accumRef = useRef(0);
  useFrame((_, delta) => {
    if (animationMode !== 'animated') return;
    accumRef.current += delta * animSpeed;
    const inc = Math.floor(accumRef.current);
    if (inc > 0) {
      accumRef.current -= inc;
      setGrown((n) => Math.min(growth.N, n + inc));
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
      acylindricity: shape?.acylindricity ?? NaN,
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
  }, [assembly, growth.N, stalled]);

  const lastReportedRef = useRef<GrowthMetrics | null>(null);
  useEffect(() => {
    if (lastReportedRef.current === metrics) return;
    lastReportedRef.current = metrics;
    onMetrics?.(metrics);
  }, [metrics, onMetrics]);

  const center = useMemo<[number, number, number]>(() => {
    const c = assemblyCentroid(assembly);
    return [-c[0], -c[1], -c[2]];
  }, [assembly]);

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
        <>
          <InertiaEllipsoid shape={metrics.shape} />
          <PrincipalAxes shape={metrics.shape} />
        </>
      )}
    </group>
  );
}
