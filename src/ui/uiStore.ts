import { create } from 'zustand';

interface UiState {
  helpOpen: boolean;
  setHelpOpen: (b: boolean) => void;

  collapsedSections: Record<string, boolean>;
  toggleSection: (id: string) => void;
  setSectionCollapsed: (id: string, collapsed: boolean) => void;

  metricsHidden: boolean;
  toggleMetricsHidden: () => void;

  firstVisitDismissed: boolean;
  dismissFirstVisit: () => void;
}

const LS_FIRST_VISIT = 'plancktons.firstVisitDismissed';
const LS_METRICS_HIDDEN = 'plancktons.metricsHidden';

function lsGet(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function lsSet(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* private mode */
  }
}

function defaultMetricsHidden(): boolean {
  const stored = lsGet(LS_METRICS_HIDDEN);
  if (stored != null) return stored === '1';
  try {
    return window.matchMedia('(max-width: 720px)').matches;
  } catch {
    return false;
  }
}

export const useUiStore = create<UiState>((set) => ({
  helpOpen: false,
  setHelpOpen: (helpOpen) => set({ helpOpen }),

  collapsedSections: {},
  toggleSection: (id) =>
    set((s) => ({
      collapsedSections: { ...s.collapsedSections, [id]: !s.collapsedSections[id] },
    })),
  setSectionCollapsed: (id, collapsed) =>
    set((s) => ({ collapsedSections: { ...s.collapsedSections, [id]: collapsed } })),

  metricsHidden: defaultMetricsHidden(),
  toggleMetricsHidden: () =>
    set((s) => {
      const next = !s.metricsHidden;
      lsSet(LS_METRICS_HIDDEN, next ? '1' : '0');
      return { metricsHidden: next };
    }),

  firstVisitDismissed: lsGet(LS_FIRST_VISIT) === '1',
  dismissFirstVisit: () => {
    lsSet(LS_FIRST_VISIT, '1');
    set({ firstVisitDismissed: true });
  },
}));
