// Sanity check: data/preliminary/q2_beta_3.csv was generated against
// ALGORITHM_VERSION='2'. Its first 5 trials carry the same per-trial
// efficiency values as tests/golden.test.ts pins. If this test ever fails,
// it means either (a) the kernel changed and the preliminary/*.csv files
// need to be regenerated (and ALGORITHM_VERSION bumped), or (b) the data
// file was corrupted in a merge.
//
// Re-generating after an authorized kernel change:
//   npx tsx scripts/study.ts --N 50 --trials 500 --strategy compact \
//     --beta 3 --workers auto --out data/preliminary/q2_beta_3.csv
// (and similarly for the chirality / β sweep / D_f / g(r) files).

import { describe, expect, it } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

const Q2_BETA_3_PATH = resolve(__dirname, '..', 'data', 'preliminary', 'q2_beta_3.csv');

describe('preliminary data pinning', () => {
  it('q2_beta_3.csv first 5 trials match the golden η values', () => {
    if (!existsSync(Q2_BETA_3_PATH)) {
      throw new Error(
        `Missing ${Q2_BETA_3_PATH}. Regenerate with: npx tsx scripts/study.ts --N 50 --trials 500 --strategy compact --beta 3 --workers auto --out data/preliminary/q2_beta_3.csv`
      );
    }
    const raw = readFileSync(Q2_BETA_3_PATH, 'utf-8');
    const lines = raw.split('\n').filter((l) => l && !l.startsWith('#'));
    const header = lines.shift()!.split(',');
    const effIdx = header.indexOf('efficiency');
    const bboxIdx = header.indexOf('bboxEfficiency');
    expect(effIdx).toBeGreaterThan(-1);
    expect(bboxIdx).toBeGreaterThan(-1);
    // Mirror tests/golden.test.ts pins for N=50, compact β=3, seed=1.
    const expectedEff = [
      0.5681818181818181, 0.4716981132075473, 0.5681818181818183, 0.5952380952380955,
      0.5747126436781612,
    ];
    const expectedBbox = [
      0.34722222222222227, 0.2314814814814815, 0.2604166666666667, 0.2314814814814814,
      0.23148148148148154,
    ];
    for (let i = 0; i < 5; i++) {
      const cols = lines[i]!.split(',');
      expect(parseFloat(cols[effIdx]!)).toBe(expectedEff[i]);
      expect(parseFloat(cols[bboxIdx]!)).toBe(expectedBbox[i]);
    }
  });
});
