// Quick numeric sanity check — run with `npx tsx src/lib/__sanity__.ts`.
// Verifies the math against known exact values without setting up a test framework.

import { Rng } from './rng.js';
import {
  freeFaceShapeCounts,
  freeSurfaceArea,
  growOne,
  makeAssembly,
  partVolumeTotal,
} from './assembly.js';
import { computeHull } from './hull.js';
import { tetVolume } from './planckton.js';

function approx(a: number, b: number, eps = 1e-6): boolean {
  return Math.abs(a - b) < eps;
}
let pass = 0;
let fail = 0;
function check(name: string, cond: boolean): void {
  if (cond) {
    pass++;
    console.log(`  ✓  ${name}`);
  } else {
    fail++;
    console.log(`  ✗  ${name}`);
  }
}

console.log('Plancktons sanity check');

// 1) Unit Hill T volume
{
  const a = makeAssembly({ L: 1, rng: new Rng(1), chiralityBias: 1, strategy: 'uniform' });
  const v = tetVolume(a.tets[0]!.verts);
  check('unit Hill T volume = 1/6', approx(v, 1 / 6));
  check('partVolumeTotal(1 tet) = 1/6', approx(partVolumeTotal(a), 1 / 6));
}

// 2) Hull of a single tet = its own volume
{
  const a = makeAssembly({ L: 1, rng: new Rng(1), chiralityBias: 1, strategy: 'uniform' });
  const hull = computeHull(a.tets[0]!.verts)!;
  check('hull(single tet) = 1/6', approx(hull.volume, 1 / 6, 1e-5));
}

// 3) Surface area of a unit Hill T = 2*(1/2) + 2*(sqrt(2)/2) = 1 + sqrt(2)
{
  const a = makeAssembly({ L: 1, rng: new Rng(1), chiralityBias: 1, strategy: 'uniform' });
  const area = freeSurfaceArea(a);
  check('surface area = 1 + sqrt(2)', approx(area, 1 + Math.SQRT2, 1e-6));
}

// 4) Free-face shape counts on a single tet: 2 iso + 2 scalene
{
  const a = makeAssembly({ L: 1, rng: new Rng(1), chiralityBias: 1, strategy: 'uniform' });
  const { isoceles, scalene } = freeFaceShapeCounts(a);
  check('single tet has 2 iso + 2 scalene free faces', isoceles === 2 && scalene === 2);
}

// 5) Grow assembly to N=20 and confirm 20 tets placed, V*/V plausible
{
  const a = makeAssembly({ L: 1, rng: new Rng(42), chiralityBias: 0.5, strategy: 'uniform' });
  while (a.tets.length < 20 && growOne(a)) {
    /* empty */
  }
  const allV = a.tets.flatMap((t) => [...t.verts]);
  const hull = computeHull(allV);
  check('grew to N=20', a.tets.length === 20);
  check('hull exists', hull !== null);
  if (hull) {
    const eff = partVolumeTotal(a) / hull.volume;
    console.log(
      `     N=20 uniform:  V*=${partVolumeTotal(a).toFixed(4)}  V=${hull.volume.toFixed(4)}  eff=${eff.toFixed(3)}`
    );
    check('uniform N=20 efficiency in (0.15, 0.45)', eff > 0.15 && eff < 0.45);
  }
}

// 6) Compact strategy gives HIGHER efficiency than uniform on average
{
  let effUni = 0;
  let effCompact = 0;
  const trials = 6;
  for (let t = 0; t < trials; t++) {
    const a1 = makeAssembly({
      L: 1,
      rng: new Rng(100 + t),
      chiralityBias: 0.5,
      strategy: 'uniform',
    });
    while (a1.tets.length < 30 && growOne(a1)) {
      /* empty */
    }
    const h1 = computeHull(a1.tets.flatMap((t) => [...t.verts]));
    if (h1) effUni += partVolumeTotal(a1) / h1.volume;

    const a2 = makeAssembly({
      L: 1,
      rng: new Rng(100 + t),
      chiralityBias: 0.5,
      strategy: 'compact',
    });
    while (a2.tets.length < 30 && growOne(a2)) {
      /* empty */
    }
    const h2 = computeHull(a2.tets.flatMap((t) => [...t.verts]));
    if (h2) effCompact += partVolumeTotal(a2) / h2.volume;
  }
  effUni /= trials;
  effCompact /= trials;
  console.log(
    `     N=30  uniform eff=${effUni.toFixed(3)}  compact eff=${effCompact.toFixed(3)}`
  );
  check('compact >= uniform efficiency', effCompact >= effUni - 0.02);
}

console.log(`\n${pass} passed, ${fail} failed`);
if (fail > 0) process.exit(1);
