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
  /** Inertia ellipsoid overlay (growth scene). */
  showEllipsoid: boolean;
  /** Reference-density lines on plots. */
  showReferences: boolean;
  /** Render the assembly as a single brepjs-fused solid (no internal shared
   * faces). Async; loads OpenCascade WASM on first toggle. Slower per frame
   * (~50 ms per tet for fuseAll) but visually unambiguous — no z-fighting,
   * no perceived overlap. Recommended N ≤ 50. */
  useFusedMesh: boolean;
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
  /** Monotonic counter — bump to advance one tet in step mode. */
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
  useFusedMesh: false,
};

export const useStore = create<State>((set) => ({
  scene: 'single',
  setScene: (scene) => set({ scene }),

  singleChirality: 'R',
  setSingleChirality: (singleChirality) => set({ singleChirality }),

  reptileExplode: 0.1,
  setReptileExplode: (reptileExplode) => set({ reptileExplode }),
  reptileDepth: 1,
  setReptileDepth: (reptileDepth) => set({ reptileDepth }),

  cubeExplode: 0,
  setCubeExplode: (cubeExplode) => set({ cubeExplode }),

  growth: { N: 20, seed: 1, chiralityBias: 0.5, strategy: 'uniform', compactBeta: 3 },
  setGrowth: (p) => set((s) => ({ growth: { ...s.growth, ...p } })),
  animationMode: 'instant',
  setAnimationMode: (animationMode) => set({ animationMode }),
  animSpeed: 4,
  setAnimSpeed: (animSpeed) => set({ animSpeed }),
  stepTrigger: 0,
  bumpStep: () => set((s) => ({ stepTrigger: s.stepTrigger + 1 })),

  color: DEFAULT_COLOR,
  setColor: (c) => set((s) => ({ color: { ...s.color, ...c } })),

  advanced: true,
  setAdvanced: (advanced) => set({ advanced }),
}));
