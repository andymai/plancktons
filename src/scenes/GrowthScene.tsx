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
import { CameraFit } from './CameraFit.js';

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
  rg: number; // radius of gyration
  asphericity: number; // Rudnick–Gaspari b = λ₁ − ½(λ₂+λ₃), length²
  acylindricity: number; // c = λ₂ − λ₃, length²
  kappaSq: number; // shape anisotropy ∈ [0, 1]
  prolateness: number; // S, sign = rod (+) / disc (−)
  chirR: number;
  chirL: number;
  freeFaceFrac: number; // free faces / (4·N)
  meanVertexCoord: number; // ⟨coordination⟩
  maxVertexCoord: number;
  shape: ShapeDescriptors | null; // full descriptors for ellipsoid overlay
}

/**
 * Build an assembly to `targetN`. Extends an existing assembly when targetN
 * grows, and rebuilds from scratch when targetN shrinks below the current
 * size (since `growOne` cannot un-place a tet). Cached via a ref so the
 * common "grow" case stays O(ΔN).
 */
function useGrownAssembly(
  seed: number,
  strategy: 'uniform' | 'compact',
  chiralityBias: number,
  compactBeta: number,
  targetN: number
): { assembly: Assembly; stalled: boolean } {
  const cacheRef = useRef<{
    key: string;
    assembly: Assembly;
  } | null>(null);
  const simKey = `${seed}|${strategy}|${chiralityBias}|${compactBeta}`;

  // Ref-as-instance-variable cache: read/write outside React's normal flow
  // because we need to retain state across renders even when useMemo is
  // discarded. The eslint rule against ref access in render is too strict for
  // this idiomatic memoization pattern.
  /* eslint-disable react-hooks/refs */
  const cached = cacheRef.current;
  const needRebuild = !cached || cached.key !== simKey || cached.assembly.tets.length > targetN;
  const assembly = needRebuild
    ? makeAssembly({
        L: GROWTH_L,
        rng: new Rng(seed),
        chiralityBias,
        strategy,
        compactBeta,
      })
    : cached.assembly;
  let stalled = false;
  while (assembly.tets.length < targetN) {
    if (growOne(assembly) !== 'grown') {
      stalled = true;
      break;
    }
  }
  cacheRef.current = { key: simKey, assembly };
  return { assembly, stalled };
  /* eslint-enable react-hooks/refs */
}

export function GrowthScene({ onMetrics }: { onMetrics?: (m: GrowthMetrics) => void }) {
  const growth = useStore((s) => s.growth);
  const animationMode = useStore((s) => s.animationMode);
  const animSpeed = useStore((s) => s.animSpeed);
  const stepTrigger = useStore((s) => s.stepTrigger);
  const color = useStore((s) => s.color);

  // Reset the rendered tet count whenever the simulation identity changes
  // (mode, seed, strategy, …). Render-time setState is React's documented
  // pattern for "derived state that resets on prop change" - see
  // https://react.dev/reference/react/useState#storing-information-from-previous-renders
  // Any change to a simulation parameter (mode included) resets the rendered
  // growth. growth.N is in the key too so dragging the N slider in animated /
  // step mode restarts the animation from N=1 - visible regeneration.
  const simKey = `${animationMode}|${growth.seed}|${growth.strategy}|${growth.chiralityBias}|${growth.compactBeta}|${growth.N}`;
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
    // Include currentN: assembly is mutated in place during growth (same ref,
    // extended .tets array), so React's Object.is dep check on `assembly` alone
    // misses content updates and freezes hull/ellipsoid at the first N's state.
  }, [assembly, currentN, growth.N, stalled]);

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
  const tetCount = Math.max(1, assembly.tets.length);
  // At large N (>180), pure hue cycling makes neighbours indistinguishable
  // (360°/N < 2°). Cap the hue cycle at 270° and modulate lightness so order
  // remains visually readable.
  const depthHue = (i: number) => {
    const t = i / tetCount;
    const hue = Math.round(t * 270);
    const light = 35 + Math.round(t * 35);
    return `hsl(${hue}, 70%, ${light}%)`;
  };

  // For camera framing: the assembly half-extent (max distance from centroid to
  // any vertex). Falls back to R_g · √2 if bbox isn't available yet.
  const extent = useMemo(() => {
    if (Number.isFinite(metrics.bboxVolume)) {
      const [sx, sy, sz] = metrics.bboxSize;
      return 0.5 * Math.sqrt(sx * sx + sy * sy + sz * sz);
    }
    return Math.max(1, metrics.rg * Math.SQRT2);
  }, [metrics.bboxSize, metrics.bboxVolume, metrics.rg]);

  return (
    <>
      <CameraFit extent={extent} />
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
    </>
  );
}
