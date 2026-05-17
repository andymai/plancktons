import { useId, useState, type ReactNode } from 'react';
import { GLOSSARY } from './glossary.js';
import { useUiStore } from './uiStore.js';

interface Props {
  name: keyof typeof GLOSSARY;
  children?: ReactNode;
}

export function Term({ name, children }: Props) {
  const entry = GLOSSARY[name];
  const [hover, setHover] = useState(false);
  const setHelpOpen = useUiStore((s) => s.setHelpOpen);
  const id = useId();
  if (!entry) return <>{children ?? name}</>;
  return (
    <span className="term-wrap">
      <button
        type="button"
        className="term"
        aria-describedby={hover ? id : undefined}
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
        onFocus={() => setHover(true)}
        onBlur={() => setHover(false)}
        onClick={() => setHelpOpen(true)}
        title={undefined}
      >
        {children ?? entry.shortLabel}
      </button>
      {hover && (
        <span role="tooltip" id={id} className="term-popover">
          {entry.short}
          <em className="term-cta"> · click for details</em>
        </span>
      )}
    </span>
  );
}
