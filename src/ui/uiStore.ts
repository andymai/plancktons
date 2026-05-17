import { create } from 'zustand';

interface UiState {
  helpOpen: boolean;
  setHelpOpen: (b: boolean) => void;

  collapsedSections: Record<string, boolean>;
  toggleSection: (id: string) => void;
  setSectionCollapsed: (id: string, collapsed: boolean) => void;

  firstVisitDismissed: boolean;
  dismissFirstVisit: () => void;
}

const LS_FIRST_VISIT = 'plancktons.firstVisitDismissed';

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

  firstVisitDismissed: loadFirstVisit(),
  dismissFirstVisit: () => {
    saveFirstVisit();
    set({ firstVisitDismissed: true });
  },
}));
