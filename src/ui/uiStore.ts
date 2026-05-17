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

function loadMetricsHidden(): boolean {
  try {
    return localStorage.getItem(LS_METRICS_HIDDEN) === '1';
  } catch {
    return false;
  }
}

function loadFirstVisit(): boolean {
  try {
    return localStorage.getItem(LS_FIRST_VISIT) === '1';
  } catch {
    return false;
  }
}

function saveFirstVisit(): void {
  try {
    localStorage.setItem(LS_FIRST_VISIT, '1');
  } catch {
    /* private mode */
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

  metricsHidden: loadMetricsHidden(),
  toggleMetricsHidden: () =>
    set((s) => {
      const next = !s.metricsHidden;
      try {
        localStorage.setItem(LS_METRICS_HIDDEN, next ? '1' : '0');
      } catch {
        /* private mode */
      }
      return { metricsHidden: next };
    }),

  firstVisitDismissed: loadFirstVisit(),
  dismissFirstVisit: () => {
    saveFirstVisit();
    set({ firstVisitDismissed: true });
  },
}));
