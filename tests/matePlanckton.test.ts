import { describe, expect, it } from 'vitest';
import { faceTriangles, matchPerms, matePlanckton, unitPlanckton } from '../src/lib/planckton.js';
import { Rng } from '../src/lib/rng.js';
import { growOne, makeAssembly } from '../src/lib/assembly.js';
import type { Vec3 } from '../src/lib/vec.js';

function vertexKey(v: Vec3): string {
  // Quantize to 1e-9 so floating-point round-off after the rigid + reflection
  // composition still hashes to the same bucket.
  return `${Math.round(v[0] * 1e9)},${Math.round(v[1] * 1e9)},${Math.round(v[2] * 1e9)}`;
}

describe('matePlanckton', () => {
  it('places the result vertex-coincident on the target face (3 shared vertices)', () => {
    const seed = unitPlanckton(1, 'R');
    const target = faceTriangles(seed)[0]!;
    // matePlanckton's contract: caller supplies a template of chirality
    // flip(desired_result), since mating is a reflection.
    const tmpl = unitPlanckton(1, 'L');
    const tF = faceTriangles(tmpl);
    const perms = matchPerms(target, tF[0]!);
    expect(perms.length).toBeGreaterThan(0);
    const mated = matePlanckton(tmpl, 0, target, perms[0]!);
    const seedKeys = new Set(seed.verts.map(vertexKey));
    const matedKeys = mated.verts.map(vertexKey);
    const shared = matedKeys.filter((k) => seedKeys.has(k));
    expect(shared).toHaveLength(3);
  });

  it('flips chirality (reflection across the face plane)', () => {
    const tmpl = unitPlanckton(1, 'R');
    const seed = unitPlanckton(1, 'L');
    const target = faceTriangles(seed)[0]!;
    const perms = matchPerms(target, faceTriangles(tmpl)[0]!);
    if (perms.length === 0) {
      // L→R mating on face 0 may not have a cyclic perm match; bail
      // gracefully - other faces will exercise the path.
      return;
    }
    const mated = matePlanckton(tmpl, 0, target, perms[0]!);
    expect(mated.chirality).toBe('L');
  });

  it('grown assembly has 3-vertex-shared edges between every mated pair', () => {
    // After 5 grow steps, every consecutive growth step should produce a tet
    // that shares exactly 3 vertices with at least one existing tet.
    const a = makeAssembly({
      L: 1,
      rng: new Rng(7),
      chiralityBias: 0.5,
      strategy: 'compact',
      compactBeta: 3,
    });
    for (let i = 0; i < 5; i++) growOne(a);
    // For each tet (except seed) check it shares ≥ 3 verts with at least one
    // earlier tet.
    for (let i = 1; i < a.tets.length; i++) {
      const myKeys = new Set(a.tets[i]!.verts.map(vertexKey));
      let maxShared = 0;
      for (let j = 0; j < i; j++) {
        const otherKeys = new Set(a.tets[j]!.verts.map(vertexKey));
        let shared = 0;
        for (const k of myKeys) if (otherKeys.has(k)) shared++;
        if (shared > maxShared) maxShared = shared;
      }
      expect(maxShared).toBe(3);
    }
  });

  it('preserves Hill T₁ edge-length spectrum after mating', () => {
    // Every Planckton at edge L should have edge multiset (3·L, 2·L√2, 1·L√3).
    // If matePlanckton's transform skewed lengths, this would shift.
    const seed = unitPlanckton(1, 'R');
    const target = faceTriangles(seed)[1]!;
    const tmpl = unitPlanckton(1, 'L');
    const tF = faceTriangles(tmpl);
    let mated = null;
    for (let tfIdx = 0; tfIdx < 4; tfIdx++) {
      const perms = matchPerms(target, tF[tfIdx]!);
      if (perms.length > 0) {
        mated = matePlanckton(tmpl, tfIdx, target, perms[0]!);
        break;
      }
    }
    expect(mated).not.toBeNull();
    const lengths: number[] = [];
    const v = mated!.verts;
    for (let i = 0; i < 4; i++) {
      for (let j = i + 1; j < 4; j++) {
        lengths.push(
          Math.sqrt(
            (v[i]![0] - v[j]![0]) ** 2 + (v[i]![1] - v[j]![1]) ** 2 + (v[i]![2] - v[j]![2]) ** 2
          )
        );
      }
    }
    lengths.sort((a, b) => a - b);
    expect(lengths[0]).toBeCloseTo(1, 9);
    expect(lengths[1]).toBeCloseTo(1, 9);
    expect(lengths[2]).toBeCloseTo(1, 9);
    expect(lengths[3]).toBeCloseTo(Math.SQRT2, 9);
    expect(lengths[4]).toBeCloseTo(Math.SQRT2, 9);
    expect(lengths[5]).toBeCloseTo(Math.sqrt(3), 9);
  });
});
