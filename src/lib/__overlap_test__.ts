// Stress test the overlap-free invariant. Run with `npx tsx src/lib/__overlap_test__.ts`.

import { Rng } from './rng.js';
import { growOne, makeAssembly } from './assembly.js';
import { findOverlaps } from './validate.js';
import { centroid, cross, dot, sub } from './vec.js';
import type { Vec3 } from './vec.js';
import type { Planckton } from './planckton.js';

// Strict centroid-in-tet: positive margin = require some depth inside.
function strictIn(p: Vec3, t: readonly [Vec3, Vec3, Vec3, Vec3], margin: number): boolean {
  const v0 = sub(t[1], t[0]);
  const v1 = sub(t[2], t[0]);
  const v2 = sub(t[3], t[0]);
  const denom = dot(v0, cross(v1, v2));
  if (Math.abs(denom) < 1e-12) return false;
  const r = sub(p, t[0]);
  const c1 = dot(r, cross(v1, v2)) / denom;
  const c2 = dot(v0, cross(r, v2)) / denom;
  const c3 = dot(v0, cross(v1, r)) / denom;
  const c0 = 1 - c1 - c2 - c3;
  return c0 > margin && c1 > margin && c2 > margin && c3 > margin;
}

const L = 1;
const STRATEGIES = ['uniform', 'compact'] as const;
const Ns = [10, 30, 50];
const trials = 25;

let totalBad = 0;
for (const strategy of STRATEGIES) {
  for (const N of Ns) {
    let bad = 0;
    let badAssemblyCount = 0;
    for (let t = 0; t < trials; t++) {
      const rng = new Rng(1000 + t * 17);
      const a = makeAssembly({ L, rng, chiralityBias: 0.5, strategy });
      while (a.tets.length < N) {
        if (growOne(a) !== 'grown') break;
      }
      const overlaps = findOverlaps(a, L);
      if (overlaps.length > 0) {
        badAssemblyCount++;
        bad += overlaps.length;
        if (badAssemblyCount === 1) {
          const o = overlaps[0]!;
          console.log(
            `\n${strategy} N=${N} trial=${t}: ${overlaps.length} overlap(s). First pair tets ${o.a},${o.b}:`
          );
          console.log('  A:', o.ta.chirality, JSON.stringify(o.ta.verts));
          console.log('  B:', o.tb.chirality, JSON.stringify(o.tb.verts));
        }
      }
    }
    totalBad += bad;
    console.log(
      `${strategy} N=${N}: ${badAssemblyCount}/${trials} assemblies bad, ${bad} total overlap-pairs`
    );
  }
}
console.log(`\nTotal: ${totalBad} overlap-pair violations`);

// Now the STRICT centroid test (must be >= 1e-5 inside)
console.log('\nStrict centroid-in-tet (margin 1e-5):');
let strict = 0;
for (let t = 0; t < 50; t++) {
  const a = makeAssembly({ L, rng: new Rng(2000 + t * 13), chiralityBias: 0.5, strategy: 'compact' });
  while (a.tets.length < 30) {
    if (growOne(a) !== 'grown') break;
  }
  for (let i = 0; i < a.tets.length; i++) {
    for (let j = i + 1; j < a.tets.length; j++) {
      const A = (a.tets[i] as Planckton).verts;
      const B = (a.tets[j] as Planckton).verts;
      const cA = centroid(A[0], A[1], A[2], A[3]);
      const cB = centroid(B[0], B[1], B[2], B[3]);
      if (strictIn(cA, B, 1e-5) || strictIn(cB, A, 1e-5)) {
        strict++;
        if (strict <= 3)
          console.log(`  trial=${t} i=${i} j=${j}  cA=${cA.map((x) => x.toFixed(3))} cB=${cB.map((x) => x.toFixed(3))}`);
      }
    }
  }
}
console.log(`Strict centroid overlaps: ${strict}`);

if (totalBad > 0 || strict > 0) process.exit(1);
