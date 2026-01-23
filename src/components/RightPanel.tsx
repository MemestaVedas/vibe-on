import { SideLyrics } from './SideLyrics';
import { useLyricsStore } from '../store/lyricsStore';
import { AnimatePresence, motion } from 'motion/react';
import { useEffect, useState } from 'react';
import { usePlayerStore } from '../store/playerStore';
import { useCoverArt } from '../hooks/useCoverArt';
import { IconMusicNote, IconPlay, IconExternalLink } from './Icons';
import { MarqueeText } from './MarqueeText';
import { SquigglySlider } from './SquigglySlider';

export function RightPanel() {
    const { status, library, history, playFile } = usePlayerStore();
    const { lines, plainLyrics, isInstrumental, isLoading, fetchLyrics, error } = useLyricsStore();
    const { track } = status;

    // Fetch lyrics automatically when track changes
    useEffect(() => {
        if (track?.path) {
            console.log('[RightPanel] Track changed:', track.title);
            console.log('[RightPanel] Triggering fetchLyrics for:', track.path);
            // We use fetchLyrics (not loadCachedLyrics) to ensure we actually trigger a fetch if not cached
            fetchLyrics(
                track.artist,
                track.title,
                track.duration_secs,
                track.path
            );
        }
    }, [track?.path, track?.title, track?.artist, track?.duration_secs, fetchLyrics]);

    // Debug logging for state changes
    useEffect(() => {
        console.log('[RightPanel] Lyrics updated:', {
            hasLines: !!lines,
            hasPlain: !!plainLyrics,
            instrumental: isInstrumental,
            loading: isLoading,
            error: error
        });
    }, [lines, plainLyrics, isInstrumental, isLoading, error]);

    // Get cover from library
    const currentIndex = library.findIndex(t => t.path === track?.path);
    const currentLibraryTrack = currentIndex >= 0 ? library[currentIndex] : null;
    const coverUrl = useCoverArt(currentLibraryTrack?.cover_image);

    // Get recently played from store (limit to 10 for display)
    const recentTracks = history.slice(0, 10);

    // Determine what to show in the bottom section
    const hasContent = (lines && lines.length > 0) || (plainLyrics && plainLyrics.trim().length > 0);

    // Ideal state: Show if loading OR (valid content AND not instrumental AND no error)
    const shouldShowLyricsIdeally = isLoading || (hasContent && !isInstrumental && !error);

    const [showLyrics, setShowLyrics] = useState(shouldShowLyricsIdeally);

    useEffect(() => {
        if (shouldShowLyricsIdeally) {
            setShowLyrics(true);
        } else {
            // Keep showing if we have a specific error message to let user read it
            if (error && error.includes("recents view")) {
                const timer = setTimeout(() => setShowLyrics(false), 3000);
                return () => clearTimeout(timer);
            } else {
                setShowLyrics(false);
            }
        }
    }, [shouldShowLyricsIdeally, error]);

    return (
        <aside className="h-full flex flex-col p-6 gap-6 overflow-hidden">
            {/* Now Playing Header */}
            <div className="flex items-center justify-between shrink-0">
                <h2 className="text-title-medium font-bold text-on-surface">Now Playing</h2>
            </div>

            {/* Main Art & Info */}
            <div className="flex flex-col items-center gap-4 shrink-0 transition-all duration-300">
                {/* Large Art */}
                <div className="w-52 h-52 rounded-[1.5rem] bg-surface-container-high shadow-elevation-2 relative group overflow-hidden shrink-0">
                    {coverUrl ? (
                        <img
                            src={coverUrl}
                            alt={track?.album || "Album Art"}
                            className="w-full h-full object-cover"
                        />
                    ) : (
                        <div className="w-full h-full flex items-center justify-center text-on-surface-variant/50">
                            <IconMusicNote size={48} />
                        </div>
                    )}
                </div>

                {/* Info */}
                <div className="flex flex-col items-center text-center gap-1 w-full px-2">
                    <div className="w-full text-headline-small font-bold text-on-surface truncate">
                        <MarqueeText text={track?.title || "Not Playing"} />
                    </div>
                    <div className="text-title-medium text-on-surface-variant truncate w-full">
                        {track?.artist || "Pick a song"}
                    </div>
                    <p className="text-label-medium text-on-surface-variant/60 mt-1 truncate max-w-full">
                        {track?.album}
                    </p>
                </div>
            </div>

            {/* Separator */}
            <div className="px-8 py-2">
                <SquigglySlider
                    value={50}
                    max={100}
                    onChange={() => { }}
                    isPlaying={status.state === 'Playing'}
                    className="h-4 pointer-events-none opacity-50"
                    accentColor="var(--md-sys-color-outline-variant)"
                />
            </div>

            {/* Content Switcher: Lyrics or Recent History */}
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
                                <button
                                    onClick={() => import('../utils/windowUtils').then(m => m.openLyricsWindow())}
                                    className="p-1.5 text-on-surface-variant hover:text-on-surface hover:bg-surface-container-highest rounded-lg transition-colors"
                                    title="Open Floating Window"
                                >
                                    <IconExternalLink size={16} />
                                </button>
                            </div>

                            {/* Window-like container */}
                            <div className="flex-1 rounded-2xl bg-surface-container-low overflow-hidden relative flex flex-col group">
                                <SideLyrics />
                            </div>
                        </motion.div>
                    ) : (
                        <motion.div
                            key="history"
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -20 }}
                            className="absolute inset-0 flex flex-col"
                        >
                            <h3 className="text-title-small font-semibold text-on-surface-variant/80 px-1 mb-4">Recently Played</h3>
                            <div className="flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-surface-container-high gap-2 flex flex-col pb-4">
                                {recentTracks.length === 0 && (
                                    <div className="p-4 rounded-xl bg-surface-container-high/50 text-center">
                                        <p className="text-body-small text-on-surface-variant">Start playing music to build your history!</p>
                                    </div>
                                )}

                                {recentTracks.map((t, i) => (
                                    <QueueItem
                                        key={`${t.path}-${i}`}
                                        track={t}
                                        isActive={t.path === track?.path}
                                        onClick={() => playFile(t.path)}
                                    />
                                ))}
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </aside>
    );
}

