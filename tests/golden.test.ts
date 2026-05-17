// Golden regression test: pins exact (bit-identical) per-trial η_C and η_B
// outputs for a deterministic curve sweep. Failure means the simulation kernel
// changed observably and ALGORITHM_VERSION in src/lib/provenance.ts MUST be
// bumped before merging.
//
// To intentionally update the pins after an authorized behavior change:
//   1. Bump ALGORITHM_VERSION in src/lib/provenance.ts.
//   2. Regenerate the literals below from a single CLI run (the simplest way:
//      npx tsx -e "import('./src/lib/study.js').then(m=>console.log(JSON.stringify(
//      [10,30,50,100].map(N=>m.runStudy({N,trials:5,startSeed:1,chiralityBias:0.5,
//      strategy:'compact',compactBeta:3}).map(t=>[t.trial,t.efficiency,t.bboxEfficiency]))
//      )))").
//   3. Update the GOLDEN constant.
//   4. Note the bump and the rationale in the PR description.

import { describe, expect, it } from 'vitest';
import { runStudy } from '../src/lib/study.js';

/**
 * Pinned (N → [trial, efficiency, bboxEfficiency][]) for
 * compact, β=3, c_R=0.5, startSeed=1, trials=5.
 *
 * Generated against the kernel at ALGORITHM_VERSION='2'.
 */
const GOLDEN: Record<number, ReadonlyArray<readonly [number, number, number]>> = {
  10: [
    [0, 0.7692307692307693, 0.4166666666666665],
    [1, 0.5000000000000001, 0.13888888888888887],
    [2, 0.8333333333333335, 0.4166666666666666],
    [3, 0.5263157894736842, 0.2083333333333333],
    [4, 0.666666666666667, 0.20833333333333326],
  ],
  30: [
    [0, 0.46153846153846156, 0.2777777777777778],
    [1, 0.39473684210526316, 0.1388888888888889],
    [2, 0.5882352941176472, 0.27777777777777773],
    [3, 0.6666666666666667, 0.4166666666666663],
    [4, 0.6976744186046513, 0.41666666666666646],
  ],
  50: [
    [0, 0.5681818181818181, 0.34722222222222227],
    [1, 0.4716981132075473, 0.2314814814814815],
    [2, 0.5681818181818183, 0.2604166666666667],
    [3, 0.5952380952380955, 0.2314814814814814],
    [4, 0.5747126436781612, 0.23148148148148154],
  ],
  100: [
    [0, 0.45045045045045046, 0.20833333333333334],
    [1, 0.5291005291005293, 0.3472222222222222],
    [2, 0.6849315068493156, 0.3472222222222223],
    [3, 0.523560209424084, 0.26041666666666663],
    [4, 0.4761904761904765, 0.26041666666666663],
  ],
};

describe('golden regression', () => {
  for (const [Nstr, expected] of Object.entries(GOLDEN)) {
    const N = Number(Nstr);
    it(`N=${N} compact β=3 startSeed=1 (5 trials) matches pinned output`, () => {
      const trials = runStudy({
        N,
        trials: expected.length,
        startSeed: 1,
        chiralityBias: 0.5,
        strategy: 'compact',
        compactBeta: 3,
      });
      expect(trials.length).toBe(expected.length);
      for (let i = 0; i < expected.length; i++) {
        const [eTrial, eEff, eBboxEff] = expected[i]!;
        const got = trials[i]!;
        expect(got.trial).toBe(eTrial);
        // Bit-identical on doubles: the LCG and SAT arithmetic are pure
        // IEEE-754 +/-/*//; same inputs in the same order ⇒ same bits.
        expect(got.efficiency).toBe(eEff);
        expect(got.bboxEfficiency).toBe(eBboxEff);
      }
    });
  }
});
