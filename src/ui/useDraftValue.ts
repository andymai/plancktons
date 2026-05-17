import { useState } from 'react';

/**
 * Mirrors an external value as local state. On every render, re-syncs to the
 * external value whenever it changes. Lets a component display a live "draft"
 * that defaults to (and resets to) the upstream committed value.
 */
export function useDraftValue<T>(value: T): [T, (v: T) => void] {
  const [draft, setDraft] = useState(value);
  const [prev, setPrev] = useState(value);
  if (!Object.is(prev, value)) {
    setPrev(value);
    setDraft(value);
  }
  return [draft, setDraft];
}
