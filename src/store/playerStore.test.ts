import { describe, it, expect, beforeEach, vi } from 'vitest';
import { usePlayerStore } from './playerStore';

// Mock Tauri APIs
vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(),
}));
vi.mock('@tauri-apps/api/event', () => ({
  emit: vi.fn(),
}));

describe('usePlayerStore - State Structure', () => {
  beforeEach(() => {
    // Ensure store is available
    const state = usePlayerStore.getState();
    expect(state).toBeDefined();
  });

  describe('Store Instantiation', () => {
    it('should exist and be accessible', () => {
      const store = usePlayerStore.getState();
      expect(store).toBeDefined();
      expect(typeof store).toBe('object');
    });

    it('should have all core state properties', () => {
      const state = usePlayerStore.getState();
      
      expect(state).toHaveProperty('status');
      expect(state).toHaveProperty('library');
      expect(state).toHaveProperty('queue');
      expect(state).toHaveProperty('currentFolder');
      expect(state).toHaveProperty('isLoading');
      expect(state).toHaveProperty('error');
    });

    it('should have audio control properties', () => {
      const state = usePlayerStore.getState();
      
      expect(state).toHaveProperty('eqGains');
      expect(state).toHaveProperty('showEq');
      expect(state).toHaveProperty('preampDb');
      expect(state).toHaveProperty('balance');
      expect(state).toHaveProperty('stereoWidth');
      expect(state).toHaveProperty('speed');
    });

    it('should expose core action methods', () => {
      const state = usePlayerStore.getState();
      
      // Critical playback methods
      expect(typeof state.playFile).toBe('function');
      expect(typeof state.pause).toBe('function');
      expect(typeof state.resume).toBe('function');
      expect(typeof state.seek).toBe('function');
      expect(typeof state.setVolume).toBe('function');
    });

    it('should expose library management methods', () => {
      const state = usePlayerStore.getState();
      
      expect(typeof state.scanFolder).toBe('function');
      expect(typeof state.loadLibrary).toBe('function');
      expect(typeof state.refreshLibrary).toBe('function');
    });

    it('should expose queue operations', () => {
      const state = usePlayerStore.getState();
      
      expect(typeof state.setQueue).toBe('function');
      expect(typeof state.addToQueue).toBe('function');
      expect(typeof state.playNext).toBe('function');
      expect(typeof state.toggleShuffle).toBe('function');
    });

    it('should expose equalizer methods', () => {
      const state = usePlayerStore.getState();
      
      expect(typeof state.setEqGain).toBe('function');
      expect(typeof state.applyPreset).toBe('function');
      expect(typeof state.addPreset).toBe('function');
    });
  });

  describe('Store Memoization & Stability', () => {
    it('should return same reference on repeated calls', () => {
      const store1 = usePlayerStore.getState();
      const store2 = usePlayerStore.getState();
      expect(store1).toBe(store2);
    });

    it('should support subscriptions', () => {
      const unsubscribe = usePlayerStore.subscribe(() => {});
      expect(typeof unsubscribe).toBe('function');
      unsubscribe();
    });

    it('should support selective subscriptions', () => {
      let updateCount = 0;
      const unsubscribe = usePlayerStore.subscribe(
        (state) => state.error,
        () => updateCount++
      );
      expect(typeof unsubscribe).toBe('function');
      unsubscribe();
    });
  });

  describe('Favorites Management', () => {
    it('should initialize with favorites property', () => {
      const state = usePlayerStore.getState();
      expect(state).toHaveProperty('favorites');
      expect(state.favorites instanceof Set).toBe(true);
    });
  });

  describe('History Tracking', () => {
    it('should track play history', () => {
      const state = usePlayerStore.getState();
      expect(state).toHaveProperty('history');
      expect(Array.isArray(state.history)).toBe(true);
    });

    it('should track play counts', () => {
      const state = usePlayerStore.getState();
      expect(state).toHaveProperty('playCounts');
      expect(typeof state.playCounts).toBe('object');
    });
  });

  describe('Search & Display', () => {
    it('should support search functionality', () => {
      const state = usePlayerStore.getState();
      expect(typeof state.setSearchQuery).toBe('function');
      expect(state).toHaveProperty('searchQuery');
    });

    it('should support display language selection', () => {
      const state = usePlayerStore.getState();
      expect(typeof state.setDisplayLanguage).toBe('function');
      expect(state).toHaveProperty('displayLanguage');
    });
  });
});
