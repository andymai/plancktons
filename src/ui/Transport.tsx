import { useEffect, useRef } from 'react';
import type { GrowthMetrics } from '../scenes/GrowthScene.js';
import { useStore } from '../lib/store.js';
import { PauseIcon, PlayIcon, PlusOneIcon, SkipBackIcon, SkipForwardIcon } from './icons.js';

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

  const lastSpeedRef = useRef(DEFAULT_RESUME_SPEED);
  useEffect(() => {
    if (animSpeed > 0) lastSpeedRef.current = animSpeed;
  }, [animSpeed]);

  if (scene !== 'growth') return null;

  const currentN = metrics?.N ?? 0;
  const targetN = growth.N;
  const playing = animSpeed > 0;
  const atEnd = currentN >= targetN;
  const pct = targetN > 0 ? (100 * currentN) / targetN : 0;

  const togglePlay = () => setAnimSpeed(playing ? 0 : lastSpeedRef.current);

  return (
    <div className="transport" role="region" aria-label="Growth playback">
      <button
        type="button"
        className="transport-btn"
        onClick={bumpReset}
        title="Restart from N=1"
        aria-label="Restart from N=1"
      >
        <SkipBackIcon />
      </button>
      {animationMode === 'animated' && (
        <button
          type="button"
          className="transport-btn transport-play"
          onClick={togglePlay}
          disabled={atEnd && !playing}
          title={
            playing ? 'Pause (Space)' : atEnd ? 'Reached target — restart with ⏮' : 'Play (Space)'
          }
          aria-label={playing ? 'Pause' : 'Play'}
          aria-pressed={playing}
        >
          {playing ? <PauseIcon /> : <PlayIcon />}
        </button>
      )}
      {animationMode === 'step' && (
        <button
          type="button"
          className="transport-btn"
          onClick={bumpStep}
          disabled={atEnd}
          title="Add one Planckton (Space)"
          aria-label="Add one Planckton"
        >
          <PlusOneIcon />
        </button>
      )}
      <button
        type="button"
        className="transport-btn"
        onClick={bumpJumpEnd}
        disabled={atEnd}
        title={`Jump to N=${targetN}`}
        aria-label={`Jump to N=${targetN}`}
      >
        <SkipForwardIcon />
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
