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

// Repeat icon component
function IconRepeat({ size = 24, mode = 'off' }: { size?: number; mode?: 'off' | 'all' | 'one' }) {
    return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="17 1 21 5 17 9" />
            <path d="M3 11V9a4 4 0 0 1 4-4h14" />
            <polyline points="7 23 3 19 7 15" />
            <path d="M21 13v2a4 4 0 0 1-4 4H3" />
            {mode === 'one' && <text x="12" y="14" fontSize="8" textAnchor="middle" fill="currentColor" stroke="none">1</text>}
        </svg>
    );
}

// Heart icon for favorites
function IconHeart({ size = 24, filled = false }: { size?: number; filled?: boolean }) {
    return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill={filled ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2">
            <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
        </svg>
    );
}

// Format seconds to MM:SS
function formatTime(seconds: number): string {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
}

// Lyrics button component
function LyricsButton({ track }: { track: { title: string; artist: string; duration_secs: number; path: string } | null }) {
    const { showLyrics, toggleLyrics, loadCachedLyrics, isLoading } = useLyricsStore();

    const handleClick = () => {
        if (track) {
            // Load lyrics from backend cache (prefetched when song started playing)
            loadCachedLyrics(track.path);
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
    const {
        status, pause, resume, setVolume, refreshStatus, nextTrack, prevTrack,
        getCurrentTrackIndex, library, playFile, seek, repeatMode, cycleRepeatMode,
        error, setError
    } = usePlayerStore();
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

                {!isHovered && track && (
                    <div
                        className="absolute left-0 top-0 bottom-0 z-[1] pointer-events-none flex items-stretch text-primary opacity-40 rounded-l-full"
                        style={{
                            width: `${(position_secs / (track.duration_secs || 1)) * 100}%`,
                            transition: 'width 0.5s cubic-bezier(0.2, 0, 0, 1)'
                        }}
                    >
                        {/* Solid fill part */}
                        <div className="flex-1 bg-current" />

                        {/* Vertical Wave Edge */}
                        <div className="w-[12px] h-full shrink-0 overflow-hidden relative -mr-[1px]">
                            {/* -mr-1 to ensure no gaps if render is sub-pixel */}
                            <motion.div
                                className="w-full absolute top-0 left-0"
                                style={{ height: 'calc(100% + 40px)', top: '-40px' }}
                                animate={state === 'Playing' ? { y: ['0px', '40px'] } : { y: '0px' }}
                                transition={{
                                    duration: 1, // Speed of one cycle (40px)
                                    ease: "linear",
                                    repeat: Infinity
                                }}
                            >
                                <svg
                                    className="h-full w-full"
                                    preserveAspectRatio="none"
                                >
                                    <defs>
                                        <pattern id="pill-progress-wave" x="0" y="0" width="12" height="40" patternUnits="userSpaceOnUse">
                                            {/* We use motion.path to morph between wave and straight line */}
                                            {/* Note: pattern paths inside defs might not animate well with framer-motion if rerendered. 
                                                However, Framer Motion needs to control the DOM element. 
                                                If it's inside a pattern, it might be tricky. 
                                                Alternative: Don't use pattern?
                                                Actually, if we animate the 'd' of a path inside a pattern, it should update.
                                            */}
                                            <motion.path
                                                // Wave Path: M 0 0 L 6 0 Q 1 10 6 20 T 6 40 L 0 40 Z
                                                // Straight Path (matched points): M 0 0 L 6 0 L 6 20 L 6 40 L 0 40 Z
                                                // To match Q/T commands, we can use curves that are actually straight lines.
                                                // Wave: Q 1 10 6 20 (Control point 1 at x=1 pulls it left)
                                                // Straight: Q 6 10 6 20 (Control point at x=6 keeps it straight)
                                                // Wave: T 6 40 (Implied reflection, effectively Q 11 30 6 40)
                                                // Straight: T 6 40 (Implied reflection of straight is straight? Q 6 30 6 40)

                                                initial={false}
                                                animate={{
                                                    d: state === 'Playing'
                                                        ? "M 0 0 L 6 0 Q 1 10 6 20 T 6 40 L 0 40 Z" // Wavy
                                                        : "M 0 0 L 6 0 Q 6 10 6 20 T 6 40 L 0 40 Z" // Straight (Control points aligned)
                                                }}
                                                transition={{ duration: 0.3 }}
                                                fill="currentColor"
                                            />
                                        </pattern>
                                    </defs>
                                    <rect x="0" y="0" width="100%" height="100%" fill="url(#pill-progress-wave)" />
                                </svg>
                            </motion.div>
                        </div>
                    </div>
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
                                {/* Favorite Button */}
                                {track && (
                                    <button
                                        onClick={() => usePlayerStore.getState().toggleFavorite(track.path)}
                                        className={`p-2 rounded-full transition-colors ${usePlayerStore.getState().isFavorite(track.path)
                                            ? 'text-error'
                                            : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-container-highest'
                                            }`}
                                        title={usePlayerStore.getState().isFavorite(track.path) ? 'Remove from Favorites' : 'Add to Favorites'}
                                    >
                                        <IconHeart size={22} filled={usePlayerStore.getState().isFavorite(track.path)} />
                                    </button>
                                )}

                                {/* Repeat Button */}
                                <button
                                    onClick={cycleRepeatMode}
                                    className={`p-2 rounded-full transition-colors ${repeatMode !== 'off'
                                        ? 'text-primary bg-primary-container'
                                        : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-container-highest'
                                        }`}
                                    title={`Repeat: ${repeatMode === 'off' ? 'Off' : repeatMode === 'all' ? 'All' : 'One'}`}
                                >
                                    <IconRepeat size={22} mode={repeatMode} />
                                </button>

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
