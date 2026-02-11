import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { invoke } from '@tauri-apps/api/core';
import { emit } from '@tauri-apps/api/event';
import type { PlayerStatus, TrackDisplay } from '../types';

type RepeatMode = 'off' | 'all' | 'one';

// Helper function to broadcast queue updates to mobile clients via WebSocket
const broadcastQueueUpdate = async (queue: TrackDisplay[]) => {
    try {
        await emit('queue-updated', {
            tracks: queue.map(t => ({
                path: t.path,
                title: t.title,
                artist: t.artist,
                album: t.album,
                duration_secs: t.duration_secs,
                cover_url: t.cover_image ? `/cover/${encodeURIComponent(t.path)}` : null
            }))
        });
    } catch (e) {
        console.error('[PlayerStore] Failed to broadcast queue update:', e);
    }
};

interface PlayerStore {
    // State
    status: PlayerStatus;
    library: TrackDisplay[];
    history: TrackDisplay[];
    coversDir: string | null;
    currentFolder: string | null; // Kept for now, maybe deprecated later
    folders: string[]; // NEW: List of scanned folders
    isLoading: boolean;
    error: string | null;
    sort: { key: keyof TrackDisplay; direction: 'asc' | 'desc' } | null;
    activeSource: 'local' | 'youtube';

    // Repeat mode
    repeatMode: RepeatMode;

    // Queue & Shuffle
    queue: TrackDisplay[];
    originalQueue: TrackDisplay[];
    isShuffled: boolean;

    // Favorites
    favorites: Set<string>; // Set of track paths
    searchQuery: string; // NEW: Search query

    playCounts: Record<string, number>; // Map of path -> count

    // Persistence
    savedVolume: number;
    lastPlayedTrack: { path: string; position: number } | null;

    // Actions
    playFile: (path: string) => Promise<void>;
    pause: () => Promise<void>;
    resume: () => Promise<void>;
    stop: () => Promise<void>;
    setVolume: (value: number) => Promise<void>;
    seek: (value: number) => Promise<void>;
    refreshStatus: () => Promise<void>;
    refreshLibrary: () => Promise<void>; // Add to interface

    scanFolder: (path: string) => Promise<void>;
    removeFolder: (path: string) => Promise<void>;
    loadLibrary: () => Promise<void>;
    setError: (error: string | null) => void;
    nextTrack: () => Promise<void>;
    prevTrack: () => Promise<void>;
    getCurrentTrackIndex: () => number;
    addToHistory: (track: TrackDisplay) => void;
    setSort: (key: keyof TrackDisplay) => void;
    updateYtStatus: (status: any) => void;
    setSearchQuery: (query: string) => void;
    clearAllData: () => Promise<void>;

    // Queue Actions
    setQueue: (tracks: TrackDisplay[]) => void;
    addToQueue: (track: TrackDisplay) => void;
    playNext: (track: TrackDisplay) => void;
    toggleShuffle: () => void;
    playQueue: (tracks: TrackDisplay[], startIndex?: number) => Promise<void>;

    // Repeat mode actions
    cycleRepeatMode: () => void;

    // Favorites actions
    toggleFavorite: (trackPath: string) => void;
    isFavorite: (trackPath: string) => boolean;

    // Immersive Mode
    immersiveMode: boolean;
    toggleImmersiveMode: () => void;

    // Audio Output Selection
    audioOutput: 'desktop' | 'mobile';
    setAudioOutput: (output: 'desktop' | 'mobile') => Promise<void>;

    // Autoplay Helpers
    playRandomAlbum: () => Promise<void>;
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
            playCounts: {},
            coversDir: null,
            currentFolder: null,
            folders: [],
            isLoading: false,
            error: null,
            sort: null,
            activeSource: 'local',
            searchQuery: '',

            // Persistence defaults
            savedVolume: 1.0,
            lastPlayedTrack: null,

            // Queue & Shuffle
            queue: [],
            originalQueue: [],
            isShuffled: false,

            // Repeat mode
            repeatMode: 'off' as RepeatMode,

            // Favorites
            favorites: new Set<string>(),

            // Immersive Mode
            immersiveMode: false,

            // Audio Output
            audioOutput: 'desktop',

