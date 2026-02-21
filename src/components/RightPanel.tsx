import { SideLyrics } from './SideLyrics';
import { useLyricsStore } from '../store/lyricsStore';
import { AnimatePresence, motion } from 'motion/react';
import { useEffect, useState, memo, useCallback, useMemo } from 'react';
import { usePlayerStore } from '../store/playerStore';
import { useNavigationStore } from '../store/navigationStore';
import { useCoverArt } from '../hooks/useCoverArt';
import { useCurrentCover } from '../hooks/useCurrentCover';
import { IconMusicNote, IconPlay, IconQueue, IconAlbum, IconLyrics, IconFullscreen, IconHeart } from './Icons';
import { M3CircleImage } from './ShapeComponents';
import { MarqueeText } from './MarqueeText';
import { SquigglySlider } from './SquigglySlider';
import { Virtuoso } from 'react-virtuoso';
import { getDisplayText } from '../utils/textUtils';
import { TrackDisplay } from '../types';

export function RightPanel() {
    // Granular selectors — only re-render for specific slice
    const trackPath = usePlayerStore(s => s.status.track?.path ?? null);
    const trackCoverRaw = usePlayerStore(s => s.status.track?.cover_image ?? null);
    const positionSecs = usePlayerStore(s => s.status.position_secs);
    const playerState = usePlayerStore(s => s.status.state);
    const queue = usePlayerStore(s => s.queue);
    const library = usePlayerStore(s => s.library);
    const displayLanguage = usePlayerStore(s => s.displayLanguage);
    const playFile = usePlayerStore(s => s.playFile);
    const toggleImmersiveMode = usePlayerStore(s => s.toggleImmersiveMode);
    const favorites = usePlayerStore(s => s.favorites);
    const toggleFavorite = usePlayerStore(s => s.toggleFavorite);
    const { lines, plainLyrics, isInstrumental, isLoading, error, lyricsMode, toggleLyrics } = useLyricsStore();
    const { navigateToAlbum } = useNavigationStore();
    const { isRightPanelCollapsed } = useNavigationStore();
    const isCollapsed = isRightPanelCollapsed;

    // Find full track info from library for Romaji
    const displayTrack = useMemo(() => {
        if (!trackPath) return null;
        return library.find(t => t.path === trackPath) || usePlayerStore.getState().status.track;
    }, [trackPath, library]);

    const displayTitle = displayTrack ? getDisplayText(displayTrack as TrackDisplay, 'title', displayLanguage) : "Not Playing";
    const displayArtist = displayTrack ? getDisplayText(displayTrack as TrackDisplay, 'artist', displayLanguage) : "Pick a song";
    const displayAlbum = displayTrack ? getDisplayText(displayTrack as TrackDisplay, 'album', displayLanguage) : null;
    const trackDuration = displayTrack?.duration_secs ?? 0;

    // Clover Shape from TitleBar
    const CloverIcon = ({ children, active, color }: { children: React.ReactNode, active: boolean, color: string }) => (
        <div className="relative w-8 h-8 flex items-center justify-center">
            {active && (
                <svg viewBox="0 0 280 280" className="absolute inset-0 w-full h-full opacity-20" style={{ color }}>
                    <path d="M178.73 6.2068C238.87 -19.9132 299.91 41.1269 273.79 101.267L269.47 111.207C261.5 129.577 261.5 150.417 269.47 168.787L273.79 178.727C299.91 238.867 238.87 299.907 178.73 273.787L168.79 269.467C150.42 261.497 129.58 261.497 111.21 269.467L101.27 273.787C41.1281 299.907 -19.9139 238.867 6.20706 178.727L10.5261 168.787C18.5011 150.417 18.5011 129.577 10.5261 111.207L6.20706 101.267C-19.9139 41.1269 41.1281 -19.9132 101.27 6.2068L111.21 10.5269C129.58 18.4969 150.42 18.4969 168.79 10.5269L178.73 6.2068Z" fill="currentColor" />
                </svg>
            )}
            <div className="relative z-10" style={{ color: active ? 'var(--md-sys-color-primary)' : 'var(--md-sys-color-on-surface-variant)' }}>
                {children}
            </div>
        </div>
    );

    // Cover art — robust matching for 3rd column
    const trackCover = useCurrentCover();
    const coverUrl = useCoverArt(trackCover || trackCoverRaw, trackPath || undefined);
    // console.log(`[RightPanel] Track: ${trackPath}, CoverRaw: ${trackCoverRaw}, URL: ${coverUrl}`);

    // Determine what to show in the bottom section
    const hasContent = (lines && lines.length > 0) || (plainLyrics && plainLyrics.trim().length > 0);
    const shouldShowLyricsIdeally = isLoading || (hasContent && !isInstrumental && !error);

    const [showLyrics, setShowLyrics] = useState<boolean>(!!shouldShowLyricsIdeally);

    useEffect(() => {
        if (shouldShowLyricsIdeally) {
            setShowLyrics(true);
        } else {
            if (error && error.includes("recents view")) {
                const timer = setTimeout(() => setShowLyrics(false), 3000);
                return () => clearTimeout(timer);
            } else {
                setShowLyrics(false);
            }
        }
    }, [shouldShowLyricsIdeally, error]);

    const handleArtClick = () => {
        if (displayAlbum && displayArtist) {
            // Note: navigation might need original names, but let's try with what we have
            // Usually navigation relies on exact matches, so passing original names might be safer if `navigateToAlbum` expects them
            // However, `displayTrack` has the full object, so we can access original fields if needed for logic
            // But `displayAlbum` is localized string.
            // Let's check `navigateToAlbum` implementation or use the `displayTrack` original fields if available
            const originalAlbum = (displayTrack as any)?.album || displayAlbum;
            const originalArtist = (displayTrack as any)?.artist || displayArtist;
            navigateToAlbum(originalAlbum, originalArtist);
        }
    };

    const handleSeek = useCallback((val: number) => {
        usePlayerStore.getState().seek(val);
    }, []);

    // Memoize queue item renderer for Virtuoso
    const renderQueueItem = useCallback((index: number) => {
        const t = queue[index];
        if (!t) return null;
        return (
            <QueueItem
                key={`${t.path}-${index}`}
                track={t}
                displayLanguage={displayLanguage}
                isActive={!!(trackPath && t.path === trackPath)}
                onClick={() => playFile(t.path)}
            />
        );
    }, [queue, trackPath, playFile, displayLanguage]);

    return (
        <div className="h-full flex flex-col overflow-hidden bg-surface-container rounded-[2rem] relative z-20">
            {isCollapsed ? (
                /* COLLAPSED VIEW */
                <div className="flex flex-col items-center h-full py-6 gap-4">
                    <button
                        onClick={() => useNavigationStore.getState().setRightPanelCollapsed(false)}
                        className="p-2 rounded-full hover:bg-surface-container-highest transition-colors text-on-surface-variant hover:text-on-surface mb-2"
                        title="Expand"
                    >
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M15.41 7.41L14 6l-6 6 6 6 1.41-1.41L10.83 12z" /> {/* Chevron Left */}
                        </svg>
                    </button>

                    {/* Action Icons (Vertical Stack) */}
                    <div className="flex flex-col gap-2">
                        {/* Favorite */}
                        {trackPath && (
                            <button
                                onClick={(e) => { e.stopPropagation(); toggleFavorite(trackPath); }}
                                className="p-2 rounded-full hover:bg-surface-container-highest transition-colors text-on-surface-variant hover:text-on-surface"
                                title={favorites.has(trackPath) ? "Remove from Favorites" : "Add to Favorites"}
                            >
                                <IconHeart size={20} filled={favorites.has(trackPath)} className={favorites.has(trackPath) ? "text-error" : ""} />
                            </button>
                        )}

                        {/* Lyrics Toggle (Opens Overlay) */}
                        <button
                            onClick={toggleLyrics}
                            className={`p-2 rounded-full hover:bg-surface-container-highest transition-colors ${isLoading ? 'animate-pulse' : ''} text-on-surface-variant hover:text-on-surface`}
                            title="Open Lyrics"
                        >
                            <IconLyrics size={20} />
                        </button>

                        {/* Immersive Mode */}
                        <button
                            onClick={toggleImmersiveMode}
                            className="p-2 rounded-full hover:bg-surface-container-highest transition-colors text-on-surface-variant hover:text-on-surface"
                            title="Immersive Mode"
                        >
                            <IconFullscreen size={20} />
                        </button>
                    </div>

                    {/* Vertical Song Title */}
                    <div className="flex-1 flex items-center justify-center min-h-0 overflow-hidden my-4">
                        <div className="rotate-180" style={{ writingMode: 'vertical-rl' }}>
                            <MarqueeText
                                text={displayTitle}
                                className="text-title-medium font-bold text-on-surface-variant tracking-wider pointer-events-none"
                            />
                        </div>
                    </div>

                    {/* Tiny Art Indicator */}
                    {trackPath && (
                        <div className="w-10 h-10 rounded-full overflow-hidden shrink-0 animate-spin-slow mt-auto" style={{ animationDuration: '10s' }}>
                            {coverUrl && <img src={coverUrl} className="w-full h-full object-cover opacity-60" />}
                        </div>
                    )}
                </div>
            ) : (
                /* EXPANDED VIEW */
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="flex flex-col h-full p-6 gap-6"
                >
                    {/* Now Playing Header */}
                    <div className="flex items-center justify-between shrink-0">
                        <h2 className="text-title-medium font-bold text-on-surface">Now Playing</h2>
                        <div className="flex items-center gap-1">
                            <button
                                onClick={toggleImmersiveMode}
                                className="p-2 rounded-full hover:bg-surface-container-highest transition-colors text-on-surface-variant hover:text-on-surface"
                                title="Immersive Mode"
                            >
                                <IconFullscreen size={20} />
                            </button>
                            <button
                                onClick={() => useNavigationStore.getState().setRightPanelCollapsed(true)}
                                className="p-2 -mr-2 rounded-full hover:bg-surface-container-highest transition-colors text-on-surface-variant hover:text-on-surface"
                                title="Collapse"
                            >
                                <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                                    <path d="M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z" /> {/* Chevron Right */}
                                </svg>
                            </button>
                        </div>
                    </div>

                    {/* Main Art & Info */}
                    <div className="flex flex-col items-center gap-6 shrink-0 transition-all duration-300">
                        <div
                            className="w-72 h-72 rounded-[2rem] bg-surface-container-high shadow-elevation-2 relative group overflow-hidden shrink-0 cursor-pointer hover:scale-[1.02] active:scale-95 transition-transform duration-200"
                            title={displayAlbum ? `Go to album: ${displayAlbum}` : "Album Art"}
                        >
                            <div className="w-full h-full" onClick={handleArtClick}>
                                {coverUrl ? (
                                    <img
                                        src={coverUrl}
                                        alt={displayAlbum || "Album Art"}
                                        className="w-full h-full object-cover"
                                    />
                                ) : (
                                    <div className="w-full h-full flex items-center justify-center text-on-surface-variant/50">
                                        <IconMusicNote size={64} />
                                    </div>
                                )}
                            </div>

                            {/* Hover Overlay - Favorite & Info */}
                            {(trackPath || coverUrl) && (
                                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-4 z-20 pointer-events-none">
                                    {/* Go To Album Button */}
                                    {displayAlbum && (
                                        <button
                                            onClick={(e) => { e.stopPropagation(); handleArtClick(); }}
                                            className="p-3 bg-white/20 hover:bg-white/30 rounded-full text-white backdrop-blur-md transition-all scale-90 hover:scale-100 pointer-events-auto"
                                            title="Go to Album"
                                        >
                                            <IconAlbum size={28} />
                                        </button>
                                    )}

                                    {/* Favorite Button */}
                                    {trackPath && (
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                toggleFavorite(trackPath);
                                            }}
                                            className="p-3 bg-white/20 hover:bg-white/30 rounded-full text-white backdrop-blur-md transition-all scale-90 hover:scale-100 cursor-pointer pointer-events-auto border-none outline-none flex items-center justify-center"
                                            title={favorites.has(trackPath) ? "Remove from Favorites" : "Add to Favorites"}
                                        >
                                            <AnimatePresence mode="wait">
                                                {favorites.has(trackPath) ? (
                                                    <motion.div
                                                        key="fav-filled"
                                                        initial={{ scale: 0.5, opacity: 0 }}
                                                        animate={{ scale: 1, opacity: 1 }}
                                                        exit={{
                                                            scale: 1.5,
                                                            opacity: 0,
                                                            rotate: [-10, 10, -10, 10, 0],
                                                            filter: "blur(4px)"
                                                        }}
                                                        transition={{ duration: 0.3 }}
                                                    >
                                                        <IconHeart size={28} filled={true} className="text-error" />
                                                    </motion.div>
                                                ) : (
                                                    <motion.div
                                                        key="fav-outline"
                                                        initial={{ scale: 0.8, opacity: 0 }}
                                                        animate={{ scale: 1, opacity: 1 }}
                                                        exit={{ scale: 0.5, opacity: 0 }}
                                                        transition={{ duration: 0.2 }}
                                                    >
                                                        <IconHeart size={28} filled={false} className="text-white" />
                                                    </motion.div>
                                                )}
                                            </AnimatePresence>
                                        </button>
                                    )}
                                </div>
                            )}
                        </div>

                        <div className="flex flex-col items-center text-center gap-1 w-full px-2">
                            <div className="w-full text-headline-medium font-bold text-on-surface truncate">
                                <MarqueeText text={displayTitle} />
                            </div>
                            <div className="text-title-large text-on-surface-variant truncate w-full font-medium">
                                {displayArtist}
                            </div>
                        </div>
                    </div>

                    {/* Seeker */}
                    <div className="px-8 py-2 w-full">
                        <SquigglySlider
                            value={positionSecs}
                            max={trackDuration || 100}
                            onChange={handleSeek}
                            isPlaying={playerState === 'Playing'}
                            className="h-6 w-full cursor-pointer text-primary hover:text-primary-container transition-colors"
                            accentColor="currentColor"
                        />
                    </div>

                    {/* Content Switcher: Lyrics or Queue */}
                    <div className="flex-1 min-h-0 relative">
                        <AnimatePresence mode="wait">
                            {showLyrics ? (
                                <motion.div
                                    key="lyrics"
                                    initial={{ opacity: 0, scale: 0.95 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    exit={{ opacity: 0, scale: 0.95 }}
                                    transition={{ duration: 0.3, ease: 'backOut' }}
                                    className="absolute inset-0 flex flex-col"
                                >
                                    <div className="flex items-center justify-between mb-2 px-1">
                                        <div className="flex items-center gap-2">
                                            <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                                            <h3 className="text-title-small font-semibold text-on-surface">Lyrics</h3>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            {useLyricsStore.getState().isTranslating && (
                                                <div className="w-4 h-4 border-2 border-primary/50 border-t-primary rounded-full animate-spin mr-1" title="Translating..." />
                                            )}
                                            {useLyricsStore.getState().translationError && !useLyricsStore.getState().isTranslating && (
                                                <div className="mr-2 text-error" title={useLyricsStore.getState().translationError || "Translation Failed"}>
                                                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                        <circle cx="12" cy="12" r="10" />
                                                        <line x1="12" y1="8" x2="12" y2="12" />
                                                        <line x1="12" y1="16" x2="12.01" y2="16" />
                                                    </svg>
                                                </div>
                                            )}
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    const modes: ('original' | 'romaji' | 'both')[] = ['original', 'romaji', 'both'];
                                                    const next = modes[(modes.indexOf(lyricsMode) + 1) % 3];
                                                    useLyricsStore.getState().setLyricsMode(next);
                                                }}
                                                className="h-7 px-2 rounded-lg bg-surface-container-high hover:bg-surface-container-highest text-xs font-medium text-on-surface-variant hover:text-primary transition-colors border border-outline-variant/30 uppercase"
                                                title={`Mode: ${lyricsMode}`}
                                            >
                                                {lyricsMode === 'original' ? 'JP' : lyricsMode === 'romaji' ? 'RO' : 'BOTH'}
                                            </button>

                                            <div className="flex items-center gap-1 bg-surface-container rounded-full p-1">
                                                <button
                                                    onClick={() => setShowLyrics(false)}
                                                    className="transition-all duration-200"
                                                    title="Show Queue"
                                                >
                                                    <CloverIcon active={!showLyrics} color="var(--md-sys-color-primary)">
                                                        <IconQueue size={18} />
                                                    </CloverIcon>
                                                </button>
                                                <button
                                                    onClick={() => setShowLyrics(true)}
                                                    className="transition-all duration-200"
                                                    title="Show Lyrics"
                                                >
                                                    <CloverIcon active={showLyrics} color="var(--md-sys-color-primary)">
                                                        <IconLyrics size={18} />
                                                    </CloverIcon>
                                                </button>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="flex-1 rounded-2xl bg-surface-container-low overflow-hidden relative flex flex-col group">
                                        <SideLyrics />
                                    </div>
                                </motion.div>
                            ) : (
                                <motion.div
                                    key="queue"
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, y: -20 }}
                                    className="absolute inset-0 flex flex-col"
                                >
                                    <div className="flex items-center justify-between mb-4 px-1">
                                        <h3 className="text-title-small font-semibold text-on-surface-variant/80">Queue</h3>
                                        <div className="flex items-center gap-1 bg-surface-container rounded-full p-1">
                                            <button
                                                onClick={() => setShowLyrics(false)}
                                                className="transition-all duration-200"
                                                title="Show Queue"
                                            >
                                                <CloverIcon active={!showLyrics} color="var(--md-sys-color-primary)">
                                                    <IconQueue size={18} />
                                                </CloverIcon>
                                            </button>
                                            <button
                                                onClick={() => setShowLyrics(true)}
                                                className="transition-all duration-200"
                                                title="Show Lyrics"
                                            >
                                                <CloverIcon active={showLyrics} color="var(--md-sys-color-primary)">
                                                    <IconLyrics size={18} />
                                                </CloverIcon>
                                            </button>
                                        </div>
                                    </div>
                                    <div className="flex-1 min-h-0">
                                        {queue.length === 0 ? (
                                            <div className="p-4 rounded-xl bg-surface-container-high/50 text-center">
                                                <p className="text-body-small text-on-surface-variant">Queue is empty</p>
                                            </div>
                                        ) : (
                                            <Virtuoso
                                                totalCount={queue.length}
                                                itemContent={renderQueueItem}
                                                className="h-full no-scrollbar"
                                                overscan={5}
                                            />
                                        )}
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>
                </motion.div>
            )}
        </div>
    );
}

