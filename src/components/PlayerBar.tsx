import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { usePlayerStore } from '../store/playerStore';
import { useCoverArt } from '../hooks/useCoverArt';
import { useCurrentCover } from '../hooks/useCurrentCover';
import { useSettingsStore } from '../store/settingsStore';
import { TrackDisplay } from '../types';
import { SquigglySlider } from './SquigglySlider';
import { MarqueeText } from './MarqueeText';
import { useRipple } from './RippleEffect';
import {
    IconPrevious,
    IconPlay,
    IconPause,
    IconNext,
    IconVolume,
    IconMusicNote,
    IconShuffle,
} from './Icons';
import { getDisplayText } from '../utils/textUtils';

// Icon for speakers/audio output
function IconSpeaker({ size = 24 }: { size?: number }) {
    return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="4" y="2" width="16" height="20" rx="2" ry="2" />
            <circle cx="12" cy="14" r="4" />
            <line x1="12" y1="6" x2="12" y2="6.01" />
        </svg>
    );
}

// Icon for mobile/phone
function IconMobile({ size = 24 }: { size?: number }) {
    return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="5" y="2" width="14" height="20" rx="2" ry="2" />
            <line x1="12" y1="18" x2="12.01" y2="18" />
        </svg>
    );
}

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

// Format seconds to MM:SS
function formatTime(seconds: number): string {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
}

const SMOOTH_SPRING = { type: 'spring', stiffness: 300, damping: 40, mass: 1 } as const;

// Restored expressive side button design for collapsed mode prev/next.
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
            layout
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
            <motion.svg
                viewBox="0 0 340 340"
                className="absolute inset-0 w-full h-full text-secondary-container drop-shadow-md group-hover:drop-shadow-lg group-hover:text-secondary-container-high transition-colors duration-300"
                animate={{ rotate: rotation }}
                transition={{ type: 'spring', stiffness: 200, damping: 20 }}
            >
                <path d="M261.856 41.2425C272.431 41.9625 277.718 42.3226 281.991 44.1826C288.175 46.8926 293.111 51.8325 295.816 58.0125C297.685 62.2825 298.044 67.5725 298.762 78.1425L300.402 102.273C300.693 106.553 300.838 108.693 301.303 110.733C301.975 113.683 303.142 116.503 304.754 119.063C305.869 120.843 307.279 122.453 310.097 125.683L326.001 143.903C332.97 151.893 336.455 155.882 338.155 160.222C340.615 166.512 340.615 173.493 338.155 179.783C336.455 184.123 332.97 188.112 326.001 196.102L310.097 214.322C307.279 217.552 305.869 219.162 304.754 220.942C303.142 223.502 301.975 226.323 301.303 229.273C300.838 231.313 300.693 233.452 300.402 237.732L298.762 261.863C298.044 272.433 297.685 277.723 295.816 281.993C293.111 288.173 288.175 293.112 281.991 295.822C277.718 297.682 272.431 298.043 261.856 298.763L237.725 300.403C233.448 300.693 231.31 300.843 229.267 301.303C226.316 301.973 223.499 303.143 220.937 304.753C219.164 305.873 217.549 307.283 214.319 310.103L196.097 326.003C188.111 332.973 184.119 336.453 179.775 338.153C173.491 340.623 166.509 340.623 160.225 338.153C155.881 336.453 151.889 332.973 143.903 326.003L125.681 310.103C122.451 307.283 120.836 305.873 119.063 304.753C116.501 303.143 113.684 301.973 110.733 301.303C108.69 300.843 106.552 300.693 102.275 300.403L78.1438 298.763C67.5694 298.043 62.2822 297.682 58.0088 295.822C51.8252 293.112 46.8887 288.173 44.1844 281.993C42.3154 277.723 41.9561 272.433 41.2375 261.863L39.5977 237.732C39.3071 233.452 39.1618 231.313 38.6969 229.273C38.0251 226.323 36.8584 223.502 35.2463 220.942C34.1306 219.162 32.7213 217.552 29.9027 214.322L13.999 196.102C7.02996 188.112 3.54542 184.123 1.84516 179.783C-0.615054 173.493 -0.615053 166.512 1.84516 160.222C3.54542 155.882 7.02996 151.893 13.999 143.903L29.9027 125.683C32.7213 122.453 34.1306 120.843 35.2463 119.063C36.8584 116.503 38.0251 113.683 38.6969 110.733C39.1618 108.693 39.3071 106.553 39.5977 102.273L41.2375 78.1425C41.9561 67.5725 42.3154 62.2825 44.1844 58.0125C46.8887 51.8325 51.8252 46.8926 58.0088 44.1826C62.2823 42.3226 67.5694 41.9625 78.1438 41.2425L102.275 39.6025C106.552 39.3125 108.69 39.1625 110.733 38.7025C113.684 38.0325 116.501 36.8625 119.063 35.2525C120.836 34.1325 122.451 32.7225 125.681 29.9025L143.903 14.0025C151.889 7.03252 155.881 3.5525 160.225 1.8525C166.509 -0.6175 173.491 -0.6175 179.775 1.8525C184.119 3.5525 188.111 7.03252 196.097 14.0025L214.319 29.9025C217.549 32.7225 219.164 34.1325 220.937 35.2525C223.499 36.8625 226.316 38.0325 229.267 38.7025C231.31 39.1625 233.448 39.3125 237.725 39.6025L261.856 41.2425Z" fill="currentColor" />
            </motion.svg>

            <div className="relative z-10 text-on-secondary-container group-hover:text-on-secondary-container-high transition-colors">
                {icon}
            </div>
        </motion.button>
    );
};

