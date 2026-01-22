import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { usePlayerStore } from '../store/playerStore';
import { useLyricsStore } from '../store/lyricsStore';
import { useCoverArt } from '../hooks/useCoverArt';
import { useSettingsStore } from '../store/settingsStore';
import { SquigglySlider } from './SquigglySlider';
import { MarqueeText } from './MarqueeText';
import {
    IconLyrics,
    IconPrevious,
    IconPlay,
    IconPause,
    IconNext,
    IconVolume,
    IconMusicNote
} from './Icons';

// Format seconds to MM:SS
function formatTime(seconds: number): string {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
}

// Lyrics button component
function LyricsButton({ track }: { track: { title: string; artist: string; duration_secs: number; path: string } | null }) {
    const { showLyrics, toggleLyrics, fetchLyrics, isLoading } = useLyricsStore();

    const handleClick = () => {
        if (track) {
            // Fetch lyrics if we have a track
            fetchLyrics(track.artist, track.title, track.duration_secs, track.path);
        }
        toggleLyrics();
    };

    return (
        <button
            onClick={handleClick}
            disabled={!track}
            className={`p-2 rounded-full transition-colors ${showLyrics ? 'bg-primary-container text-on-primary-container' : 'text-on-surface-variant hover:bg-surface-container-highest hover:text-on-surface'}`}
            title="Lyrics"
        >
            {isLoading ? (
                <div className="text-label-small">(Loading)</div>
            ) : (
                <IconLyrics size={24} />
            )}
        </button>
    );
}

