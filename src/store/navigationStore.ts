import { create } from 'zustand';

export type AppView = 'tracks' | 'albums' | 'artists' | 'settings' | 'ytmusic' | 'favorites' | 'statistics' | 'torrents';

interface NavigationState {
    view: AppView;
    selectedAlbumKey: string | null;
    isRightPanelOpen: boolean;

    setView: (view: AppView) => void;
    navigateToAlbum: (albumName: string, artistName: string) => void;
    clearSelectedAlbum: () => void;

    toggleRightPanel: () => void;
    setRightPanelOpen: (isOpen: boolean) => void;

    isRightPanelCollapsed: boolean;
    toggleRightPanelCollapsed: () => void;
    setRightPanelCollapsed: (isCollapsed: boolean) => void;

    isLeftSidebarCollapsed: boolean;
    toggleLeftSidebar: () => void;
    setLeftSidebarCollapsed: (isCollapsed: boolean) => void;
}

export const useNavigationStore = create<NavigationState>((set) => ({
    view: 'tracks',
    selectedAlbumKey: null,
    isRightPanelOpen: false,
    isRightPanelCollapsed: false,
    isLeftSidebarCollapsed: false,

    setView: (view) => set({ view, selectedAlbumKey: null }),
    navigateToAlbum: (albumName, artistName) => set({
        view: 'albums',
        selectedAlbumKey: `${albumName}-${artistName}`
    }),
    clearSelectedAlbum: () => set({ selectedAlbumKey: null }),

    toggleRightPanel: () => set((state) => ({ isRightPanelOpen: !state.isRightPanelOpen })),
    setRightPanelOpen: (isOpen) => set({ isRightPanelOpen: isOpen }),

    toggleRightPanelCollapsed: () => set((state) => ({ isRightPanelCollapsed: !state.isRightPanelCollapsed })),
    setRightPanelCollapsed: (isCollapsed) => set({ isRightPanelCollapsed: isCollapsed }),

    toggleLeftSidebar: () => set((state) => ({ isLeftSidebarCollapsed: !state.isLeftSidebarCollapsed })),
    setLeftSidebarCollapsed: (isCollapsed) => set({ isLeftSidebarCollapsed: isCollapsed })
}));
