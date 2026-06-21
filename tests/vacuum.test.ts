import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { makeVacuumParams, runVacuumSettle } from '../src/lib/vacuum.js';

const SMALL = makeVacuumParams({ N: 10, seed: 42, maxFrames: 220, recordEvery: 10 });

// Frictionless settle + morphological skin extraction is legitimately heavy,
// especially under coverage instrumentation — give the suite generous headroom.
describe('runVacuumSettle', { timeout: 30000 }, () => {
  it('is deterministic: same seed → byte-identical trajectory', () => {
    const a = runVacuumSettle(SMALL);
    const b = runVacuumSettle(SMALL);
    expect(a.frameCount).toBe(b.frameCount);
    expect(a.positions).toEqual(b.positions);
    expect(a.quats).toEqual(b.quats);
    expect(Array.from(a.chirality)).toEqual(Array.from(b.chirality));
  });

  it('different seeds produce different packings', () => {
    const a = runVacuumSettle(SMALL);
    const b = runVacuumSettle(makeVacuumParams({ ...SMALL, seed: 99 }));
    expect(a.positions).not.toEqual(b.positions);
  });

  it('records frames and reports a valid jammed frame', () => {
    const t = runVacuumSettle(SMALL);
    expect(t.frameCount).toBeGreaterThan(1);
    expect(t.jammedFrame).toBe(t.frameCount - 1);
    expect(t.positions.length).toBe(t.frameCount * t.N * 3);
    expect(t.quats.length).toBe(t.frameCount * t.N * 4);
    expect(t.radii.length).toBe(t.frameCount);
  });

  it('air-removed is monotonic non-decreasing within [0,1]', () => {
    const t = runVacuumSettle(SMALL);
    for (let f = 0; f < t.frameCount; f++) {
      expect(t.airRemoved[f]!).toBeGreaterThanOrEqual(0);
      expect(t.airRemoved[f]!).toBeLessThanOrEqual(1);
      if (f > 0) expect(t.airRemoved[f]!).toBeGreaterThanOrEqual(t.airRemoved[f - 1]! - 1e-6);
    }
    expect(t.airRemoved[t.frameCount - 1]!).toBeCloseTo(1, 6);
  });

  it('final packing fractions are physical (0 < η_B ≤ 1)', () => {
    const t = runVacuumSettle(SMALL);
    expect(t.finalMetrics.N).toBe(10);
    expect(t.finalMetrics.etaB).toBeGreaterThan(0);
    expect(t.finalMetrics.etaB).toBeLessThanOrEqual(1.0001);
  });

  it('reports progress up to maxFrames', () => {
    let lastDone = 0;
    let total = 0;
    runVacuumSettle(makeVacuumParams({ N: 8, seed: 1, maxFrames: 120, recordEvery: 8 }), {
      onProgress: (done, t) => {
        lastDone = done;
        total = t;
      },
    });
    expect(total).toBe(120);
    expect(lastDone).toBeGreaterThan(0);
    expect(lastDone).toBeLessThanOrEqual(120);
  });

  it('physics source contains no wall-clock or Math.random (determinism guard)', () => {
    for (const f of ['vacuum.ts', 'rigidTet.ts', 'quat.ts']) {
      const src = readFileSync(`${process.cwd()}/src/lib/${f}`, 'utf8');
      expect(src).not.toMatch(/Math\.random/);
      expect(src).not.toMatch(/Date\.now/);
      expect(src).not.toMatch(/performance\.now/);
    }
  });
});
