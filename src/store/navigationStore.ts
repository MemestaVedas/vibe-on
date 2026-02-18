import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

import type { AppView } from '../types';



interface NavigationState {
    view: AppView;
    selectedAlbumKey: string | null;
    activePlaylistId: string | null;
    isRightPanelOpen: boolean;

    setView: (view: AppView) => void;
    navigateToAlbum: (albumName: string, artistName: string) => void;
    navigateToPlaylist: (playlistId: string) => void;
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

export const useNavigationStore = create<NavigationState>()(
    persist(
        (set) => ({
            view: 'tracks',
            selectedAlbumKey: null,
            activePlaylistId: null,
            isRightPanelOpen: false,
            isRightPanelCollapsed: false,
            isLeftSidebarCollapsed: false,

            setView: (view) => set({ view, selectedAlbumKey: null, activePlaylistId: null }),
            navigateToAlbum: (albumName, artistName) => set({
                view: 'albums',
                selectedAlbumKey: `${albumName}-${artistName}`,
                activePlaylistId: null
            }),
            navigateToPlaylist: (playlistId) => set({
                view: 'playlist',
                activePlaylistId: playlistId,
                selectedAlbumKey: null
            }),
            clearSelectedAlbum: () => set({ selectedAlbumKey: null }),

            toggleRightPanel: () => set((state) => ({ isRightPanelOpen: !state.isRightPanelOpen })),
            setRightPanelOpen: (isOpen) => set({ isRightPanelOpen: isOpen }),

            toggleRightPanelCollapsed: () => set((state) => ({ isRightPanelCollapsed: !state.isRightPanelCollapsed })),
            setRightPanelCollapsed: (isCollapsed) => set({ isRightPanelCollapsed: isCollapsed }),

            toggleLeftSidebar: () => set((state) => ({ isLeftSidebarCollapsed: !state.isLeftSidebarCollapsed })),
            setLeftSidebarCollapsed: (isCollapsed) => set({ isLeftSidebarCollapsed: isCollapsed })
        }),
        {
            name: 'navigation-storage',
            storage: createJSONStorage(() => localStorage), // Use localStorage for dragging persistence across sessions
            partialize: (state) => ({
                view: state.view,
                selectedAlbumKey: state.selectedAlbumKey,
                activePlaylistId: state.activePlaylistId,
                isLeftSidebarCollapsed: state.isLeftSidebarCollapsed,
                isRightPanelCollapsed: state.isRightPanelCollapsed
            }),
        }
    )
);
