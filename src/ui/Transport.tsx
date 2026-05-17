import type { GrowthMetrics } from '../scenes/GrowthScene.js';
import { useStore } from '../lib/store.js';

const DEFAULT_RESUME_SPEED = 12;

export function Transport({ metrics }: { metrics: GrowthMetrics | null }) {
  const scene = useStore((s) => s.scene);
  const animationMode = useStore((s) => s.animationMode);
  const animSpeed = useStore((s) => s.animSpeed);
  const setAnimSpeed = useStore((s) => s.setAnimSpeed);
  const growth = useStore((s) => s.growth);
  const bumpStep = useStore((s) => s.bumpStep);
  const bumpReset = useStore((s) => s.bumpReset);
  const bumpJumpEnd = useStore((s) => s.bumpJumpEnd);

  if (scene !== 'growth') return null;

  const currentN = metrics?.N ?? 0;
  const targetN = growth.N;
  const playing = animSpeed > 0;
  const pct = targetN > 0 ? (100 * currentN) / targetN : 0;

  const togglePlay = () => setAnimSpeed(playing ? 0 : DEFAULT_RESUME_SPEED);

  return (
    <div className="transport" role="region" aria-label="Growth playback">
      <button
        type="button"
        className="transport-btn"
        onClick={bumpReset}
        title="Restart from N=1"
        aria-label="Restart from N=1"
      >
        ⏮
      </button>
      {animationMode === 'animated' && (
        <button
          type="button"
          className="transport-btn transport-play"
          onClick={togglePlay}
          title={playing ? 'Pause (Space)' : 'Play (Space)'}
          aria-label={playing ? 'Pause' : 'Play'}
          aria-pressed={playing}
        >
          {playing ? '⏸' : '▶'}
        </button>
      )}
      {animationMode === 'step' && (
        <button
          type="button"
          className="transport-btn"
          onClick={bumpStep}
          title="Add one Planckton (Space)"
          aria-label="Add one Planckton"
        >
          +1
        </button>
      )}
      <button
        type="button"
        className="transport-btn"
        onClick={bumpJumpEnd}
        title={`Jump to N=${targetN}`}
        aria-label={`Jump to N=${targetN}`}
      >
        ⏭
      </button>
      <div className="transport-progress" aria-hidden="true">
        <div className="transport-progress-fill" style={{ width: `${pct}%` }} />
      </div>
      <span className="transport-counter" role="status" aria-live="polite">
        N: {currentN} / {targetN}
        {metrics?.stalled && currentN < targetN ? ' · stalled' : ''}
      </span>
    </div>
  );
}
