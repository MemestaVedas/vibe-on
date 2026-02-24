import { motion, AnimatePresence } from 'motion/react';
import React, { useRef, useState, useEffect, useMemo } from 'react';
import { usePlayerStore } from '../store/playerStore';
import { useLyricsStore } from '../store/lyricsStore';
import { useCoverArt } from '../hooks/useCoverArt';
import { useCurrentCover } from '../hooks/useCurrentCover';
import { useThemeStore, ThemeColors } from '../store/themeStore';
import { IconPlay, IconPause, IconNext, IconPrevious, IconMusicNote, IconShuffle, IconHeart, IconQueue, IconLyrics, IconClose, IconTrash } from './Icons';
import { formatTime } from '../utils/formatTime';
import { SquigglySlider } from './SquigglySlider';
import { Virtuoso } from 'react-virtuoso';
import { getDisplayText } from '../utils/textUtils';
import { TrackDisplay } from '../types';

/**
 * IMMERSIVE VIEW — 3-Column Redesign
 * 
 * Layout Principles:
 * 1. 3 Equal Columns (when Queue is open).
 * 2. Left: Queue (Toggleable)
 * 3. Center: Art/Controls
 * 4. Right: Lyrics
 * 5. Behaviour: Art shifts from Left to Middle when Queue opens.
 * 6. Style: Strictly 2D, Zero Blur, High Contrast.
 */
