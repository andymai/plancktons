import type { GrowthMetrics } from '../scenes/GrowthScene.js';
import type { VacuumHudMetrics } from '../scenes/VacuumScene.js';
import { useStore } from '../lib/store.js';
import { PauseIcon, PlayIcon, PlusOneIcon, SkipBackIcon, SkipForwardIcon } from './icons.js';

export function Transport({
  metrics,
  vacuum,
}: {
  metrics: GrowthMetrics | null;
  vacuum: VacuumHudMetrics | null;
}) {
  const scene = useStore((s) => s.scene);
  const animationMode = useStore((s) => s.animationMode);
  const animSpeed = useStore((s) => s.animSpeed);
  const togglePlay = useStore((s) => s.togglePlay);
  const growth = useStore((s) => s.growth);
  const bumpStep = useStore((s) => s.bumpStep);
  const bumpReset = useStore((s) => s.bumpReset);
  const bumpJumpEnd = useStore((s) => s.bumpJumpEnd);

  if (scene === 'vacuum') return <VacuumTransport vacuum={vacuum} />;

  // Instant mode has no playback to control — the assembly is rendered at its
  // target N directly, so a transport row would be inert at best, misleading
  // at worst (⏮ silently does nothing).
  if (scene !== 'growth' || animationMode === 'instant') return null;

  const currentN = metrics?.N ?? 0;
  const targetN = growth.N;
  const playing = animSpeed > 0;
  const atEnd = currentN >= targetN;
  const pct = targetN > 0 ? (100 * currentN) / targetN : 0;

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

function VacuumTransport({ vacuum }: { vacuum: VacuumHudMetrics | null }) {
  const animSpeed = useStore((s) => s.animSpeed);
  const togglePlay = useStore((s) => s.togglePlay);
  const scrub = useStore((s) => s.vacuumScrub);
  const setScrub = useStore((s) => s.setVacuumScrub);

  const playing = animSpeed > 0;
  const running = vacuum?.running ?? false;
  const atEnd = scrub >= 0.999;

  return (
    <div className="transport" role="region" aria-label="Vacuum playback">
      <button
        type="button"
        className="transport-btn"
        onClick={() => setScrub(0)}
        disabled={running}
        title="Restart (full of air)"
        aria-label="Restart"
      >
        <SkipBackIcon />
      </button>
      <button
        type="button"
        className="transport-btn transport-play"
        onClick={togglePlay}
        disabled={running || (atEnd && !playing)}
        title={playing ? 'Pause (Space)' : atEnd ? 'Sealed — restart with ⏮' : 'Play (Space)'}
        aria-label={playing ? 'Pause' : 'Play'}
        aria-pressed={playing}
      >
        {playing ? <PauseIcon /> : <PlayIcon />}
      </button>
      <button
        type="button"
        className="transport-btn"
        onClick={() => setScrub(1)}
        disabled={running || atEnd}
        title="Jump to sealed"
        aria-label="Jump to sealed"
      >
        <SkipForwardIcon />
      </button>
      <input
        type="range"
        className="transport-scrub"
        min={0}
        max={1}
        step={0.001}
        value={scrub}
        disabled={running}
        onChange={(e) => setScrub(parseFloat(e.target.value))}
        aria-label="Air removed"
        title="Scrub air removed"
      />
      <span className="transport-counter" role="status" aria-live="polite">
        {running
          ? `packing… ${vacuum?.progress != null ? Math.round(vacuum.progress * 100) : 0}%`
          : `air: ${Math.round(scrub * 100)}%`}
      </span>
    </div>
  );
}
