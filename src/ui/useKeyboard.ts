import { useEffect } from 'react';
import { useStore } from '../lib/store.js';

/**
 * Global keyboard shortcuts:
 *   Space         play/pause (animated mode) or step (step mode)
 *   R             randomize seed
 *   N             next seed (seed + 1)
 *   ←/→           cycle scenes
 *   1/2/3/4       jump to scene
 *   ?             toggle advanced mode
 *
 * Skipped when a text input has focus.
 */
const SCENES = ['single', 'cube', 'reptile', 'growth'] as const;

export function useKeyboardShortcuts() {
  const setScene = useStore((s) => s.setScene);
  const setGrowth = useStore((s) => s.setGrowth);
  const setAnimSpeed = useStore((s) => s.setAnimSpeed);
  const setAnimationMode = useStore((s) => s.setAnimationMode);
  const bumpStep = useStore((s) => s.bumpStep);
  const setAdvanced = useStore((s) => s.setAdvanced);

  useEffect(() => {
    function handler(e: KeyboardEvent) {
      const target = e.target as HTMLElement | null;
      const tag = target?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target?.isContentEditable) {
        return;
      }
      const st = useStore.getState();
      switch (e.key) {
        case ' ':
          if (st.scene !== 'growth') return;
          if (st.animationMode === 'animated') {
            setAnimSpeed(st.animSpeed === 0 ? 4 : 0);
          } else if (st.animationMode === 'step') {
            bumpStep();
          }
          e.preventDefault();
          break;
        case 'r':
        case 'R':
          if (st.scene === 'growth') setGrowth({ seed: Math.floor(Math.random() * 1e6) });
          break;
        case 'n':
        case 'N':
          if (st.scene === 'growth') setGrowth({ seed: st.growth.seed + 1 });
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
          setScene(SCENES[parseInt(e.key, 10) - 1]!);
          break;
        case '?':
          setAdvanced(!st.advanced);
          break;
        case 'a':
        case 'A':
          if (st.scene === 'growth') {
            setAnimationMode(
              st.animationMode === 'instant'
                ? 'animated'
                : st.animationMode === 'animated'
                  ? 'step'
                  : 'instant'
            );
          }
          break;
      }
    }
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [setScene, setGrowth, setAnimSpeed, setAnimationMode, bumpStep, setAdvanced]);
}