export function ImmersiveView() {
    const activeTrack = usePlayerStore(s => s.status.track);
    const activeState = usePlayerStore(s => s.status.state);
    const isShuffled = usePlayerStore(s => s.isShuffled);
    const queue = usePlayerStore(s => s.queue);
    const setQueue = usePlayerStore(s => s.setQueue);
    const library = usePlayerStore(s => s.library);
    const displayLanguage = usePlayerStore(s => s.displayLanguage);
    const error = usePlayerStore(s => s.error);
    const isLoading = usePlayerStore(s => s.isLoading);

    const toggleImmersiveMode = usePlayerStore(s => s.toggleImmersiveMode);
    const toggleShuffle = usePlayerStore(s => s.toggleShuffle);
    const pause = usePlayerStore(s => s.pause);
    const resume = usePlayerStore(s => s.resume);
    const nextTrack = usePlayerStore(s => s.nextTrack);
    const prevTrack = usePlayerStore(s => s.prevTrack);
    const playFile = usePlayerStore(s => s.playFile);
    const setError = usePlayerStore(s => s.setError);

    const { lines, lyricsMode, setLyricsMode, fetchLyrics } = useLyricsStore();

    const isPlaying = activeState === 'Playing';
    const colors = useThemeStore(state => state.colors);

    const [showQueue, setShowQueue] = useState(false);

    // Use memoized library lookup with fallback for Immersive View
    const currentCover = useCurrentCover();
    const coverUrl = useCoverArt(currentCover || activeTrack?.cover_image || activeTrack?.cover_url, activeTrack?.path, true);

    // Find full track info from library for Romaji
    const displayTrack = useMemo(() => {
        if (!activeTrack?.path) return null;
        return library.find(t => t.path === activeTrack.path) || activeTrack;
    }, [activeTrack?.path, library, activeTrack]);

    const displayTitle = displayTrack ? getDisplayText(displayTrack as TrackDisplay, 'title', displayLanguage) : "SYSTEM IDLE";
    const displayArtist = displayTrack ? getDisplayText(displayTrack as TrackDisplay, 'artist', displayLanguage) : "NULL_ARTIST";

    // Sync Lyrics when track changes inside ImmersiveView
    useEffect(() => {
        if (activeTrack?.path) {
            console.log('[ImmersiveView] Auto-fetching lyrics for:', activeTrack.title);
            fetchLyrics(
                activeTrack.artist || '',
                activeTrack.title || '',
                activeTrack.duration_secs || 0,
                activeTrack.path
            );
        }
    }, [activeTrack?.path, activeTrack?.title, activeTrack?.artist, fetchLyrics]);

    // Keyboard Shortcuts
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
            switch (e.key) {
                case 'ArrowLeft': {
                    const { position_secs, track } = usePlayerStore.getState().status;
                    if (track) usePlayerStore.getState().seek(Math.max(0, position_secs - 10));
                    break;
                }
                case 'ArrowRight': {
                    const { position_secs, track } = usePlayerStore.getState().status;
                    if (track) usePlayerStore.getState().seek(Math.min(track.duration_secs, position_secs + 10));
                    break;
                }
                case 'ArrowUp':
                    e.preventDefault();
                    usePlayerStore.getState().setVolume(Math.min(1, usePlayerStore.getState().status.volume + 0.05));
                    break;
                case 'ArrowDown':
                    e.preventDefault();
                    usePlayerStore.getState().setVolume(Math.max(0, usePlayerStore.getState().status.volume - 0.05));
                    break;
                case 'l':
                case 'L':
                    if (activeTrack) usePlayerStore.getState().toggleFavorite(activeTrack.path);
                    break;
                case 'q':
                case 'Q':
                    setShowQueue(s => !s);
                    break;
                case 'Escape':
                    toggleImmersiveMode();
                    break;
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [toggleImmersiveMode, activeTrack]);


    const cycleLyricsMode = () => {
        const modes: ('original' | 'romaji' | 'both')[] = ['original', 'romaji', 'both'];
        const next = modes[(modes.indexOf(lyricsMode) + 1) % 3];
        setLyricsMode(next);
    };

    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="fixed inset-0 z-[100] flex overflow-hidden select-none bg-black text-white"
            style={{ fontFamily: 'Outfit, sans-serif' }}
        >
            {/* === TECHNICAL BACKGROUND === */}
            <AmbientBackground coverUrl={coverUrl} colors={colors} />
            <div className="absolute inset-0 pointer-events-none z-10 bg-noise opacity-[0.03] mix-blend-overlay" />
            <div className="absolute inset-0 pointer-events-none z-10 animate-scanline opacity-[0.02]" />

            {/* === MAIN 3-COLUMN LAYOUT === */}
            <div className="relative z-10 flex w-full h-full">

                {/* --- 1. LEFT COLUMN: QUEUE --- */}
                <motion.div
                    animate={{ width: showQueue ? '25%' : '0%' }}
                    transition={{ type: 'tween', duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
                    className="h-full overflow-hidden relative"
                >
                    <VerticalSquiggly isLeft />
                    <SideQueue
                        showQueue={showQueue}
                        queue={queue}
                        activeTrackPath={activeTrack?.path}
                        onPlay={playFile}
                        colors={colors}
                        onClose={() => setShowQueue(false)}
                        displayLanguage={displayLanguage}
                        onMove={(from: number, to: number) => {
                            if (from === to || from < 0 || to < 0 || from >= queue.length || to >= queue.length) return;
                            const nextQueue = [...queue];
                            const [moved] = nextQueue.splice(from, 1);
                            nextQueue.splice(to, 0, moved);
                            setQueue(nextQueue);
                        }}
                        onRemove={(index: number) => {
                            if (index < 0 || index >= queue.length) return;
                            const nextQueue = queue.filter((_, i) => i !== index);
                            setQueue(nextQueue);
                        }}
                        onClear={() => setQueue([])}
                    />
                </motion.div>

                {/* --- 2. CENTER COLUMN: PLAYER (FRAGMENTED) --- */}
                <motion.div
                    animate={{
                        width: showQueue ? '35%' : '45%',
                        x: showQueue ? 0 : -20
                    }}
                    transition={{ type: 'spring', stiffness: 100, damping: 20 }}
                    className="h-full flex flex-col items-center justify-center px-6 md:px-12 lg:px-24 relative z-20 min-w-0"
                >
                    <div className="flex flex-col items-start w-full max-w-[460px] relative">
                        <AlbumArt coverUrl={coverUrl} />

                        <div className="mt-8 lg:mt-12 w-full text-left relative">
                            <motion.div
                                initial={{ x: -50, opacity: 0 }}
                                animate={{ x: 0, opacity: 1 }}
                                className="inline-block relative max-w-full"
                            >
                                <motion.h1
                                    layoutId="track-title"
                                    className="text-4xl md:text-5xl lg:text-7xl font-bold tracking-[-0.05em] leading-[0.85] uppercase mb-4 break-words max-w-full line-clamp-2"
                                    style={{ color: colors.onSurface }}
                                >
                                    {displayTitle}
                                </motion.h1>
                                <div className="h-1 w-16 lg:w-24 bg-primary mt-2 lg:mt-4" style={{ backgroundColor: colors.primary }} />
                            </motion.div>

                            <motion.p
                                layoutId="track-artist"
                                className="text-lg md:text-xl lg:text-2xl font-semibold mt-2 lg:mt-4 tracking-[-0.02em] opacity-40 uppercase truncate max-w-full"
                                style={{ color: colors.onSurfaceVariant }}
                            >
                                {displayArtist}
                            </motion.p>
                        </div>

                        {/* Progress Technical */}
                        <div className="mt-8 lg:mt-12 w-full">
                            <div className="flex justify-between mb-3 text-[10px] font-bold tabular-nums tracking-[0.2em] uppercase opacity-30" style={{ color: colors.onSurface }}>
                                <span>{formatTime(usePlayerStore.getState().status.position_secs)}</span>
                                <span>{formatTime(activeTrack?.duration_secs || 0)}</span>
                            </div>
                            <SquigglySlider
                                value={usePlayerStore(s => s.status.position_secs)}
                                max={activeTrack?.duration_secs || 1}
                                onChange={(val) => usePlayerStore.getState().seek(val)}
                                isPlaying={isPlaying}
                                accentColor={colors.primary}
                                className="w-full"
                            />
                        </div>

                        {/* Controls DOCK */}
                        <div className="mt-8 lg:mt-12 flex items-center justify-center gap-4 lg:gap-6 w-full">
                            <CloverButton
                                onClick={prevTrack}
                                icon={<IconPrevious size={24} />}
                                colors={colors}
                            />

                            <div className="flex items-center gap-2 p-2 lg:p-3 rounded-full glass-panel transition-transform hover:scale-[1.02]">
                                <ControlButton
                                    onClick={() => setShowQueue(!showQueue)}
                                    icon={<IconQueue size={18} />}
                                    isActive={showQueue}
                                    colors={colors}
                                    label="Q"
                                />
                                <div className="w-px h-6 bg-white/10 mx-1" />
                                <ControlButton
                                    onClick={toggleShuffle}
                                    icon={<IconShuffle size={18} />}
                                    isActive={isShuffled}
                                    colors={colors}
                                    label="SHF"
                                />

                                <PlayButton isPlaying={isPlaying} onToggle={isPlaying ? pause : resume} colors={colors} />

                                <div className="w-px h-6 bg-white/10 mx-1" />
                                <FavoriteButton path={activeTrack?.path || ''} colors={colors} />
                                <ControlButton
                                    onClick={cycleLyricsMode}
                                    icon={<IconLyrics size={18} />}
                                    colors={colors}
                                    label="LYR"
                                    subLabel={lyricsMode === 'original' ? 'JP' : lyricsMode === 'romaji' ? 'RO' : 'BOTH'}
                                />
                            </div>

                            <CloverButton
                                onClick={nextTrack}
                                icon={<IconNext size={24} />}
                                colors={colors}
                            />
                        </div>
                    </div>
                </motion.div>

                {/* --- 3. RIGHT COLUMN: LYRICS (ASYMMETRIC) --- */}
                <motion.div
                    animate={{ width: showQueue ? '40%' : '55%' }}
                    transition={{ type: 'spring', stiffness: 100, damping: 20 }}
                    className="h-full overflow-hidden relative"
                >
                    <VerticalSquiggly />
                    <LyricsPanel lines={lines || []} colors={colors} />
                </motion.div>
            </div>

            <motion.button
                whileHover={{ scale: 1.1, opacity: 1 }}
                whileTap={{ scale: 0.9 }}
                onClick={toggleImmersiveMode}
                className="absolute top-8 right-8 z-[80] p-2 opacity-40 transition-opacity"
                style={{ color: colors.onSurface }}
            >
                <svg viewBox="0 0 280 280" width={24} height={24} fill="currentColor">
                    <path d="M178.73 6.2068C238.87 -19.9132 299.91 41.1269 273.79 101.267L269.47 111.207C261.5 129.577 261.5 150.417 269.47 168.787L273.79 178.727C299.91 238.867 238.87 299.907 178.73 273.787L168.79 269.467C150.42 261.497 129.58 261.497 111.21 269.467L101.27 273.787C41.1281 299.907 -19.9139 238.867 6.20706 178.727L10.5261 168.787C18.5011 150.417 18.5011 129.577 10.5261 111.207L6.20706 101.267C-19.9139 41.1269 41.1281 -19.9132 101.27 6.2068L111.21 10.5269C129.58 18.4969 150.42 18.4969 168.79 10.5269L178.73 6.2068Z" />
                </svg>
            </motion.button>

            {/* GLOBAL OVERLAYS */}
            <AnimatePresence>
                {isLoading && <ImmersiveLoader />}
                {error && <ImmersiveError error={error} onClear={() => setError(null)} />}
            </AnimatePresence>
        </motion.div>
    );
}

// ─────────────────────────────────────────────────────────
//  SUB-COMPONENTS (SHARP 2D)
// ─────────────────────────────────────────────────────────

function SideQueue({ showQueue, queue, activeTrackPath, onPlay, colors, onClose, displayLanguage, onMove, onRemove, onClear }: any) {
    const virtuosoRef = useRef<any>(null);
    const [dragIndex, setDragIndex] = useState<number | null>(null);

    // Auto-scroll to active track when it changes or when queue opens
    useEffect(() => {
        if (showQueue && activeTrackPath && virtuosoRef.current) {
            // Delay to allow the column expansion animation to finish (approx 400ms)
            const timer = setTimeout(() => {
                const index = queue.findIndex((t: any) =>
                    t.path.replace(/\\/g, '/').toLowerCase() === activeTrackPath.replace(/\\/g, '/').toLowerCase()
                );

                if (index !== -1 && virtuosoRef.current) {
                    virtuosoRef.current.scrollToIndex({
                        index,
                        align: 'center',
                        behavior: 'smooth'
                    });
                }
            }, 450);
            return () => clearTimeout(timer);
        }
    }, [showQueue, activeTrackPath, queue]);

    return (
        <div className="w-full h-full glass-panel flex flex-col pt-32 relative overflow-hidden">
            {/* Background Texture for Queue */}
            <div className="absolute inset-0 bg-blueprint opacity-[0.03] pointer-events-none" />

            <div className="px-10 mb-10 flex items-center justify-between relative z-10">
                <div className="flex flex-col">
                    <h2 className="text-3xl font-bold tracking-[-0.05em] uppercase leading-none" style={{ color: colors.onSurface }}>
                        Next <span className="text-primary opacity-50" style={{ color: colors.primary }}>_UP</span>
                    </h2>
                </div>
                <div className="flex items-center gap-3">
                    <button
                        onClick={onClear}
                        className="px-3 py-2 rounded-full bg-white/10 text-white/70 hover:text-white transition-colors text-xs uppercase tracking-widest"
                        title="Clear Queue"
                    >
                        <IconTrash size={16} />
                    </button>
                    <button
                        onClick={onClose}
                        className="w-10 h-10 flex items-center justify-center opacity-40 hover:opacity-100 transition-opacity"
                    >
                        <svg viewBox="0 0 280 280" width={20} height={20} fill="currentColor">
                            <path d="M178.73 6.2068C238.87 -19.9132 299.91 41.1269 273.79 101.267L269.47 111.207C261.5 129.577 261.5 150.417 269.47 168.787L273.79 178.727C299.91 238.867 238.87 299.907 178.73 273.787L168.79 269.467C150.42 261.497 129.58 261.497 111.21 269.467L101.27 273.787C41.1281 299.907 -19.9139 238.867 6.20706 178.727L10.5261 168.787C18.5011 150.417 18.5011 129.577 10.5261 111.207L6.20706 101.267C-19.9139 41.1269 41.1281 -19.9132 101.27 6.2068L111.21 10.5269C129.58 18.4969 150.42 18.4969 168.79 10.5269L178.73 6.2068Z" />
                        </svg>
                    </button>
                </div>
            </div>

            <div className="flex-1 relative z-10 px-2">
                <Virtuoso
                    ref={virtuosoRef}
                    data={queue}
                    className="no-scrollbar"
                    style={{ height: '100%' }}
                    itemContent={(i, track) => {
                        const activePath = activeTrackPath?.replace(/\\/g, '/').toLowerCase();
                        const currentPath = track.path.replace(/\\/g, '/').toLowerCase();
                        const isActive = activePath === currentPath;
                        const indexStr = (i + 1).toString().padStart(2, '0');

                        const displayTitle = getDisplayText(track as TrackDisplay, 'title', displayLanguage);
                        const displayArtist = getDisplayText(track as TrackDisplay, 'artist', displayLanguage);

                        return (
                            <div className="pb-4 px-4 overflow-visible">
                                <motion.div
                                    key={track.path + i}
                                    initial={{ opacity: 0, x: -10 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    whileHover={{ x: 6, scale: 1.02 }}
                                    whileTap={{ scale: 0.98 }}
                                    draggable
                                    onDragStart={(event) => {
                                        event.dataTransfer.effectAllowed = 'move';
                                        setDragIndex(i);
                                    }}
                                    onDragOver={(event) => event.preventDefault()}
                                    onDrop={(event) => {
                                        event.preventDefault();
                                        if (dragIndex !== null) onMove(dragIndex, i);
                                        setDragIndex(null);
                                    }}
                                    onDragEnd={() => setDragIndex(null)}
                                    className={`group p-3 rounded-full flex items-center gap-4 cursor-pointer transition-all border relative ${isActive
                                        ? 'shadow-[0_0_20px_rgba(0,0,0,0.3)] border-white/20'
                                        : 'border-transparent hover:border-white/10 hover:bg-white/5'
                                        } ${dragIndex === i ? 'ring-2 ring-white/30' : ''}`}
                                    style={{
                                        backgroundColor: isActive ? colors.primary : 'rgba(255,255,255,0.02)',
                                        color: isActive ? colors.onPrimary : colors.onSurface
                                    }}
                                    onClick={() => onPlay(track.path)}
                                >
                                    <span className={`text-base font-bold tabular-nums tracking-tighter w-10 text-center ${isActive ? 'opacity-80' : 'opacity-20 group-hover:opacity-40'}`}>
                                        {indexStr}
                                    </span>

                                    <div className={`w-14 h-14 rounded-full overflow-hidden flex-shrink-0 border-2 ${isActive ? 'border-white/40' : 'border-white/5'}`}>
                                        <QueueThumb cover={track.cover_image} path={track.path} />
                                    </div>

                                    <div className="flex-1 min-w-0 px-3">
                                        <p className={`text-lg font-bold uppercase tracking-tight truncate`}>
                                            {displayTitle}
                                        </p>
                                        <p className={`text-base font-semibold uppercase tracking-widest opacity-40 truncate`}>
                                            {displayArtist}
                                        </p>
                                    </div>

                                    <div className="flex items-center gap-3 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <button
                                            onClick={(event) => {
                                                event.stopPropagation();
                                                onRemove(i);
                                            }}
                                            className="p-2 rounded-full hover:bg-white/10"
                                            title="Remove from Queue"
                                        >
                                            <IconClose size={16} />
                                        </button>
                                        <span className="text-white/40 cursor-grab select-none">≡</span>
                                    </div>

                                    {isActive && (
                                        <div className="pr-4">
                                            <div className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                                        </div>
                                    )}
                                </motion.div>
                            </div>
                        );
                    }}
                    components={{
                        Header: () => <div className="h-[30vh]" />,
                        Footer: () => <div className="h-[40vh]" />
                    }}
                />
            </div>
        </div>
    );
}

function QueueThumb({ cover, path }: { cover: string | null, path: string }) {
    const url = useCoverArt(cover, path);
    if (!url) return <div className="w-full h-full flex items-center justify-center"><IconMusicNote size={16} className="opacity-20" /></div>;
    return <img src={url} className="w-full h-full object-cover" />;
}

function AmbientBackground({ coverUrl, colors }: { coverUrl: string | null, colors: ThemeColors }) {
    return (
        <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden">
            <div className="absolute inset-0 bg-surface" style={{ backgroundColor: colors.surface }} />
            <div className="absolute inset-0 bg-blueprint opacity-[0.05]" />
            <AnimatePresence mode="wait">
                {coverUrl && (
                    <motion.img
                        key={coverUrl} src={coverUrl} alt=""
                        initial={{ opacity: 0, scale: 1.1 }} animate={{ opacity: 0.1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
                        transition={{ duration: 0.8, ease: "easeOut" }}
                        className="absolute inset-0 w-full h-full object-cover opacity-10 grayscale"
                    />
                )}
            </AnimatePresence>
            <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-black opacity-60" />
        </div>
    );
}

function AlbumArt({ coverUrl }: { coverUrl: string | null }) {
    return (
        <div
            className="relative w-full aspect-square max-w-[420px] rounded-[3rem] overflow-hidden bg-white/5 brutalist-shadow border border-white/10"
        >
            <div className="absolute inset-0 bg-noise opacity-[0.05] z-10 pointer-events-none" />
            <AnimatePresence mode="wait">
                <motion.div
                    key={coverUrl}
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 1.1 }}
                    className="w-full h-full"
                >
                    {coverUrl ? <img src={coverUrl} className="w-full h-full object-cover" /> : <div className="w-full h-full bg-zinc-900 flex items-center justify-center"><IconMusicNote size={80} className="opacity-10" /></div>}
                </motion.div>
            </AnimatePresence>
        </div>
    );
}

function ControlButton({ onClick, icon, isActive, colors, subLabel }: any) {
    return (
        <motion.button
            whileHover={{ scale: 1.1, backgroundColor: 'rgba(255,255,255,0.05)' }} whileTap={{ scale: 0.9 }}
            onClick={onClick}
            className={`flex flex-col items-center justify-center p-3 rounded-2xl transition-colors`}
            style={{ color: isActive ? colors.primary : colors.onSurface }}
        >
            {icon}
            {subLabel && <span className="text-[8px] font-bold uppercase mt-1 tracking-tighter opacity-40">{subLabel}</span>}
        </motion.button>
    );
}

function CloverButton({ onClick, icon, colors }: any) {
    const [rotation, setRotation] = useState(0);

    const handleClick = () => {
        setRotation(prev => prev + 120);
        onClick();
    };

    return (
        <motion.button
            whileHover={{ scale: 1.15 }}
            whileTap={{ scale: 0.9 }}
            onClick={handleClick}
            className="w-14 h-14 relative flex items-center justify-center group"
            style={{ color: colors.onSurface }}
        >
            <motion.div
                className="absolute inset-0 drop-shadow-md group-hover:drop-shadow-lg transition-all duration-300"
                style={{ color: 'rgba(255,255,255,0.08)' }}
                animate={{ rotate: rotation }}
                transition={{ type: "spring", stiffness: 200, damping: 20 }}
            >
                <svg viewBox="0 0 340 340" className="w-full h-full" fill="currentColor">
                    <path d="M261.856 41.2425C272.431 41.9625 277.718 42.3226 281.991 44.1826C288.175 46.8926 293.111 51.8325 295.816 58.0125C297.685 62.2825 298.044 67.5725 298.762 78.1425L300.402 102.273C300.693 106.553 300.838 108.693 301.303 110.733C301.975 113.683 303.142 116.503 304.754 119.063C305.869 120.843 307.279 122.453 310.097 125.683L326.001 143.903C332.97 151.893 336.455 155.882 338.155 160.222C340.615 166.512 340.615 173.493 338.155 179.783C336.455 184.123 332.97 188.112 326.001 196.102L310.097 214.322C307.279 217.552 305.869 219.162 304.754 220.942C303.142 223.502 301.975 226.323 301.303 229.273C300.838 231.313 300.693 233.452 300.402 237.732L298.762 261.863C298.044 272.433 297.685 277.723 295.816 281.993C293.111 288.173 288.175 293.112 281.991 295.822C277.718 297.682 272.431 298.043 261.856 298.763L237.725 300.403C233.448 300.693 231.31 300.843 229.267 301.303C226.316 301.973 223.499 303.143 220.937 304.753C219.164 305.873 217.549 307.283 214.319 310.103L196.097 326.003C188.111 332.973 184.119 336.453 179.775 338.153C173.491 340.623 166.509 340.623 160.225 338.153C155.881 336.453 151.889 332.973 143.903 326.003L125.681 310.103C122.451 307.283 120.836 305.873 119.063 304.753C116.501 303.143 113.684 301.973 110.733 301.303C108.69 300.843 106.552 300.693 102.275 300.403L78.1438 298.763C67.5694 298.043 62.2822 297.682 58.0088 295.822C51.8252 293.112 46.8887 288.173 44.1844 281.993C42.3154 277.723 41.9561 272.433 41.2375 261.863L39.5977 237.732C39.3071 233.452 39.1618 231.313 38.6969 229.273C38.0251 226.323 36.8584 223.502 35.2463 220.942C34.1306 219.162 32.7213 217.552 29.9027 214.322L13.999 196.102C7.02996 188.112 3.54542 184.123 1.84516 179.783C-0.615054 173.493 -0.615053 166.512 1.84516 160.222C3.54542 155.882 7.02996 151.893 13.999 143.903L29.9027 125.683C32.7213 122.453 34.1306 120.843 35.2463 119.063C36.8584 116.503 38.0251 113.683 38.6969 110.733C39.1618 108.693 39.3071 106.553 39.5977 102.273L41.2375 78.1425C41.9561 67.5725 42.3154 62.2825 44.1844 58.0125C46.8887 51.8325 51.8252 46.8926 58.0088 44.1826C62.2823 42.3226 67.5694 41.9625 78.1438 41.2425L102.275 39.6025C106.552 39.3125 108.69 39.1625 110.733 38.7025C113.684 38.0325 116.501 36.8625 119.063 35.2525C120.836 34.1325 122.451 32.7225 125.681 29.9025L143.903 14.0025C151.889 7.03252 155.881 3.5525 160.225 1.8525C166.509 -0.6175 173.491 -0.6175 179.775 1.8525C184.119 3.5525 188.111 7.03252 196.097 14.0025L214.319 29.9025C217.549 32.7225 219.164 34.1325 220.937 35.2525C223.499 36.8625 226.316 38.0325 229.267 38.7025C231.31 39.1625 233.448 39.3125 237.725 39.6025L261.856 41.2425Z" />
                </svg>
            </motion.div>
            <div className="relative z-10">
                {icon}
            </div>
        </motion.button>
    );
}

function PlayButton({ isPlaying, onToggle, colors }: any) {
    return (
        <motion.button
            whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
            onClick={onToggle}
            className="w-14 h-14 flex items-center justify-center rounded-2xl bg-white shadow-xl transition-all"
            style={{ backgroundColor: colors.primary, color: colors.onPrimary }}
        >
            {isPlaying ? <IconPause size={28} /> : <IconPlay size={28} className="translate-x-0.5" />}
        </motion.button>
    );
}

function FavoriteButton({ path, colors }: any) {
    const isFavorite = usePlayerStore(state => state.isFavorite(path));
    const toggleFavorite = usePlayerStore(state => state.toggleFavorite);
    return (
        <motion.button
            whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.8 }}
            onClick={() => toggleFavorite(path)}
            className="p-2"
            style={{ color: isFavorite ? colors.tertiary : `${colors.onSurface}20` }}
        >
            <IconHeart size={20} filled={isFavorite} />
        </motion.button>
    );
}

const LyricsPanel = React.memo(({ lines, colors }: any) => {
    const position_secs = usePlayerStore(state => state.status.position_secs);
    const lyricsMode = useLyricsStore(state => state.lyricsMode);
    const virtuosoRef = useRef<any>(null);

    const activeLineIndex = useMemo(() => {
        if (!lines || lines.length === 0) return -1;
        for (let i = lines.length - 1; i >= 0; i--) {
            if (position_secs >= lines[i].time) return i;
        }
        return -1;
    }, [lines, position_secs]);

    useEffect(() => {
        if (activeLineIndex >= 0 && virtuosoRef.current) {
            virtuosoRef.current.scrollToIndex({
                index: activeLineIndex,
                align: 'center',
                behavior: 'smooth'
            });
        }
    }, [activeLineIndex]);

    return (
        <div className="w-full h-full flex flex-col">
            <Virtuoso
                ref={virtuosoRef}
                data={lines}
                className="no-scrollbar"
                style={{ height: '100%' }}
                increaseViewportBy={400}
                topItemCount={0}
                itemContent={(i, line) => {
                    const isActive = i === activeLineIndex;
                    const isNext = i === activeLineIndex + 1;
                    return (
                        <div
                            key={i}
                            className="py-6 px-12 text-left cursor-pointer transition-all duration-500 origin-left"
                            onClick={() => usePlayerStore.getState().seek(line.time)}
                            style={{
                                opacity: isActive ? 1 : isNext ? 0.3 : 0.1,
                                scale: isActive ? 1.05 : 1,
                                filter: isActive ? 'none' : 'grayscale(1)',
                                transform: isActive ? `translateX(${isActive ? '20px' : '0px'})` : 'none'
                            }}
                        >
                            {lyricsMode === 'romaji' ? (
                                <p className="text-2xl lg:text-4xl font-semibold leading-tight uppercase tracking-tight break-words pr-12 lg:pr-24" style={{ color: colors.onSurface }}>{line.romaji || line.text}</p>
                            ) : lyricsMode === 'both' && line.romaji ? (
                                <div className="flex flex-col gap-2">
                                    <p className="text-[10px] font-bold tracking-[0.3em] uppercase opacity-40 mb-1" style={{ color: colors.primary }}>{line.romaji}</p>
                                    <p className="text-2xl lg:text-4xl font-semibold leading-tight tracking-tight break-words pr-12 lg:pr-24" style={{ color: colors.onSurface }}>{line.text}</p>
                                </div>
                            ) : (
                                <p className="text-2xl lg:text-4xl font-semibold leading-tight tracking-tight break-words pr-12 lg:pr-24" style={{ color: colors.onSurface }}>{line.text}</p>
                            )}
                        </div>
                    );
                }}
                components={{
                    Header: () => <div className="h-[40vh]" />,
                    Footer: () => <div className="h-[40vh]" />
                }}
            />
        </div>
    );
});

function VerticalSquiggly({ isLeft }: { isLeft?: boolean }) {
    const isPlaying = usePlayerStore(state => state.status.state === 'Playing');

    const path = useMemo(() => {
        const height = 2000; // Overscan for vertical scroll
        const wavelength = 30;
        const amplitude = 4;
        const frequency = (2 * Math.PI) / wavelength;

        let d = "M 10 0";
        for (let y = 0; y <= height; y += 5) {
            const x = 10 + Math.sin(y * frequency) * amplitude;
            d += ` L ${x} ${y}`;
        }
        return d;
    }, []);

    const straight = "M 10 0 L 10 2000";

    return (
        <div className={`absolute top-0 bottom-0 w-[20px] pointer-events-none ${isLeft ? 'right-0' : 'left-0'}`}>
            <svg className="w-full h-full" preserveAspectRatio="none" viewBox="0 0 20 1000">
                <motion.path
                    d={isPlaying ? path : straight}
                    stroke="white"
                    strokeWidth="1"
                    fill="none"
                    className="opacity-10"
                    animate={{ d: isPlaying ? path : straight }}
                    transition={{ duration: 1.5, ease: "linear" }}
                />
            </svg>
        </div>
    );
}

function ImmersiveLoader() {
    return (
        <div className="absolute inset-0 z-[110] bg-black flex items-center justify-center bg-noise">
            <div className="w-12 h-12 rounded-full border-2 border-primary border-t-transparent animate-spin" />
        </div>
    );
}

function ImmersiveError({ error, onClear }: any) {
    return (
        <div className="absolute bottom-24 left-1/2 -translate-x-1/2 z-[110] bg-error text-on-error px-8 py-4 rounded-2xl shadow-elevation-3 flex items-center gap-4 font-black uppercase tracking-tighter">
            <span className="text-sm">ERR_SYSTEM_FAILURE: {error}</span>
            <button onClick={onClear} className="opacity-40 hover:opacity-100 transition-opacity p-2">
                <svg viewBox="0 0 280 280" width={20} height={20} fill="currentColor">
                    <path d="M178.73 6.2068C238.87 -19.9132 299.91 41.1269 273.79 101.267L269.47 111.207C261.5 129.577 261.5 150.417 269.47 168.787L273.79 178.727C299.91 238.867 238.87 299.907 178.73 273.787L168.79 269.467C150.42 261.497 129.58 261.497 111.21 269.467L101.27 273.787C41.1281 299.907 -19.9139 238.867 6.20706 178.727L10.5261 168.787C18.5011 150.417 18.5011 129.577 10.5261 111.207L6.20706 101.267C-19.9139 41.1269 41.1281 -19.9132 101.27 6.2068L111.21 10.5269C129.58 18.4969 150.42 18.4969 168.79 10.5269L178.73 6.2068Z" />
                </svg>
            </button>
        </div>
    );
}
