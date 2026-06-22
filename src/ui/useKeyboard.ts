import { useEffect } from 'react';
import { useStore, MODE_ORDER } from '../lib/store.js';
import type { AnimationMode } from '../lib/store.js';

const SCENES = ['single', 'cube', 'reptile', 'growth', 'vacuum'] as const;
const ANIMATION_CYCLE: readonly AnimationMode[] = ['instant', 'animated', 'step'] as const;

function nextAnimationMode(m: AnimationMode): AnimationMode {
  const i = ANIMATION_CYCLE.indexOf(m);
  return ANIMATION_CYCLE[(i + 1) % ANIMATION_CYCLE.length]!;
}

export function useKeyboardShortcuts() {
  const setScene = useStore((s) => s.setScene);
  const setGrowth = useStore((s) => s.setGrowth);
  const setVacuum = useStore((s) => s.setVacuum);
  const togglePlay = useStore((s) => s.togglePlay);
  const setAnimationMode = useStore((s) => s.setAnimationMode);
  const bumpStep = useStore((s) => s.bumpStep);
  const setMode = useStore((s) => s.setMode);

  useEffect(() => {
    function handler(e: KeyboardEvent) {
      const target = e.target as HTMLElement | null;
      const tag = target?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target?.isContentEditable) {
        return;
      }
      // Suppress global shortcuts while a modal is open so Arrow/Space/R/N
      // can't mutate the underlying scene/seed/mode from inside the dialog.
      if (target?.closest('.overlay-backdrop, .export-menu-list')) return;
      const st = useStore.getState();
      switch (e.key) {
        case ' ':
          if (st.scene === 'vacuum') {
            togglePlay();
            e.preventDefault();
            break;
          }
          if (st.scene !== 'growth') return;
          if (st.animationMode === 'animated') togglePlay();
          else if (st.animationMode === 'step') bumpStep();
          e.preventDefault();
          break;
        case 'r':
        case 'R':
          if (st.scene === 'growth') setGrowth({ seed: Math.floor(Math.random() * 1e6) });
          else if (st.scene === 'vacuum') setVacuum({ seed: Math.floor(Math.random() * 1e6) });
          break;
        case 'n':
        case 'N':
          if (st.scene === 'growth') setGrowth({ seed: st.growth.seed + 1 });
          else if (st.scene === 'vacuum') setVacuum({ seed: st.vacuum.seed + 1 });
          break;
        case 'ArrowRight': {
          const i = SCENES.indexOf(st.scene);
          setScene(SCENES[(i + 1) % SCENES.length]!);
          break;
        }
        case 'ArrowLeft': {
          const i = SCENES.indexOf(st.scene);
          setScene(SCENES[(i - 1 + SCENES.length) % SCENES.length]!);
          break;
        }
        case '1':
        case '2':
        case '3':
        case '4':
        case '5':
          setScene(SCENES[parseInt(e.key, 10) - 1]!);
          break;
        case '?': {
          const i = MODE_ORDER.indexOf(st.mode);
          setMode(MODE_ORDER[(i + 1) % MODE_ORDER.length]!);
          break;
        }
        case 'a':
        case 'A':
          if (st.scene === 'growth') setAnimationMode(nextAnimationMode(st.animationMode));
          break;
      }
    }
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [setScene, setGrowth, setVacuum, togglePlay, setAnimationMode, bumpStep, setMode]);
}
