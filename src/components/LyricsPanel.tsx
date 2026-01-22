import { useEffect, useRef, useMemo, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useLyricsStore } from '../store/lyricsStore';
import { usePlayerStore } from '../store/playerStore';
import { useThemeStore } from '../store/themeStore';

export function LyricsPanel() {
    const { lines, plainLyrics, showLyrics, closeLyrics, isLoading, error, isInstrumental } = useLyricsStore();
    const { status, seek } = usePlayerStore();
    const { colors } = useThemeStore();
    const containerRef = useRef<HTMLDivElement>(null);
    const activeLineRef = useRef<HTMLDivElement>(null);

    // Track if user is manually scrolling - pause auto-scroll when they do
    const [isUserScrolling, setIsUserScrolling] = useState(false);
    const scrollTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const position = status.position_secs;

    // Find current active line based on playback position
    const activeLineIndex = useMemo(() => {
        if (!lines || lines.length === 0) return -1;

        // Find the last line that has started playing
        for (let i = lines.length - 1; i >= 0; i--) {
            if (position >= lines[i].time) {
                return i;
            }
        }
        return -1;
    }, [lines, position]);

    // Handle user scroll - pause auto-scroll for 5 seconds
    const handleScroll = useCallback(() => {
        setIsUserScrolling(true);

        // Clear existing timeout
        if (scrollTimeoutRef.current) {
            clearTimeout(scrollTimeoutRef.current);
        }

        // Resume auto-scroll after 5 seconds of no scrolling
        scrollTimeoutRef.current = setTimeout(() => {
            setIsUserScrolling(false);
        }, 5000);
    }, []);

    // Auto-scroll to active line (only if user isn't scrolling)
    useEffect(() => {
        if (!isUserScrolling && activeLineRef.current && containerRef.current) {
            activeLineRef.current.scrollIntoView({
                behavior: 'smooth',
                block: 'center',
            });
        }
    }, [activeLineIndex, isUserScrolling]);

    // Cleanup timeout on unmount
    useEffect(() => {
        return () => {
            if (scrollTimeoutRef.current) {
                clearTimeout(scrollTimeoutRef.current);
            }
        };
    }, []);

    if (!showLyrics) return null;

    return (
        <AnimatePresence>
            <motion.div
                initial={{ opacity: 0, y: 50 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 50 }}
                transition={{ type: "spring", stiffness: 300, damping: 30 }}
                className="fixed inset-0 z-40 flex items-center justify-center p-8 pb-32"
                style={{ pointerEvents: 'none' }}
            >
                {/* Backdrop - click to close */}
                <div
                    className="absolute inset-0 bg-black/60 backdrop-blur-xl"
                    style={{ pointerEvents: 'auto' }}
                    onClick={closeLyrics}
                />

                {/* Lyrics Container */}
                <motion.div
                    initial={{ scale: 0.95 }}
                    animate={{ scale: 1 }}
                    exit={{ scale: 0.95 }}
                    className="relative z-10 w-full max-w-2xl h-[70vh] rounded-3xl overflow-hidden"
                    style={{
                        pointerEvents: 'auto',
                        background: `linear-gradient(180deg, ${colors.backgroundRaw}e0 0%, ${colors.backgroundRaw}f0 100%)`,
                        boxShadow: `0 25px 50px -12px rgba(0, 0, 0, 0.5), inset 0 1px 0 rgba(255,255,255,0.1)`
                    }}
                >
                    {/* Header */}
                    <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
                        <div className="flex items-center gap-3">
                            <div
                                className="w-10 h-10 rounded-xl flex items-center justify-center"
                                style={{ backgroundColor: colors.accent1 + '20' }}
                            >
                                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke={colors.accent1} strokeWidth="2">
                                    <path d="M9 18V5l12-2v13" />
                                    <circle cx="6" cy="18" r="3" />
                                    <circle cx="18" cy="16" r="3" />
                                </svg>
                            </div>
                            <div>
                                <h2 className="text-lg font-bold text-white">Lyrics</h2>
                                <p className="text-sm text-white/50 truncate max-w-[200px]">
                                    {status.track?.title || 'No track playing'}
                                </p>
                            </div>
                        </div>

                        {/* Close Button */}
                        <button
                            onClick={closeLyrics}
                            className="w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors"
                        >
                            <svg className="w-5 h-5 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M18 6L6 18M6 6l12 12" />
                            </svg>
                        </button>
                    </div>

                    {/* Lyrics Content */}
                    <div
                        ref={containerRef}
                        onScroll={handleScroll}
                        className="h-[calc(100%-72px)] overflow-y-auto px-6 py-8 scrollbar-thin scrollbar-thumb-white/20 scrollbar-track-transparent"
                    >
                        {isLoading && (
                            <div className="flex flex-col items-center justify-center h-full gap-4">
                                <div className="w-8 h-8 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                <p className="text-white/50">Searching for lyrics...</p>
                            </div>
                        )}

                        {error && !isLoading && (
                            <div className="flex flex-col items-center justify-center h-full gap-4 text-center">
                                <div className="w-16 h-16 rounded-full bg-white/10 flex items-center justify-center">
                                    <svg className="w-8 h-8 text-white/40" viewBox="0 0 24 24" fill="currentColor">
                                        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" />
                                    </svg>
                                </div>
                                <p className="text-white/50">No lyrics found for this track</p>
                                <p className="text-white/30 text-sm">Try a different song or check the track info</p>
                            </div>
                        )}

                        {isInstrumental && !isLoading && (
                            <div className="flex flex-col items-center justify-center h-full gap-4 text-center">
                                <div className="w-16 h-16 rounded-full bg-white/10 flex items-center justify-center">
                                    <svg className="w-8 h-8 text-white/40" viewBox="0 0 24 24" fill="currentColor">
                                        <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z" />
                                    </svg>
                                </div>
                                <p className="text-white/50">Instrumental Track</p>
                                <p className="text-white/30 text-sm">This track has no vocals</p>
                            </div>
                        )}

                        {/* Synced Lyrics - Click to seek */}
                        {lines && lines.length > 0 && !isLoading && (
                            <div className="space-y-4">
                                {lines.map((line, index) => (
                                    <div
                                        key={`${line.time}-${index}`}
                                        ref={index === activeLineIndex ? activeLineRef : null}
                                        onClick={() => seek(line.time)}
                                        className="transition-all duration-300 cursor-pointer hover:opacity-100 group"
                                        style={{
                                            opacity: index === activeLineIndex ? 1 : 0.4,
                                            transform: index === activeLineIndex ? 'scale(1.02)' : 'scale(1)',
                                        }}
                                    >
                                        <p
                                            className="text-2xl font-semibold leading-relaxed transition-colors duration-300 group-hover:text-white"
                                            style={{
                                                color: index === activeLineIndex ? colors.accent1 : 'white',
                                            }}
                                        >
                                            {line.text}
                                        </p>
                                    </div>
                                ))}
                                {/* Bottom padding for scroll */}
                                <div className="h-32" />
                            </div>
                        )}

                        {/* Plain Lyrics Fallback */}
                        {!lines && plainLyrics && !isLoading && !isInstrumental && (
                            <div className="whitespace-pre-wrap text-lg text-white/80 leading-relaxed">
                                {plainLyrics}
                            </div>
                        )}
                    </div>
                </motion.div>
            </motion.div>
        </AnimatePresence>
    );
}
