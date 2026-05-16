// Global UI state. Kept small — heavy data (assemblies) is derived from these.

import { create } from 'zustand';
import type { GrowthStrategy } from './assembly.js';

export type SceneId = 'single' | 'cube' | 'reptile' | 'growth';
export type AnimationMode = 'instant' | 'animated' | 'step';

export interface ColorOpts {
  rightColor: string;
  leftColor: string;
  showHull: boolean;
  showEdges: boolean;
  edgeOpacity: number;
}

export interface GrowthParams {
  N: number;
  seed: number;
  chiralityBias: number;
  strategy: GrowthStrategy;
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
  manualMode: boolean;
  setManualMode: (b: boolean) => void;

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
  edgeOpacity: 0.4,
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

  growth: { N: 20, seed: 1, chiralityBias: 0.5, strategy: 'uniform' },
  setGrowth: (p) => set((s) => ({ growth: { ...s.growth, ...p } })),
  animationMode: 'instant',
  setAnimationMode: (animationMode) => set({ animationMode }),
  animSpeed: 4,
  setAnimSpeed: (animSpeed) => set({ animSpeed }),
  manualMode: false,
  setManualMode: (manualMode) => set({ manualMode }),

  color: DEFAULT_COLOR,
  setColor: (c) => set((s) => ({ color: { ...s.color, ...c } })),

  advanced: false,
  setAdvanced: (advanced) => set({ advanced }),
}));
