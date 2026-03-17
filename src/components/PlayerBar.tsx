import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
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

const PillIconButton = ({ onClick, disabled, className = '', children, title }: { onClick: () => void; disabled?: boolean; className?: string; children: React.ReactNode; title?: string }) => (
    <button
        onClick={onClick}
        disabled={disabled}
        title={title}
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
                {!isExpanded && (
                    <PillIconButton
                        onClick={prevTrack}
                        disabled={!hasPrev}
                        title="Previous"
                        className="pointer-events-auto bg-secondary-container text-on-secondary-container hover:bg-secondary-container-high shadow-elevation-1"
                    >
                        <IconPrevious size={22} />
                    </PillIconButton>
                )}

                <div
                    onMouseEnter={() => setIsPillHovered(true)}
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

                    {track && (
                        <div
                            className="absolute left-0 bottom-0 h-1 z-[1] bg-secondary-container transition-[width] duration-200 rounded-full"
                            style={{ width: `${Math.min(100, (position_secs / (track.duration_secs || 1)) * 100)}%` }}
                        />
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
                            <div className="text-title-medium font-bold truncate text-on-surface w-full">
                                <MarqueeText text={getDisplayText(displayTrack as TrackDisplay, 'title', displayLanguage) || 'Not Playing'} />
                            </div>
                            <div className="flex items-center gap-2 text-on-surface-variant w-full">
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
                            <PillIconButton
                                onClick={prevTrack}
                                disabled={!hasPrev}
                                title="Previous"
                                className="text-on-surface-variant hover:text-on-surface hover:bg-surface-container-highest"
                            >
                                <IconPrevious size={20} />
                            </PillIconButton>
                            <PillIconButton
                                onClick={handlePlayPause}
                                className="bg-primary text-on-primary shadow-elevation-1 hover:brightness-95"
                                title={state === 'Playing' ? 'Pause' : 'Play'}
                            >
                                {playRipple.render}
                                {state === 'Playing' ? <IconPause size={22} /> : <IconPlay size={22} />}
                            </PillIconButton>
                            <PillIconButton
                                onClick={nextTrack}
                                disabled={!hasNext}
                                title="Next"
                                className="text-on-surface-variant hover:text-on-surface hover:bg-surface-container-highest"
                            >
                                <IconNext size={20} />
                            </PillIconButton>
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

                {!isExpanded && (
                    <PillIconButton
                        onClick={nextTrack}
                        disabled={!hasNext}
                        title="Next"
                        className="pointer-events-auto bg-secondary-container text-on-secondary-container hover:bg-secondary-container-high shadow-elevation-1"
                    >
                        <IconNext size={22} />
                    </PillIconButton>
                )}
            </div>
        </div>
    );
}
