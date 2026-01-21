import { create } from 'zustand';
import { invoke } from '@tauri-apps/api/core';
import type { PlayerStatus, TrackDisplay } from '../types';

interface PlayerStore {
    // State
    status: PlayerStatus;
    library: TrackDisplay[];
    coversDir: string | null;
    currentFolder: string | null;
    isLoading: boolean;
    error: string | null;

    // Actions
    playFile: (path: string) => Promise<void>;
    pause: () => Promise<void>;
    resume: () => Promise<void>;
    stop: () => Promise<void>;
    setVolume: (value: number) => Promise<void>;
    refreshStatus: () => Promise<void>;
    scanFolder: (path: string) => Promise<void>;
    loadLibrary: () => Promise<void>;
    setError: (error: string | null) => void;
}

export const usePlayerStore = create<PlayerStore>((set, get) => ({
    // Initial state
    status: {
        state: 'Stopped',
        track: null,
        position_secs: 0,
        volume: 1.0,
    },
    library: [],
    coversDir: null,
    currentFolder: null,
    isLoading: false,
    error: null,

    // Actions
    playFile: async (path: string) => {
        try {
            set({ error: null });
            await invoke('play_file', { path });
            await get().refreshStatus();
        } catch (e) {
            set({ error: String(e) });
        }
    },

    pause: async () => {
        try {
            await invoke('pause');
            await get().refreshStatus();
        } catch (e) {
            set({ error: String(e) });
        }
    },

    resume: async () => {
        try {
            await invoke('resume');
            await get().refreshStatus();
        } catch (e) {
            set({ error: String(e) });
        }
    },

    stop: async () => {
        try {
            await invoke('stop');
            await get().refreshStatus();
        } catch (e) {
            set({ error: String(e) });
        }
    },

    setVolume: async (value: number) => {
        try {
            await invoke('set_volume', { value });
            await get().refreshStatus();
        } catch (e) {
            set({ error: String(e) });
        }
    },

    refreshStatus: async () => {
        try {
            const status = await invoke<PlayerStatus>('get_player_state');
            set({ status });
        } catch (e) {
            console.error('Failed to refresh status:', e);
        }
    },

    scanFolder: async (path: string) => {
        try {
            set({ isLoading: true, error: null });
            // Use new backend command that inserts into DB
            const tracks = await invoke<TrackDisplay[]>('init_library', { path });
            // Add ID property
            const tracksWithId = tracks.map(t => ({ ...t, id: t.path }));
            set({ library: tracksWithId, currentFolder: path, isLoading: false });
        } catch (e) {
            set({ error: String(e), isLoading: false });
        }
    },

    loadLibrary: async () => {
        try {
            set({ isLoading: true });
            const tracks = await invoke<TrackDisplay[]>('get_library_tracks');
            // Fetch covers directory if we don't have it (or always)
            let { coversDir } = get();
            if (!coversDir) {
                coversDir = await invoke<string>('get_covers_dir');
            }

            const tracksWithId = tracks.map(t => ({ ...t, id: t.path }));
            set({ library: tracksWithId, coversDir, isLoading: false });
        } catch (e) {
            console.error('Failed to load library:', e);
            set({ isLoading: false });
        }
    },

    setError: (error: string | null) => set({ error }),
}));
