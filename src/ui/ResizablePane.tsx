import { useEffect, useRef, useState, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
  side: 'left' | 'right';
  storageKey: string;
  defaultWidth: number;
  minWidth: number;
  maxWidth: number;
  className?: string;
}

function loadWidth(key: string, def: number, min: number, max: number): number {
  try {
    const v = parseInt(localStorage.getItem(key) ?? '', 10);
    return Number.isFinite(v) ? Math.max(min, Math.min(max, v)) : def;
  } catch {
    return def;
  }
}

export function ResizablePane({
  children,
  side,
  storageKey,
  defaultWidth,
  minWidth,
  maxWidth,
  className,
}: Props) {
  const [width, setWidth] = useState(() => loadWidth(storageKey, defaultWidth, minWidth, maxWidth));
  const draggingRef = useRef(false);

  useEffect(() => {
    function onMove(e: MouseEvent) {
      if (!draggingRef.current) return;
      const raw = side === 'left' ? e.clientX : window.innerWidth - e.clientX;
      const w = Math.max(minWidth, Math.min(maxWidth, raw));
      setWidth(w);
    }
    function onUp() {
      if (!draggingRef.current) return;
      draggingRef.current = false;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      try {
        localStorage.setItem(storageKey, String(width));
      } catch {
        /* private mode */
      }
    }
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, [width, side, storageKey, minWidth, maxWidth]);

  function onMouseDown(e: React.MouseEvent) {
    e.preventDefault();
    draggingRef.current = true;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  }

  function onKey(e: React.KeyboardEvent) {
    const step = e.shiftKey ? 40 : 10;
    if (e.key === 'ArrowLeft') {
      e.preventDefault();
      setWidth((w) => Math.max(minWidth, w + (side === 'left' ? -step : step)));
    } else if (e.key === 'ArrowRight') {
      e.preventDefault();
      setWidth((w) => Math.min(maxWidth, w + (side === 'left' ? step : -step)));
    } else if (e.key === 'Home') {
      e.preventDefault();
      setWidth(defaultWidth);
    }
  }

  const resizer = (
    <div
      className="pane-resizer"
      role="separator"
      aria-orientation="vertical"
      aria-valuemin={minWidth}
      aria-valuemax={maxWidth}
      aria-valuenow={width}
      tabIndex={0}
      onMouseDown={onMouseDown}
      onTouchStart={onMouseDown as unknown as React.TouchEventHandler}
      onDoubleClick={() => setWidth(defaultWidth)}
      onKeyDown={onKey}
      title={`Drag to resize · double-click or Home to reset (${defaultWidth}px)`}
    />
  );

  return (
    <>
      {side === 'right' ? resizer : null}
      <aside className={`pane pane-${side} ${className ?? ''}`} style={{ width }}>
        {children}
      </aside>
      {side === 'left' ? resizer : null}
    </>
  );
}
