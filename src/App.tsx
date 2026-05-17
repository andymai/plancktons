import { useEffect, useState } from 'react';
import { SceneCanvas } from './scenes/SceneCanvas.js';
import { Controls } from './ui/Controls.js';
import { HUD } from './ui/HUD.js';
import { Actions } from './ui/Actions.js';
import { Research } from './ui/Research.js';
import type { GrowthMetrics } from './scenes/GrowthScene.js';
import { decodeStateFromHash } from './lib/exports.js';
import { useStore } from './lib/store.js';
import './App.css';

function applyHashStateOnce() {
  const hadHash = !!window.location.hash;
  const s = decodeStateFromHash();
  if (!s) {
    if (hadHash) console.warn('Share link was invalid; using defaults.');
    return;
  }
  const store = useStore.getState();
  if (s.scene) store.setScene(s.scene as 'single' | 'cube' | 'reptile' | 'growth');
  if (s.singleChirality) store.setSingleChirality(s.singleChirality);
  if (typeof s.cubeExplode === 'number') store.setCubeExplode(s.cubeExplode);
  if (typeof s.reptileExplode === 'number') store.setReptileExplode(s.reptileExplode);
  if (typeof s.reptileDepth === 'number') store.setReptileDepth(s.reptileDepth);
  if (s.growth) {
    store.setGrowth({
      N: s.growth.N,
      seed: s.growth.seed,
      chiralityBias: s.growth.chiralityBias,
      strategy: s.growth.strategy as 'uniform' | 'compact',
      compactBeta: s.growth.compactBeta,
    });
  }
  if (typeof s.advanced === 'boolean') store.setAdvanced(s.advanced);
}

export default function App() {
  const [metrics, setMetrics] = useState<GrowthMetrics | null>(null);
  useEffect(() => {
    applyHashStateOnce();
  }, []);
  return (
    <div className="app">
      <header className="topbar">
        <div className="title">
          <span className="title-main">Plancktons</span>
          <span className="title-sub">
            Hill tetrahedra — interactive study of face-to-face assemblies
          </span>
        </div>
        <Actions />
      </header>
      <div className="layout">
        <aside className="sidebar">
          <Controls />
          <Research />
        </aside>
        <main className="canvas-wrap">
          <SceneCanvas onMetrics={setMetrics} />
          <HUD metrics={metrics} />
        </main>
      </div>
    </div>
  );
}