            // Actions
            clearAllData: async () => {
                console.log('[PlayerStore] clearAllData called');
                try {
                    // 1. Clear Backend Data (database, covers, cache, settings)
                    await invoke('clear_all_data');
                    console.log('[PlayerStore] Backend data cleared');

                    // 2. Clear LocalStorage (Zustand persist storage)
                    if (typeof window !== 'undefined') {
                        localStorage.clear();
                        sessionStorage.clear();
                        console.log('[PlayerStore] LocalStorage and SessionStorage cleared');
                    }

                    // 3. Reset store to initial state
                    set({
                        status: { state: 'Stopped', track: null, position_secs: 0, volume: 1.0 },
                        library: [],
                        queue: [],
                        originalQueue: [],
                        isShuffled: false,
                        history: [],
                        playCounts: {},
                        coversDir: null,
                        currentFolder: null,
                        folders: [],
                        isLoading: false,
                        error: null,
                        sort: null,
                        activeSource: 'local',
                        searchQuery: '',
                        repeatMode: 'off',
                        favorites: new Set(),
                        savedVolume: 1.0,
                        lastPlayedTrack: null,
                    });
                    console.log('[PlayerStore] Store state reset');

                    // 4. Reload the app to ensure clean state
                    if (typeof window !== 'undefined') {
                        console.log('[PlayerStore] Reloading application...');
                        window.location.reload();
                    }
                } catch (e) {
                    console.error('[PlayerStore] Failed to clear data:', e);
                    set({ error: String(e) });
                    throw e; // Re-throw so UI can show error
                }
            },

            setSearchQuery: (query: string) => set({ searchQuery: query }),

