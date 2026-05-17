// Avrami / KJMA growth kinetics. The classical model for nucleation-and-
// growth phase transformations (Kolmogorov 1937, Johnson-Mehl 1939, Avrami
// 1939):
//
//   X(t) = X∞ · ( 1 − exp( −K · t^n ) )
//
// where X is the transformed fraction, X∞ is the asymptote, K is a rate
// constant, and n is the Avrami exponent encoding growth dimensionality
// and nucleation mode:
//
//   n = 1 : surface-limited or 1D growth
//   n = 2 : 2D growth on existing nuclei
//   n = 3 : 3D bulk growth, constant nucleation rate
//   n = 4 : 3D growth with increasing nucleation rate
//
// For our face-graph cluster aggregation we treat the growth step count as
// "time", η_C(t) as the transformed fraction, and η_∞ as the asymptote
// (taken as the trajectory's final η_C, which is a slight under-estimate but
// adequate when the curve has visibly flattened).
//
// Linearized fit: ln(−ln(1 − η/η∞)) = ln(K) + n · ln(t). OLS on this
// transformed pair gives n as the slope, K = exp(intercept).

import type { Rng as RngT } from './rng.js';
import { Rng } from './rng.js';
import { growOne, makeAssembly, type GrowthStrategy } from './assembly.js';
import { computeHull } from './hull.js';

export interface KineticsParams {
  L: number;
  N: number;
  seed: number;
  chiralityBias: number;
  strategy: GrowthStrategy;
  compactBeta: number;
}

export interface KineticsHooks {
  onStep?: (step: number, total: number, currentEta: number) => void;
}

export interface KineticsResult {
  /** η_C at each growth step. trajectory[0] is the seed (single-tet) value. */
  trajectory: number[];
  /** Tet count reached at each step (= step + 1 if growth never stalled). */
  Ns: number[];
  /** Final η_C, taken as η_∞ for the Avrami fit. */
  etaInf: number;
  /** Avrami fit if the trajectory was long enough; otherwise null. */
  fit: AvramiFit | null;
}

export interface AvramiFit {
  /** Avrami exponent n: 1 = surface-limited, 3 = 3D bulk. */
  n: number;
  /** 1-sigma uncertainty on n. */
  nErr: number;
  /** Rate constant K. */
  K: number;
  /** R² on the linearized fit. */
  r2: number;
  /** Number of usable points (excludes the head, where 1-η/η∞ ≈ 0). */
  nPoints: number;
}

/**
 * Run growth from seed to N, recording η_C at each step. Optionally call
 * `hooks.onStep` after each new tet so a worker can stream progress.
 */
export function growTrajectory(p: KineticsParams, hooks?: KineticsHooks): KineticsResult {
  const rng: RngT = new Rng(p.seed);
  const a = makeAssembly({
    L: p.L,
    rng,
    chiralityBias: p.chiralityBias,
    strategy: p.strategy,
    compactBeta: p.compactBeta,
  });
  const trajectory: number[] = [];
  const Ns: number[] = [];
  function record(): void {
    Ns.push(a.tets.length);
    trajectory.push(etaOf(a.tets));
  }
  record();
  for (let step = 1; step < p.N; step++) {
    if (growOne(a) !== 'grown') break;
    record();
    hooks?.onStep?.(step, p.N - 1, trajectory[trajectory.length - 1]!);
  }
  const etaInf = trajectory[trajectory.length - 1] ?? 0;
  const eta0 = trajectory[0] ?? 1;
  const fit = etaInf < eta0 ? avramiFit(trajectory, eta0, etaInf) : null;
  return { trajectory, Ns, etaInf, fit };
}

/**
 * OLS fit on the Avrami linearization. η_C(t) DECREASES from η₀ ≈ 1 (single
 * seed tet) toward η_∞ (asymptotic compactness) as the hull catches up with
 * V★ growth, so the transformed-fraction analogue is
 *
 *   X(t) = (η₀ − η(t)) / (η₀ − η_∞)    ∈ [0, 1)
 *
 * which rises monotonically with t. Standard Avrami:
 *
 *   X(t) = 1 − exp(−K · t^n)
 *
 * giving the OLS-friendly linearization
 *
 *   ln(−ln(1 − X)) = ln(K) + n · ln(t).
 *
 * Drops t=0 (where X=0 and ln blows up) and any t where the numerical
 * trajectory hasn't strictly moved (X ≤ 0 or X ≥ 1).
 */
export function avramiFit(
  trajectory: ReadonlyArray<number>,
  eta0: number,
  etaInf: number
): AvramiFit | null {
  const denom = eta0 - etaInf;
  if (denom <= 0) return null;
  const lx: number[] = [];
  const ly: number[] = [];
  for (let t = 1; t < trajectory.length; t++) {
    const eta = trajectory[t]!;
    const X = (eta0 - eta) / denom;
    if (X <= 0 || X >= 1) continue;
    const arg = -Math.log(1 - X);
    if (arg <= 0) continue;
    lx.push(Math.log(t));
    ly.push(Math.log(arg));
  }
  const n = lx.length;
  if (n < 3) return null;
  const mx = lx.reduce((s, v) => s + v, 0) / n;
  const my = ly.reduce((s, v) => s + v, 0) / n;
  let sxx = 0;
  let sxy = 0;
  let syy = 0;
  for (let i = 0; i < n; i++) {
    const dx = lx[i]! - mx;
    const dy = ly[i]! - my;
    sxx += dx * dx;
    sxy += dx * dy;
    syy += dy * dy;
  }
  if (sxx < 1e-15) return null;
  const slope = sxy / sxx;
  const intercept = my - slope * mx;
  const r2 = syy < 1e-15 ? 1 : (sxy * sxy) / (sxx * syy);
  let sse = 0;
  for (let i = 0; i < n; i++) {
    const resid = ly[i]! - (slope * lx[i]! + intercept);
    sse += resid * resid;
  }
  const dof = Math.max(1, n - 2);
  const nErr = Math.sqrt(sse / dof / sxx);
  return { n: slope, nErr, K: Math.exp(intercept), r2, nPoints: n };
}

function etaOf(tets: Array<{ verts: readonly [unknown, unknown, unknown, unknown] }>): number {
  if (tets.length === 0) return 0;
  const allV: [number, number, number][] = [];
  for (const t of tets) {
    for (const v of t.verts as readonly [number, number, number][]) {
      allV.push([v[0], v[1], v[2]]);
    }
  }
  const hull = computeHull(allV);
  if (!hull) return 0;
  // L=1 here since the trajectory is parameterised by N and we just want
  // the dimensionless ratio.
  const Vstar = tets.length / 6;
  return Vstar / hull.volume;
}
