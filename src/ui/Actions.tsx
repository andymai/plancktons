import { useStore } from '../lib/store.js';
import {
  encodeStateToHash,
  exportAssemblyJSON,
  exportSTL,
  takeScreenshot,
} from '../lib/exports.js';
import { Rng } from '../lib/rng.js';
import { growOne, makeAssembly } from '../lib/assembly.js';

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
    });
    while (a.tets.length < growth.N && growOne(a)) {
      // empty
    }
    return a;
  }

  return (
    <div className="actions">
      <button
        onClick={() => {
          const url = encodeStateToHash(useStore.getState());
          navigator.clipboard?.writeText(url).catch(() => {});
          const el = document.createElement('div');
          el.textContent = '🔗 link copied!';
          el.className = 'toast';
          document.body.appendChild(el);
          setTimeout(() => el.remove(), 1800);
        }}
        title="Copy a shareable URL with the current parameters"
      >
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