function QueueItem({ track, isActive, onClick }: {
    track: { title: string; artist: string; cover_image?: string | null };
    isActive: boolean;
    onClick?: () => void;
}) {
    const coverUrl = useCoverArt(track.cover_image);

    return (
        <button
            onClick={onClick}
            className={`
                group flex items-center gap-3 p-2 rounded-xl text-left transition-all duration-200
                ${isActive
                    ? 'bg-secondary-container text-on-secondary-container'
                    : 'hover:bg-surface-container-high text-on-surface'
                }
            `}
        >
            {/* Tiny Art */}
            <div className={`
                w-10 h-10 rounded-lg overflow-hidden shrink-0 bg-surface-container-highest relative
                ${isActive ? 'shadow-sm' : ''}
            `}>
                {coverUrl ? (
                    <img src={coverUrl} alt="" className="w-full h-full object-cover" />
                ) : (
                    <div className="w-full h-full flex items-center justify-center">
                        <IconMusicNote size={16} className="opacity-50" />
                    </div>
                )}

                {/* Hover Play Overlay */}
                <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                    <IconPlay size={16} className="text-white fill-white" />
                </div>
            </div>

            <div className="flex flex-col min-w-0 flex-1">
                <span className={`text-label-large font-medium truncate ${isActive ? '' : 'text-on-surface'}`}>
                    {track.title}
                </span>
                <span className={`text-label-small truncate ${isActive ? 'text-on-secondary-container/80' : 'text-on-surface-variant'}`}>
                    {track.artist}
                </span>
            </div>
        </button>
    );
}
