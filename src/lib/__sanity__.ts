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
  while (a.tets.length < 20) {
    if (growOne(a) !== 'grown') break;
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
    while (a1.tets.length < 30) {
      if (growOne(a1) !== 'grown') break;
    }
    const h1 = computeHull(a1.tets.flatMap((t) => [...t.verts]));
    if (h1) effUni += partVolumeTotal(a1) / h1.volume;

    const a2 = makeAssembly({
      L: 1,
      rng: new Rng(100 + t),
      chiralityBias: 0.5,
      strategy: 'compact',
    });
    while (a2.tets.length < 30) {
      if (growOne(a2) !== 'grown') break;
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

// 7) Shape descriptors: a sphere-like cloud should be isotropic (κ²≈0)
{
  const sphere: [number, number, number][] = [];
  const M = 200;
  const lcg = new Rng(7);
  for (let i = 0; i < M; i++) {
    // Marsaglia uniform on sphere via rejection
    let x = 0, y = 0, z = 0, s = 2;
    while (s >= 1) {
      x = 2 * lcg.next() - 1;
      y = 2 * lcg.next() - 1;
      z = 2 * lcg.next() - 1;
      s = x * x + y * y + z * z;
    }
    sphere.push([x, y, z]);
  }
  const desc = (await import('./shape.js')).gyrationDescriptors(sphere);
  console.log(
    `     sphere cloud: κ²=${desc!.kappaSq.toFixed(3)}, prolateness=${desc!.prolateness.toFixed(3)}, R_g=${desc!.rg.toFixed(3)}`
  );
  check('sphere cloud has κ² < 0.02 (isotropic)', desc!.kappaSq < 0.02);
}

// 8) Rod (points along x-axis) → highly prolate, κ²≈1
{
  const rod: [number, number, number][] = [];
  for (let i = 0; i < 50; i++) rod.push([i, 0, 0]);
  const desc = (await import('./shape.js')).gyrationDescriptors(rod);
  console.log(`     rod cloud: κ²=${desc!.kappaSq.toFixed(3)}, prolateness=${desc!.prolateness.toFixed(3)}`);
  check('rod cloud has κ² > 0.95 (rod-like)', desc!.kappaSq > 0.95);
}

// 9) Vertex coordination on the cube tiling: 8 corners × 1 + edge midpoints × 2 + face centers etc.
{
  const { cubeTiling } = await import('./canonicalScenes.js');
  const { vertexCoordination, makeAssembly } = await import('./assembly.js');
  const pieces = cubeTiling(1);
  const a = makeAssembly({ L: 1, rng: new Rng(1), chiralityBias: 1, strategy: 'uniform' });
  // Replace seed's tets with the cube tiling.
  a.tets.length = 0;
  a.tets.push(...pieces);
  const coord = vertexCoordination(a);
  console.log(
    `     6-cube tiling: ${coord.uniqueVertices} unique vertices, mean coord=${coord.meanCoord.toFixed(2)}, max=${coord.maxCoord}`
  );
  // 8 cube corners used as tet vertices; (0,0,0) and (1,1,1) — the space-diagonal
  // endpoints all 6 tets share — have coordination 6.
  check('cube tiling: diagonal endpoints shared by 6 tets', coord.maxCoord === 6 && coord.uniqueVertices === 8);
}

console.log(`\n${pass} passed, ${fail} failed`);
if (fail > 0) process.exit(1);
