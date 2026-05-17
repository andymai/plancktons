import { useEffect, useRef, useState } from 'react';
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
    showToast('Link copied');
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

  function downloadSTL() {
    const a = buildCurrentAssembly();
    if (a) exportSTL(a.tets, 'plancktons.stl');
  }

  function downloadJSON() {
    const a = buildCurrentAssembly();
    if (a) exportAssemblyJSON(a, 'plancktons.json');
  }

  return (
    <div className="actions">
      <button
        onClick={() => copyShareLink()}
        title="Copy a shareable URL with the current parameters"
      >
        Share link
      </button>
      <ExportMenu
        onPng={() => takeScreenshot()}
        onStl={downloadSTL}
        onJson={downloadJSON}
        sceneIsGrowth={scene === 'growth'}
      />
      <a
        href="https://github.com/andymai/plancktons"
        target="_blank"
        rel="noopener noreferrer"
        className="action-link action-link-github"
        title="View source on GitHub"
        aria-label="GitHub repository"
      >
        <GitHubIcon />
      </a>
    </div>
  );
}

function GitHubIcon() {
  return (
    <svg width={16} height={16} viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
      <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2 .37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.012 8.012 0 0 0 16 8c0-4.42-3.58-8-8-8z" />
    </svg>
  );
}

function ExportMenu({
  onPng,
  onStl,
  onJson,
  sceneIsGrowth,
}: {
  onPng: () => void;
  onStl: () => void;
  onJson: () => void;
  sceneIsGrowth: boolean;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  function fire(fn: () => void) {
    fn();
    setOpen(false);
  }

  return (
    <div className="export-menu" ref={rootRef}>
      <button
        type="button"
        className="export-menu-toggle"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        title="Download the current state"
      >
        Export ▾
      </button>
      {open && (
        <div className="export-menu-list" role="menu">
          <button role="menuitem" type="button" onClick={() => fire(onPng)}>
            PNG (canvas screenshot)
          </button>
          <button
            role="menuitem"
            type="button"
            onClick={() => fire(onStl)}
            disabled={!sceneIsGrowth}
            title={sceneIsGrowth ? '' : 'STL is only available for the growth scene'}
          >
            STL (mesh)
          </button>
          <button
            role="menuitem"
            type="button"
            onClick={() => fire(onJson)}
            disabled={!sceneIsGrowth}
            title={sceneIsGrowth ? '' : 'JSON is only available for the growth scene'}
          >
            JSON (assembly state)
          </button>
        </div>
      )}
    </div>
  );
}
