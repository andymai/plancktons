import { useRef, type KeyboardEvent, type RefCallback } from 'react';

/**
 * WAI-ARIA radiogroup keyboard pattern: arrow keys move focus + selection,
 * Home/End jump to first/last, a roving tabIndex keeps the group as a single
 * tab stop. Pass the `getRadioProps(id)` output as spread on each radio
 * button so the active option is the only one in the tab order.
 */
export function useRadioGroup<T extends string>(
  options: readonly T[],
  selected: T,
  onSelect: (t: T) => void
) {
  const refs = useRef(new Map<T, HTMLButtonElement>());

  function setRef(id: T): RefCallback<HTMLButtonElement> {
    return (el) => {
      if (el) refs.current.set(id, el);
      else refs.current.delete(id);
    };
  }

  function handleKey(e: KeyboardEvent, current: T) {
    const i = options.indexOf(current);
    if (i < 0) return;
    let nextIdx = -1;
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') nextIdx = (i + 1) % options.length;
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp')
      nextIdx = (i - 1 + options.length) % options.length;
    else if (e.key === 'Home') nextIdx = 0;
    else if (e.key === 'End') nextIdx = options.length - 1;
    if (nextIdx < 0) return;
    e.preventDefault();
    const next = options[nextIdx]!;
    onSelect(next);
    refs.current.get(next)?.focus();
  }

  return function getRadioProps(id: T) {
    return {
      ref: setRef(id),
      tabIndex: id === selected ? 0 : -1,
      onKeyDown: (e: KeyboardEvent) => handleKey(e, id),
    };
  };
}
