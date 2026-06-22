// Deterministic frictionless rigid-body settle: N loose Plancktons are placed
// in a sphere and squeezed into a jammed packing by a contracting "bag" wall —
// the vacuum-bag scene's physics kernel. Browser-only and seeded entirely by
// the LCG (rng.ts) with no wall-clock or global RNG calls, so the same seed
// always yields the same trajectory.
//
// The settle runs at a fixed timestep, records downsampled keyframes for scrub
// playback, and computes packing metrics on the final (jammed) frame. It does
// NOT touch the face-mating study/CSV pipeline; its versioning is independent
// of ALGORITHM_VERSION.

import type { Vec3 } from './vec.js';
import { norm } from './vec.js';
import type { Chirality } from './planckton.js';
import { tetContact } from './planckton.js';
import { Rng } from './rng.js';
import { SPATIAL_HASH_CELL_FACTOR } from './constants.js';
import { createSpatialHash, insertTet, queryNeighbors, tetCentroid } from './spatialHash.js';
import type { Quat } from './quat.js';
import type { RigidBody } from './rigidTet.js';
import {
  bodyToPlanckton,
  createRigidBody,
  integrateBody,
  resolveBoundary,
  resolveContact,
} from './rigidTet.js';
import { vacuumMetrics, type VacuumMetrics } from './vacuumMetrics.js';
import { morphologicalField } from './morphology.js';
import { marchingCubes } from './marchingCubes.js';

/** Bumped if the settle's physics changes; independent of ALGORITHM_VERSION. */
export const VACUUM_ALGORITHM_VERSION = '1';

export interface VacuumParams {
  N: number;
  seed: number;
  L: number;
  /** Fraction right-handed (0.5 = balanced), as in growth. */
  chiralityBias: number;
  /** Fixed timestep. */
  dt: number;
  /** Wall radius shrink rate (world units per unit time). */
  contractionRate: number;
  /** Contact restitution (0 = fully damped settle). */
  restitution: number;
  /** Hard ceiling on simulated steps. */
  maxFrames: number;
  /** Record one keyframe every `recordEvery` steps. */
  recordEvery: number;
  /** Initial wall radius as a multiple of the close-packed radius. */
  startRadiusFactor: number;
}

export interface VacuumTrajectory {
  N: number;
  L: number;
  frameCount: number;
  recordEvery: number;
  dt: number;
  /** frameCount · N · 3, world centroids. */
  positions: Float32Array;
  /** frameCount · N · 4, body→world quaternions [x,y,z,w]. */
  quats: Float32Array;
  /** N, 0 = R, 1 = L. */
  chirality: Uint8Array;
  /** frameCount, bag wall radius at each keyframe. */
  radii: Float32Array;
  /** frameCount, normalized "% air removed" ∈ [0,1], monotonic. */
  airRemoved: Float32Array;
  /** Index of the final (jammed) keyframe. */
  jammedFrame: number;
  finalMetrics: VacuumMetrics;
  /** Wrinkled vacuum-seal skin of the final packing (flat xyz triples). */
  skinPositions: Float32Array;
  /** Triangle indices into skinPositions. */
  skinIndices: Uint32Array;
}

export const DEFAULT_VACUUM_PARAMS: VacuumParams = {
  N: 40,
  seed: 7,
  L: 1,
  chiralityBias: 0.5,
  dt: 0.01,
  contractionRate: 1.5,
  restitution: 0,
  maxFrames: 3200,
  recordEvery: 8,
  startRadiusFactor: 2.4,
};

export function makeVacuumParams(p: Partial<VacuumParams>): VacuumParams {
  return { ...DEFAULT_VACUUM_PARAMS, ...p };
}

// Solver/seeding constants. Tuned for stability of a frictionless tet pack.
const VELOCITY_ITERS = 16;
const LINEAR_DAMPING = 0.02;
// Low angular damping so contact torques keep reorienting tets until they
// nestle — the "rotate to fit" behaviour a frictionless settle needs to densify.
const ANGULAR_DAMPING = 0.012;
const SLOP_FRAC = 0.002; // allowed residual penetration, × L
const PEN_TOL_FRAC = 0.12; // contract while max penetration stays below this, × L
const BAUMGARTE = 0.2; // penetration → velocity-bias gain (applied at contact point ⇒ torque)
const SPEED_CAP_FRAC = 0.25; // max displacement per step, × bodyRadius
const STALL_LIMIT = 300; // consecutive non-contracting steps ⇒ jammed
const SEED_MAX_TRIES = 40;
const CENTER: Vec3 = [0, 0, 0];

