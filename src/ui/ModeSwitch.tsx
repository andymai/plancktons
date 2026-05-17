import { useStore } from '../lib/store.js';
import type { Mode } from '../lib/store.js';

const OPTIONS: { id: Mode; label: string; hint: string }[] = [
  {
    id: 'learn',
    label: 'Learn',
    hint: 'Minimal UI — scene + essential parameters. Use the ? button for help.',
  },
  {
    id: 'explore',
    label: 'Explore',
    hint: 'Adds display tweaks (colors, hull, ellipsoid) and full HUD metrics.',
  },
  {
    id: 'research',
    label: 'Research',
    hint: 'Adds histograms, η-vs-N sweeps, pair correlation, kinetics, MC refinement.',
  },
];

export function ModeSwitch() {
  const mode = useStore((s) => s.mode);
  const setMode = useStore((s) => s.setMode);
  return (
    <div className="mode-switch" role="radiogroup" aria-label="Disclosure mode">
      {OPTIONS.map((o) => (
        <button
          key={o.id}
          type="button"
          role="radio"
          aria-checked={mode === o.id}
          className={`mode-button ${mode === o.id ? 'active' : ''}`}
          onClick={() => setMode(o.id)}
          title={o.hint}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
