import { useEffect, useState } from 'react';
import { SceneCanvas } from './scenes/SceneCanvas.js';
import { Controls } from './ui/Controls.js';
import { Actions } from './ui/Actions.js';
import { Research } from './ui/Research.js';
import { ModeSwitch } from './ui/ModeSwitch.js';
import { MetricsPanel } from './ui/MetricsPanel.js';
import { Transport } from './ui/Transport.js';
import { HelpOverlay } from './ui/HelpOverlay.js';
import { FirstVisitToast } from './ui/FirstVisitToast.js';
import { ErrorBoundary } from './ui/ErrorBoundary.js';
import { ResizableSidebar } from './ui/ResizableSidebar.js';
import { useKeyboardShortcuts } from './ui/useKeyboard.js';
import { useUiStore } from './ui/uiStore.js';
import type { GrowthMetrics } from './scenes/GrowthScene.js';
import type { VacuumHudMetrics } from './scenes/VacuumScene.js';
import { decodeStateFromHash } from './lib/exports.js';
import { useStore } from './lib/store.js';
import './App.css';

function applyHashStateOnce(): boolean {
  const hadHash = !!window.location.hash;
  const s = decodeStateFromHash();
  if (!s) {
    if (hadHash) console.warn('Share link was invalid; using defaults.');
    return false;
  }
  const store = useStore.getState();
  if (s.scene) store.setScene(s.scene);
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
  if (s.vacuum) {
    store.setVacuum({
      N: s.vacuum.N,
      seed: s.vacuum.seed,
      chiralityBias: s.vacuum.chiralityBias,
      contractionRate: s.vacuum.contractionRate,
      restitution: s.vacuum.restitution,
    });
  }
  if (s.mode) store.setMode(s.mode);
  return hadHash;
}

export default function App() {
  const [metrics, setMetrics] = useState<GrowthMetrics | null>(null);
  const [vacMetrics, setVacMetrics] = useState<VacuumHudMetrics | null>(null);
  useKeyboardShortcuts();
  useEffect(() => {
    applyHashStateOnce();
  }, []);
  return (
    <div className="app">
      <header className="topbar">
        <div className="title">
          <span
            className="title-main"
            title="Plancktons - colloquial name for Hill orthoschemes, the right-tetrahedra that tile space."
          >
            Plancktons
          </span>
          <span
            className="title-sub"
            title="Interactive study of random aggregation and packing density for Hill T₁ orthoschemes."
          >
            Planckton packing - a Hill T₁ orthoscheme study
          </span>
        </div>
        <div className="topbar-right">
          <ModeSwitch />
          <HelpButton />
          <Actions />
        </div>
      </header>
      <div className="layout">
        <ResizableSidebar>
          <Controls />
          <Research />
        </ResizableSidebar>
        <main className="canvas-wrap">
          <ErrorBoundary>
            <SceneCanvas onMetrics={setMetrics} onVacuumMetrics={setVacMetrics} />
          </ErrorBoundary>
          <Transport metrics={metrics} vacuum={vacMetrics} />
        </main>
        <MetricsPanel metrics={metrics} vacuum={vacMetrics} />
      </div>
      <HelpOverlay />
      <FirstVisitToast />
    </div>
  );
}

function HelpButton() {
  const setOpen = useUiStore((s) => s.setHelpOpen);
  return (
    <button
      type="button"
      className="help-button"
      onClick={() => setOpen(true)}
      title="Help & glossary"
      aria-label="Open help"
    >
      ?
    </button>
  );
}
