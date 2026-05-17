import { useStore } from '../lib/store.js';
import {
  encodeStateToHash,
  exportAssemblyJSON,
  exportSTL,
  takeScreenshot,
} from '../lib/exports.js';
import { Rng } from '../lib/rng.js';
import { growOne, makeAssembly } from '../lib/assembly.js';

function showToast(text: string, kind: 'ok' | 'warn' = 'ok') {
  const el = document.createElement('div');
  el.textContent = text;
  el.className = `toast ${kind === 'warn' ? 'toast-warn' : ''}`;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 1800);
}

async function copyShareLink() {
  const url = encodeStateToHash(useStore.getState());
  try {
    if (!navigator.clipboard) throw new Error('Clipboard API unavailable');
    await navigator.clipboard.writeText(url);
    showToast('🔗 link copied!');
  } catch {
    window.prompt('Copy this URL:', url);
  }
}

export function Actions() {
  const scene = useStore((s) => s.scene);
  const growth = useStore((s) => s.growth);

  function buildCurrentAssembly() {
    if (scene !== 'growth') return null;
    const a = makeAssembly({
      L: 1,
      rng: new Rng(growth.seed),
      chiralityBias: growth.chiralityBias,
      strategy: growth.strategy,
      compactBeta: growth.compactBeta,
    });
    while (a.tets.length < growth.N) {
      if (growOne(a) !== 'grown') break;
    }
    return a;
  }

  return (
    <div className="actions">
      <button onClick={() => copyShareLink()} title="Copy a shareable URL with the current parameters">
        🔗 Share link
      </button>
      <button onClick={() => takeScreenshot()} title="Save the canvas as PNG">
        📸 PNG
      </button>
      <button
        onClick={() => {
          const a = buildCurrentAssembly();
          if (a) exportSTL(a.tets, 'plancktons.stl');
        }}
        disabled={scene !== 'growth'}
        title="Export the assembly as an STL mesh"
      >
        🧊 STL
      </button>
      <button
        onClick={() => {
          const a = buildCurrentAssembly();
          if (a) exportAssemblyJSON(a, 'plancktons.json');
        }}
        disabled={scene !== 'growth'}
        title="Save the assembly as JSON"
      >
        💾 JSON
      </button>
    </div>
  );
}
