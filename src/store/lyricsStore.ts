import { create } from 'zustand';
import { invoke } from '@tauri-apps/api/core';
import type { LyricsLine } from '../types';

interface LyricsStore {
    // State
    lines: LyricsLine[] | null;      // Parsed synced lyrics
    plainLyrics: string | null;       // Fallback plain lyrics
    isLoading: boolean;
    error: string | null;
    showLyrics: boolean;              // Panel visibility
    currentTrackId: string | null;    // Track we fetched lyrics for (path)
    isInstrumental: boolean;

    // Actions
    fetchLyrics: (artist: string, track: string, duration: number, trackPath: string) => Promise<void>;
    toggleLyrics: () => void;
    closeLyrics: () => void;
    clearLyrics: () => void;
}

/**
 * Parse LRC format lyrics into structured array
 * LRC format: [mm:ss.xx]Lyric text
 * Example: [00:12.34]Hello world
 */
function parseLRC(lrcString: string): LyricsLine[] {
    const lines: LyricsLine[] = [];
    const regex = /\[(\d{2}):(\d{2})\.(\d{2,3})\](.*)/g;

    let match;
    while ((match = regex.exec(lrcString)) !== null) {
        const minutes = parseInt(match[1], 10);
        const seconds = parseInt(match[2], 10);
        const milliseconds = parseInt(match[3].padEnd(3, '0'), 10);
        const text = match[4].trim();

        // Convert to seconds (float)
        const time = minutes * 60 + seconds + milliseconds / 1000;

        if (text) { // Only add non-empty lines
            lines.push({ time, text });
        }
    }

    // Sort by timestamp (should already be sorted, but just in case)
    lines.sort((a, b) => a.time - b.time);

    return lines;
}

export const useLyricsStore = create<LyricsStore>()((set, get) => ({
    // Initial state
    lines: null,
    plainLyrics: null,
    isLoading: false,
    error: null,
    showLyrics: false,
    currentTrackId: null,
    isInstrumental: false,

    fetchLyrics: async (artist: string, track: string, duration: number, trackPath: string) => {
        // Don't refetch for same track
        if (get().currentTrackId === trackPath && (get().lines || get().plainLyrics)) {
            return;
        }

        set({ isLoading: true, error: null, lines: null, plainLyrics: null, isInstrumental: false });

        try {
            // Duration needs to be in whole seconds for the API
            const durationInt = Math.round(duration);

            const response = await invoke<{
                syncedLyrics: string | null;
                plainLyrics: string | null;
                instrumental: boolean | null;
            }>('get_lyrics', {
                artist,
                track,
                duration: durationInt
            });

            const isInstrumental = response.instrumental ?? false;

            if (response.syncedLyrics) {
                // Parse LRC format
                const parsed = parseLRC(response.syncedLyrics);
                set({
                    lines: parsed,
                    plainLyrics: response.plainLyrics,
                    currentTrackId: trackPath,
                    isLoading: false,
                    isInstrumental
                });
            } else if (response.plainLyrics) {
                // Fallback to plain lyrics
                set({
                    lines: null,
                    plainLyrics: response.plainLyrics,
                    currentTrackId: trackPath,
                    isLoading: false,
                    isInstrumental
                });
            } else if (isInstrumental) {
                set({
                    lines: null,
                    plainLyrics: null,
                    currentTrackId: trackPath,
                    isLoading: false,
                    isInstrumental: true,
                    error: null
                });
            } else {
                set({
                    error: 'No lyrics found',
                    currentTrackId: trackPath,
                    isLoading: false
                });
            }
        } catch (e) {
            set({
                error: String(e),
                isLoading: false,
                currentTrackId: trackPath
            });
        }
    },

    toggleLyrics: () => {
        set(state => ({ showLyrics: !state.showLyrics }));
    },

    closeLyrics: () => {
        set({ showLyrics: false });
    },

    clearLyrics: () => {
        set({
            lines: null,
            plainLyrics: null,
            error: null,
            currentTrackId: null,
            isInstrumental: false
        });
    },
}));
