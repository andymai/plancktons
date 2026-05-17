import type { Planckton } from './planckton.js';
import type { Assembly } from './assembly.js';
import type { Vec3 } from './vec.js';
import { cross, sub } from './vec.js';

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

interface SnapshotState {
  scene: string;
  singleChirality: 'R' | 'L';
  cubeExplode: number;
  reptileExplode: number;
  reptileDepth: number;
  growth: { N: number; seed: number; chiralityBias: number; strategy: string; compactBeta: number };
  advanced: boolean;
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
    a: state.advanced,
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
      a?: boolean;
    };
    const result: Partial<SnapshotState> = {};
    if (p.s) result.scene = p.s;
    if (p.sc) result.singleChirality = p.sc;
    if (typeof p.ce === 'number') result.cubeExplode = p.ce;
    if (typeof p.re === 'number') result.reptileExplode = p.re;
    if (typeof p.rd === 'number') result.reptileDepth = p.rd;
    if (p.g) {
      result.growth = {
        N: p.g.N ?? 20,
        seed: p.g.sd ?? 1,
        chiralityBias: p.g.cb ?? 0.5,
        strategy: p.g.st ?? 'uniform',
        compactBeta: p.g.b ?? 3,
      };
    }
    if (typeof p.a === 'boolean') result.advanced = p.a;
    return result;
  } catch (err) {
    console.warn('decodeStateFromHash: invalid hash', err);
    return null;
  }
}
