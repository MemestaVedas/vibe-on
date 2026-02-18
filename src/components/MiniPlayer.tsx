import { useState, useRef, useEffect, useMemo } from 'react';
import { usePlayerStore } from '../store/playerStore';
import { useThemeStore } from '../store/themeStore';
import { SquigglySlider } from './SquigglySlider';
import { useCurrentCover } from '../hooks/useCurrentCover';
import { useCoverArt } from '../hooks/useCoverArt';
import {
    IconPrevious, IconNext, IconPause, IconPlay,
    IconShuffle, IconHeart, IconMobileDevice,
    IconComputer, IconFullscreen, IconVolume
} from './Icons';
import { getDisplayText } from '../utils/textUtils';
import { useRipple } from './RippleEffect';

export function MiniPlayer() {
    const containerRef = useRef<HTMLDivElement>(null);
    const ripple = useRipple({ size: 60 });
    const {
        status, resume, pause, nextTrack, prevTrack, seek,
        toggleMiniPlayer, displayLanguage, setVolume,
        refreshStatus, isShuffled, toggleShuffle, toggleFavorite, favorites,
        library
    } = usePlayerStore();
    const { colors } = useThemeStore();
    const [activeDevice, setActiveDevice] = useState<'pc' | 'mobile'>('pc');

    const track = status.track;

    // Hydrate track with library data (Romaji/En fields) if available
    const displayTrack = useMemo(() => {
        if (!track) return null;
        return library.find(t => t.path === track.path) || track;
    }, [track, library]);

    // Derived Favorite state
    const isFav = track?.path ? favorites.has(track.path) : false;

    // Volume Overlay State
    const [showVolume, setShowVolume] = useState(false);
    const volumeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const coverPath = useCurrentCover();
    const coverUrl = useCoverArt(coverPath, track?.path, true);

    const displayTitle = displayTrack ? getDisplayText(displayTrack as any, 'title', displayLanguage) : '';
    const displayArtist = displayTrack ? getDisplayText(displayTrack as any, 'artist', displayLanguage) : '';

    const handlePlayPause = (e: React.MouseEvent) => {
        e.stopPropagation();
        ripple.trigger(e, containerRef.current || undefined);
        if (status.state === 'Playing') pause();
        else resume();
    };

    const handleWheel = (e: React.WheelEvent) => {
        const delta = e.deltaY;
        const step = 0.05;
        const currentVolume = status.volume;

        let newVolume = currentVolume;
        if (delta < 0) {
            newVolume = Math.min(1, currentVolume + step);
        } else {
            newVolume = Math.max(0, currentVolume - step);
        }

        setVolume(newVolume);

        // Show overlay
        setShowVolume(true);

        // Reset timer
        if (volumeTimerRef.current) {
            clearTimeout(volumeTimerRef.current);
        }

        volumeTimerRef.current = setTimeout(() => {
            setShowVolume(false);
        }, 1500);
    };

    // Poll for status updates while playing
    useEffect(() => {
        if (status.state === 'Playing') {
            const interval = setInterval(refreshStatus, 500);
            return () => clearInterval(interval);
        }
    }, [status.state, refreshStatus]);

    // Cleanup timer
    useEffect(() => {
        return () => {
            if (volumeTimerRef.current) clearTimeout(volumeTimerRef.current);
        };
    }, []);

    if (!track) {
        return (
            <div
                className="h-screen w-screen flex flex-col items-center justify-center p-4 select-none relative overflow-hidden"
                style={{ backgroundColor: colors.surfaceContainer }}
                data-tauri-drag-region
            >
                {/* Expand Button (Top Right) */}
                <button
                    onClick={toggleMiniPlayer}
                    className="absolute top-4 right-4 p-2 rounded-full bg-primary/10 hover:bg-primary/20 transition-colors z-20"
                    style={{ color: colors.primary }}
                >
                    <IconFullscreen size={16} />
                </button>
                <p style={{ color: colors.onSurfaceVariant }} className="font-medium text-sm">No Track Playing</p>
            </div>
        )
    }

    return (
        <div
            ref={containerRef}
            className="h-screen w-screen relative overflow-hidden flex flex-col select-none group"
            style={{ backgroundColor: colors.surfaceContainer }}
            data-tauri-drag-region
            onWheel={handleWheel}
        >
            {ripple.render}
            {/* Background Image (Full Bleed, Low Blur) */}
            <div className="absolute inset-0 z-0">
                <img
                    src={coverUrl || '/default-cover.png'}
                    className="w-full h-full object-cover opacity-80"
                    alt=""
                    draggable={false}
                />

                {/* Gradient Scrim for Contrast */}
                <div
                    className="absolute inset-0"
                    style={{
                        background: `linear-gradient(to top, ${colors.surfaceContainer} 0%, ${colors.surfaceContainer}99 20%, ${colors.surfaceContainer}40 50%, ${colors.surfaceContainer}99 100%)`,
                        mixBlendMode: 'multiply'
                    }}
                />
                {/* Color Tint */}
                <div
                    className="absolute inset-0 mix-blend-color opacity-30"
                    style={{ backgroundColor: colors.primary }}
                />
            </div>

            {/* Volume Overlay */}
            <div
                className={`absolute inset-0 z-50 flex items-center justify-center transition-opacity duration-300 pointer-events-none ${showVolume ? 'opacity-100' : 'opacity-0'}`}
                style={{ backgroundColor: 'rgba(0,0,0,0.4)' }}
            >
                <div className="bg-black/40 backdrop-blur-md p-4 rounded-2xl flex flex-col items-center gap-2 text-white">
                    <IconVolume size={32} />
                    <span className="text-xl font-bold">{Math.round(status.volume * 100)}%</span>
                </div>
            </div>

            {/* Content Container */}
            <div className={`relative z-10 flex flex-col justify-between h-full p-3 text-white transition-opacity duration-300 ${showVolume ? 'opacity-40' : 'opacity-100'}`} data-tauri-drag-region>

                {/* Top Row: Device Toggle & Fullscreen */}
                <div className="flex items-center justify-between" data-tauri-drag-region>
                    {/* Device Toggle Pill */}
                    <div className="flex items-center bg-black/20 backdrop-blur-md rounded-full p-0.5" data-tauri-drag-region>
                        <button
                            onClick={() => setActiveDevice('pc')}
                            className={`p-1.5 rounded-full transition-all ${activeDevice === 'pc' ? 'bg-white/20 text-white shadow-sm' : 'text-white/50 hover:text-white/80'}`}
                        >
                            <IconComputer size={14} />
                        </button>
                        <button
                            onClick={() => setActiveDevice('mobile')}
                            className={`p-1.5 rounded-full transition-all ${activeDevice === 'mobile' ? 'bg-white/20 text-white shadow-sm' : 'text-white/50 hover:text-white/80'}`}
                        >
                            <IconMobileDevice size={14} />
                        </button>
                    </div>

                    {/* Fullscreen / Expand Button */}
                    <button
                        onClick={toggleMiniPlayer}
                        className="p-1.5 bg-white/10 backdrop-blur-md rounded-full text-white hover:bg-white/20 transition-colors"
                    >
                        <IconFullscreen size={14} />
                    </button>
                </div>

                {/* Middle Row: Info & Big Play Button */}
                <div className="flex items-center justify-between mt-auto mb-6" data-tauri-drag-region>
                    <div className="flex flex-col gap-0 min-w-0 pr-2 flex-1" data-tauri-drag-region>
                        <span
                            className="text-lg font-bold text-white truncate leading-tight drop-shadow-md"
                            title={displayTitle}
                            data-tauri-drag-region
                        >
                            {displayTitle}
                        </span>
                        <span
                            className="text-sm font-medium text-white/80 truncate drop-shadow-sm"
                            title={displayArtist}
                            data-tauri-drag-region
                        >
                            {displayArtist}
                        </span>
                    </div>

                    {/* Big Play Button */}
                    <button
                        onClick={handlePlayPause}
                        className="w-10 h-10 rounded-[0.8rem] flex items-center justify-center shrink-0 shadow-lg hover:scale-105 active:scale-95 transition-all text-black relative"
                        style={{ backgroundColor: colors.primaryContainer, color: colors.onPrimaryContainer }}
                    >
                        {status.state === 'Playing' ? (
                            <IconPause size={20} fill="currentColor" className="relative z-10" />
                        ) : (
                            <IconPlay size={20} fill="currentColor" className="relative z-10" />
                        )}
                    </button>
                </div>

                {/* Bottom Row: Controls & Progress */}
                <div className="flex items-center gap-2 text-white/90" data-tauri-drag-region>

                    <button onClick={prevTrack} className="hover:text-white transition-colors active:scale-90">
                        <IconPrevious size={20} />
                    </button>

                    {/* Progress Slider */}
                    <div className="flex-1 h-4 flex items-center">
                        <SquigglySlider
                            value={status.position_secs}
                            max={track.duration_secs || 1}
                            onChange={seek}
                            isPlaying={status.state === 'Playing'}
                            accentColor={colors.onPrimaryContainer || 'white'}
                            className="w-full h-2.5"
                        />
                    </div>

                    <button onClick={nextTrack} className="hover:text-white transition-colors active:scale-90">
                        <IconNext size={20} />
                    </button>

                    <button
                        onClick={toggleShuffle}
                        className={`transition-all active:scale-90 opacity-80 hover:opacity-100 ${isShuffled ? 'text-primary' : 'hover:text-white'}`}
                        style={{ color: isShuffled ? colors.primary : undefined }}
                    >
                        <IconShuffle size={16} />
                    </button>

                    <button
                        onClick={() => track && toggleFavorite(track.path)}
                        className={`transition-all active:scale-90 opacity-80 hover:opacity-100 ${isFav ? 'text-red-500' : 'hover:text-white'}`}
                    >
                        <IconHeart size={16} filled={isFav} />
                    </button>
                </div>
            </div>
        </div>
    );
}