export function PlayerBar() {
    const { status, pause, resume, setVolume, refreshStatus, nextTrack, prevTrack, getCurrentTrackIndex, library, playFile, seek, error, setError } = usePlayerStore();
    const { albumArtStyle, expandedArtMode } = useSettingsStore();
    const { state, track, position_secs, volume } = status;
    const lastStateRef = useRef(state);

    // Poll for status updates while playing
    useEffect(() => {
        if (state === 'Playing') {
            const interval = setInterval(refreshStatus, 500);
            return () => clearInterval(interval);
        }
    }, [state, refreshStatus]);

    // Auto-clear error
    useEffect(() => {
        if (error) {
            const timer = setTimeout(() => setError(null), 4000);
            return () => clearTimeout(timer);
        }
    }, [error, setError]);

    // Auto-play next track when current track ends
    useEffect(() => {
        if (lastStateRef.current === 'Playing' && state === 'Stopped' && track) {
            const isFinished = position_secs >= track.duration_secs - 0.5;
            if (isFinished) {
                nextTrack();
            }
        }
        lastStateRef.current = state;
    }, [state, track, position_secs, nextTrack]);

    const handlePlayPause = () => {
        if (state === 'Playing') {
            pause();
        } else if (state === 'Paused') {
            resume();
        } else if (state === 'Stopped' && track) {
            playFile(track.path);
        }
    };

    const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setVolume(parseFloat(e.target.value));
    };

    const handleSeek = (newValue: number) => {
        seek(newValue);
    };

    const currentIndex = getCurrentTrackIndex();
    const hasPrev = currentIndex > 0;
    const hasNext = currentIndex >= 0 && currentIndex < library.length - 1;

    const currentLibraryTrack = currentIndex >= 0 ? library[currentIndex] : null;
    const isYtUrl = currentLibraryTrack?.cover_url !== undefined;
    const coverUrl = isYtUrl ? currentLibraryTrack?.cover_url : useCoverArt(currentLibraryTrack?.cover_image);
    const activeCoverUrl = track?.cover_url || coverUrl;

    const [isHovered, setIsHovered] = useState(false);
    const hoverTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const handleMouseEnter = () => {
        if (hoverTimeoutRef.current) {
            clearTimeout(hoverTimeoutRef.current);
            hoverTimeoutRef.current = null;
        }
        setIsHovered(true);
    };

    const handleMouseLeave = () => {
        hoverTimeoutRef.current = setTimeout(() => {
            setIsHovered(false);
        }, 300); // 300ms buffer to prevent glitching
    };

    return (
        <div
            className="fixed bottom-6 left-0 right-0 z-50 flex flex-col items-center justify-end pointer-events-none gap-4"
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
        >
            {/* Error Toast */}
            <AnimatePresence>
                {error && (
                    <motion.div
                        initial={{ opacity: 0, y: 20, scale: 0.9 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 10, scale: 0.95 }}
                        className="bg-red-500 text-white px-6 py-3 rounded-full shadow-elevation-3 font-medium text-body-medium flex items-center gap-3 pointer-events-auto"
                    >
                        <span>⚠️ {error}</span>
                        <button onClick={() => setError(null)} className="opacity-80 hover:opacity-100">✕</button>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Player Container */}
            <motion.div
                layout
                initial={false}
                animate={{
                    width: isHovered ? '90%' : '20rem', // 20rem is w-80
                    height: isHovered ? '6rem' : '4rem', // 6rem is h-24, 4rem is h-16
                    borderRadius: isHovered ? '2rem' : '9999px',
                    maxWidth: isHovered ? '56rem' : '20rem', // 56rem is max-w-4xl
                }}
                transition={{ type: "spring", stiffness: 200, damping: 25, mass: 1 }}
                className={`
                    pointer-events-auto
                    relative 
                    bg-surface-container-high 
                    text-on-surface
                    shadow-elevation-3
                    overflow-hidden
                    flex items-center
                    ${isHovered ? 'px-6 py-3 gap-6' : 'px-4 py-2 gap-4'}
                `}
            >
                {/* Background Art Overlay (Expanded Mode) */}
                <AnimatePresence>
                    {isHovered && expandedArtMode === 'background' && activeCoverUrl && (
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="absolute inset-0 z-0 pointer-events-none overflow-hidden rounded-[2rem]"
                        >
                            <div className="absolute left-0 top-0 bottom-0 w-3/4">
                                <img
                                    src={activeCoverUrl}
                                    alt=""
                                    className="w-full h-full object-cover opacity-50"
                                />
                                {/* Smooth fade into the pill background */}
                                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-surface-container-high/20 to-surface-container-high" />
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* Progress Fill Background (Minimal Mode only) */}
                {!isHovered && track && (
                    <div
                        className="absolute inset-0 z-0 bg-primary/30 pointer-events-none transition-all duration-200 ease-linear"
                        style={{ width: `${(position_secs / (track.duration_secs || 1)) * 100}%` }}
                    />
                )}

                <AnimatePresence mode="wait">
                    {isHovered ? (
                        /* EXPANDED LAYOUT */
                        <motion.div
                            key="expanded"
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            transition={{ duration: 0.2 }}
                            className="flex w-full items-center gap-6 relative z-10 h-full"
                        >
                            {/* Left: Info */}
                            <div className="flex items-center gap-4 flex-1 min-w-0">
                                {/* Cover Art - Only show in pill mode or if background art is disabled */}
                                {expandedArtMode === 'pill' && (
                                    <div
                                        className={`
                                            relative shrink-0 overflow-hidden bg-surface-container-low shadow-sm transition-all duration-300
                                            ${albumArtStyle === 'vinyl' ? 'w-16 h-16 rounded-full' : 'w-16 h-16 rounded-xl'}
                                        `}
                                    >
                                        {activeCoverUrl ? (
                                            <img
                                                src={activeCoverUrl}
                                                alt=""
                                                className={`
                                                    w-full h-full object-cover
                                                    ${albumArtStyle === 'vinyl' && state === 'Playing' ? 'animate-spin-slow' : ''}
                                                `}
                                            />
                                        ) : (
                                            <div className="w-full h-full flex items-center justify-center text-on-surface-variant">
                                                <IconMusicNote size={24} />
                                            </div>
                                        )}

                                        {/* Vinyl Center Hole */}
                                        {albumArtStyle === 'vinyl' && (
                                            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                                                <div className="w-4 h-4 bg-surface-container-high rounded-full border border-surface-container-low/50" />
                                            </div>
                                        )}
                                    </div>
                                )}

                                <div className="flex flex-col min-w-0">
                                    <div className="text-title-medium font-bold truncate  text-on-surface">
                                        <MarqueeText text={track?.title || "Not Playing"} />
                                    </div>
                                    <div className="text-body-medium text-on-surface-variant truncate">
                                        {track?.artist || "Pick a song"}
                                    </div>
                                </div>
                            </div>

                            {/* Center: Controls */}
                            <div className="flex flex-col items-center flex-[2] gap-1">
                                <div className="flex items-center gap-6">
                                    <button onClick={prevTrack} disabled={!hasPrev} className="text-on-surface-variant hover:text-on-surface disabled:opacity-30 p-2 rounded-full hover:bg-surface-container-highest">
                                        <IconPrevious size={28} />
                                    </button>
                                    <button
                                        onClick={handlePlayPause}
                                        className="w-14 h-14 bg-primary text-on-primary rounded-2xl flex items-center justify-center hover:bg-primary/90 shadow-elevation-1 transition-transform active:scale-95"
                                    >
                                        {state === 'Playing' ? (
                                            <IconPause size={32} />
                                        ) : (
                                            <IconPlay size={32} />
                                        )}
                                    </button>
                                    <button onClick={nextTrack} disabled={!hasNext} className="text-on-surface-variant hover:text-on-surface disabled:opacity-30 p-2 rounded-full hover:bg-surface-container-highest">
                                        <IconNext size={28} />
                                    </button>
                                </div>

                                {/* Seeker */}
                                <div className="w-full flex items-center gap-3 text-label-small font-medium text-on-surface-variant/80">
                                    <span className="w-10 text-right">{formatTime(position_secs)}</span>
                                    <div className="flex-1 h-6 relative flex items-center">
                                        <SquigglySlider
                                            value={position_secs}
                                            max={track?.duration_secs || 100}
                                            onChange={handleSeek}
                                            isPlaying={state === 'Playing'}
                                            accentColor="var(--md-sys-color-primary)"
                                            className="w-full"
                                        />
                                    </div>
                                    <span className="w-10">{track ? formatTime(track.duration_secs) : '0:00'}</span>
                                </div>
                            </div>

                            {/* Right: Actions */}
                            <div className="flex items-center gap-2 flex-1 justify-end">
                                <LyricsButton track={track} />

                                <div className="flex items-center gap-2 group relative">
                                    <IconVolume size={24} className="text-on-surface-variant" />
                                    <input
                                        type="range" min="0" max="1" step="0.01" value={volume}
                                        onChange={handleVolumeChange}
                                        className="w-24 accent-primary"
                                    />
                                </div>
                            </div>
                        </motion.div>
                    ) : (
                        /* MINIMAL LAYOUT */
                        <motion.div
                            key="minimal"
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            transition={{ duration: 0.2 }}
                            className="flex w-full items-center gap-4 relative z-10"
                        >
                            {/* Cover Art (Tiny) */}
                            <div
                                className={`
                                    relative shrink-0 overflow-hidden bg-surface-container-low border border-outline-variant/20 transition-all duration-300
                                    ${albumArtStyle === 'vinyl' ? 'w-10 h-10 rounded-full' : 'w-10 h-10 rounded-sm'}
                                `}
                            >
                                {activeCoverUrl ? (
                                    <img
                                        src={activeCoverUrl}
                                        alt=""
                                        className={`
                                            w-full h-full object-cover
                                            ${albumArtStyle === 'vinyl' && state === 'Playing' ? 'animate-spin-slow' : ''}
                                        `}
                                    />
                                ) : (
                                    <div className="w-full h-full flex items-center justify-center text-on-surface-variant">
                                        <IconMusicNote size={16} />
                                    </div>
                                )}

                                {/* Vinyl Center Hole (Minimal) */}
                                {albumArtStyle === 'vinyl' && (
                                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                                        <div className="w-2 h-2 bg-surface-container-high rounded-full border border-surface-container-low/30" />
                                    </div>
                                )}
                            </div>

                            {/* Text Info */}
                            <div className="flex-1 min-w-0 flex items-center gap-2 overflow-hidden z-10">
                                <div className="text-label-large font-bold truncate text-on-surface">
                                    <MarqueeText text={track?.title || "Not Playing"} />
                                </div>
                                <span className="text-on-surface-variant text-label-medium">•</span>
                                <div className="text-label-medium text-on-surface-variant truncate max-w-[100px]">
                                    {track?.artist || "Artist"}
                                </div>
                            </div>

                            {/* Time */}
                            <div className="text-label-small font-medium text-on-surface-variant tabular-nums z-10">
                                {formatTime(position_secs)} / {track ? formatTime(track.duration_secs) : '0:00'}
                            </div>

                            {/* Progress Indicator (Background or Border?) */}
                            {/* Optional: Add a subtle progress bar at the bottom? */}
                        </motion.div>
                    )}
                </AnimatePresence>
            </motion.div>
        </div>
    );
}
