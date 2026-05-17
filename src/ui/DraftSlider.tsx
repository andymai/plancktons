import { useState } from 'react';

/**
 * Number slider whose value is held locally while the user drags. `onCommit`
 * fires on pointerup / change-after-release (cheap), `onDraftChange` fires on
 * every intermediate change so parents can show the live value next to the
 * slider without triggering expensive recomputation.
 *
 * Visually identical to a native range input.
 */
export function DraftSlider({
  value,
  min,
  max,
  step,
  onCommit,
  onDraftChange,
  title,
  ariaLabel,
}: {
  value: number;
  min: number;
  max: number;
  step: number;
  onCommit: (v: number) => void;
  onDraftChange?: (v: number) => void;
  title?: string;
  ariaLabel?: string;
}) {
  const [draft, setDraft] = useState(value);
  const [prevValue, setPrevValue] = useState(value);
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
      onChange={(e) => {
        const v = parseFloat(e.target.value);
        setDraft(v);
        onDraftChange?.(v);
      }}
      onMouseUp={() => onCommit(draft)}
      onTouchEnd={() => onCommit(draft)}
      onKeyUp={() => onCommit(draft)}
    />
  );
}
