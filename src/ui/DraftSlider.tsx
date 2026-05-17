import { useState } from 'react';

/**
 * Number slider whose value is held locally while the user drags. The
 * `onCommit` callback fires on pointerup / change-after-release, not on every
 * intermediate value. Eliminates per-frame rebuilds while dragging.
 *
 * Visually identical to a native range input.
 */
export function DraftSlider({
  value,
  min,
  max,
  step,
  onCommit,
  title,
  ariaLabel,
}: {
  value: number;
  min: number;
  max: number;
  step: number;
  onCommit: (v: number) => void;
  title?: string;
  ariaLabel?: string;
}) {
  const [draft, setDraft] = useState(value);
  const [prevValue, setPrevValue] = useState(value);
  // Render-time sync: when the upstream value changes (URL hash, reset, etc.),
  // pull it into the local draft. Official React pattern for derived state.
  if (prevValue !== value) {
    setPrevValue(value);
    setDraft(value);
  }

  return (
    <input
      type="range"
      min={min}
      max={max}
      step={step}
      value={draft}
      title={title}
      aria-label={ariaLabel}
      onChange={(e) => setDraft(parseFloat(e.target.value))}
      onMouseUp={() => onCommit(draft)}
      onTouchEnd={() => onCommit(draft)}
      onKeyUp={() => onCommit(draft)}
    />
  );
}
