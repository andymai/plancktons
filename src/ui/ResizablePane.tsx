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

function persistWidth(key: string, w: number) {
  try {
    localStorage.setItem(key, String(w));
  } catch {
    /* private mode */
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
  const widthRef = useRef(width);
  useEffect(() => {
    widthRef.current = width;
  }, [width]);

  useEffect(() => {
    function pointerX(e: MouseEvent | TouchEvent): number | null {
      if ('touches' in e) return e.touches[0]?.clientX ?? null;
      return e.clientX;
    }
    function onMove(e: MouseEvent | TouchEvent) {
      if (!draggingRef.current) return;
      const x = pointerX(e);
      if (x == null) return;
      // touch-action: none on .pane-resizer suppresses scroll once the gesture
      // starts on it, but Safari still fires touchmove with cancelable=true
      // afterwards — preventDefault here is the second line of defence.
      if ('touches' in e && e.cancelable) e.preventDefault();
      const raw = side === 'left' ? x : window.innerWidth - x;
      setWidth(Math.max(minWidth, Math.min(maxWidth, raw)));
    }
    function onUp() {
      if (!draggingRef.current) return;
      draggingRef.current = false;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      persistWidth(storageKey, widthRef.current);
    }
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    window.addEventListener('touchmove', onMove, { passive: false });
    window.addEventListener('touchend', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      window.removeEventListener('touchmove', onMove);
      window.removeEventListener('touchend', onUp);
    };
  }, [side, storageKey, minWidth, maxWidth]);

  function onPointerDown(e: React.MouseEvent | React.TouchEvent) {
    e.preventDefault();
    draggingRef.current = true;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  }

  function onKey(e: React.KeyboardEvent) {
    const step = e.shiftKey ? 40 : 10;
    let next: number | null = null;
    if (e.key === 'ArrowLeft') {
      next = width + (side === 'left' ? -step : step);
    } else if (e.key === 'ArrowRight') {
      next = width + (side === 'left' ? step : -step);
    } else if (e.key === 'Home') {
      next = defaultWidth;
    }
    if (next == null) return;
    e.preventDefault();
    const clamped = Math.max(minWidth, Math.min(maxWidth, next));
    setWidth(clamped);
    persistWidth(storageKey, clamped);
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
      onMouseDown={onPointerDown}
      onTouchStart={onPointerDown}
      onDoubleClick={() => {
        setWidth(defaultWidth);
        persistWidth(storageKey, defaultWidth);
      }}
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