/** Uniform random unit quaternion (Shoemake). */
function randomQuat(rng: Rng): Quat {
  const u1 = rng.next();
  const u2 = rng.next();
  const u3 = rng.next();
  const s1 = Math.sqrt(1 - u1);
  const s2 = Math.sqrt(u1);
  const t1 = 2 * Math.PI * u2;
  const t2 = 2 * Math.PI * u3;
  return [s1 * Math.sin(t1), s1 * Math.cos(t1), s2 * Math.sin(t2), s2 * Math.cos(t2)];
}

/** Uniform random point in the ball of radius R (rejection in the cube). */
function randomInBall(rng: Rng, R: number): Vec3 {
  for (;;) {
    const x = (2 * rng.next() - 1) * R;
    const y = (2 * rng.next() - 1) * R;
    const z = (2 * rng.next() - 1) * R;
    if (x * x + y * y + z * z <= R * R) return [x, y, z];
  }
}

/** Close-packed sphere radius for N tets of volume L³/6 (η≈1 lower bound). */
function packedRadius(N: number, L: number): number {
  const vol = (N * L ** 3) / 6;
  return Math.cbrt((3 * vol) / (4 * Math.PI));
}

export function runVacuumSettle(
  params: VacuumParams,
  cb?: { onProgress?: (done: number, total: number) => void }
): VacuumTrajectory {
  const { N, L, dt, maxFrames, recordEvery } = params;
  const rng = new Rng(params.seed);
  const rPacked = packedRadius(N, L);
  const R0 = Math.max(params.startRadiusFactor * rPacked, 2 * L);

  // --- Seed loose, mostly non-overlapping bodies (deterministic). ---
  const bodies: RigidBody[] = [];
  for (let i = 0; i < N; i++) {
    const chir: Chirality = rng.next() < params.chiralityBias ? 'R' : 'L';
    let best: RigidBody | null = null;
    for (let tries = 0; tries < SEED_MAX_TRIES; tries++) {
      const probe = createRigidBody(L, chir, [0, 0, 0], randomQuat(rng));
      const pos = randomInBall(rng, Math.max(R0 - probe.radius, 0));
      probe.pos = pos;
      best = probe;
      const pv = bodyToPlanckton(probe).verts;
      let clash = false;
      for (const other of bodies) {
        if (
          norm([pos[0] - other.pos[0], pos[1] - other.pos[1], pos[2] - other.pos[2]]) >
          probe.radius + other.radius
        )
          continue;
        if (tetContact(pv, bodyToPlanckton(other).verts, L)) {
          clash = true;
          break;
        }
      }
      if (!clash) break;
    }
    bodies.push(best as RigidBody);
  }

  const slop = SLOP_FRAC * L;
  const cell = SPATIAL_HASH_CELL_FACTOR * L;
  const radii: number[] = [];
  const frames: { pos: Float32Array; quat: Float32Array }[] = [];

  let R = R0;
  let stall = 0;

  const recordFrame = (): void => {
    const pos = new Float32Array(N * 3);
    const quat = new Float32Array(N * 4);
    for (let i = 0; i < N; i++) {
      const b = bodies[i]!;
      pos[i * 3] = b.pos[0];
      pos[i * 3 + 1] = b.pos[1];
      pos[i * 3 + 2] = b.pos[2];
      quat[i * 4] = b.quat[0];
      quat[i * 4 + 1] = b.quat[1];
      quat[i * 4 + 2] = b.quat[2];
      quat[i * 4 + 3] = b.quat[3];
    }
    frames.push({ pos, quat });
    radii.push(R);
  };

  recordFrame();

  const rFloor = packedRadius(N, L); // η = 1 lower bound; the pack jams above it
  const penTol = PEN_TOL_FRAC * L;

  for (let step = 0; step < maxFrames; step++) {
    // Broadphase: rebuild the hash from current centroids.
    const hash = createSpatialHash(cell);
    const worldVerts: (readonly [Vec3, Vec3, Vec3, Vec3])[] = [];
    for (let i = 0; i < N; i++) {
      const v = bodyToPlanckton(bodies[i]!).verts;
      worldVerts.push(v);
      insertTet(hash, i, tetCentroid(v));
    }

    // Narrowphase: collect unique contacts in deterministic index order.
    const contacts: { i: number; j: number; normal: Vec3; depth: number; point: Vec3 }[] = [];
    let maxPen = 0;
    for (let i = 0; i < N; i++) {
      const cand = queryNeighbors(hash, tetCentroid(worldVerts[i]!));
      cand.sort((a, b) => a - b);
      let last = -1;
      for (const j of cand) {
        if (j <= i || j === last) continue;
        last = j;
        const c = tetContact(worldVerts[i]!, worldVerts[j]!, L);
        if (c) {
          contacts.push({ i, j, normal: c.normal, depth: c.depth, point: c.point });
          if (c.depth > maxPen) maxPen = c.depth;
        }
      }
    }

    // The bag squeezes only while the pack isn't over-compressed: contract when
    // penetration is small, hold to let contacts relax otherwise. This applies
    // real inward pressure to the bulk (not just chasing the outermost tet) and
    // jams when further contraction can't be absorbed. Stall ⇒ jammed.
    if (maxPen < penTol && R > rFloor) {
      R = Math.max(R - params.contractionRate * dt, rFloor);
      stall = 0;
    } else {
      stall++;
    }

    // Velocity solve (sequential impulses) with a Baumgarte penetration bias.
    // Because the bias impulse acts at the contact point, deep contacts both
    // separate and rotate the tets — they reorient to nestle rather than only
    // shoving apart. Bias is clamped to the per-step speed cap for stability.
    const maxSpeed = (SPEED_CAP_FRAC * (bodies[0]?.radius ?? L)) / dt;
    for (let it = 0; it < VELOCITY_ITERS; it++) {
      for (const c of contacts) {
        const bias = Math.min(maxSpeed, (BAUMGARTE * Math.max(c.depth - slop, 0)) / dt);
        resolveContact(bodies[c.i]!, bodies[c.j]!, c.normal, c.point, params.restitution, bias);
      }
    }

    // Boundary + integrate + damp + speed-cap.
    for (const b of bodies) {
      resolveBoundary(b, CENTER, R, params.restitution);
      const sp = norm(b.vel);
      if (sp > maxSpeed) {
        const s = maxSpeed / sp;
        b.vel = [b.vel[0] * s, b.vel[1] * s, b.vel[2] * s];
      }
      integrateBody(b, dt);
      const ld = 1 - LINEAR_DAMPING;
      const ad = 1 - ANGULAR_DAMPING;
      b.vel = [b.vel[0] * ld, b.vel[1] * ld, b.vel[2] * ld];
      b.omega = [b.omega[0] * ad, b.omega[1] * ad, b.omega[2] * ad];
    }

    if ((step + 1) % recordEvery === 0) recordFrame();
    cb?.onProgress?.(step + 1, maxFrames);

    if (stall >= STALL_LIMIT) break;
  }

  // Always record the final state as the jammed frame.
  recordFrame();
  const frameCount = frames.length;
  const jammedFrame = frameCount - 1;

  const positions = new Float32Array(frameCount * N * 3);
  const quats = new Float32Array(frameCount * N * 4);
  for (let f = 0; f < frameCount; f++) {
    positions.set(frames[f]!.pos, f * N * 3);
    quats.set(frames[f]!.quat, f * N * 4);
  }
  const radiiArr = Float32Array.from(radii);
  const airRemoved = new Float32Array(frameCount);
  const span = R0 - radii[radii.length - 1]!;
  for (let f = 0; f < frameCount; f++) {
    airRemoved[f] =
      span > 1e-9
        ? Math.min(1, Math.max(0, (R0 - radii[f]!) / span))
        : f / Math.max(1, frameCount - 1);
  }

  const finalTets = bodies.map(bodyToPlanckton);
  const finalMetrics = vacuumMetrics(bodies, L);

  // Extract the wrinkled vacuum-seal skin once, off the main thread.
  const mf = morphologicalField(finalTets, L, { voxelSize: L / 10 });
  const skin = mf
    ? marchingCubes(mf.field, mf.dims, mf.origin, mf.voxelSize, 0)
    : { positions: new Float32Array(0), indices: new Uint32Array(0) };

  return {
    N,
    L,
    frameCount,
    recordEvery,
    dt,
    positions,
    quats,
    chirality: Uint8Array.from(bodies.map((b) => (b.chirality === 'R' ? 0 : 1))),
    radii: radiiArr,
    airRemoved,
    jammedFrame,
    finalMetrics,
    skinPositions: skin.positions,
    skinIndices: skin.indices,
  };
}
