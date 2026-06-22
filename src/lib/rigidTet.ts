// Rigid-body state and frictionless contact resolution for a single Planckton
// in the vacuum-bag settle. Pure; the orchestrator (vacuum.ts) owns the loop.
//
// Conventions: `pos` is the world centroid, `quat` is the body→world rotation,
// `omega` is world-frame angular velocity, and `bodyVerts` are the tet vertices
// expressed relative to the centroid in the body frame (constant per L+chirality).

import type { Vec3 } from './vec.js';
import { add, cross, dot, norm, scl, sub } from './vec.js';
import type { Quat } from './quat.js';
import { QUAT_IDENTITY, integrateQuat, quatToMat3, rotateVec } from './quat.js';
import type { Mat3 } from './mat3.js';
import { mat3mul, mat3mulVec, mat3transpose } from './mat3.js';
import type { Chirality, Planckton } from './planckton.js';
import { tetInertia } from './inertia.js';
import { tetCentroid } from './spatialHash.js';
import { unitPlanckton } from './planckton.js';

const FACES_R = unitPlanckton(1, 'R').faces;
const FACES_L = unitPlanckton(1, 'L').faces;

export interface RigidBody {
  pos: Vec3;
  quat: Quat;
  vel: Vec3;
  omega: Vec3;
  chirality: Chirality;
  invMass: number;
  /** Inverse inertia tensor in the body frame (constant). */
  invInertiaBody: Mat3;
  /** Tet vertices relative to centroid, body frame (constant). */
  bodyVerts: readonly [Vec3, Vec3, Vec3, Vec3];
  /** Bounding-sphere radius about the centroid. */
  radius: number;
}

interface BodyTemplate {
  invMass: number;
  invInertiaBody: Mat3;
  bodyVerts: [Vec3, Vec3, Vec3, Vec3];
  radius: number;
}

const templateCache = new Map<string, BodyTemplate>();

function template(L: number, chirality: Chirality): BodyTemplate {
  const cacheKey = `${L}:${chirality}`;
  const hit = templateCache.get(cacheKey);
  if (hit) return hit;
  const p = unitPlanckton(L, chirality);
  const g = tetCentroid(p.verts);
  const bodyVerts = p.verts.map((v) => sub(v, g)) as [Vec3, Vec3, Vec3, Vec3];
  const bi = tetInertia(p.verts, 1);
  let radius = 0;
  for (const bv of bodyVerts) radius = Math.max(radius, norm(bv));
  const t: BodyTemplate = {
    invMass: 1 / bi.mass,
    invInertiaBody: bi.inertiaBodyInv,
    bodyVerts,
    radius,
  };
  templateCache.set(cacheKey, t);
  return t;
}

export function createRigidBody(
  L: number,
  chirality: Chirality,
  pos: Vec3,
  quat: Quat = [...QUAT_IDENTITY]
): RigidBody {
  const t = template(L, chirality);
  return {
    pos,
    quat,
    vel: [0, 0, 0],
    omega: [0, 0, 0],
    chirality,
    invMass: t.invMass,
    invInertiaBody: t.invInertiaBody,
    bodyVerts: t.bodyVerts,
    radius: t.radius,
  };
}

/** Reconstruct the world-space Planckton for SAT, metrics, and rendering. */
export function bodyToPlanckton(b: RigidBody): Planckton {
  const verts = b.bodyVerts.map((bv) => add(b.pos, rotateVec(b.quat, bv))) as [
    Vec3,
    Vec3,
    Vec3,
    Vec3,
  ];
  return { verts, faces: b.chirality === 'R' ? FACES_R : FACES_L, chirality: b.chirality };
}

/** World-frame inverse inertia tensor R·Iᵇ⁻¹·Rᵀ. */
export function worldInvInertia(b: RigidBody): Mat3 {
  const R = quatToMat3(b.quat);
  return mat3mul(mat3mul(R, b.invInertiaBody), mat3transpose(R));
}

/** Semi-implicit Euler position/orientation update (velocities already solved). */
export function integrateBody(b: RigidBody, dt: number): void {
  b.pos = add(b.pos, scl(b.vel, dt));
  b.quat = integrateQuat(b.quat, b.omega, dt);
}

export function bodyKineticEnergy(b: RigidBody): number {
  const mass = 1 / b.invMass;
  const lin = 0.5 * mass * dot(b.vel, b.vel);
  // Angular KE = ½ ωᵇ·(Iᵇ ωᵇ) in the body frame. We store only Iᵇ⁻¹, so
  // Iᵇ ωᵇ = solve(Iᵇ⁻¹, ωᵇ). Rotate ω into the body frame first.
  const omegaBody = mat3mulVec(mat3transpose(quatToMat3(b.quat)), b.omega);
  const Lbody = solve3(b.invInertiaBody, omegaBody);
  const ang = 0.5 * dot(omegaBody, Lbody);
  return lin + ang;
}

