// Verify recursive midpoint subdivision preserves Hill-T volume at every depth.
import { eightReptile } from './canonicalScenes.js';
import { tetVolume } from './planckton.js';
import type { Vec3 } from './vec.js';

function subdivide(verts: readonly [Vec3, Vec3, Vec3, Vec3]): Array<[Vec3, Vec3, Vec3, Vec3]> {
  const [V0, V1, V2, V3] = verts;
  const m = (a: Vec3, b: Vec3): Vec3 => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2];
  const M01 = m(V0, V1),
    M02 = m(V0, V2),
    M03 = m(V0, V3),
    M12 = m(V1, V2),
    M13 = m(V1, V3),
    M23 = m(V2, V3);
  return [
    [V0, M01, M02, M03],
    [M01, V1, M12, M13],
    [M02, M12, V2, M23],
    [M03, M13, M23, V3],
    [M02, M13, M01, M03],
    [M02, M13, M03, M23],
    [M02, M13, M23, M12],
    [M02, M13, M12, M01],
  ];
}

const L = 1;
let pieces: Array<[Vec3, Vec3, Vec3, Vec3]> = eightReptile(L).map(
  (p) => [...p.verts] as [Vec3, Vec3, Vec3, Vec3]
);
for (let depth = 1; depth <= 3; depth++) {
  if (depth > 1) pieces = pieces.flatMap(subdivide);
  const vols = pieces.map((p) => tetVolume(p));
  const min = Math.min(...vols);
  const max = Math.max(...vols);
  const sum = vols.reduce((s, x) => s + x, 0);
  const expectedEach = L ** 3 / (6 * 8 ** (depth - 1));
  const expectedSum = (2 * L) ** 3 / 6;
  console.log(
    `depth ${depth}: ${pieces.length} pieces  min/max vol ${min.toFixed(8)}/${max.toFixed(8)}  ` +
      `sum ${sum.toFixed(6)} (expected ${expectedSum.toFixed(6)})  per-piece expected ${expectedEach.toFixed(8)}`
  );
  const allEqual = max - min < 1e-9;
  console.log(`  uniform volume: ${allEqual ? 'YES (all Hill T)' : 'NO — mixed shapes!'}`);
}
