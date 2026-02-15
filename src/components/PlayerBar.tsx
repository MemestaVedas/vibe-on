import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { usePlayerStore } from '../store/playerStore';
import { useCoverArt } from '../hooks/useCoverArt';
import { useCurrentCover } from '../hooks/useCurrentCover';
import { useSettingsStore } from '../store/settingsStore';
import { SquigglySlider } from './SquigglySlider';
import { MarqueeText } from './MarqueeText';
import {
    IconPrevious,
    IconPlay,
    IconPause,
    IconNext,
    IconVolume,
    IconMusicNote,
    IconShuffle,
    IconQueue
} from './Icons';
import { useNavigationStore } from '../store/navigationStore';


// --- Animation Constants ---
const SMOOTH_SPRING = { type: "spring", stiffness: 300, damping: 40, mass: 1 } as const;

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

// Expressive Button with Click Animation and Scalloped Shape (External buttons)
const ExpressiveControlButton = ({ onClick, icon, disabled, direction = 'left' }: { onClick: () => void, icon: React.ReactNode, disabled: boolean, direction?: 'left' | 'right' }) => {
    const [rotation, setRotation] = useState(0);

    const handleClick = () => {
        if (!disabled) {
            setRotation(prev => prev + 120);
            onClick();
        }
    };

    return (
        <motion.button
            layout // Participate in layout changes
            initial={{ opacity: 0, scale: 0.8, x: direction === 'left' ? 20 : -20 }}
            animate={{ opacity: 1, scale: 1, x: 0 }}
            exit={{ opacity: 0, scale: 0.5, x: direction === 'left' ? 10 : -10 }}
            whileHover={{ scale: 1.15 }}
            whileTap={{ scale: 0.9 }}
            transition={SMOOTH_SPRING}
            onClick={handleClick}
            disabled={disabled}
            className="group relative w-12 h-12 flex items-center justify-center pointer-events-auto disabled:opacity-50"
        >
            {/* Rotating Background Shape */}
            <motion.svg
                viewBox="0 0 340 340"
                className="absolute inset-0 w-full h-full text-secondary-container drop-shadow-md group-hover:drop-shadow-lg group-hover:text-secondary-container-high transition-colors duration-300"
                animate={{ rotate: rotation }}
                transition={{ type: "spring", stiffness: 200, damping: 20 }}
            >
                <path d="M261.856 41.2425C272.431 41.9625 277.718 42.3226 281.991 44.1826C288.175 46.8926 293.111 51.8325 295.816 58.0125C297.685 62.2825 298.044 67.5725 298.762 78.1425L300.402 102.273C300.693 106.553 300.838 108.693 301.303 110.733C301.975 113.683 303.142 116.503 304.754 119.063C305.869 120.843 307.279 122.453 310.097 125.683L326.001 143.903C332.97 151.893 336.455 155.882 338.155 160.222C340.615 166.512 340.615 173.493 338.155 179.783C336.455 184.123 332.97 188.112 326.001 196.102L310.097 214.322C307.279 217.552 305.869 219.162 304.754 220.942C303.142 223.502 301.975 226.323 301.303 229.273C300.838 231.313 300.693 233.452 300.402 237.732L298.762 261.863C298.044 272.433 297.685 277.723 295.816 281.993C293.111 288.173 288.175 293.112 281.991 295.822C277.718 297.682 272.431 298.043 261.856 298.763L237.725 300.403C233.448 300.693 231.31 300.843 229.267 301.303C226.316 301.973 223.499 303.143 220.937 304.753C219.164 305.873 217.549 307.283 214.319 310.103L196.097 326.003C188.111 332.973 184.119 336.453 179.775 338.153C173.491 340.623 166.509 340.623 160.225 338.153C155.881 336.453 151.889 332.973 143.903 326.003L125.681 310.103C122.451 307.283 120.836 305.873 119.063 304.753C116.501 303.143 113.684 301.973 110.733 301.303C108.69 300.843 106.552 300.693 102.275 300.403L78.1438 298.763C67.5694 298.043 62.2822 297.682 58.0088 295.822C51.8252 293.112 46.8887 288.173 44.1844 281.993C42.3154 277.723 41.9561 272.433 41.2375 261.863L39.5977 237.732C39.3071 233.452 39.1618 231.313 38.6969 229.273C38.0251 226.323 36.8584 223.502 35.2463 220.942C34.1306 219.162 32.7213 217.552 29.9027 214.322L13.999 196.102C7.02996 188.112 3.54542 184.123 1.84516 179.783C-0.615054 173.493 -0.615053 166.512 1.84516 160.222C3.54542 155.882 7.02996 151.893 13.999 143.903L29.9027 125.683C32.7213 122.453 34.1306 120.843 35.2463 119.063C36.8584 116.503 38.0251 113.683 38.6969 110.733C39.1618 108.693 39.3071 106.553 39.5977 102.273L41.2375 78.1425C41.9561 67.5725 42.3154 62.2825 44.1844 58.0125C46.8887 51.8325 51.8252 46.8926 58.0088 44.1826C62.2823 42.3226 67.5694 41.9625 78.1438 41.2425L102.275 39.6025C106.552 39.3125 108.69 39.1625 110.733 38.7025C113.684 38.0325 116.501 36.8625 119.063 35.2525C120.836 34.1325 122.451 32.7225 125.681 29.9025L143.903 14.0025C151.889 7.03252 155.881 3.5525 160.225 1.8525C166.509 -0.6175 173.491 -0.6175 179.775 1.8525C184.119 3.5525 188.111 7.03252 196.097 14.0025L214.319 29.9025C217.549 32.7225 219.164 34.1325 220.937 35.2525C223.499 36.8625 226.316 38.0325 229.267 38.7025C231.31 39.1625 233.448 39.3125 237.725 39.6025L261.856 41.2425Z" fill="currentColor" />
            </motion.svg>

            {/* Icon */}
            <div className="relative z-10 text-on-secondary-container group-hover:text-on-secondary-container-high transition-colors">
                {icon}
            </div>
        </motion.button>
    );
};