/** Solve M·x = b for a symmetric 3×3 M (Cramer's rule). */
function solve3(M: Mat3, v: Vec3): Vec3 {
  const det =
    M[0][0] * (M[1][1] * M[2][2] - M[1][2] * M[2][1]) -
    M[0][1] * (M[1][0] * M[2][2] - M[1][2] * M[2][0]) +
    M[0][2] * (M[1][0] * M[2][1] - M[1][1] * M[2][0]);
  const dx =
    v[0] * (M[1][1] * M[2][2] - M[1][2] * M[2][1]) -
    M[0][1] * (v[1] * M[2][2] - M[1][2] * v[2]) +
    M[0][2] * (v[1] * M[2][1] - M[1][1] * v[2]);
  const dy =
    M[0][0] * (v[1] * M[2][2] - M[1][2] * v[2]) -
    v[0] * (M[1][0] * M[2][2] - M[1][2] * M[2][0]) +
    M[0][2] * (M[1][0] * v[2] - v[1] * M[2][0]);
  const dz =
    M[0][0] * (M[1][1] * v[2] - v[1] * M[2][1]) -
    M[0][1] * (M[1][0] * v[2] - v[1] * M[2][0]) +
    v[0] * (M[1][0] * M[2][1] - M[1][1] * M[2][0]);
  return [dx / det, dy / det, dz / det];
}

/**
 * Frictionless normal-impulse contact between bodies `a` and `b`. `normal`
 * points A→B (push B out); `point` is the world contact point. Applies only the
 * normal impulse (no friction), so kinetic energy is non-increasing for
 * restitution e ∈ [0,1]. Positional de-penetration is separate (see
 * `correctPenetration`) so it never injects velocity/energy.
 */
export function resolveContact(
  a: RigidBody,
  b: RigidBody,
  normal: Vec3,
  point: Vec3,
  restitution: number,
  bias = 0
): void {
  const rA = sub(point, a.pos);
  const rB = sub(point, b.pos);
  const vA = add(a.vel, cross(a.omega, rA));
  const vB = add(b.vel, cross(b.omega, rB));
  const vrel = dot(sub(vB, vA), normal);

  const IaInv = worldInvInertia(a);
  const IbInv = worldInvInertia(b);
  const raCrossN = cross(rA, normal);
  const rbCrossN = cross(rB, normal);
  const angA = dot(normal, cross(mat3mulVec(IaInv, raCrossN), rA));
  const angB = dot(normal, cross(mat3mulVec(IbInv, rbCrossN), rB));
  const k = a.invMass + b.invMass + angA + angB;
  if (k <= 0) return;

  // The `bias` term is a Baumgarte velocity correction (∝ penetration). Applied
  // at the contact POINT with lever arms rA/rB, its impulse is both linear and
  // angular — so penetrating tets push apart AND rotate to nestle, rather than
  // only translating. bias=0 ⇒ pure normal impulse (energy non-increasing).
  const jn = (-(1 + restitution) * vrel + bias) / k;
  if (jn <= 0) return; // separating/resting and not penetrating — no impulse
  const impulse = scl(normal, jn);
  a.vel = sub(a.vel, scl(impulse, a.invMass));
  b.vel = add(b.vel, scl(impulse, b.invMass));
  a.omega = sub(a.omega, mat3mulVec(IaInv, cross(rA, impulse)));
  b.omega = add(b.omega, mat3mulVec(IbInv, cross(rB, impulse)));
}

/**
 * Split positional correction: push two penetrating bodies apart along `normal`
 * (A→B) by a fraction of the penetration beyond `slop`, weighted by inverse
 * mass. Touches only positions — never velocities — so it adds no kinetic
 * energy (the "Baumgarte without energy injection" the design calls for).
 */
export function correctPenetration(
  a: RigidBody,
  b: RigidBody,
  normal: Vec3,
  depth: number,
  slop: number,
  fraction: number
): void {
  const corr = Math.max(depth - slop, 0) * fraction;
  if (corr <= 0) return;
  const wsum = a.invMass + b.invMass;
  if (wsum <= 0) return;
  a.pos = sub(a.pos, scl(normal, corr * (a.invMass / wsum)));
  b.pos = add(b.pos, scl(normal, corr * (b.invMass / wsum)));
}

/**
 * Containment against the contracting spherical bag of given `center`/`radius`.
 * Removes any outward velocity (with restitution) and clamps the centroid so
 * the body's bounding sphere stays inside — the inward clamp on a shrinking
 * wall is what supplies the "suction" compaction. Linear only (the wall acts
 * through the centroid), so no spurious torque.
 */
export function resolveBoundary(
  b: RigidBody,
  center: Vec3,
  radius: number,
  restitution: number
): void {
  const d = sub(b.pos, center);
  const dist = norm(d);
  const limit = radius - b.radius;
  if (dist <= limit) return;
  const outward: Vec3 = dist > 1e-12 ? scl(d, 1 / dist) : [0, 0, 1];
  const vn = dot(b.vel, outward);
  if (vn > 0) b.vel = sub(b.vel, scl(outward, (1 + restitution) * vn));
  b.pos = add(center, scl(outward, Math.max(limit, 0)));
}