type PillBtnProps = React.ButtonHTMLAttributes<HTMLButtonElement> & { onClick: () => void; children: React.ReactNode };
const PillIconButton = ({ onClick, className = '', children, title, disabled, ...props }: PillBtnProps) => (
    <button
        onClick={onClick}
        disabled={disabled}
        title={title}
        {...props}
        className={`flex h-10 w-10 items-center justify-center rounded-full transition-colors disabled:opacity-30 ${className}`}
    >
        {children}
    </button>
);

export function PlayerBar() {
    // Granular selectors — only re-render when the SPECIFIC slice changes
    // This is the #1 optimization: polling updates position_secs every 500ms,
    // but track/state/volume change rarely. Splitting prevents cascading re-renders.
    const state = usePlayerStore(s => s.status.state);
    const track = usePlayerStore(s => s.status.track);
    const library = usePlayerStore(s => s.library);
    const position_secs = usePlayerStore(s => s.status.position_secs);

    // Hydrate track with library data (Romaji/En fields) if available
    const displayTrack = useMemo(() => {
        if (!track) return null;
        return library.find(t => t.path === track.path) || track;
    }, [track, library]);

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
    const audioOutput = usePlayerStore(s => s.audioOutput);
    const setAudioOutput = usePlayerStore(s => s.setAudioOutput);

    const isShuffled = usePlayerStore(s => s.isShuffled);
    const toggleShuffle = usePlayerStore(s => s.toggleShuffle);
    const displayLanguage = usePlayerStore(s => s.displayLanguage);
    const { albumArtStyle, expandedArtMode } = useSettingsStore();
    const lastStateRef = useRef(state);

    const playRipple = useRipple({ size: 50 });

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

    const handlePlayPause = (e?: React.MouseEvent) => {
        if (e) {
            playRipple.trigger(e);
        }
        if (state === 'Playing') {
            pause();
        } else if (state === 'Paused') {
            resume();
        } else if (state === 'Stopped' && track) {
            playFile(track.path);
        }
    };

    const [localVolume, setLocalVolume] = useState(volume);
    const volumeFrameRef = useRef<number | null>(null);
    const pendingVolumeRef = useRef<number | null>(null);

    useEffect(() => {
        setLocalVolume(volume);
    }, [volume]);

    const flushVolume = useCallback(() => {
        if (pendingVolumeRef.current === null) {
            volumeFrameRef.current = null;
            return;
        }

        const next = pendingVolumeRef.current;
        pendingVolumeRef.current = null;
        setVolume(next);
        volumeFrameRef.current = null;
    }, [setVolume]);

    const scheduleVolumeFlush = useCallback(() => {
        if (volumeFrameRef.current !== null) return;
        volumeFrameRef.current = window.requestAnimationFrame(flushVolume);
    }, [flushVolume]);

    const handleVolumeChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        const val = parseFloat(e.target.value);
        setLocalVolume(val);
        pendingVolumeRef.current = val;
        scheduleVolumeFlush();
    }, [scheduleVolumeFlush]);

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
    const activeCoverUrl = useCoverArt(currentCover || track?.cover_image || track?.cover_url, track?.path, true);

    // Determine whether the active cover image is dark or light to choose readable text colors.
    const [isCoverDark, setIsCoverDark] = useState<boolean | null>(null);
    useEffect(() => {
        if (!activeCoverUrl) {
            setIsCoverDark(null);
            return;
        }

        let cancelled = false;
        const img = new Image();
        img.crossOrigin = 'Anonymous';
        img.src = activeCoverUrl;
        img.onload = () => {
            try {
                const w = 32;
                const h = 32;
                const canvas = document.createElement('canvas');
                canvas.width = w;
                canvas.height = h;
                const ctx = canvas.getContext('2d');
                if (!ctx) return;
                ctx.drawImage(img, 0, 0, w, h);
                const data = ctx.getImageData(0, 0, w, h).data;
                let r = 0, g = 0, b = 0, count = 0;
                for (let i = 0; i < data.length; i += 4) {
                    r += data[i];
                    g += data[i + 1];
                    b += data[i + 2];
                    count++;
                }
                if (count === 0) return;
                const avgR = r / count;
                const avgG = g / count;
                const avgB = b / count;
                // Relative luminance approximation
                const lum = 0.2126 * avgR + 0.7152 * avgG + 0.0722 * avgB;
                // Threshold: lower means darker image. Tuneable if needed.
                const dark = lum < 140;
                if (!cancelled) setIsCoverDark(dark);
            } catch (e) {
                if (!cancelled) setIsCoverDark(null);
            }
        };
        img.onerror = () => { if (!cancelled) setIsCoverDark(null); };

        return () => { cancelled = true; };
    }, [activeCoverUrl]);

    const [isExpanded, setIsExpanded] = useState(false);
    const [isPillHovered, setIsPillHovered] = useState(false);
    const [isVolumeHovered, setIsVolumeHovered] = useState(false);
    const [isVolumeDragging, setIsVolumeDragging] = useState(false);
    const hoverTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const clearCollapseTimer = useCallback(() => {
        if (hoverTimeoutRef.current) {
            clearTimeout(hoverTimeoutRef.current);
            hoverTimeoutRef.current = null;
        }
    }, []);

    const scheduleCollapse = useCallback(() => {
        clearCollapseTimer();
        hoverTimeoutRef.current = setTimeout(() => {
            setIsExpanded(false);
        }, 280);
    }, [clearCollapseTimer]);

    useEffect(() => {
        const keepExpanded = isPillHovered || isVolumeHovered || isVolumeDragging;
        if (keepExpanded) {
            clearCollapseTimer();
            setIsExpanded(true);
        } else {
            scheduleCollapse();
        }
    }, [isPillHovered, isVolumeHovered, isVolumeDragging, clearCollapseTimer, scheduleCollapse]);

    useEffect(() => {
        return () => {
            clearCollapseTimer();
            if (volumeFrameRef.current !== null) {
                window.cancelAnimationFrame(volumeFrameRef.current);
            }
        };
    }, [clearCollapseTimer]);

    const handleVolumePointerDown = useCallback(() => {
        setIsVolumeDragging(true);

        const handlePointerUp = () => {
            setIsVolumeDragging(false);
            window.removeEventListener('pointerup', handlePointerUp);
        };

        window.addEventListener('pointerup', handlePointerUp);
    }, []);

    return (
        <div className="absolute bottom-6 left-0 right-0 z-50 flex flex-col items-center justify-end pointer-events-none gap-4">
            {error && (
                <div className="bg-red-500 text-white px-6 py-3 rounded-full shadow-elevation-3 font-medium text-body-medium flex items-center gap-3 pointer-events-auto">
                    <span>Warning: {error}</span>
                    <button onClick={() => setError(null)} className="opacity-80 hover:opacity-100">x</button>
                </div>
            )}

            <div className="flex items-center justify-center gap-3 w-full h-[6rem]">
                <AnimatePresence>
                    {!isExpanded && (
                        <ExpressiveControlButton
                            onClick={prevTrack}
                            disabled={!hasPrev}
                            icon={<IconPrevious size={24} />}
                            direction="left"
                        />
                    )}
                </AnimatePresence>

                <div
                    onMouseEnter={(e) => {
                        const tgt = e.target as HTMLElement;
                        if (tgt && tgt.closest && tgt.closest('.no-expand')) return;
                        setIsPillHovered(true);
                    }}
                    onMouseLeave={() => setIsPillHovered(false)}
                    className={`
                        pointer-events-auto relative z-20 text-on-surface overflow-hidden isolation-isolate border backdrop-blur-xl
                        transition-all duration-200 ease-out rounded-full
                        ${isExpanded
                            ? 'w-[min(90vw,56rem)] h-24 px-6 bg-black/60 border-white/10 shadow-[0_22px_44px_-12px_rgba(0,0,0,0.6)]'
                            : 'w-80 h-16 px-4 bg-[rgba(22,22,26,0.7)] border-white/10 shadow-[0_16px_34px_-8px_rgba(0,0,0,0.55)]'
                        }
                    `}
                >
                    {isExpanded && expandedArtMode === 'background' && activeCoverUrl && (
                        <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden">
                            <img src={activeCoverUrl} alt="" className="w-full h-full object-cover opacity-55 scale-105" />
                            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-surface-container-high/60 to-surface-container-high" />
                        </div>
                    )}

                    {/* Primary tint overlay for expanded pill removed per request */}

                    {track && (
                        <>
                            {!isExpanded ? (
                                <div
                                    className="absolute left-0 top-0 bottom-0 z-[1] pointer-events-none flex items-stretch text-secondary-container rounded-l-full"
                                    style={{
                                        width: `${Math.min(100, (position_secs / (track.duration_secs || 1)) * 100)}%`
                                    }}
                                >
                                    <div className="flex-1 bg-current" />
                                    <div className="w-[12px] h-full shrink-0 overflow-hidden relative -ml-[1px]">
                                        <motion.div
                                            className="w-full absolute top-0 left-0"
                                            style={{ height: 'calc(100% + 40px)', top: '-40px' }}
                                            animate={state === 'Playing' ? { y: ['0px', '40px'] } : { y: '0px' }}
                                            transition={{ duration: 1, ease: 'linear', repeat: Infinity }}
                                        >
                                            <svg className="h-full w-full" preserveAspectRatio="none">
                                                <defs>
                                                    <pattern id="pill-progress-wave" x="0" y="0" width="12" height="40" patternUnits="userSpaceOnUse">
                                                        <path d="M 0 0 L 6 0 Q -4 10 6 20 T 6 40 L 0 40 Z" fill="currentColor" />
                                                    </pattern>
                                                </defs>
                                                <rect x="0" y="0" width="100%" height="100%" fill="url(#pill-progress-wave)" />
                                            </svg>
                                        </motion.div>
                                    </div>
                                </div>
                            ) : (
                                <div
                                    className="absolute left-0 bottom-0 h-1 z-[1] bg-secondary-container transition-[width] duration-200 rounded-full"
                                    style={{ width: `${Math.min(100, (position_secs / (track.duration_secs || 1)) * 100)}%` }}
                                />
                            )}
                        </>
                    )}

                    <div className="relative z-10 h-full flex items-center gap-4">
                        {(!isExpanded || expandedArtMode !== 'background' || !activeCoverUrl) && (
                            <div
                                className={`relative shrink-0 overflow-hidden bg-surface-container-low shadow-sm ${albumArtStyle === 'vinyl' ? 'rounded-full' : 'rounded-xl'}`}
                                style={{ width: isExpanded ? '4rem' : '2.5rem', height: isExpanded ? '4rem' : '2.5rem' }}
                            >
                                {activeCoverUrl ? (
                                    <img
                                        src={activeCoverUrl}
                                        alt=""
                                        className={`w-full h-full object-cover ${albumArtStyle === 'vinyl' && state === 'Playing' ? 'animate-spin-slow' : ''}`}
                                    />
                                ) : (
                                    <div className="w-full h-full flex items-center justify-center text-on-surface-variant">
                                        <IconMusicNote size={isExpanded ? 24 : 16} />
                                    </div>
                                )}
                                {albumArtStyle === 'vinyl' && (
                                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                                        <div className="w-1/4 h-1/4 bg-surface-container-high rounded-full border border-surface-container-low/50" />
                                    </div>
                                )}
                            </div>
                        )}

                        <div className="flex min-w-0 flex-col justify-center overflow-hidden">
                            <div className={`text-title-medium font-bold truncate ${
                                isCoverDark === null ? (isExpanded ? 'text-on-primary' : 'text-on-surface') : (isCoverDark ? 'text-white' : 'text-on-surface')
                            } w-full`}>
                                <MarqueeText text={getDisplayText(displayTrack as TrackDisplay, 'title', displayLanguage) || 'Not Playing'} />
                            </div>
                            <div className={`flex items-center gap-2 ${
                                isCoverDark === null ? (isExpanded ? 'text-on-secondary' : 'text-on-surface-variant') : (isCoverDark ? 'text-on-surface-variant' : 'text-on-surface-variant')
                            } w-full`}>
                                <span className="truncate text-body-medium">
                                    {getDisplayText(displayTrack as TrackDisplay, 'artist', displayLanguage) || 'Artist'}
                                </span>
                                {!isExpanded && (
                                    <>
                                        <span className="text-label-medium opacity-60">.</span>
                                        <span className="text-label-small tabular-nums opacity-60">{formatTime(position_secs)}</span>
                                    </>
                                )}
                            </div>
                            {isExpanded && (
                                <div className="mt-1 w-[min(42vw,30rem)] flex items-center gap-2 text-label-small text-on-surface-variant/85">
                                    <span className="w-10 text-right">{formatTime(position_secs)}</span>
                                    <div className="flex-1">
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
                            )}
                        </div>

                        <div className="ml-auto flex items-center gap-1">
                            {isExpanded && (
                                <PillIconButton
                                    onClick={prevTrack}
                                    disabled={!hasPrev}
                                    title="Previous"
                                    className="text-on-surface-variant hover:text-on-surface hover:bg-surface-container-highest"
                                >
                                    <IconPrevious size={20} />
                                </PillIconButton>
                            )}
                            <PillIconButton
                                onClick={handlePlayPause}
                                className="bg-primary text-on-primary shadow-elevation-1 hover:brightness-95 no-expand"
                                title={state === 'Playing' ? 'Pause' : 'Play'}
                                onMouseEnter={(e) => e.stopPropagation()}
                            >
                                {playRipple.render}
                                {state === 'Playing' ? <IconPause size={22} /> : <IconPlay size={22} />}
                            </PillIconButton>
                            {isExpanded && (
                                <PillIconButton
                                    onClick={nextTrack}
                                    disabled={!hasNext}
                                    title="Next"
                                    className="text-on-surface-variant hover:text-on-surface hover:bg-surface-container-highest"
                                >
                                    <IconNext size={20} />
                                </PillIconButton>
                            )}
                        </div>

                        {isExpanded && (
                            <div className="ml-3 flex items-center gap-2">
                                <PillIconButton
                                    onClick={toggleShuffle}
                                    title="Shuffle"
                                    className={isShuffled ? 'text-primary bg-primary-container' : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-container-highest'}
                                >
                                    <IconShuffle size={20} />
                                </PillIconButton>

                                <PillIconButton
                                    onClick={cycleRepeatMode}
                                    title="Repeat"
                                    className={repeatMode !== 'off' ? 'text-primary bg-primary-container' : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-container-highest'}
                                >
                                    <IconRepeat size={20} mode={repeatMode} />
                                </PillIconButton>

                                <PillIconButton
                                    onClick={() => setAudioOutput(audioOutput === 'desktop' ? 'mobile' : 'desktop')}
                                    title="Output Device"
                                    className={audioOutput === 'mobile' ? 'text-primary bg-primary-container' : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-container-highest'}
                                >
                                    {audioOutput === 'desktop' ? <IconSpeaker size={20} /> : <IconMobile size={20} />}
                                </PillIconButton>

                                <div
                                    className="ml-2 flex items-center gap-2 px-2 py-1 rounded-full bg-surface-container-high/70"
                                    onMouseEnter={() => setIsVolumeHovered(true)}
                                    onMouseLeave={() => setIsVolumeHovered(false)}
                                >
                                    <IconVolume size={18} className="text-on-surface-variant" />
                                    <input
                                        type="range"
                                        min="0"
                                        max="1"
                                        step="0.01"
                                        value={localVolume}
                                        onPointerDown={handleVolumePointerDown}
                                        onChange={handleVolumeChange}
                                        className="w-28 accent-primary h-1"
                                    />
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                <AnimatePresence>
                    {!isExpanded && (
                        <ExpressiveControlButton
                            onClick={nextTrack}
                            disabled={!hasNext}
                            icon={<IconNext size={24} />}
                            direction="right"
                        />
                    )}
                </AnimatePresence>
            </div>
        </div>
    );
}
