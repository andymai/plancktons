import { describe, expect, it } from 'vitest';
import { runCurve, runStudy, trialsToCSV } from '../src/lib/study.js';

describe('runStudy', () => {
  it('returns one TrialResult per trial', () => {
    const trials = runStudy({
      N: 10,
      trials: 5,
      startSeed: 1,
      chiralityBias: 0.5,
      strategy: 'uniform',
    });
    expect(trials.length).toBe(5);
    for (const t of trials) {
      expect(t.V).toBeGreaterThan(0);
      expect(t.Vstar).toBeGreaterThan(0);
      expect(t.efficiency).toBeGreaterThan(0);
      expect(t.efficiency).toBeLessThanOrEqual(1.01);
    }
  });

  it('seeds are deterministic - same seed gives same V', () => {
    const a = runStudy({
      N: 8,
      trials: 1,
      startSeed: 42,
      chiralityBias: 0.5,
      strategy: 'uniform',
    });
    const b = runStudy({
      N: 8,
      trials: 1,
      startSeed: 42,
      chiralityBias: 0.5,
      strategy: 'uniform',
    });
    expect(b[0]!.V).toBeCloseTo(a[0]!.V, 12);
  });
});

describe('runCurve', () => {
  it('returns one CurvePoint per N', () => {
    const points = runCurve([5, 10, 15], 3, 1, 0.5, 'uniform');
    expect(points.length).toBe(3);
    expect(points[0]!.N).toBe(5);
    expect(points[1]!.N).toBe(10);
  });

  it('handles trial-failures gracefully (returns NaN, not crash)', () => {
    const points = runCurve([1], 0, 1, 0.5, 'uniform');
    expect(points[0]!.meanEff).toBeNaN();
  });
});

describe('trialsToCSV', () => {
  it('emits header + N rows', () => {
    const trials = runStudy({
      N: 5,
      trials: 3,
      startSeed: 1,
      chiralityBias: 0.5,
      strategy: 'uniform',
    });
    const csv = trialsToCSV(trials);
    const lines = csv.split('\n');
    // Lines: provenance block (commented with #) + header + trial rows.
    expect(lines[0]).toMatch(/^# plancktons export/);
    const headerIdx = lines.findIndex((l) => !l.startsWith('#'));
    expect(lines[headerIdx]).toMatch(/^trial,N,seed,V,Vbbox,Vstar,efficiency,bboxEfficiency,/);
    expect(lines.length - headerIdx).toBe(1 + trials.length);
  });
});
