import { create } from 'zustand';
import type { GrowthStrategy } from './assembly.js';

export type SceneId = 'single' | 'cube' | 'reptile' | 'growth';
export type AnimationMode = 'instant' | 'animated' | 'step';

export type ColorMode = 'chirality' | 'depth';

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

  // Reptile
  reptileExplode: number; // 0..1
  setReptileExplode: (v: number) => void;
  reptileDepth: number; // 1=8 pieces, 2=64, ...
  setReptileDepth: (n: number) => void;

  // Cube tiling
  cubeExplode: number;
  setCubeExplode: (v: number) => void;

  // Growth
  growth: GrowthParams;
  setGrowth: (p: Partial<GrowthParams>) => void;
  animationMode: AnimationMode;
  setAnimationMode: (m: AnimationMode) => void;
  animSpeed: number; // tets per second
  setAnimSpeed: (n: number) => void;
  /** Monotonic counter - bump to advance one tet in step mode. */
  stepTrigger: number;
  bumpStep: () => void;

  // Visual
  color: ColorOpts;
  setColor: (c: Partial<ColorOpts>) => void;

  // Mode
  advanced: boolean;
  setAdvanced: (b: boolean) => void;
}

const DEFAULT_COLOR: ColorOpts = {
  rightColor: '#d83a3a',
  leftColor: '#f5f5f0',
  showHull: false,
  showEdges: true,
  edgeOpacity: 0.55,
  // 2.5 % inset: visually separates pieces in canonical tilings and random
  // growth where mathematical face-sharing would otherwise z-fight. Set to 0
  // in advanced to see the true touching configuration.
  tetInset: 0.025,
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

  // Modest explode by default so canonical scenes don't look like a single
  // blob on first view.
  reptileExplode: 0.15,
  setReptileExplode: (reptileExplode) => set({ reptileExplode }),
  reptileDepth: 1,
  setReptileDepth: (reptileDepth) => set({ reptileDepth }),

  cubeExplode: 0.15,
  setCubeExplode: (cubeExplode) => set({ cubeExplode }),

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

  color: DEFAULT_COLOR,
  setColor: (c) => set((s) => ({ color: { ...s.color, ...c } })),

  advanced: true,
  setAdvanced: (advanced) => set({ advanced }),
}));
