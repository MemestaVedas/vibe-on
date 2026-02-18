import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

import type { AppView } from '../types';



interface NavigationState {
    view: AppView;
    selectedAlbumKey: string | null;
    selectedArtistName: string | null;
    activePlaylistId: string | null;
    isRightPanelOpen: boolean;

    setView: (view: AppView) => void;
    navigateToAlbum: (albumName: string, artistName: string) => void;
    navigateToArtist: (artistName: string) => void;
    navigateToPlaylist: (playlistId: string) => void;
    clearSelectedAlbum: () => void;
    clearSelectedArtist: () => void;

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
            selectedArtistName: null,
            activePlaylistId: null,
            isRightPanelOpen: false,
            isRightPanelCollapsed: false,
            isLeftSidebarCollapsed: false,

            setView: (view) => set({ view, selectedAlbumKey: null, selectedArtistName: null, activePlaylistId: null }),
            navigateToAlbum: (albumName, artistName) => set({
                view: 'albums',
                selectedAlbumKey: `${albumName}-${artistName}`,
                selectedArtistName: null,
                activePlaylistId: null
            }),
            navigateToArtist: (artistName) => set({
                view: 'artists',
                selectedArtistName: artistName,
                selectedAlbumKey: null,
                activePlaylistId: null
            }),
            navigateToPlaylist: (playlistId) => set({
                view: 'playlist',
                activePlaylistId: playlistId,
                selectedAlbumKey: null,
                selectedArtistName: null
            }),
            clearSelectedAlbum: () => set({ selectedAlbumKey: null }),
            clearSelectedArtist: () => set({ selectedArtistName: null }),

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
                selectedArtistName: state.selectedArtistName,
                activePlaylistId: state.activePlaylistId,
                isLeftSidebarCollapsed: state.isLeftSidebarCollapsed,
                isRightPanelCollapsed: state.isRightPanelCollapsed
            }),
        }
    )
);
