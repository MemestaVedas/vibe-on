import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { invoke } from '@tauri-apps/api/core';
import type { PlayerStatus, TrackDisplay } from '../types';

type RepeatMode = 'off' | 'all' | 'one';

interface PlayerStore {
    // State
    status: PlayerStatus;
    library: TrackDisplay[];
    history: TrackDisplay[];
    coversDir: string | null;
    currentFolder: string | null;
    isLoading: boolean;
    error: string | null;
    sort: { key: keyof TrackDisplay; direction: 'asc' | 'desc' } | null;
    activeSource: 'local' | 'youtube';

    // Repeat mode
    repeatMode: RepeatMode;

    // Favorites
    favorites: Set<string>; // Set of track paths
    searchQuery: string; // NEW: Search query

    // Actions
    playFile: (path: string) => Promise<void>;
    pause: () => Promise<void>;
    resume: () => Promise<void>;
    stop: () => Promise<void>;
    setVolume: (value: number) => Promise<void>;
    seek: (value: number) => Promise<void>;
    refreshStatus: () => Promise<void>;
    scanFolder: (path: string) => Promise<void>;
    loadLibrary: () => Promise<void>;
    setError: (error: string | null) => void;
    nextTrack: () => Promise<void>;
    prevTrack: () => Promise<void>;
    getCurrentTrackIndex: () => number;
    addToHistory: (track: TrackDisplay) => void;
    setSort: (key: keyof TrackDisplay) => void;
    updateYtStatus: (status: any) => void;
    setSearchQuery: (query: string) => void; // NEW: Set search query

    // Repeat mode actions
    cycleRepeatMode: () => void;

    // Favorites actions
    toggleFavorite: (trackPath: string) => void;
    isFavorite: (trackPath: string) => boolean;
}