export const QueueItem = memo(function QueueItem({ track, isActive, onClick, displayLanguage }: {
    track: TrackDisplay;
    isActive: boolean;
    onClick?: () => void;
    displayLanguage: any;
}) {
    const coverUrl = useCoverArt(track.cover_image, track.path);
    const displayTitle = getDisplayText(track, 'title', displayLanguage);
    const displayArtist = getDisplayText(track, 'artist', displayLanguage);

    return (
        <button
            onClick={onClick}
            className={`
                group flex items-center gap-3 p-2 rounded-xl text-left transition-all duration-200 w-full
                ${isActive
                    ? 'bg-secondary-container text-on-secondary-container'
                    : 'hover:bg-surface-container-high text-on-surface'
                }
            `}
        >
            {/* Tiny Art */}
            <div className="w-10 h-10 shrink-0 relative">
                {coverUrl ? (
                    <M3CircleImage src={coverUrl} fallback={<IconMusicNote size={16} />} />
                ) : (
                    <div className="w-full h-full flex items-center justify-center bg-surface-container-highest rounded-full">
                        <IconMusicNote size={16} className="opacity-50" />
                    </div>
                )}

                {/* Hover Play Overlay */}
                <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity rounded-full">
                    <IconPlay size={16} className="text-white fill-white" />
                </div>
            </div>

            <div className="flex flex-col min-w-0 flex-1">
                <span className={`text-label-large font-medium truncate ${isActive ? '' : 'text-on-surface'}`}>
                    {displayTitle}
                </span>
                <span className={`text-label-small truncate ${isActive ? 'text-on-secondary-container/80' : 'text-on-surface-variant'}`}>
                    {displayArtist}
                </span>
            </div>

            {/* Playing Indicator */}
            {isActive && (
                <div className="w-2 h-2 rounded-full bg-primary shrink-0 mr-2" />
            )}
        </button>
    );
});
