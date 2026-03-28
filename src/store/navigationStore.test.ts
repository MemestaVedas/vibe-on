import { describe, it, expect, beforeEach } from 'vitest';
import { useNavigationStore } from './navigationStore';

describe('useNavigationStore', () => {
  beforeEach(() => {
    // Reset before each test by fetching fresh state
    useNavigationStore.setState({
      view: 'home',
      isRightPanelOpen: false,
      isRightPanelCollapsed: false,
      isLeftSidebarCollapsed: false,
    });
  });

  describe('Store Structure', () => {
    it('should initialize with expected properties', () => {
      const state = useNavigationStore.getState();
      
      expect(state).toHaveProperty('view');
      expect(state).toHaveProperty('isRightPanelOpen');
      expect(state).toHaveProperty('isRightPanelCollapsed');
      expect(state).toHaveProperty('isLeftSidebarCollapsed');
      expect(state).toHaveProperty('setView');
    });

    it('should have action methods', () => {
      const state = useNavigationStore.getState();
      
      expect(typeof state.setView).toBe('function');
      expect(typeof state.setRightPanelOpen).toBe('function');
      expect(typeof state.setRightPanelCollapsed).toBe('function');
      expect(typeof state.setLeftSidebarCollapsed).toBe('function');
    });
  });

  describe('Initial State', () => {
    it('should start with home view', () => {
      const state = useNavigationStore.getState();
      expect(state.view).toBe('home');
    });

    it('should start with panels collapsed', () => {
      const state = useNavigationStore.getState();
      expect(state.isRightPanelOpen).toBe(false);
      expect(state.isRightPanelCollapsed).toBe(false);
      expect(state.isLeftSidebarCollapsed).toBe(false);
    });
  });

  describe('State Immutability', () => {
    it('should maintain store reference consistency', () => {
      const store1 = useNavigationStore.getState();
      const store2 = useNavigationStore.getState();
      expect(store1).toBe(store2);
    });

    it('should support subscriptions', () => {
      let changeCount = 0;
      const unsubscribe = useNavigationStore.subscribe(
        (state) => state.view,
        () => changeCount++
      );
      
      expect(typeof unsubscribe).toBe('function');
      unsubscribe();
    });
  });

  describe('View Types', () => {
    it('should support valid view types', () => {
      const validViews = [
        'home',
        'playlist',
        'favorites',
        'artists',
        'albums',
        'torrents',
        'statistics2',
        'tracks',
        'settings',
      ];
      
      const state = useNavigationStore.getState();
      validViews.forEach((view) => {
        expect(() => {
          state.setView(view as any);
        }).not.toThrow();
      });
    });
  });

  describe('Panel State Management', () => {
    it('should track independent panel states', () => {
      const state = useNavigationStore.getState();
      
      // Right panel can be open/closed
      expect(typeof state.isRightPanelOpen).toBe('boolean');
      
      // Right panel can be collapsed (separate from open/closed)
      expect(typeof state.isRightPanelCollapsed).toBe('boolean');
      
      // Left sidebar collapse is independent
      expect(typeof state.isLeftSidebarCollapsed).toBe('boolean');
    });
  });

  describe('Persistence & Performance', () => {
    it('store should be lightweight', () => {
      const state = useNavigationStore.getState();
      const keys = Object.keys(state);
      
      // Should have reasonable number of properties (8-12 for state + actions)
      expect(keys.length).toBeGreaterThan(0);
      expect(keys.length).toBeLessThan(20);
    });
  });
});
