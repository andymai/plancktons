import { describe, expect, it } from 'vitest';
import { ALGORITHM_VERSION, provenance, provenanceCsvHeader } from '../src/lib/provenance.js';

describe('provenance()', () => {
  it('returns an object with the four expected fields', () => {
    const p = provenance();
    expect(p.algorithmVersion).toBe(ALGORITHM_VERSION);
    expect(typeof p.commit).toBe('string');
    expect(typeof p.buildTime).toBe('string');
    expect(typeof p.exportTime).toBe('string');
  });

  it('exportTime is a valid ISO 8601 timestamp', () => {
    const p = provenance();
    expect(new Date(p.exportTime).toString()).not.toBe('Invalid Date');
    expect(p.exportTime).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
  });

  it('falls back to "dev" when build-time defines are absent (test runtime)', () => {
    // Vite injects __BUILD_COMMIT__/__BUILD_TIME__ at build time. In vitest
    // these are undefined, so the fallback path is what tests exercise.
    const p = provenance();
    expect(p.commit).toBe('dev');
    expect(p.buildTime).toBe('dev');
  });

  it('uses injected __BUILD_COMMIT__ / __BUILD_TIME__ when defined as strings', () => {
    // Vite's `define` plugin replaces these at build time; emulate that by
    // assigning the globals before calling provenance.
    const g = globalThis as unknown as { __BUILD_COMMIT__?: string; __BUILD_TIME__?: string };
    g.__BUILD_COMMIT__ = 'abc1234';
    g.__BUILD_TIME__ = '2026-05-17T00:00:00Z';
    try {
      const p = provenance();
      expect(p.commit).toBe('abc1234');
      expect(p.buildTime).toBe('2026-05-17T00:00:00Z');
    } finally {
      delete g.__BUILD_COMMIT__;
      delete g.__BUILD_TIME__;
    }
  });
});

describe('provenanceCsvHeader()', () => {
  it('emits a # comment block with the standard fields', () => {
    const header = provenanceCsvHeader();
    const lines = header.split('\n');
    expect(lines[0]).toBe('# plancktons export');
    expect(lines).toContain(`# algorithm_version=${ALGORITHM_VERSION}`);
    expect(lines.some((l) => l.startsWith('# commit='))).toBe(true);
    expect(lines.some((l) => l.startsWith('# build_time='))).toBe(true);
    expect(lines.some((l) => l.startsWith('# export_time='))).toBe(true);
  });

  it('every line starts with "# "', () => {
    const header = provenanceCsvHeader();
    for (const line of header.split('\n')) {
      expect(line.startsWith('# ')).toBe(true);
    }
  });

  it('appends extra string/number fields verbatim', () => {
    const header = provenanceCsvHeader({
      n_trials: 200,
      strategy: 'compact',
      compactBeta: 3,
    });
    expect(header).toContain('# n_trials=200');
    expect(header).toContain('# strategy=compact');
    expect(header).toContain('# compactBeta=3');
  });

  it('JSON-stringifies object/array extras', () => {
    const header = provenanceCsvHeader({
      sweep: [10, 20, 50],
      meta: { strategy: 'uniform' },
    });
    expect(header).toContain('# sweep=[10,20,50]');
    expect(header).toContain('# meta={"strategy":"uniform"}');
  });

  it('handles boolean and null extras', () => {
    const header = provenanceCsvHeader({ advanced: true, note: null });
    expect(header).toContain('# advanced=true');
    expect(header).toContain('# note=null');
  });
});
