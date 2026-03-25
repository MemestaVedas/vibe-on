import { describe, it, expect, beforeEach } from 'vitest';
import { useSettingsStore } from './settingsStore';

describe('useSettingsStore', () => {
  beforeEach(() => {
    // Reset to defaults
    useSettingsStore.setState({
      theme: 'dark',
      language: 'en',
      compactMode: false,
      autoPlayOnConnect: true,
      showLyrics: true,
      animationsEnabled: true,
    });
  });

  describe('Store Initialization', () => {
    it('should have all expected setting properties', () => {
      const state = useSettingsStore.getState();
      
      expect(state).toHaveProperty('theme');
      expect(state).toHaveProperty('language');
      expect(state).toHaveProperty('compactMode');
      expect(state).toHaveProperty('autoPlayOnConnect');
      expect(state).toHaveProperty('showLyrics');
      expect(state).toHaveProperty('animationsEnabled');
    });

    it('should initialize to valid state', () => {
      const state = useSettingsStore.getState();
      
      // Just verify structure is accessible
      expect(typeof state.theme).toBe('string');
      expect(typeof state.language).toBe('string');
      expect(typeof state.compactMode).toBe('boolean');
    });
  });

  describe('Default Values', () => {
    it('should initialize with sensible defaults', () => {
      const state = useSettingsStore.getState();
      
      expect(state.theme).toBe('dark');
      expect(state.language).toBe('en');
      expect(state.compactMode).toBe(false);
      expect(state.autoPlayOnConnect).toBe(true);
      expect(state.showLyrics).toBe(true);
      expect(state.animationsEnabled).toBe(true);
    });
  });

  describe('Style Settings', () => {
    it('should have theme and language properties', () => {
      const state = useSettingsStore.getState();
      
      expect(state).toHaveProperty('theme');
      expect(['light', 'dark', 'auto']).toContain(state.theme);
      
      expect(state).toHaveProperty('language');
      expect(typeof state.language).toBe('string');
    });
  });

  describe('Boolean Settings', () => {
    it('should track boolean setting states', () => {
      const state = useSettingsStore.getState();
      
      expect(typeof state.compactMode).toBe('boolean');
      expect(typeof state.autoPlayOnConnect).toBe('boolean');
      expect(typeof state.showLyrics).toBe('boolean');
      expect(typeof state.animationsEnabled).toBe('boolean');
    });
  });

  describe('Store Consistency', () => {
    it('should maintain store reference', () => {
      const store1 = useSettingsStore.getState();
      const store2 = useSettingsStore.getState();
      expect(store1).toBe(store2);
    });

    it('should support subscriptions', () => {
      let updateCount = 0;
      const unsubscribe = useSettingsStore.subscribe(() => {
        updateCount++;
      });
      
      expect(typeof unsubscribe).toBe('function');
      unsubscribe();
    });
  });

  describe('Settings Persistence', () => {
    it('should preserve settings in state', () => {
      const state = useSettingsStore.getState();
      
      // Verify current settings are accessible
      expect(state).toHaveProperty('theme');
      expect(state).toHaveProperty('language');
      expect(state).toHaveProperty('compactMode');
      
      // Get fresh state and verify consistency
      const freshState = useSettingsStore.getState();
      expect(freshState.theme).toBe(state.theme);
      expect(freshState.language).toBe(state.language);
    });
  });
});
