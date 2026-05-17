import { describe, expect, it } from 'vitest';
import { downloadCSV, runCurve, runStudy, trialsToCSV } from '../src/lib/study.js';

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

  it('returns NaN on trial failure instead of throwing', () => {
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

describe('trialsToCSV meta', () => {
  it('includes note line when meta.note is supplied', () => {
    const trials = runStudy({
      N: 5,
      trials: 1,
      startSeed: 1,
      chiralityBias: 0.5,
      strategy: 'uniform',
    });
    const csv = trialsToCSV(trials, { note: 'pilot run' });
    expect(csv).toContain('# note=pilot run');
  });

  it('includes studyParams entries when provided', () => {
    const trials = runStudy({
      N: 5,
      trials: 1,
      startSeed: 1,
      chiralityBias: 0.5,
      strategy: 'uniform',
    });
    const csv = trialsToCSV(trials, { studyParams: { strategy: 'uniform', beta: 4 } });
    expect(csv).toContain('# strategy=uniform');
    expect(csv).toContain('# beta=4');
  });
});

describe('runCurve', () => {
  it('reports finite means for trialsPerN=1 (exercises n=1 path in meanStd)', () => {
    const curve = runCurve([3, 5, 8], 1, 1, 0.5, 'uniform');
    expect(curve).toHaveLength(3);
    for (const pt of curve) {
      expect(Number.isFinite(pt.meanEff)).toBe(true);
      // With a single sample, Bessel-corrected std/sem are NaN.
      expect(Number.isNaN(pt.stdEff)).toBe(true);
      expect(Number.isNaN(pt.semEff)).toBe(true);
    }
  });

  it('fires onN / onTrial hooks during a sweep', () => {
    const onN: number[] = [];
    const onTrial: Array<[number, number]> = [];
    runCurve([4, 6], 2, 1, 0.5, 'uniform', undefined, {
      onN: (done) => onN.push(done),
      onTrial: (done, total) => onTrial.push([done, total]),
    });
    expect(onN).toEqual([1, 2]);
    // 2 trials × 2 Ns = 4 total trial-progress callbacks.
    expect(onTrial.length).toBe(4);
  });
});

describe('downloadCSV', () => {
  it('produces a text/csv blob with the supplied filename', () => {
    let blob: Blob | null = null;
    let filename = '';
    const origCreate = URL.createObjectURL;
    const origRevoke = URL.revokeObjectURL;
    const origClick = HTMLAnchorElement.prototype.click;
    URL.createObjectURL = (b: Blob): string => {
      blob = b;
      return 'blob:test';
    };
    URL.revokeObjectURL = (): void => {};
    HTMLAnchorElement.prototype.click = function (this: HTMLAnchorElement): void {
      filename = this.download;
    };
    try {
      downloadCSV('a,b,c\n1,2,3\n', 'out.csv');
    } finally {
      URL.createObjectURL = origCreate;
      URL.revokeObjectURL = origRevoke;
      HTMLAnchorElement.prototype.click = origClick;
    }
    expect(blob).toBeTruthy();
    expect((blob as unknown as Blob).type).toBe('text/csv');
    expect(filename).toBe('out.csv');
  });
});