            setSort: (key: keyof TrackDisplay) => {
                set((state) => {
                    let direction: 'asc' | 'desc' = 'asc';
                    if (state.sort?.key === key && state.sort.direction === 'asc') {
                        direction = 'desc';
                    }

                    const sortedLibrary = [...state.library].sort((a, b) => {
                        const valA = a[key];
                        const valB = b[key];
                        if (typeof valA === 'string' && typeof valB === 'string') {
                            return direction === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA);
                        }
                        if (typeof valA === 'number' && typeof valB === 'number') {
                            return direction === 'asc' ? valA - valB : valB - valA;
                        }
                        return 0;
                    });

                    return { sort: { key, direction }, library: sortedLibrary };
                });
            },

            addToHistory: (track: TrackDisplay) => {
                set((state) => {
                    const filtered = state.history.filter((t) => t.path !== track.path);
                    const newCounts = { ...state.playCounts };
                    newCounts[track.path] = (newCounts[track.path] || 0) + 1;
                    return {
                        history: [track, ...filtered].slice(0, 50),
                        playCounts: newCounts
                    };
                });
            },

            // --- Queue Actions ---

            setQueue: (tracks: TrackDisplay[]) => {
                set({
                    queue: tracks,
                    originalQueue: tracks, // Backup for un-shuffle
                    isShuffled: false
                });
                // Broadcast to mobile clients
                broadcastQueueUpdate(tracks);
            },

            addToQueue: (track: TrackDisplay) => {
                set(state => {
                    const newQueue = [...state.queue, track];
                    // Broadcast updated queue to mobile clients
                    broadcastQueueUpdate(newQueue);
                    return {
                        queue: newQueue,
                        originalQueue: [...state.originalQueue, track]
                    };
                });
            },

            playNext: (track: TrackDisplay) => {
                // Insert track after current playing track
                const { queue, status } = get();
                const currentPath = status.track?.path;
                let insertIndex = -1;

                if (currentPath) {
                    insertIndex = queue.findIndex(t => t.path === currentPath);
                }

                // If no track playing or not found, add to end (or front?) -> Let's add to front if stopped, after current if playing
                if (insertIndex === -1) {
                    // Add to front
                    set(state => {
                        const newQueue = [track, ...state.queue];
                        broadcastQueueUpdate(newQueue);
                        return {
                            queue: newQueue,
                            originalQueue: [track, ...state.originalQueue]
                        };
                    });
                } else {
                    const newQueue = [...queue];
                    newQueue.splice(insertIndex + 1, 0, track);

                    // Also update originalQueue roughly? 
                    // Dealing with originalQueue when shuffling is complex. 
                    // For now, let's just insert into originalQueue at the end or try to sync.
                    // Simple approach: append to original queue if shuffled to avoid messing order.
                    // Or ideally, insert after current in originalQueue too.

                    set(state => {
                        broadcastQueueUpdate(newQueue);
                        return {
                            queue: newQueue,
                            originalQueue: [...state.originalQueue, track] // Simplified
                        };
                    });
                }
            },

            toggleShuffle: () => {
                const { isShuffled, originalQueue, queue, status } = get();

                if (isShuffled) {
                    // Un-shuffle: Restore original order
                    // Try to keep current track playing
                    set({
                        isShuffled: false,
                        queue: [...originalQueue]
                    });
                    broadcastQueueUpdate(originalQueue);
                } else {
                    // Shuffle
                    // Fisher-Yates shuffle
                    const newQueue = [...queue];
                    let currentIndex = newQueue.length;

                    // While there remain elements to shuffle...
                    while (currentIndex != 0) {
                        // Pick a remaining element...
                        let randomIndex = Math.floor(Math.random() * currentIndex);
                        currentIndex--;
                        // And swap it with the current element.
                        [newQueue[currentIndex], newQueue[randomIndex]] = [
                            newQueue[randomIndex], newQueue[currentIndex]];
                    }

                    // Move currently playing track to top if exists
                    const currentPath = status.track?.path;
                    if (currentPath) {
                        const trackIndex = newQueue.findIndex(t => t.path === currentPath);
                        if (trackIndex > -1) {
                            const [track] = newQueue.splice(trackIndex, 1);
                            newQueue.unshift(track);
                        }
                    }

                    set({
                        isShuffled: true,
                        queue: newQueue
                    });
                    broadcastQueueUpdate(newQueue);
                }
            },

            // --- Playback --

            playQueue: async (tracks: TrackDisplay[], startIndex = 0) => {
                try {
                    if (tracks.length === 0) return;

                    const trackToPlay = tracks[startIndex];
                    if (!trackToPlay) return;

                    console.log("[PlayerStore] Setting queue and playing:", trackToPlay.title);

                    set({ queue: tracks });
                    // Broadcast updated queue to mobile clients
                    broadcastQueueUpdate(tracks);

                    await get().playFile(trackToPlay.path);

                } catch (e) {
                    console.error("[PlayerStore] playQueue failed:", e);
                    set({ error: String(e) });
                }
            },

            playFile: async (path: string) => {
                try {
                    console.log("[PlayerStore] Attempting to play:", path);
                    set({ error: null, activeSource: 'local' });

                    await invoke('play_file', { path });

                    // Add to history
                    const track = get().library.find((t) => t.path === path) || get().queue.find(t => t.path === path);
                    if (track) {
                        get().addToHistory(track);
                    }

                    // If queue is empty, auto-populate with library (Fallback behavior)
                    const { queue } = get();
                    if (queue.length === 0) {
                        get().setQueue(get().library);
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
                    set({ savedVolume: value });
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

            refreshLibrary: async () => {
                try {
                    console.log('[PlayerStore] Refreshing library...');
                    set({ isLoading: true });
                    const { folders } = get();

                    // Re-scan all folders
                    for (const folder of folders) {
                        console.log("Rescanning:", folder);
                        await invoke('init_library', { path: folder });
                    }

                    // Reload tracks
                    await get().loadLibrary();
                } catch (e) {
                    console.error("Failed to refresh library", e);
                    set({ error: String(e), isLoading: false });
                }
            },

            scanFolder: async (path: string) => {
                try {
                    set({ isLoading: true, error: null });
                    const tracks = await invoke<TrackDisplay[]>('init_library', { path });
                    const tracksWithId = tracks.map(t => ({ ...t, id: t.path }));

                    set(state => {
                        const newFolders = state.folders.includes(path) ? state.folders : [...state.folders, path];

                        // If queue is empty, set it to library
                        const shouldUpdateQueue = state.queue.length === 0;

                        return {
                            library: tracksWithId,
                            currentFolder: path,
                            folders: newFolders,
                            isLoading: false,
                            queue: shouldUpdateQueue ? tracksWithId : state.queue,
                            originalQueue: shouldUpdateQueue ? tracksWithId : state.originalQueue,
                        };
                    });
                } catch (e) {
                    set({ error: String(e), isLoading: false });
                }
            },

            removeFolder: async (path: string) => {
                try {
                    set({ isLoading: true });
                    await invoke('remove_folder', { path });
                    set(state => ({
                        folders: state.folders.filter(f => f !== path),
                    }));
                    await get().loadLibrary();
                } catch (e) {
                    console.error('Failed to remove folder:', e);
                    set({ error: String(e), isLoading: false });
                }
            },

            loadLibrary: async () => {
                try {
                    set({ isLoading: true });
                    const tracks = await invoke<TrackDisplay[]>('get_library_tracks');
                    let { coversDir } = get();
                    if (!coversDir) {
                        coversDir = await invoke<string>('get_covers_dir');
                    }
                    const tracksWithId = tracks.map(t => ({ ...t, id: t.path }));

                    set(state => ({
                        library: tracksWithId,
                        coversDir,
                        isLoading: false,
                        // If queue is empty (fresh start), populate it
                        queue: state.queue.length === 0 ? tracksWithId : state.queue,
                        originalQueue: state.originalQueue.length === 0 ? tracksWithId : state.originalQueue
                    }));
                } catch (e) {
                    console.error('Failed to load library:', e);
                    set({ isLoading: false });
                }
            },

            setError: (error: string | null) => set({ error }),

            getCurrentTrackIndex: () => {
                const { status, queue } = get();
                if (!status.track) return -1;
                return queue.findIndex(t => t.path === status.track?.path);
            },

            prevTrack: async () => {
                const { queue, playFile, getCurrentTrackIndex, activeSource } = get();

                if (activeSource === 'youtube') {
                    await invoke('yt_control', { action: 'prev' });
                    return;
                }

                const currentIndex = getCurrentTrackIndex();
                if (currentIndex > 0) {
                    await playFile(queue[currentIndex - 1].path);
                } else {
                    // Optional: Wrap around?
                }
            },

            nextTrack: async () => {
                const { queue, playFile, getCurrentTrackIndex, activeSource, repeatMode } = get();

                if (activeSource === 'youtube') {
                    await invoke('yt_control', { action: 'next' });
                    return;
                }

                const currentIndex = getCurrentTrackIndex();

                // Repeat One Logic: Handled by 'media_controls.rs' auto-play usually, but for manual next click:
                // If repeat one is on, Next button SHOULD go to next track or replay? 
                // Standard convention: Next button ALWAYS goes to next track. Auto-finish respects repeat mode.
                // But if Repeat One is play, next button usually forces next track.

                if (currentIndex >= 0 && currentIndex < queue.length - 1) {
                    await playFile(queue[currentIndex + 1].path);
                } else if (repeatMode === 'all' && queue.length > 0) {
                    // Wrap around
                    await playFile(queue[0].path);
                }
            },

            updateYtStatus: (ytStatus: any) => {
                set({
                    activeSource: 'youtube',
                    status: {
                        state: ytStatus.is_playing ? 'Playing' : 'Paused',
                        volume: 1.0,
                        position_secs: ytStatus.progress,
                        track: {
                            title: ytStatus.title,
                            artist: ytStatus.artist,
                            album: ytStatus.album,
                            duration_secs: ytStatus.duration,
                            path: 'youtube',
                            cover_image: null,
                        } as any
                    }
                });
            },

            cycleRepeatMode: () => {
                const { repeatMode } = get();
                const modes: RepeatMode[] = ['off', 'all', 'one'];
                const currentIndex = modes.indexOf(repeatMode);
                const nextMode = modes[(currentIndex + 1) % modes.length];
                set({ repeatMode: nextMode });
            },

            toggleFavorite: (trackPath: string) => {
                const favorites = new Set(get().favorites);
                if (favorites.has(trackPath)) {
                    favorites.delete(trackPath);
                } else {
                    favorites.add(trackPath);
                }
                set({ favorites });
            },

            isFavorite: (trackPath: string) => {
                return get().favorites.has(trackPath);
            },

            toggleImmersiveMode: () => {
                set(state => ({ immersiveMode: !state.immersiveMode }));
            },
            setAudioOutput: async (output) => {
                set({ audioOutput: output });
                // Notify mobile via WebSocket about output change
                try {
                    await emit('output-changed', { output });
                    console.log(`[PlayerStore] Audio output changed to: ${output}`);
                } catch (e) {
                    console.error('[PlayerStore] Failed to notify output change:', e);
                }
            },
            playRandomAlbum: async () => {
                const { library, playQueue } = get();
                if (library.length === 0) return;

                // Group by albums
                const albumsMap = new Map<string, TrackDisplay[]>();
                library.forEach(track => {
                    const albumKey = track.album || 'Unknown Album';
                    if (!albumsMap.has(albumKey)) {
                        albumsMap.set(albumKey, []);
                    }
                    albumsMap.get(albumKey)!.push(track);
                });

                const albumNames = Array.from(albumsMap.keys());
                const randomAlbumName = albumNames[Math.floor(Math.random() * albumNames.length)];
                const albumTracks = albumsMap.get(randomAlbumName) || [];

                if (albumTracks.length > 0) {
                    console.log(`[PlayerStore] Autoplay: Starting random album "${randomAlbumName}"`);
                    await playQueue(albumTracks, 0);
                }
            },
        }),
        {
            name: 'vibe-player-storage',
            partialize: (state) => ({
                history: state.history.slice(0, 20), // Cap persisted history
                playCounts: state.playCounts,
                favorites: Array.from(state.favorites),
                folders: state.folders,
                // Queue is NOT persisted — reconstructed from library on startup
                isShuffled: state.isShuffled,
                savedVolume: state.savedVolume,
                lastPlayedTrack: state.lastPlayedTrack
            }),
            merge: (persistedState: any, currentState) => ({
                ...currentState,
                ...persistedState,
                favorites: new Set(persistedState?.favorites || []),
                folders: persistedState?.folders || [],
                // Queue is NOT restored — will be rebuilt from library on loadLibrary()
                queue: [],
                originalQueue: [],
                isShuffled: persistedState?.isShuffled || false,
                savedVolume: persistedState?.savedVolume ?? 1.0,
                lastPlayedTrack: persistedState?.lastPlayedTrack || null
            })
        }
    )
);

