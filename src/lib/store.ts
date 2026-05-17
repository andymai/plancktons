import { create } from 'zustand';
import type { GrowthStrategy } from './assembly.js';

export type SceneId = 'single' | 'cube' | 'reptile' | 'growth';
export type AnimationMode = 'instant' | 'animated' | 'step';

export type Mode = 'learn' | 'explore' | 'research';
export const MODE_ORDER: readonly Mode[] = ['learn', 'explore', 'research'] as const;

export function isAtLeast(current: Mode, required: Mode): boolean {
  return MODE_ORDER.indexOf(current) >= MODE_ORDER.indexOf(required);
}

export type ColorMode = 'chirality' | 'depth' | 'coordination';

export interface ColorOpts {
  rightColor: string;
  leftColor: string;
  showHull: boolean;
  showEdges: boolean;
  edgeOpacity: number;
  /** Shrink each tet toward its centroid by this fraction (0 = touching, 0.04 = visible gap). */
  tetInset: number;
  colorMode: ColorMode;
  /** Gyration ellipsoid overlay (growth scene). NOT the inertia ellipsoid. */
  showEllipsoid: boolean;
  /** Reference-density lines on plots. */
  showReferences: boolean;
}

export interface GrowthParams {
  N: number;
  seed: number;
  chiralityBias: number;
  strategy: GrowthStrategy;
  compactBeta: number;
}

interface State {
  scene: SceneId;
  setScene: (s: SceneId) => void;

  // Single-Planckton inspector
  singleChirality: 'R' | 'L';
  setSingleChirality: (c: 'R' | 'L') => void;
  singleShowAngles: boolean;
  setSingleShowAngles: (b: boolean) => void;

  // Reptile
  reptileExplode: number; // 0..1
  setReptileExplode: (v: number) => void;
  reptileDepth: number; // 1=8 pieces, 2=64, ...
  setReptileDepth: (n: number) => void;

  // Cube tiling
  cubeExplode: number;
  setCubeExplode: (v: number) => void;
  cubeAutoplay: boolean;
  setCubeAutoplay: (b: boolean) => void;
  reptileAutoplay: boolean;
  setReptileAutoplay: (b: boolean) => void;

  // Growth
  growth: GrowthParams;
  setGrowth: (p: Partial<GrowthParams>) => void;
  animationMode: AnimationMode;
  setAnimationMode: (m: AnimationMode) => void;
  animSpeed: number; // tets per second
  setAnimSpeed: (n: number) => void;
  // Monotonic counters; each scene watches these to step / restart / jump.
  stepTrigger: number;
  bumpStep: () => void;
  resetTrigger: number;
  bumpReset: () => void;
  jumpEndTrigger: number;
  bumpJumpEnd: () => void;

  // Visual
  color: ColorOpts;
  setColor: (c: Partial<ColorOpts>) => void;

  mode: Mode;
  setMode: (m: Mode) => void;
}

const DEFAULT_COLOR: ColorOpts = {
  rightColor: '#d83a3a',
  leftColor: '#f5f5f0',
  showHull: false,
  showEdges: true,
  edgeOpacity: 0.55,
  // 0.5 % inset: just enough to disambiguate shared faces from one direction
  // of the camera. The material also has polygonOffset enabled (a depth-only
  // GPU nudge), so this inset is belt-and-suspenders rather than the primary
  // defense. Set to 0 in advanced for the true mathematical touching config.
  tetInset: 0.005,
  colorMode: 'chirality',
  showEllipsoid: false,
  showReferences: true,
};

export const useStore = create<State>((set) => ({
  // Default landing on the random-growth scene — it's the centerpiece of the
  // research tool and (with animated playback) the most visually engaging
  // first impression.
  scene: 'growth',
  setScene: (scene) => set({ scene }),

  singleChirality: 'R',
  setSingleChirality: (singleChirality) => set({ singleChirality }),
  singleShowAngles: false,
  setSingleShowAngles: (singleShowAngles) => set({ singleShowAngles }),

  // Modest explode by default so canonical scenes don't look like a single
  // blob on first view.
  reptileExplode: 0.15,
  setReptileExplode: (reptileExplode) => set({ reptileExplode }),
  reptileDepth: 1,
  setReptileDepth: (reptileDepth) => set({ reptileDepth }),

  cubeExplode: 0.15,
  setCubeExplode: (cubeExplode) => set({ cubeExplode }),
  cubeAutoplay: false,
  setCubeAutoplay: (cubeAutoplay) => set({ cubeAutoplay }),
  reptileAutoplay: false,
  setReptileAutoplay: (reptileAutoplay) => set({ reptileAutoplay }),

  // N=40 is dense enough to be visually striking but quick to generate.
  // Compact strategy with β=3 yields visibly rounder, denser piles than
  // uniform — better first impression of the actual physics being studied.
  growth: { N: 40, seed: 7, chiralityBias: 0.5, strategy: 'compact', compactBeta: 3 },
  setGrowth: (p) => set((s) => ({ growth: { ...s.growth, ...p } })),
  // Animated playback auto-plays growth from N=1 → 40 over ~3 s on landing.
  animationMode: 'animated',
  setAnimationMode: (animationMode) => set({ animationMode }),
  animSpeed: 12,
  setAnimSpeed: (animSpeed) => set({ animSpeed }),
  stepTrigger: 0,
  bumpStep: () => set((s) => ({ stepTrigger: s.stepTrigger + 1 })),
  resetTrigger: 0,
  bumpReset: () => set((s) => ({ resetTrigger: s.resetTrigger + 1 })),
  jumpEndTrigger: 0,
  bumpJumpEnd: () => set((s) => ({ jumpEndTrigger: s.jumpEndTrigger + 1 })),

  color: DEFAULT_COLOR,
  setColor: (c) => set((s) => ({ color: { ...s.color, ...c } })),

  mode: 'learn',
  setMode: (mode) => set({ mode }),
}));
