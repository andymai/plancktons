// Build-time provenance, injected by Vite's `define`. Falls back to "dev" for
// local node scripts or any environment where the substitution didn't happen.

declare const __BUILD_COMMIT__: string | undefined;
declare const __BUILD_TIME__: string | undefined;

/** Identifier of the growth + SAT-overlap algorithm. Bump when behavior changes. */
export const ALGORITHM_VERSION = '2';

export interface Provenance {
  algorithmVersion: string;
  commit: string;
  buildTime: string;
  exportTime: string;
}

export function provenance(): Provenance {
  return {
    algorithmVersion: ALGORITHM_VERSION,
    commit: typeof __BUILD_COMMIT__ === 'string' ? __BUILD_COMMIT__ : 'dev',
    buildTime: typeof __BUILD_TIME__ === 'string' ? __BUILD_TIME__ : 'dev',
    exportTime: new Date().toISOString(),
  };
}

/** CSV comment block stamped at the top of every exported file. */
export function provenanceCsvHeader(extra?: Record<string, unknown>): string {
  const p = provenance();
  const lines = [
    `# plancktons export`,
    `# algorithm_version=${p.algorithmVersion}`,
    `# commit=${p.commit}`,
    `# build_time=${p.buildTime}`,
    `# export_time=${p.exportTime}`,
  ];
  if (extra) {
    for (const [k, v] of Object.entries(extra)) {
      lines.push(`# ${k}=${typeof v === 'object' ? JSON.stringify(v) : String(v)}`);
    }
  }
  return lines.join('\n');
}
