import { useEffect, useState } from 'react';
import { useStore } from '../lib/store.js';
import type { SceneId } from '../lib/store.js';
import { GLOSSARY } from './glossary.js';
import { useUiStore } from './uiStore.js';

type Tab = 'glossary' | 'concepts' | 'scene';

const SCENE_PRIMER: Record<SceneId, { title: string; body: string }> = {
  single: {
    title: 'Single Planckton',
    body: 'You are looking at one Hill T₁ orthoscheme — a right-tetrahedron. Toggle "Show dihedral angles" to label each edge with its rational-π angle (π/2, π/3, π/4). Their sum, weighted by edge length, is the Dehn invariant — and it collapses to zero.',
  },
  cube: {
    title: 'Cube tiling',
    body: 'Six Plancktons (3 right-handed, 3 left-handed) tile a cube exactly — the η = 1 reference. The "Explode" slider pulls the pieces apart; auto-play animates the dissection so you can see scissors-congruence in motion.',
  },
  reptile: {
    title: '8-reptile dissection',
    body: 'Each Planckton splits into 8 unit-scale copies of itself. Recursing d times gives 8^d sub-Plancktons. Matoušek & Safernová (2010) proved this is the only such self-similar dissection family for tetrahedra.',
  },
  growth: {
    title: 'Random face-to-face growth',
    body: 'Each step picks a free face at random and glues a fresh Planckton onto a congruent face. A separating-axis test guarantees no overlap. Compact strategy biases toward concave pockets — tighter packings, earlier jamming. Metrics: η_C (hull) tells you how compact the cluster looks; η_B (bbox) is the literature-comparable density.',
  },
};

const CONCEPTS = [
  'planckton',
  'hillT1',
  'dehnInvariant',
  'scissorsCongruence',
  'reptile',
  'etaC',
  'etaB',
  'avrami',
  'bondOrder',
] as const;

export function HelpOverlay() {
  const open = useUiStore((s) => s.helpOpen);
  const setOpen = useUiStore((s) => s.setHelpOpen);
  const scene = useStore((s) => s.scene);
  const [tab, setTab] = useState<Tab>('scene');

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, setOpen]);

  if (!open) return null;

  return (
    <div className="overlay-backdrop" onClick={() => setOpen(false)} role="presentation">
      <div
        className="help-overlay"
        role="dialog"
        aria-modal="true"
        aria-label="Help"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="help-header">
          <div className="help-tabs" role="tablist">
            <TabButton id="scene" active={tab} onSelect={setTab} label="What am I looking at?" />
            <TabButton id="concepts" active={tab} onSelect={setTab} label="Concepts" />
            <TabButton id="glossary" active={tab} onSelect={setTab} label="Glossary" />
          </div>
          <button
            type="button"
            className="help-close"
            onClick={() => setOpen(false)}
            aria-label="Close help"
            title="Close (Esc)"
          >
            ×
          </button>
        </header>
        <div className="help-body">
          {tab === 'scene' && <SceneTab scene={scene} />}
          {tab === 'concepts' && <ConceptsTab />}
          {tab === 'glossary' && <GlossaryTab />}
        </div>
      </div>
    </div>
  );
}

function TabButton({
  id,
  active,
  onSelect,
  label,
}: {
  id: Tab;
  active: Tab;
  onSelect: (t: Tab) => void;
  label: string;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active === id}
      className={`help-tab ${active === id ? 'active' : ''}`}
      onClick={() => onSelect(id)}
    >
      {label}
    </button>
  );
}

function SceneTab({ scene }: { scene: SceneId }) {
  const primer = SCENE_PRIMER[scene];
  return (
    <div>
      <h3>{primer.title}</h3>
      <p>{primer.body}</p>
    </div>
  );
}

function ConceptsTab() {
  return (
    <div>
      {CONCEPTS.map((k) => {
        const e = GLOSSARY[k];
        if (!e) return null;
        return (
          <section key={k} className="help-section">
            <h4>{e.shortLabel}</h4>
            <p>{e.body}</p>
          </section>
        );
      })}
    </div>
  );
}

function GlossaryTab() {
  const keys = Object.keys(GLOSSARY).sort((a, b) =>
    GLOSSARY[a]!.shortLabel.localeCompare(GLOSSARY[b]!.shortLabel)
  );
  return (
    <dl className="glossary-list">
      {keys.map((k) => {
        const e = GLOSSARY[k]!;
        return (
          <div key={k} className="glossary-row">
            <dt>{e.shortLabel}</dt>
            <dd>{e.body}</dd>
          </div>
        );
      })}
    </dl>
  );
}
