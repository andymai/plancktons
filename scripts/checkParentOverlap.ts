// Test whether the random face-to-face mate ever produces a tet that
// overlaps with its OWN parent (which growOne currently excludes from
// the overlap test).
import { makeAssembly, growOne } from '../src/lib/assembly.js';
import { Rng } from '../src/lib/rng.js';
import { findOverlaps } from '../src/lib/validate.js';

let bad = 0;
let total = 0;
for (const strategy of ['uniform', 'compact'] as const) {
  for (let seed = 0; seed < 30; seed++) {
    const a = makeAssembly({
      L: 1,
      rng: new Rng(5000 + seed),
      chiralityBias: 0.5,
      strategy,
      compactBeta: 3,
    });
    while (a.tets.length < 40 && growOne(a) === 'grown') {
      // empty
    }
    // EXTRA STRICT: also check parent–child pairs (they share faces, but
    // shouldn't overlap by VOLUME).
    const overs = findOverlaps(a, 1);
    if (overs.length > 0) {
      bad += overs.length;
      console.log(
        `  strategy=${strategy} seed=${seed} N=${a.tets.length}: ${overs.length} overlaps`
      );
    }
    total++;
  }
}
console.log(`\n${bad} overlap-pairs across ${total} assemblies`);