// Internal organic button that accepts motion props
const OrganicControlButton = ({ onClick, disabled, children, className = '', active = false, ...props }: any) => (
    <motion.button
        onClick={onClick}
        disabled={disabled}
        whileHover={{ scale: active ? 1.05 : 1.15, rotate: 0 }}
        whileTap={{ scale: 0.9 }}
        className={`relative flex items-center justify-center rounded-full transition-colors disabled:opacity-30 ${className}`}
        {...props}
    >
        {children}
    </motion.button>
);

export function PlayerBar() {
    // Granular selectors — only re-render when the SPECIFIC slice changes
    // This is the #1 optimization: polling updates position_secs every 500ms,
    // but track/state/volume change rarely. Splitting prevents cascading re-renders.
    const state = usePlayerStore(s => s.status.state);
    const track = usePlayerStore(s => s.status.track);
    const position_secs = usePlayerStore(s => s.status.position_secs);
    const volume = usePlayerStore(s => s.status.volume);
    const pause = usePlayerStore(s => s.pause);
    const resume = usePlayerStore(s => s.resume);
    const setVolume = usePlayerStore(s => s.setVolume);
    const refreshStatus = usePlayerStore(s => s.refreshStatus);
    const nextTrack = usePlayerStore(s => s.nextTrack);
    const prevTrack = usePlayerStore(s => s.prevTrack);
    const queue = usePlayerStore(s => s.queue);
    const playFile = usePlayerStore(s => s.playFile);
    const seek = usePlayerStore(s => s.seek);
    const repeatMode = usePlayerStore(s => s.repeatMode);
    const cycleRepeatMode = usePlayerStore(s => s.cycleRepeatMode);
    const error = usePlayerStore(s => s.error);
    const setError = usePlayerStore(s => s.setError);
    const isShuffled = usePlayerStore(s => s.isShuffled);
    const toggleShuffle = usePlayerStore(s => s.toggleShuffle);
    const { albumArtStyle, expandedArtMode } = useSettingsStore();
    const { isRightPanelOpen, toggleRightPanel } = useNavigationStore();
    const lastStateRef = useRef(state);

    // Derive isFavorite from favorites set — no getState() during render
    const isFav = usePlayerStore(s => track?.path ? s.favorites.has(track.path) : false);

    // Poll for status updates while playing (500ms = smooth enough for progress bar)
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
            const isFinished = position_secs >= track.duration_secs - 2.0;

            if (isFinished) {
                if (repeatMode === 'one') {
                    playFile(track.path);
                } else {
                    nextTrack();
                }
            }
        }
        lastStateRef.current = state;
    }, [state, track, position_secs, nextTrack, repeatMode, playFile]);

    const handlePlayPause = () => {
        if (state === 'Playing') {
            pause();
        } else if (state === 'Paused') {
            resume();
        } else if (state === 'Stopped' && track) {
            playFile(track.path);
        }
    };

    // Debounce volume to avoid IPC flooding during slider drag
    const volumeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const handleVolumeChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        const val = parseFloat(e.target.value);
        if (volumeTimerRef.current) clearTimeout(volumeTimerRef.current);
        volumeTimerRef.current = setTimeout(() => setVolume(val), 50);
    }, [setVolume]);

    const handleSeek = useCallback((newValue: number) => {
        seek(newValue);
    }, [seek]);

    // Memoize queue index with normalized matching for Windows support
    const currentIndex = useMemo(() => {
        if (!track) return -1;
        const nt = track.path.replace(/\\/g, '/').toLowerCase();
        return queue.findIndex(t => t.path.replace(/\\/g, '/').toLowerCase() === nt);
    }, [queue, track]);
    const hasPrev = currentIndex > 0;
    const hasNext = currentIndex >= 0 && currentIndex < queue.length - 1;

    // Determine Cover URL — robust lookup with fallback
    const currentCover = useCurrentCover();
    const activeCoverUrl = useCoverArt(currentCover || track?.cover_image || track?.cover_url);

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
        }, 300);
    };

    return (
        <div className="absolute bottom-6 left-0 right-0 z-50 flex flex-col items-center justify-end pointer-events-none gap-4">
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

            {/* Container for Pill and Side Buttons */}
            <div className="flex items-center justify-center gap-4 w-full h-[6rem]">
                {/* Previous Button (External) */}
                <AnimatePresence>
                    {!isHovered && (
                        <ExpressiveControlButton
                            onClick={prevTrack}
                            disabled={!hasPrev}
                            icon={<IconPrevious size={24} />}
                            direction="left"
                        />
                    )}
                </AnimatePresence>

                {/* Player Container */}
                <motion.div
                    layout
                    onMouseEnter={handleMouseEnter}
                    onMouseLeave={handleMouseLeave}
                    initial={false}
                    animate={{
                        width: isHovered ? '90%' : '20rem',
                        height: isHovered ? '6rem' : '4rem',
                        paddingLeft: isHovered ? '1.5rem' : '1rem',
                        paddingRight: isHovered ? '1.5rem' : '1rem',
                        maxWidth: isHovered ? '56rem' : '20rem',
                        backgroundColor: isHovered
                            ? 'rgba(0,0,0,0.6)'
                            : 'rgba(22, 22, 26, 0.7)', // Semi-transparent to show edge-to-edge content
                        borderColor: isHovered ? 'rgba(255,255,255,0.1)' : 'rgba(255,255,255,0.08)',
                        boxShadow: isHovered
                            ? '0 25px 50px -12px rgba(0,0,0,0.6)'
                            : '0 20px 40px -8px rgba(0,0,0,0.6)',
                        borderRadius: '9999px',
                        scale: isHovered ? 1.02 : 1.01
                    }}
                    transition={SMOOTH_SPRING}
                    className={`
                    pointer-events-auto
                    relative
                    z-20
                    text-on-surface
                    overflow-hidden
                    isolation-isolate
                    flex items-center
                    backdrop-blur-xl
                    border
                    gap-4
                `}
                >
                    {/* Background Art Overlay (Expanded Mode) */}
                    <AnimatePresence>
                        {isHovered && expandedArtMode === 'background' && activeCoverUrl && (
                            <motion.div
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                transition={{ duration: 0.5 }}
                                className="absolute inset-0 z-0 pointer-events-none overflow-hidden"
                            >
                                <div className="absolute inset-0">
                                    <img src={activeCoverUrl} alt="" className="w-full h-full object-cover opacity-60 scale-105" />
                                </div>
                                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-surface-container-high/60 to-surface-container-high" />
                            </motion.div>
                        )}
                    </AnimatePresence>

                    {/* Progress Wave (Minimal Only) - now managed via simple opacity fade */}
                    <AnimatePresence>
                        {!isHovered && track && (
                            <motion.div
                                key="progress-wave"
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                transition={{ duration: 0.3 }}
                                className="absolute left-0 top-0 bottom-0 z-[1] pointer-events-none flex items-stretch text-secondary-container rounded-l-full"
                                style={{
                                    width: `${(position_secs / (track.duration_secs || 1)) * 100}%`
                                }}
                            >
                                <div className="flex-1 bg-current" />
                                {/* Vertical Wave Edge */}
                                <div className="w-[12px] h-full shrink-0 overflow-hidden relative -mr-1">
                                    <motion.div
                                        className="w-full absolute top-0 left-0"
                                        style={{ height: 'calc(100% + 40px)', top: '-40px' }}
                                        animate={state === 'Playing' ? { y: ['0px', '40px'] } : { y: '0px' }}
                                        transition={{ duration: 1, ease: "linear", repeat: Infinity }}
                                    >
                                        <svg className="h-full w-full" preserveAspectRatio="none">
                                            <defs>
                                                <pattern id="pill-progress-wave" x="0" y="0" width="12" height="40" patternUnits="userSpaceOnUse">
                                                    <path d="M 0 0 L 6 0 Q 1 10 6 20 T 6 40 L 0 40 Z" fill="currentColor" />
                                                </pattern>
                                            </defs>
                                            <rect x="0" y="0" width="100%" height="100%" fill="url(#pill-progress-wave)" />
                                        </svg>
                                    </motion.div>
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>

                    {/*
                       SHARED CONTENT LAYOUT
                       We render elements for both states, using layoutId to morph them.
                    */}

                    {/* 1. Cover Art */}
                    <AnimatePresence mode="popLayout">
                        {(!isHovered || expandedArtMode !== 'background' || !activeCoverUrl) && (
                            <motion.div
                                layout
                                layoutId="cover-art-container"
                                initial={{ scale: 0.8, opacity: 0, width: '1rem' }}
                                animate={{ scale: 1, opacity: 1, width: isHovered ? '4rem' : '2.5rem' }}
                                exit={{ scale: 0.8, opacity: 0, width: '1rem' }}
                                className={`relative shrink-0 overflow-hidden bg-surface-container-low shadow-sm z-30
                                    ${albumArtStyle === 'vinyl' ? 'rounded-full' : 'rounded-xl'}
                                  `}
                                style={{
                                    height: isHovered ? '4rem' : '2.5rem',
                                }}
                            >
                                {activeCoverUrl ? (
                                    <img
                                        src={activeCoverUrl}
                                        alt=""
                                        className={`w-full h-full object-cover ${albumArtStyle === 'vinyl' && state === 'Playing' ? 'animate-spin-slow' : ''}`}
                                    />
                                ) : (
                                    <div className="w-full h-full flex items-center justify-center text-on-surface-variant">
                                        <IconMusicNote size={isHovered ? 24 : 16} />
                                    </div>
                                )}
                                {albumArtStyle === 'vinyl' && (
                                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                                        <div className="w-1/4 h-1/4 bg-surface-container-high rounded-full border border-surface-container-low/50" />
                                    </div>
                                )}
                            </motion.div>
                        )}
                    </AnimatePresence>

                    {/* 2. Track Info */}
                    {/* 2. Track Info */}
                    <motion.div
                        layout
                        layoutId="track-info"
                        transition={{ type: "spring", stiffness: 400, damping: 30 }}
                        className="flex flex-col min-w-0 justify-center z-20 overflow-hidden relative"
                        style={{
                            flex: isHovered ? '0 1 auto' : '1',
                            marginRight: isHovered ? '25%' : '0', // Push text away from center controls
                            alignItems: 'flex-start'
                        }}
                    >
                        {/* Title */}
                        <motion.div layout className="text-title-medium font-bold truncate text-on-surface w-full flex items-center gap-2">
                            <MarqueeText text={track?.title || "Not Playing"} />
                        </motion.div>

                        {/* Artist / Time */}
                        <motion.div layout className="flex items-center gap-2 text-on-surface-variant w-full">
                            <span className="truncate text-body-medium">
                                {track?.artist || "Artist"}
                            </span>
                            {!isHovered && (
                                <motion.div
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    exit={{ opacity: 0 }}
                                    className="flex items-center gap-2"
                                >
                                    <span className="text-label-medium opacity-60">•</span>
                                    <span className="text-label-small tabular-nums opacity-60">
                                        {formatTime(position_secs)}
                                    </span>
                                </motion.div>
                            )}
                        </motion.div>
                    </motion.div>

                    {/* 3. Expanded Controls - Only present when hovered */}
                    <AnimatePresence>
                        {isHovered && (
                            <motion.div
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                transition={{ duration: 0.2 }}
                                className="absolute inset-0 z-20 pointer-events-none flex items-center justify-center"
                            >
                                {/* Center: Controls - Absolutely Positioned for Sticky Behavior */}
                                <div className="pointer-events-auto flex flex-col items-center justify-center gap-1 w-full max-w-[50%]">
                                    <div className="flex items-center justify-center gap-6 relative">
                                        {/* Prev Button - Springs from Right (Center) to Left */}
                                        <OrganicControlButton
                                            onClick={prevTrack}
                                            disabled={!hasPrev}
                                            className="bg-secondary-container text-on-secondary-container hover:bg-secondary-container-high p-2"
                                            initial={{ x: 40, opacity: 0, scale: 0.5 }}
                                            animate={{ x: 0, opacity: 1, scale: 1 }}
                                            transition={{ type: "spring", stiffness: 300, damping: 20 }}
                                        >
                                            <IconPrevious size={24} />
                                        </OrganicControlButton>

                                        {/* Play/Pause - Static/Sticky Center */}
                                        <OrganicControlButton
                                            onClick={handlePlayPause}
                                            className="w-12 h-12 bg-primary text-on-primary shadow-elevation-1 hover:shadow-elevation-2 z-10"
                                            active
                                            initial={{ scale: 0.8, opacity: 0 }}
                                            animate={{ scale: 1, opacity: 1 }}
                                            transition={{ type: "spring", stiffness: 400, damping: 25 }}
                                        >
                                            {state === 'Playing' ? <IconPause size={24} /> : <IconPlay size={24} />}
                                        </OrganicControlButton>

                                        {/* Next Button - Springs from Left (Center) to Right */}
                                        <OrganicControlButton
                                            onClick={nextTrack}
                                            disabled={!hasNext}
                                            className="bg-secondary-container text-on-secondary-container hover:bg-secondary-container-high p-2"
                                            initial={{ x: -40, opacity: 0, scale: 0.5 }}
                                            animate={{ x: 0, opacity: 1, scale: 1 }}
                                            transition={{ type: "spring", stiffness: 300, damping: 20 }}
                                        >
                                            <IconNext size={24} />
                                        </OrganicControlButton>
                                    </div>

                                    {/* Seeker - Below controls */}
                                    <motion.div
                                        initial={{ opacity: 0, y: -10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{ delay: 0.1 }}
                                        className="w-full flex items-center gap-3 text-label-small font-medium text-on-surface-variant/80 px-8"
                                    >
                                        <span className="w-10 text-right">{formatTime(position_secs)}</span>
                                        <div className="flex-1 h-4 relative flex items-center">
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
                                    </motion.div>
                                </div>

                                {/* Right Actions - Positioned absolutely to the right, centered vertically */}
                                <div className="absolute right-6 top-1/2 -translate-y-1/2 flex items-center gap-2 pointer-events-auto">
                                    {track && (
                                        <OrganicControlButton
                                            onClick={() => usePlayerStore.getState().toggleFavorite(track.path)}
                                            className={`p-2 ${isFav ? 'text-error' : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-container-highest'}`}
                                            initial={{ x: -20, opacity: 0 }}
                                            animate={{ x: 0, opacity: 1 }}
                                            transition={{ delay: 0.05 }}
                                        >
                                            <IconHeart size={22} filled={isFav} />
                                        </OrganicControlButton>
                                    )}

                                    <OrganicControlButton
                                        onClick={toggleShuffle}
                                        className={`p-2 ${isShuffled ? 'text-primary bg-primary-container' : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-container-highest'}`}
                                        initial={{ x: -20, opacity: 0 }}
                                        animate={{ x: 0, opacity: 1 }}
                                        transition={{ delay: 0.1 }}
                                    >
                                        <IconShuffle size={22} />
                                    </OrganicControlButton>

                                    <OrganicControlButton
                                        onClick={cycleRepeatMode}
                                        className={`p-2 ${repeatMode !== 'off' ? 'text-primary bg-primary-container' : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-container-highest'}`}
                                        initial={{ x: -20, opacity: 0 }}
                                        animate={{ x: 0, opacity: 1 }}
                                        transition={{ delay: 0.15 }}
                                    >
                                        <IconRepeat size={22} mode={repeatMode} />
                                    </OrganicControlButton>

                                    {/* Queue Toggle */}
                                    <OrganicControlButton
                                        onClick={toggleRightPanel}
                                        className={`p-2 ${isRightPanelOpen ? 'text-primary bg-primary-container' : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-container-highest'}`}
                                        initial={{ x: -20, opacity: 0 }}
                                        animate={{ x: 0, opacity: 1 }}
                                        transition={{ delay: 0.2 }}
                                    >
                                        <IconQueue size={22} />
                                    </OrganicControlButton>

                                    <div className="flex items-center gap-2 ml-2">
                                        <IconVolume size={20} className="text-on-surface-variant" />
                                        <input
                                            type="range" min="0" max="1" step="0.01" value={volume}
                                            onChange={handleVolumeChange}
                                            className="w-20 accent-primary h-1"
                                        />
                                    </div>
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </motion.div>

                {/* Next Button (External) */}
                <AnimatePresence>
                    {!isHovered && (
                        <ExpressiveControlButton
                            onClick={nextTrack}
                            disabled={!hasNext}
                            icon={<IconNext size={24} />}
                            direction="right"
                        />
                    )}
                </AnimatePresence>
            </div >
        </div >
    );
}
