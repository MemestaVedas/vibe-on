import { create } from 'zustand';
import { invoke } from '@tauri-apps/api/core';
import type { Playlist, PlaylistTrack } from '@/types';

interface PlaylistState {
    playlists: Playlist[];
    currentPlaylistTracks: PlaylistTrack[];
    isLoading: boolean;
    isFetchingPlaylists: boolean;
    isFetchingTracks: boolean;
    isCreatingPlaylist: boolean;
    isMutatingPlaylist: boolean;
    isMutatingTracks: boolean;
    isReorderingTracks: boolean;
    error: string | null;
    clearError: () => void;
    isCreateDialogOpen: boolean;
    isCreateWizardOpen: boolean;
    pendingTrackToAdd: string | null;
    openCreateDialog: (trackPath?: string) => void;
    closeCreateDialog: () => void;
    openCreateWizard: () => void;
    closeCreateWizard: () => void;
    recentlyAddedToPlaylist: string | null;

    fetchPlaylists: () => Promise<void>;
    createPlaylist: (name: string, songPaths?: string[], customization?: any) => Promise<string | null>;
    deletePlaylist: (id: string) => Promise<boolean>;
    renamePlaylist: (id: string, newName: string) => Promise<boolean>;

    fetchPlaylistTracks: (playlistId: string) => Promise<void>;
    addTrackToPlaylist: (playlistId: string, trackPath: string) => Promise<void>;
    removeTrackFromPlaylist: (playlistId: string, playlistTrackId: number) => Promise<void>;
    reorderPlaylistTracks: (playlistId: string, trackIds: number[]) => Promise<boolean>;
}

