import { beforeEach, describe, expect, it } from 'vitest';
import { isAtLeast, MODE_ORDER, useStore } from '../src/lib/store.js';
import { decodeStateFromHash, encodeStateToHash } from '../src/lib/exports.js';

describe('isAtLeast', () => {
  it('learn is at-least learn', () => {
    expect(isAtLeast('learn', 'learn')).toBe(true);
  });
  it('learn is not at-least explore', () => {
    expect(isAtLeast('learn', 'explore')).toBe(false);
    expect(isAtLeast('learn', 'research')).toBe(false);
  });
  it('explore is at-least learn and explore but not research', () => {
    expect(isAtLeast('explore', 'learn')).toBe(true);
    expect(isAtLeast('explore', 'explore')).toBe(true);
    expect(isAtLeast('explore', 'research')).toBe(false);
  });
  it('research is at-least everything', () => {
    expect(isAtLeast('research', 'learn')).toBe(true);
    expect(isAtLeast('research', 'explore')).toBe(true);
    expect(isAtLeast('research', 'research')).toBe(true);
  });
  it('MODE_ORDER is monotone', () => {
    expect(MODE_ORDER).toEqual(['learn', 'explore', 'research']);
    for (let i = 0; i < MODE_ORDER.length; i++) {
      for (let j = 0; j < MODE_ORDER.length; j++) {
        expect(isAtLeast(MODE_ORDER[i]!, MODE_ORDER[j]!)).toBe(i >= j);
      }
    }
  });
});

const BASE_STATE = {
  scene: 'growth' as const,
  singleChirality: 'R' as const,
  cubeExplode: 0.2,
  reptileExplode: 0.3,
  reptileDepth: 1,
  growth: { N: 20, seed: 1, chiralityBias: 0.5, strategy: 'uniform', compactBeta: 3 },
};

describe('share-link mode round-trip', () => {
  beforeEach(() => {
    window.history.replaceState(null, '', '/');
  });

  for (const mode of ['learn', 'explore', 'research'] as const) {
    it(`round-trips mode=${mode}`, () => {
      const url = encodeStateToHash({ ...BASE_STATE, mode });
      window.history.replaceState(null, '', url);
      expect(decodeStateFromHash()?.mode).toBe(mode);
    });
  }

  it('returns undefined mode when neither m nor a is present', () => {
    const bare = btoa(JSON.stringify({ s: 'growth' }));
    window.history.replaceState(null, '', '/#' + bare);
    const decoded = decodeStateFromHash();
    expect(decoded?.scene).toBe('growth');
    expect(decoded?.mode).toBeUndefined();
  });

  it('m takes precedence over legacy a when both are present', () => {
    const both = btoa(JSON.stringify({ m: 'explore', a: true }));
    window.history.replaceState(null, '', '/#' + both);
    expect(decodeStateFromHash()?.mode).toBe('explore');
  });
});

describe('togglePlay', () => {
  beforeEach(() => {
    useStore.setState({ animSpeed: 12, lastNonZeroAnimSpeed: 12 });
  });

  it('pause stores current speed; resume restores it', () => {
    const { togglePlay } = useStore.getState();
    useStore.setState({ animSpeed: 7 });
    togglePlay();
    expect(useStore.getState().animSpeed).toBe(0);
    expect(useStore.getState().lastNonZeroAnimSpeed).toBe(7);
    togglePlay();
    expect(useStore.getState().animSpeed).toBe(7);
  });

  it('keyboard pause and transport pause restore to the same speed', () => {
    const { togglePlay } = useStore.getState();
    useStore.setState({ animSpeed: 5 });
    togglePlay();
    togglePlay();
    expect(useStore.getState().animSpeed).toBe(5);
    togglePlay();
    togglePlay();
    expect(useStore.getState().animSpeed).toBe(5);
  });

  it('toggling from default state pauses at 12 then resumes at 12', () => {
    const { togglePlay } = useStore.getState();
    togglePlay();
    expect(useStore.getState().animSpeed).toBe(0);
    togglePlay();
    expect(useStore.getState().animSpeed).toBe(12);
  });
});
