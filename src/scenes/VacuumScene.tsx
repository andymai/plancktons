import { useEffect, useMemo, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { useStore } from '../lib/store.js';
import { makeVacuumParams, type VacuumTrajectory } from '../lib/vacuum.js';
import { createRigidBody, bodyToPlanckton } from '../lib/rigidTet.js';
import type { Planckton } from '../lib/planckton.js';
import type { Quat } from '../lib/quat.js';
import { useWorkerRun } from '../ui/useWorkerRun.js';
import type { StudyResult } from '../worker/study.worker.js';
import { PlancktonMesh } from './PlancktonMesh.js';
import { VacuumBagMesh } from './VacuumBagMesh.js';
import { GyrationEllipsoid, PrincipalAxes } from './GyrationEllipsoid.js';
import { CameraFit } from './CameraFit.js';

export const VACUUM_L = 1;
const SCRUB_RATE = 0.25; // air-removed per second during playback (~4 s settle)

type VacuumResult = Extract<StudyResult, { kind: 'vacuum' }>;

export interface VacuumHudMetrics {
  N: number;
  /** Live scrub position 0..1. */
  airRemoved: number;
  /** True while the worker precompute is running. */
  running: boolean;
  /** Precompute progress 0..1, or null. */
  progress: number | null;
  etaC: number;
  etaB: number;
  etaM: number;
  etaV: number | null;
  rg: number;
  meanContactCoordination: number;
  maxContactCoordination: number;
  hullOk: boolean;
  /** η values are only meaningful once the bag is fully sealed. */
  sealed: boolean;
}

/** Nearest recorded keyframe for a given air-removed scrub value. */
function frameForScrub(traj: VacuumTrajectory, scrub: number): number {
  const a = traj.airRemoved;
  // a is monotonic non-decreasing; find the last frame with a[f] <= scrub.
  let lo = 0;
  let hi = a.length - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (a[mid]! <= scrub) lo = mid;
    else hi = mid - 1;
  }
  return lo;
}

export function VacuumScene({ onMetrics }: { onMetrics?: (m: VacuumHudMetrics | null) => void }) {
  const scrub = useStore((s) => s.vacuumScrub);
  const setScrub = useStore((s) => s.setVacuumScrub);
  const runTrigger = useStore((s) => s.vacuumRunTrigger);
  const animSpeed = useStore((s) => s.animSpeed);
  const color = useStore((s) => s.color);
  const colorMode = useStore((s) => s.color.colorMode);

  const { running, progress, result, run } = useWorkerRun<VacuumResult>();
  const [traj, setTraj] = useState<VacuumTrajectory | null>(null);

  // Launch the precompute on the explicit "Pack it" trigger (and once on mount).
  // Params are read fresh from the store so slider drags don't auto-rerun.
  useEffect(() => {
    const v = useStore.getState().vacuum;
    run({
      kind: 'vacuum',
      params: makeVacuumParams({
        N: v.N,
        seed: v.seed,
        chiralityBias: v.chiralityBias,
        contractionRate: v.contractionRate,
        restitution: v.restitution,
        L: VACUUM_L,
      }),
    });
  }, [runTrigger, run]);

  // Capture a finished trajectory and replay the settle from the start. The
  // worker result is an external async system, so synchronizing it into state
  // here is the intended use of an effect (not a render-cascade).
  useEffect(() => {
    if (!result?.trajectory) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setTraj(result.trajectory);
    setScrub(0);
  }, [result, setScrub]);

  // Advance the scrub while playing (animSpeed > 0), clamped at fully-sealed.
  useFrame((_, delta) => {
    if (!traj || animSpeed <= 0) return;
    const next = useStore.getState().vacuumScrub + delta * SCRUB_RATE;
    setScrub(next >= 1 ? 1 : next);
  });

  const frame = traj ? frameForScrub(traj, scrub) : 0;

  const tets = useMemo<Planckton[]>(() => {
    if (!traj) return [];
    const out: Planckton[] = [];
    const base = frame * traj.N;
    for (let i = 0; i < traj.N; i++) {
      const pos: [number, number, number] = [
        traj.positions[(base + i) * 3]!,
        traj.positions[(base + i) * 3 + 1]!,
        traj.positions[(base + i) * 3 + 2]!,
      ];
      const q: Quat = [
        traj.quats[(base + i) * 4]!,
        traj.quats[(base + i) * 4 + 1]!,
        traj.quats[(base + i) * 4 + 2]!,
        traj.quats[(base + i) * 4 + 3]!,
      ];
      const chir = traj.chirality[i] === 0 ? 'R' : 'L';
      out.push(bodyToPlanckton(createRigidBody(traj.L, chir, pos, q)));
    }
    return out;
  }, [traj, frame]);

  const wallRadius = traj ? traj.radii[frame]! : 1;
  const sealed = scrub >= 0.999;

  // Report HUD metrics: live air-removed plus the final-frame packing fractions.
  useEffect(() => {
    if (!onMetrics) return;
    if (!traj) {
      onMetrics({
        N: useStore.getState().vacuum.N,
        airRemoved: 0,
        running,
        progress: progress ? progress.done / progress.total : null,
        etaC: NaN,
        etaB: NaN,
        etaM: NaN,
        etaV: null,
        rg: NaN,
        meanContactCoordination: NaN,
        maxContactCoordination: NaN,
        hullOk: false,
        sealed: false,
      });
      return;
    }
    const m = traj.finalMetrics;
    onMetrics({
      N: m.N,
      airRemoved: scrub,
      running,
      progress: running && progress ? progress.done / progress.total : null,
      etaC: m.etaC,
      etaB: m.etaB,
      etaM: m.etaM,
      etaV: m.etaV,
      rg: m.gyration?.rg ?? NaN,
      meanContactCoordination: m.meanContactCoordination,
      maxContactCoordination: m.maxContactCoordination,
      hullOk: m.hullOk,
      sealed,
    });
  }, [onMetrics, traj, scrub, running, progress, sealed]);

  const tetCount = Math.max(1, tets.length);
  const colorFor = (i: number): string | undefined => {
    if (colorMode === 'depth') {
      const t = i / tetCount;
      return `hsl(${Math.round(t * 270)}, 70%, ${35 + Math.round(t * 35)}%)`;
    }
    return undefined; // chirality coloring via PlancktonMesh default
  };

  const gyration = sealed ? traj?.finalMetrics.gyration : null;

  return (
    <>
      <CameraFit extent={wallRadius} />
      {tets.map((p, i) => (
        <PlancktonMesh key={i} planckton={p} colorOverride={colorFor(i)} />
      ))}
      {traj && (
        <VacuumBagMesh
          positions={traj.skinPositions}
          indices={traj.skinIndices}
          center={[0, 0, 0]}
          wallRadius={wallRadius}
          airRemoved={scrub}
        />
      )}
      {color.showEllipsoid && gyration && (
        <>
          <GyrationEllipsoid shape={gyration} />
          <PrincipalAxes shape={gyration} />
        </>
      )}
    </>
  );
}
