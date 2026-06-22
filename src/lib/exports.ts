import type { Planckton } from './planckton.js';
import type { Assembly } from './assembly.js';
import type { Vec3 } from './vec.js';
import { cross, sub } from './vec.js';
import { ALGORITHM_VERSION, provenance } from './provenance.js';

// ------------------------------- STL ---------------------------------------

export function plancktonsToSTL(pts: ReadonlyArray<Planckton>, name = 'plancktons'): string {
  const lines: string[] = [`solid ${name}`];
  for (const p of pts) {
    for (const [i, j, k] of p.faces) {
      const a = p.verts[i] as Vec3;
      const b = p.verts[j] as Vec3;
      const c = p.verts[k] as Vec3;
      const n = cross(sub(b, a), sub(c, a));
      const len = Math.hypot(n[0], n[1], n[2]) || 1;
      const nx = n[0] / len,
        ny = n[1] / len,
        nz = n[2] / len;
      lines.push(`  facet normal ${nx} ${ny} ${nz}`);
      lines.push(`    outer loop`);
      lines.push(`      vertex ${a[0]} ${a[1]} ${a[2]}`);
      lines.push(`      vertex ${b[0]} ${b[1]} ${b[2]}`);
      lines.push(`      vertex ${c[0]} ${c[1]} ${c[2]}`);
      lines.push(`    endloop`);
      lines.push(`  endfacet`);
    }
  }
  lines.push(`endsolid ${name}`);
  return lines.join('\n');
}

export function exportSTL(pts: ReadonlyArray<Planckton>, filename = 'plancktons.stl'): void {
  const stl = plancktonsToSTL(pts);
  downloadBlob(new Blob([stl], { type: 'model/stl' }), filename);
}

// ------------------------------- JSON --------------------------------------

/**
 * Serialized assembly schema, v2:
 *   {
 *     version: 2,
 *     L: number,                           // edge length used in the simulation
 *     seed: number,                        // PRNG seed
 *     chiralityBias: number,               // ∈ [0, 1], fraction right-handed
 *     strategy: 'uniform' | 'compact',
 *     compactBeta: number,                 // inverse-temperature (compact only)
 *     N: number,                           // tets.length
 *     tets: [{ chirality: 'R'|'L', verts: [Vec3,Vec3,Vec3,Vec3] }, …]
 *   }
 * v1 omitted compactBeta - readers should treat absence as 3 (the default).
 */
export function exportAssemblyJSON(a: Assembly, filename = 'plancktons.json'): void {
  const payload = {
    version: 2,
    provenance: provenance(),
    algorithmVersion: ALGORITHM_VERSION,
    L: a.opts.L,
    seed: a.opts.rng.seed,
    chiralityBias: a.opts.chiralityBias,
    strategy: a.opts.strategy,
    compactBeta: a.opts.compactBeta ?? 3,
    N: a.tets.length,
    tets: a.tets.map((t) => ({ chirality: t.chirality, verts: t.verts })),
  };
  downloadBlob(
    new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' }),
    filename
  );
}

// ------------------------------- PNG ---------------------------------------

export function takeScreenshot(filename = 'plancktons.png'): void {
  const canvas = document.querySelector<HTMLCanvasElement>('canvas');
  if (!canvas) {
    alert('Screenshot failed: no canvas mounted.');
    return;
  }
  canvas.toBlob((blob) => {
    if (!blob) {
      alert('Screenshot failed: browser refused to encode the canvas.');
      return;
    }
    downloadBlob(blob, filename);
  }, 'image/png');
}

function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

// --------------------------- URL hash state --------------------------------

export type ShareMode = 'learn' | 'explore' | 'research';
export type ShareScene = 'single' | 'cube' | 'reptile' | 'growth' | 'vacuum';
export type ShareStrategy = 'uniform' | 'compact';
const SHARE_MODES: ReadonlySet<ShareMode> = new Set(['learn', 'explore', 'research']);
const SHARE_SCENES: ReadonlySet<ShareScene> = new Set([
  'single',
  'cube',
  'reptile',
  'growth',
  'vacuum',
]);
const SHARE_STRATEGIES: ReadonlySet<ShareStrategy> = new Set(['uniform', 'compact']);

