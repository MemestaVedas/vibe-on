import { useEffect } from 'react';
import { TitleBar } from './TitleBar';
import { SideLyrics } from './SideLyrics';
import { usePlayerStore } from '../store/playerStore';
import { ThemeManager } from './ThemeManager';
import { useLyricsStore } from '../store/lyricsStore';

export function FloatingLyricsApp() {
    const { refreshStatus, status } = usePlayerStore();
    const { fetchLyrics } = useLyricsStore();

    // Poll for status in this window independently
    useEffect(() => {
        const interval = setInterval(refreshStatus, 500);
        return () => clearInterval(interval);
    }, [refreshStatus]);

    // Ensure lyrics are fetched if track changes (and we missed the main window trigger)
    useEffect(() => {
        if (status.track) {
            fetchLyrics(status.track.artist, status.track.title, status.track.duration_secs, status.track.path);
        }
    }, [status.track?.path, fetchLyrics]);

    return (
        <div className="h-screen w-screen bg-surface overflow-hidden flex flex-col text-on-surface select-none">
            <ThemeManager />

            {/* Custom drag region for the floating window */}
            <div data-tauri-drag-region className="h-10 bg-surface-container flex items-center justify-between px-4 shrink-0">
                <span className="text-label-large font-bold opacity-50 pointer-events-none">Lyrics</span>
                {/* Close button handled by window controls or custom if decorations: false */}
            </div>

            <div className="flex-1 min-h-0 relative p-4">
                <SideLyrics />
            </div>
        </div>
    );
}