export const usePlayerStore = create<PlayerStore>()(
    persist(
        (set, get) => ({
            // Initial state
            status: {
                state: 'Stopped',
                track: null,
                position_secs: 0,
                volume: 1.0,
            },
            library: [],
            history: [],
            coversDir: null,
            currentFolder: null,
            isLoading: false,
            error: null,
            sort: null,
            activeSource: 'local',
            searchQuery: '', // NEW: Empty search query by default

            // Repeat mode
            repeatMode: 'off' as RepeatMode,

            // Favorites (stored as array for persistence, used as Set in memory)
            favorites: new Set<string>(),

            // Actions
            setSearchQuery: (query: string) => set({ searchQuery: query }),

            setSort: (key: keyof TrackDisplay) => {
                set((state) => {
                    let direction: 'asc' | 'desc' = 'asc';
                    if (state.sort?.key === key && state.sort.direction === 'asc') {
                        direction = 'desc';
                    }

                    // Sort logic
                    const sortedLibrary = [...state.library].sort((a, b) => {
                        const valA = a[key];
                        const valB = b[key];

                        if (typeof valA === 'string' && typeof valB === 'string') {
                            return direction === 'asc'
                                ? valA.localeCompare(valB)
                                : valB.localeCompare(valA);
                        }
                        if (typeof valA === 'number' && typeof valB === 'number') {
                            return direction === 'asc' ? valA - valB : valB - valA;
                        }
                        return 0;
                    });

                    return {
                        sort: { key, direction },
                        library: sortedLibrary
                    };
                });
            },

            addToHistory: (track: TrackDisplay) => {
                set((state) => {
                    const filtered = state.history.filter((t) => t.path !== track.path);
                    return { history: [track, ...filtered].slice(0, 50) };
                });
            },

            playFile: async (path: string) => {
                try {
                    console.log("[PlayerStore] Attempting to play:", path);
                    set({ error: null, activeSource: 'local' });
                    // Ensure YT is paused/hidden? (Handled by View change usually, but good to be sure)
                    // await invoke('yt_control', { action: 'pause' }); 

                    await invoke('play_file', { path });
                    console.log("[PlayerStore] Play command sent successfully");

                    // Add to history
                    const track = get().library.find((t) => t.path === path);
                    if (track) {
                        get().addToHistory(track);
                    }

                    await get().refreshStatus();
                } catch (e) {
                    console.error("[PlayerStore] Play failed:", e);
                    set({ error: String(e) });
                }
            },

            pause: async () => {
                try {
                    const { activeSource } = get();
                    if (activeSource === 'youtube') {
                        await invoke('yt_control', { action: 'pause' });
                        // Manually update status to paused for UI responsiveness
                        set((state) => ({ status: { ...state.status, state: 'Paused' } }));
                    } else {
                        await invoke('pause');
                        await get().refreshStatus();
                    }
                } catch (e) {
                    set({ error: String(e) });
                }
            },

            resume: async () => {
                try {
                    const { activeSource } = get();
                    if (activeSource === 'youtube') {
                        await invoke('yt_control', { action: 'play' });
                        set((state) => ({ status: { ...state.status, state: 'Playing' } }));
                    } else {
                        await invoke('resume');
                        await get().refreshStatus();
                    }
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

            seek: async (value: number) => {
                try {
                    const { activeSource } = get();
                    if (activeSource === 'youtube') {
                        await invoke('yt_control', { action: 'seek', value });
                    } else {
                        await invoke('seek', { value });
                        await get().refreshStatus(); // Refresh to update UI immediately
                    }
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

            getCurrentTrackIndex: () => {
                const { status, library } = get();
                if (!status.track) return -1;
                return library.findIndex(t => t.path === status.track?.path);
            },

            prevTrack: async () => {
                const { library, playFile, getCurrentTrackIndex, activeSource } = get();

                if (activeSource === 'youtube') {
                    await invoke('yt_control', { action: 'prev' });
                    return;
                }

                const currentIndex = getCurrentTrackIndex();
                if (currentIndex > 0) {
                    await playFile(library[currentIndex - 1].path);
                }
            },

            nextTrack: async () => {
                const { library, playFile, getCurrentTrackIndex, activeSource } = get();

                if (activeSource === 'youtube') {
                    await invoke('yt_control', { action: 'next' });
                    return;
                }

                const currentIndex = getCurrentTrackIndex();
                if (currentIndex >= 0 && currentIndex < library.length - 1) {
                    await playFile(library[currentIndex + 1].path);
                }
            },

            updateYtStatus: (ytStatus: any) => {
                set({
                    activeSource: 'youtube',
                    status: {
                        state: ytStatus.is_playing ? 'Playing' : 'Paused',
                        volume: 1.0, // Unknown?
                        position_secs: ytStatus.progress,
                        track: {
                            title: ytStatus.title,
                            artist: ytStatus.artist,
                            album: ytStatus.album,
                            duration_secs: ytStatus.duration,
                            path: 'youtube', // dummy
                            cover_image: null, // we need url support in type?
                            // We might need to handle cover_url separately or hack cover_image type
                        } as any
                    }
                });
                // Store cover url separately or hack it?
                // Let's rely on the fact that PlayerBar probably uses useImageColors or similar which might need URL
            },

            // Repeat mode actions
            cycleRepeatMode: () => {
                const { repeatMode } = get();
                const modes: RepeatMode[] = ['off', 'all', 'one'];
                const currentIndex = modes.indexOf(repeatMode);
                const nextMode = modes[(currentIndex + 1) % modes.length];
                console.log('[Repeat] Cycling mode:', repeatMode, '->', nextMode);
                set({ repeatMode: nextMode });
            },

            // Favorites actions
            toggleFavorite: (trackPath: string) => {
                const favorites = new Set(get().favorites);
                if (favorites.has(trackPath)) {
                    favorites.delete(trackPath);
                    console.log('[Favorites] Removed:', trackPath);
                } else {
                    favorites.add(trackPath);
                    console.log('[Favorites] Added:', trackPath);
                }
                set({ favorites });
            },

            isFavorite: (trackPath: string) => {
                return get().favorites.has(trackPath);
            },
        }),
        {
            name: 'vibe-player-storage',
            partialize: (state) => ({
                history: state.history,
                // Convert Set to array for JSON serialization
                favorites: Array.from(state.favorites)
            }),
            // Convert array back to Set on load
            merge: (persistedState: any, currentState) => ({
                ...currentState,
                ...persistedState,
                favorites: new Set(persistedState?.favorites || [])
            })
        }
    )
);