export const usePlaylistStore = create<PlaylistState>((set, get) => ({
    playlists: [],
    currentPlaylistTracks: [],
    isLoading: false,
    isFetchingPlaylists: false,
    isFetchingTracks: false,
    isCreatingPlaylist: false,
    isMutatingPlaylist: false,
    isMutatingTracks: false,
    isReorderingTracks: false,
    error: null,
    clearError: () => set({ error: null }),
    recentlyAddedToPlaylist: null,

    isCreateDialogOpen: false,
    isCreateWizardOpen: false,
    pendingTrackToAdd: null,
    openCreateDialog: (trackPath) => set({ isCreateDialogOpen: true, pendingTrackToAdd: trackPath || null }),
    closeCreateDialog: () => set({ isCreateDialogOpen: false, pendingTrackToAdd: null }),
    openCreateWizard: () => set({ isCreateWizardOpen: true }),
    closeCreateWizard: () => set({ isCreateWizardOpen: false }),

    fetchPlaylists: async () => {
        set({ isLoading: true, isFetchingPlaylists: true, error: null });
        try {
            const playlists = await invoke<Playlist[]>('get_playlists');
            set({ playlists, isLoading: false, isFetchingPlaylists: false });
        } catch (e) {
            set({ error: String(e), isLoading: false, isFetchingPlaylists: false });
        }
    },

    createPlaylist: async (name, songPaths = [], customization = {}) => {
        const trimmedName = name.trim();
        if (!trimmedName) {
            set({ error: 'Playlist name cannot be empty' });
            return null;
        }

        const exists = get().playlists.some(p => p.name.trim().toLowerCase() === trimmedName.toLowerCase());
        if (exists) {
            set({ error: `Playlist \"${trimmedName}\" already exists` });
            return null;
        }

        set({ isCreatingPlaylist: true, error: null });
        try {
            const payload: any = { name: trimmedName };
            
            // Add songs if provided
            if (songPaths && songPaths.length > 0) {
                payload.songs = songPaths;
            }
            
            // Add customization if provided
            if (customization) {
                payload.customizationType = customization.type || 'default';
                
                if (customization.type === 'image' && customization.imageUri) {
                    payload.imageUri = customization.imageUri;
                } else if (customization.type === 'icon') {
                    payload.color = customization.color;
                    payload.iconName = customization.iconName;
                } else if (customization.type === 'default' && customization.color) {
                    payload.color = customization.color;
                }
            }
            
            const id = await invoke<string>('create_playlist', payload);
            // Refetch to get updated state with customizations
            await get().fetchPlaylists();
            set({ isCreatingPlaylist: false });
            return id;
        } catch (e) {
            set({ error: String(e), isCreatingPlaylist: false });
            return null;
        }
    },

    deletePlaylist: async (id) => {
        set({ isMutatingPlaylist: true, error: null });
        try {
            await invoke('delete_playlist', { id });
            set({ playlists: get().playlists.filter(p => p.id !== id), isMutatingPlaylist: false });
            return true;
        } catch (e) {
            set({ error: String(e), isMutatingPlaylist: false });
            return false;
        }
    },

    renamePlaylist: async (id, newName) => {
        const trimmedName = newName.trim();
        if (!trimmedName) {
            set({ error: 'Playlist name cannot be empty' });
            return false;
        }

        const exists = get().playlists.some(p => p.id !== id && p.name.trim().toLowerCase() === trimmedName.toLowerCase());
        if (exists) {
            set({ error: `Playlist \"${trimmedName}\" already exists` });
            return false;
        }

        set({ isMutatingPlaylist: true, error: null });
        try {
            await invoke('rename_playlist', { id, newName: trimmedName });
            await get().fetchPlaylists();
            set({ isMutatingPlaylist: false });
            return true;
        } catch (e) {
            set({ error: String(e), isMutatingPlaylist: false });
            return false;
        }
    },

    fetchPlaylistTracks: async (playlistId) => {
        set({ isLoading: true, isFetchingTracks: true, error: null, currentPlaylistTracks: [] });
        try {
            const tracks = await invoke<PlaylistTrack[]>('get_playlist_tracks', { playlistId });
            set({ currentPlaylistTracks: tracks, isLoading: false, isFetchingTracks: false });
        } catch (e) {
            set({ error: String(e), isLoading: false, isFetchingTracks: false });
        }
    },

    addTrackToPlaylist: async (playlistId, trackPath) => {
        set({ isMutatingTracks: true, error: null });
        try {
            await invoke('add_track_to_playlist', { playlistId, trackPath });

            // Trigger animation
            set({ recentlyAddedToPlaylist: playlistId });
            setTimeout(() => {
                set({ recentlyAddedToPlaylist: null });
            }, 2000);
            set({ isMutatingTracks: false });
        } catch (e) {
            set({ error: String(e), isMutatingTracks: false });
        }
    },

    removeTrackFromPlaylist: async (playlistId, playlistTrackId) => {
        set({ isMutatingTracks: true, error: null });
        try {
            await invoke('remove_track_from_playlist', { playlistId, playlistTrackId });

            // Optimistic update if we are viewing this playlist
            const currentTracks = get().currentPlaylistTracks;
            // We assume the fetchPlaylistTracks was called for this playlistId if we are deleting from it visually
            const updatedTracks = currentTracks.filter(t => t.playlist_track_id !== playlistTrackId);
            set({ currentPlaylistTracks: updatedTracks, isMutatingTracks: false });

            // Optional: Refetch to be sure of order/state
            // await get().fetchPlaylistTracks(playlistId); 
        } catch (e) {
            set({ error: String(e), isMutatingTracks: false });
        }
    },

    reorderPlaylistTracks: async (playlistId, trackIds) => {
        set({ isReorderingTracks: true, error: null });
        try {
            await invoke('reorder_playlist_tracks', { playlistId, trackIds });
            // Refetch to get updated order
            await get().fetchPlaylistTracks(playlistId);
            set({ isReorderingTracks: false });
            return true;
        } catch (e) {
            set({ error: String(e), isReorderingTracks: false });
            return false;
        }
    }
}));
