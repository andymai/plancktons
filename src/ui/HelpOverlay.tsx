import { useEffect, useRef, useState, type MouseEvent as ReactMouseEvent } from 'react';
import { useStore } from '../lib/store.js';
import type { SceneId } from '../lib/store.js';
import { GLOSSARY } from './glossary.js';
import { useUiStore } from './uiStore.js';
import { useRadioGroup } from './useRadioGroup.js';

type Tab = 'glossary' | 'concepts' | 'scene';
const TAB_ORDER = ['scene', 'concepts', 'glossary'] as const satisfies readonly Tab[];

const SCENE_PRIMER: Record<SceneId, { title: string; body: string }> = {
  single: {
    title: 'Single Planckton',
    body: 'You are looking at one Hill T₁ orthoscheme — a right-tetrahedron. Toggle "Show dihedral angles" to label each edge with its rational-π angle (π/2, π/3, π/4). Their sum, weighted by edge length, is the Dehn invariant — and it collapses to zero.',
  },
  cube: {
    title: 'Three cubes, one shape',
    body: 'A cube can be dissected into 6 Hill orthoschemes in more than one way. The middle cube (3 R · 3 L) is the classical main-diagonal dissection — pure scissors-congruence, but NOT realizable from a single HT decomposition. The flanking cubes (2 R · 4 L and 4 R · 2 L) are what physical Plancktons drawn from one HT decomposition can build: a "mostly-L" half-prism doubled gives 2 R · 4 L; the mirror gives 4 R · 2 L. Each HT cube = 2 × (1 R + 2 L half-prism). Explode slider pulls all three apart in unison.',
  },
  reptile: {
    title: '8-reptile dissection',
    body: 'Each Planckton splits into 8 unit-scale copies of itself. Recursing d times gives 8^d sub-Plancktons. Matoušek & Safernová (2010) proved this is the only such self-similar dissection family for tetrahedra.',
  },
  growth: {
    title: 'Random face-to-face growth',
    body: 'Each step picks a free face at random and glues a fresh Planckton onto a congruent face. A separating-axis test guarantees no overlap. Compact strategy biases toward concave pockets — tighter packings, earlier jamming. Metrics: η_C (hull) tells you how compact the cluster looks; η_B (bbox) is the literature-comparable density.',
  },
  vacuum: {
    title: 'Vacuum-bag compaction',
    body: 'N loose tetrahedra are dropped into a bag and squeezed into a jammed random packing as a contracting wall "sucks the air out" — a deterministic, frictionless 6-DOF rigid-body settle (same seed → same packing). Unlike face-to-face growth, tets here are free-floating and only touch where the physics pushes them together. Press "Pack it" to run the settle, then scrub the timeline to replay the air being drawn out. The wrinkled skin is the morphological hull (η_M) of the sealed pack; η_B is the literature-comparable density.',
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
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const backdropDownRef = useRef(false);
  const getTabRadioProps = useRadioGroup(TAB_ORDER, tab, setTab);

  useEffect(() => {
    if (!open) return;
    const dialog = dialogRef.current;
    if (!dialog) return;
    const prevFocus = document.activeElement as HTMLElement | null;

    const focusables = () =>
      Array.from(
        dialog.querySelectorAll<HTMLElement>(
          'button:not(:disabled), [tabindex]:not([tabindex="-1"]), a[href]'
        )
      );
    focusables()[0]?.focus();

    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        setOpen(false);
        return;
      }
      if (e.key !== 'Tab') return;
      const list = focusables();
      if (list.length === 0) return;
      const first = list[0]!;
      const last = list[list.length - 1]!;
      const active = document.activeElement;
      if (e.shiftKey && active === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      }
    }
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      prevFocus?.focus?.();
    };
  }, [open, setOpen]);

  if (!open) return null;

  // Track whether the press-and-release pair both happen on the backdrop;
  // otherwise a drag that starts inside the dialog and releases on the
  // backdrop would close the modal — annoying for text selection.
  function onBackdropPointerDown(e: ReactMouseEvent) {
    if (e.target === e.currentTarget) backdropDownRef.current = true;
  }
  function onBackdropClick(e: ReactMouseEvent) {
    if (backdropDownRef.current && e.target === e.currentTarget) setOpen(false);
    backdropDownRef.current = false;
  }

  return (
    <div
      className="overlay-backdrop"
      onMouseDown={onBackdropPointerDown}
      onClick={onBackdropClick}
      role="presentation"
    >
      <div
        ref={dialogRef}
        className="help-overlay"
        role="dialog"
        aria-modal="true"
        aria-label="Help"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="help-header">
          <div className="help-tabs" role="tablist">
            {TAB_ORDER.map((id) => (
              <TabButton
                key={id}
                id={id}
                active={tab}
                onSelect={setTab}
                label={TAB_LABEL[id]}
                radioProps={getTabRadioProps(id)}
              />
            ))}
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
        <div
          className="help-body"
          role="tabpanel"
          id={`help-tabpanel-${tab}`}
          aria-labelledby={`help-tab-${tab}`}
        >
          {tab === 'scene' && <SceneTab scene={scene} />}
          {tab === 'concepts' && <ConceptsTab />}
          {tab === 'glossary' && <GlossaryTab />}
        </div>
      </div>
    </div>
  );
}

const TAB_LABEL: Record<Tab, string> = {
  scene: 'What am I looking at?',
  concepts: 'Concepts',
  glossary: 'Glossary',
};

function TabButton({
  id,
  active,
  onSelect,
  label,
  radioProps,
}: {
  id: Tab;
  active: Tab;
  onSelect: (t: Tab) => void;
  label: string;
  radioProps: ReturnType<ReturnType<typeof useRadioGroup<Tab>>>;
}) {
  const isActive = active === id;
  return (
    <button
      type="button"
      role="tab"
      id={`help-tab-${id}`}
      aria-selected={isActive}
      aria-controls={`help-tabpanel-${id}`}
      className={`help-tab ${isActive ? 'active' : ''}`}
      onClick={() => onSelect(id)}
      {...radioProps}
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
