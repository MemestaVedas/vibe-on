import { create } from 'zustand';
import { invoke } from '@tauri-apps/api/core';
import type { Playlist, PlaylistTrack } from '../types';

interface PlaylistState {
    playlists: Playlist[];
    currentPlaylistTracks: PlaylistTrack[];
    isLoading: boolean;
    error: string | null;
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
    deletePlaylist: (id: string) => Promise<void>;
    renamePlaylist: (id: string, newName: string) => Promise<void>;

    fetchPlaylistTracks: (playlistId: string) => Promise<void>;
    addTrackToPlaylist: (playlistId: string, trackPath: string) => Promise<void>;
    removeTrackFromPlaylist: (playlistId: string, playlistTrackId: number) => Promise<void>;
    reorderPlaylistTracks: (playlistId: string, trackIds: number[]) => Promise<void>;
}

export const usePlaylistStore = create<PlaylistState>((set, get) => ({
    playlists: [],
    currentPlaylistTracks: [],
    isLoading: false,
    error: null,
    recentlyAddedToPlaylist: null,

    isCreateDialogOpen: false,
    isCreateWizardOpen: false,
    pendingTrackToAdd: null,
    openCreateDialog: (trackPath) => set({ isCreateDialogOpen: true, pendingTrackToAdd: trackPath || null }),
    closeCreateDialog: () => set({ isCreateDialogOpen: false, pendingTrackToAdd: null }),
    openCreateWizard: () => set({ isCreateWizardOpen: true }),
    closeCreateWizard: () => set({ isCreateWizardOpen: false }),

    fetchPlaylists: async () => {
        set({ isLoading: true, error: null });
        try {
            const playlists = await invoke<Playlist[]>('get_playlists');
            set({ playlists, isLoading: false });
        } catch (e) {
            set({ error: String(e), isLoading: false });
        }
    },

    createPlaylist: async (name, songPaths = [], customization = {}) => {
        try {
            const payload: any = { name };
            
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
            return id;
        } catch (e) {
            set({ error: String(e) });
            return null;
        }
    },

    deletePlaylist: async (id) => {
        try {
            await invoke('delete_playlist', { id });
            set({ playlists: get().playlists.filter(p => p.id !== id) });
        } catch (e) {
            set({ error: String(e) });
        }
    },

    renamePlaylist: async (id, newName) => {
        try {
            await invoke('rename_playlist', { id, newName });
            await get().fetchPlaylists();
        } catch (e) {
            set({ error: String(e) });
        }
    },

    fetchPlaylistTracks: async (playlistId) => {
        set({ isLoading: true, error: null, currentPlaylistTracks: [] });
        try {
            const tracks = await invoke<PlaylistTrack[]>('get_playlist_tracks', { playlistId });
            set({ currentPlaylistTracks: tracks, isLoading: false });
        } catch (e) {
            set({ error: String(e), isLoading: false });
        }
    },

    addTrackToPlaylist: async (playlistId, trackPath) => {
        try {
            await invoke('add_track_to_playlist', { playlistId, trackPath });

            // Trigger animation
            set({ recentlyAddedToPlaylist: playlistId });
            setTimeout(() => {
                set({ recentlyAddedToPlaylist: null });
            }, 2000);
        } catch (e) {
            set({ error: String(e) });
        }
    },

    removeTrackFromPlaylist: async (playlistId, playlistTrackId) => {
        try {
            await invoke('remove_track_from_playlist', { playlistId, playlistTrackId });

            // Optimistic update if we are viewing this playlist
            const currentTracks = get().currentPlaylistTracks;
            // We assume the fetchPlaylistTracks was called for this playlistId if we are deleting from it visually
            const updatedTracks = currentTracks.filter(t => t.playlist_track_id !== playlistTrackId);
            set({ currentPlaylistTracks: updatedTracks });

            // Optional: Refetch to be sure of order/state
            // await get().fetchPlaylistTracks(playlistId); 
        } catch (e) {
            set({ error: String(e) });
        }
    },

    reorderPlaylistTracks: async (playlistId, trackIds) => {
        try {
            await invoke('reorder_playlist_tracks', { playlistId, trackIds });
            // Refetch to get updated order
            await get().fetchPlaylistTracks(playlistId);
        } catch (e) {
            set({ error: String(e) });
        }
    }
}));
