import { useEffect, useRef, useState, type ReactNode } from 'react';

const LS_KEY = 'plancktons.sidebar.width';
const MIN_W = 280;
const MAX_W = 560;
const DEFAULT_W = 360;

function loadWidth(): number {
  try {
    const v = parseInt(localStorage.getItem(LS_KEY) ?? '', 10);
    return Number.isFinite(v) ? Math.max(MIN_W, Math.min(MAX_W, v)) : DEFAULT_W;
  } catch {
    return DEFAULT_W;
  }
}

/**
 * Sidebar wrapper with a drag-to-resize handle on its right edge.
 * Width is persisted to localStorage. Falls back to {DEFAULT_W} px if storage
 * is unavailable.
 */
export function ResizableSidebar({ children }: { children: ReactNode }) {
  const [width, setWidth] = useState(loadWidth);
  const draggingRef = useRef(false);

  useEffect(() => {
    function onMove(e: MouseEvent) {
      if (!draggingRef.current) return;
      const w = Math.max(MIN_W, Math.min(MAX_W, e.clientX));
      setWidth(w);
    }
    function onUp() {
      if (!draggingRef.current) return;
      draggingRef.current = false;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      try {
        localStorage.setItem(LS_KEY, String(width));
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
  }, [width]);

  function onMouseDown(e: React.MouseEvent) {
    e.preventDefault();
    draggingRef.current = true;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  }

  return (
    <>
      <aside className="sidebar" style={{ width }}>
        {children}
      </aside>
      <div
        className="sidebar-resizer"
        onMouseDown={onMouseDown}
        onDoubleClick={() => setWidth(DEFAULT_W)}
        title="Drag to resize · double-click to reset"
      />
    </>
  );
}
