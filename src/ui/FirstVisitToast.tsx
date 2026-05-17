import { useEffect } from 'react';
import { useUiStore } from './uiStore.js';

export function FirstVisitToast() {
  const dismissed = useUiStore((s) => s.firstVisitDismissed);
  const dismiss = useUiStore((s) => s.dismissFirstVisit);
  const setHelpOpen = useUiStore((s) => s.setHelpOpen);

  useEffect(() => {
    if (dismissed) return;
    if (window.location.hash) {
      dismiss();
      return;
    }
    const t = window.setTimeout(() => dismiss(), 12000);
    return () => window.clearTimeout(t);
  }, [dismissed, dismiss]);

  if (dismissed) return null;
  return (
    <div className="first-visit-toast" role="status">
      <span>New here? Tap</span>
      <button
        type="button"
        className="first-visit-link"
        onClick={() => {
          setHelpOpen(true);
          dismiss();
        }}
      >
        ?
      </button>
      <span>for a quick primer.</span>
      <button
        type="button"
        className="first-visit-close"
        onClick={dismiss}
        aria-label="Dismiss tip"
      >
        ×
      </button>
    </div>
  );
}
