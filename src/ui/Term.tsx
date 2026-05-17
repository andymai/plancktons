import { useId, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { GLOSSARY } from './glossary.js';
import { useUiStore } from './uiStore.js';

interface Props {
  name: keyof typeof GLOSSARY;
  children?: ReactNode;
}

interface Placement {
  side: 'top' | 'bottom';
  align: 'left' | 'right';
}

const VIEWPORT_MARGIN = 8;

export function Term({ name, children }: Props) {
  const entry = GLOSSARY[name];
  const [hover, setHover] = useState(false);
  const [placement, setPlacement] = useState<Placement>({ side: 'bottom', align: 'left' });
  const setHelpOpen = useUiStore((s) => s.setHelpOpen);
  const id = useId();
  const btnRef = useRef<HTMLButtonElement | null>(null);
  const popoverRef = useRef<HTMLSpanElement | null>(null);

  useLayoutEffect(() => {
    if (!hover) return;
    const btn = btnRef.current;
    const pop = popoverRef.current;
    if (!btn || !pop) return;
    const btnRect = btn.getBoundingClientRect();
    const popRect = pop.getBoundingClientRect();
    const overflowBottom = btnRect.bottom + popRect.height + VIEWPORT_MARGIN > window.innerHeight;
    const overflowRight = btnRect.left + popRect.width + VIEWPORT_MARGIN > window.innerWidth;
    setPlacement({
      side: overflowBottom && btnRect.top > popRect.height + VIEWPORT_MARGIN ? 'top' : 'bottom',
      align: overflowRight ? 'right' : 'left',
    });
  }, [hover]);

  if (!entry) return <>{children ?? name}</>;
  return (
    <span className="term-wrap">
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
          className={`term-popover term-popover-${placement.side} term-popover-${placement.align}`}
        >
          {entry.short}
          <em className="term-cta"> · click for details</em>
        </span>
      )}
    </span>
  );
}
