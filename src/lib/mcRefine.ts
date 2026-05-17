// Metropolis Monte Carlo refinement of a face-to-face assembly. The growth
// algorithm is one-shot RSA and stops at a local-minimum jam; MC lets the
// configuration relax by accepting / rejecting local rearrangements that
// improve packing fraction.
//
// Move set: "displace leaf" — pick a tet with z=1 (one face glued, three
// free), detach it, then call `growOne` on the trimmed assembly to add a
// fresh replacement tet. If `growOne` succeeds, the proposal is the new
// configuration; otherwise the step counts as un-proposed (no move).
//
// Acceptance: energy E = −η_C. Metropolis criterion: accept iff ΔE < 0 OR
// `rng < exp(−ΔE / T)`. T → 0 = pure greedy; T ≈ 0.01 = mild thermal noise;
// T ≈ 0.1 = warm.

import { type Assembly, growOne, rebuildFromTets, tetCoordinations } from './assembly.js';
import type { Planckton } from './planckton.js';
import { computeHull } from './hull.js';
import { Rng } from './rng.js';

export interface McRefineParams {
  initial: Assembly;
  steps: number;
  temperature: number;
  seed: number;
}

export interface McRefineHooks {
  onStep?: (step: number, total: number, currentEta: number) => void;
}

export interface McRefineResult {
  /** η_C trajectory of length `steps + 1`; entry 0 is the initial value. */
  trajectory: number[];
  initialEta: number;
  finalEta: number;
  /** Number of accepted moves. */
  accepted: number;
  /** Number of geometrically valid proposals (denominator for accept rate). */
  proposed: number;
  /** Final accepted tet list. */
  finalTets: Planckton[];
}

export function runMcRefine(p: McRefineParams, hooks?: McRefineHooks): McRefineResult {
  const opts = p.initial.opts;
  let current: Assembly = rebuildFromTets(p.initial.tets, opts);
  let currentEta = etaOf(current);
  const trajectory: number[] = [currentEta];
  const initialEta = currentEta;
  let accepted = 0;
  let proposed = 0;
  const rng = new Rng(p.seed);
  for (let s = 0; s < p.steps; s++) {
    const proposal = proposeDisplaceLeaf(current, rng);
    if (proposal) {
      proposed++;
      const newEta = etaOf(proposal);
      const dE = -(newEta - currentEta);
      if (dE < 0 || rng.next() < Math.exp(-dE / Math.max(1e-9, p.temperature))) {
        current = proposal;
        currentEta = newEta;
        accepted++;
      }
    }
    trajectory.push(currentEta);
    hooks?.onStep?.(s + 1, p.steps, currentEta);
  }
  return {
    trajectory,
    initialEta,
    finalEta: currentEta,
    accepted,
    proposed,
    finalTets: current.tets.map((t) => ({ ...t })),
  };
}

function etaOf(a: Assembly): number {
  if (a.tets.length === 0) return 0;
  const allV: [number, number, number][] = [];
  for (const t of a.tets) for (const v of t.verts) allV.push([v[0], v[1], v[2]]);
  const hull = computeHull(allV);
  if (!hull) return 0;
  const Vstar = (a.tets.length * a.opts.L ** 3) / 6;
  return Vstar / hull.volume;
}

/**
 * Pick a random leaf (z=1) tet, detach it, rebuild the assembly from the
 * remaining set, and call `growOne` to add a fresh tet on the trimmed
 * configuration. Returns the new assembly if `growOne` succeeds, null
 * otherwise (no leaves, or `growOne` jammed).
 */
function proposeDisplaceLeaf(current: Assembly, rng: Rng): Assembly | null {
  if (current.tets.length < 2) return null;
  const z = tetCoordinations(current);
  const leaves: number[] = [];
  for (let i = 0; i < z.length; i++) if (z[i] === 1) leaves.push(i);
  if (leaves.length === 0) return null;
  const removeIdx = leaves[rng.int(leaves.length)]!;
  const remaining: Planckton[] = [];
  for (let i = 0; i < current.tets.length; i++) {
    if (i !== removeIdx) remaining.push(current.tets[i]!);
  }
  // Use a fresh RNG so consecutive MC steps don't retry the same placement
  // (would happen if the parent RNG were reused, since growOne consumes its
  // sequence and the trimmed assembly would replay it).
  const trimmed = rebuildFromTets(remaining, {
    ...current.opts,
    rng: new Rng(rng.int(2 ** 30)),
  });
  if (growOne(trimmed) !== 'grown') return null;
  return trimmed;
}
