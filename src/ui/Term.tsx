import { useEffect, useId, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { GLOSSARY } from './glossary.js';
import { useUiStore } from './uiStore.js';

interface Props {
  name: keyof typeof GLOSSARY;
  children?: ReactNode;
}

interface PopoverPos {
  top: number;
  left: number;
  origin: 'top' | 'bottom';
}

const VIEWPORT_MARGIN = 8;
const GAP = 6;

export function Term({ name, children }: Props) {
  const entry = GLOSSARY[name];
  const [hover, setHover] = useState(false);
  const [pos, setPos] = useState<PopoverPos | null>(null);
  const setHelpOpen = useUiStore((s) => s.setHelpOpen);
  const id = useId();
  const btnRef = useRef<HTMLButtonElement | null>(null);
  const popoverRef = useRef<HTMLSpanElement | null>(null);

  // Popovers use position: fixed so a scrolling ancestor (the sidebar) can't
  // clip them. Recompute placement on hover, window resize, and scroll —
  // getBoundingClientRect is viewport-relative. When hover becomes false the
  // popover unmounts, so stale pos values don't matter until the next hover.
  useLayoutEffect(() => {
    if (!hover) return;
    function place() {
      const btn = btnRef.current;
      const pop = popoverRef.current;
      if (!btn || !pop) return;
      const b = btn.getBoundingClientRect();
      const p = pop.getBoundingClientRect();
      const fitsBelow = b.bottom + p.height + VIEWPORT_MARGIN <= window.innerHeight;
      const fitsAbove = b.top - p.height - VIEWPORT_MARGIN >= 0;
      const origin: 'top' | 'bottom' = !fitsBelow && fitsAbove ? 'top' : 'bottom';
      const top = origin === 'bottom' ? b.bottom + GAP : b.top - p.height - GAP;
      let left = b.left;
      if (left + p.width + VIEWPORT_MARGIN > window.innerWidth) {
        left = Math.max(VIEWPORT_MARGIN, window.innerWidth - p.width - VIEWPORT_MARGIN);
      }
      setPos({ top, left, origin });
    }
    place();
    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, true);
    return () => {
      window.removeEventListener('resize', place);
      window.removeEventListener('scroll', place, true);
    };
  }, [hover]);

  // Auto-hide if scroll/resize moves the anchor far enough that the popover
  // would point at empty space (e.g., user scrolls the sidebar past the term).
  useEffect(() => {
    if (!hover) return;
    function checkVisible() {
      const btn = btnRef.current;
      if (!btn) return;
      const r = btn.getBoundingClientRect();
      const offscreen = r.bottom < 0 || r.top > window.innerHeight || r.right < 0;
      if (offscreen) setHover(false);
    }
    window.addEventListener('scroll', checkVisible, true);
    return () => window.removeEventListener('scroll', checkVisible, true);
  }, [hover]);

  if (!entry) return <>{children ?? name}</>;
  return (
    <>
      <button
        ref={btnRef}
        type="button"
        className="term"
        aria-describedby={hover ? id : undefined}
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
        onFocus={() => setHover(true)}
        onBlur={() => setHover(false)}
        onClick={() => setHelpOpen(true)}
      >
        {children ?? entry.shortLabel}
      </button>
      {hover && (
        <span
          ref={popoverRef}
          role="tooltip"
          id={id}
          className="term-popover"
          style={
            pos
              ? { top: pos.top, left: pos.left, visibility: 'visible' }
              : { top: 0, left: 0, visibility: 'hidden' }
          }
        >
          {entry.short}
          <em className="term-cta"> · click for details</em>
        </span>
      )}
    </>
  );
}