function numIn(v: unknown, min: number, max: number, fallback: number): number {
  return typeof v === 'number' && Number.isFinite(v) ? Math.max(min, Math.min(max, v)) : fallback;
}
function intIn(v: unknown, min: number, max: number, fallback: number): number {
  return Math.round(numIn(v, min, max, fallback));
}

interface SnapshotState {
  scene: ShareScene;
  singleChirality: 'R' | 'L';
  cubeExplode: number;
  reptileExplode: number;
  reptileDepth: number;
  growth: { N: number; seed: number; chiralityBias: number; strategy: string; compactBeta: number };
  vacuum: {
    N: number;
    seed: number;
    chiralityBias: number;
    contractionRate: number;
    restitution: number;
  };
  mode: ShareMode;
}

export function encodeStateToHash(state: SnapshotState): string {
  const payload = {
    s: state.scene,
    sc: state.singleChirality,
    ce: state.cubeExplode,
    re: state.reptileExplode,
    rd: state.reptileDepth,
    g: {
      N: state.growth.N,
      sd: state.growth.seed,
      cb: state.growth.chiralityBias,
      st: state.growth.strategy,
      b: state.growth.compactBeta,
    },
    v: {
      N: state.vacuum.N,
      sd: state.vacuum.seed,
      cb: state.vacuum.chiralityBias,
      cr: state.vacuum.contractionRate,
      rs: state.vacuum.restitution,
    },
    m: state.mode,
  };
  const json = JSON.stringify(payload);
  const b64 = btoa(json);
  const url = new URL(window.location.href);
  url.hash = b64;
  return url.toString();
}

export function decodeStateFromHash(): Partial<SnapshotState> | null {
  if (!window.location.hash) return null;
  try {
    const json = atob(window.location.hash.slice(1));
    const p = JSON.parse(json) as {
      s?: string;
      sc?: 'R' | 'L';
      ce?: number;
      re?: number;
      rd?: number;
      g?: { N?: number; sd?: number; cb?: number; st?: string; b?: number };
      v?: { N?: number; sd?: number; cb?: number; cr?: number; rs?: number };
      m?: string;
      a?: boolean;
    };
    const result: Partial<SnapshotState> = {};
    if (p.s && SHARE_SCENES.has(p.s as ShareScene)) result.scene = p.s as ShareScene;
    if (p.sc === 'R' || p.sc === 'L') result.singleChirality = p.sc;
    if (typeof p.ce === 'number' && Number.isFinite(p.ce)) {
      result.cubeExplode = Math.max(0, Math.min(1, p.ce));
    }
    if (typeof p.re === 'number' && Number.isFinite(p.re)) {
      result.reptileExplode = Math.max(0, Math.min(1, p.re));
    }
    if (typeof p.rd === 'number' && Number.isFinite(p.rd)) {
      result.reptileDepth = intIn(p.rd, 1, 3, 1);
    }
    if (p.g) {
      const strategy: ShareStrategy = SHARE_STRATEGIES.has(p.g.st as ShareStrategy)
        ? (p.g.st as ShareStrategy)
        : 'uniform';
      result.growth = {
        N: intIn(p.g.N, 1, 2000, 20),
        seed: intIn(p.g.sd, 0, Number.MAX_SAFE_INTEGER, 1),
        chiralityBias: numIn(p.g.cb, 0, 1, 0.5),
        strategy,
        compactBeta: numIn(p.g.b, 0, 20, 3),
      };
    }
    if (p.v) {
      result.vacuum = {
        N: intIn(p.v.N, 2, 150, 40),
        seed: intIn(p.v.sd, 0, Number.MAX_SAFE_INTEGER, 1),
        chiralityBias: numIn(p.v.cb, 0, 1, 0.5),
        contractionRate: numIn(p.v.cr, 0.2, 4, 1.5),
        restitution: numIn(p.v.rs, 0, 0.6, 0),
      };
    }
    if (p.m && SHARE_MODES.has(p.m as ShareMode)) {
      result.mode = p.m as ShareMode;
    } else if (p.a === true) {
      result.mode = 'research';
    } else if (p.a === false) {
      result.mode = 'learn';
    }
    return result;
  } catch (err) {
    console.warn('decodeStateFromHash: invalid hash', err);
    return null;
  }
}
