import { useEffect, useRef, useMemo, useState, useCallback } from 'react';
import { motion } from 'motion/react';
import { useLyricsStore } from '../store/lyricsStore';
import { usePlayerStore } from '../store/playerStore';
import { useThemeStore } from '../store/themeStore';

export function SideLyrics() {
    const { lines, plainLyrics, isLoading, error, isInstrumental } = useLyricsStore();
    const { status, seek } = usePlayerStore();
    const { colors } = useThemeStore();
    const { primary } = colors;

    const containerRef = useRef<HTMLDivElement>(null);
    const activeLineRef = useRef<HTMLDivElement>(null);

    // Track if user is manually scrolling
    const [isUserScrolling, setIsUserScrolling] = useState(false);
    const scrollTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const position = status.position_secs;

    // Find current active line
    const activeLineIndex = useMemo(() => {
        if (!lines || lines.length === 0) return -1;
        for (let i = lines.length - 1; i >= 0; i--) {
            if (position >= lines[i].time) {
                return i;
            }
        }
        return -1;
    }, [lines, position]);



    // Handle user scroll interactions (pause auto-scroll)
    // We use onWheel/onTouchStart instead of onScroll to avoid triggering this
    // when we programmatically scroll via scrollIntoView
    const handleScroll = useCallback(() => {
        console.log('[SideLyrics] User scroll detected');
        setIsUserScrolling(true);
        if (scrollTimeoutRef.current) clearTimeout(scrollTimeoutRef.current);
        scrollTimeoutRef.current = setTimeout(() => {
            console.log('[SideLyrics] User scroll timeout ended, resuming auto-scroll');
            setIsUserScrolling(false);
        }, 5000);
    }, []);

    // Auto-scroll
    useEffect(() => {
        if (!isUserScrolling && activeLineRef.current && containerRef.current) {
            const container = containerRef.current;
            const activeLine = activeLineRef.current;

            // Calculate center position:
            // Line's offset within container - Half container height + Half line height
            // We need to account for the container's scrollTop as well if we were using getBoundingClientRect, 
            // but offsetTop is relative to the offsetParent (which should be the container if it's positioned).
            // Default position is static, so we might need to check if container has relative positioning?
            // "flex-1 overflow-y-auto" usually makes it the offset parent for children if we add relative.

            const scrollTarget = activeLine.offsetTop - (container.clientHeight / 2) + (activeLine.clientHeight / 2);

            container.scrollTo({
                top: scrollTarget,
                behavior: 'smooth'
            });
        }
    }, [activeLineIndex, isUserScrolling]);

    // Cleanup
    useEffect(() => {
        return () => {
            if (scrollTimeoutRef.current) clearTimeout(scrollTimeoutRef.current);
        };
    }, []);

    if (isLoading) {
        return (
            <div className="flex flex-col items-center justify-center h-full gap-3 py-10 opacity-50">
                <div className="w-6 h-6 border-2 border-on-surface/30 border-t-on-surface rounded-full animate-spin" />
                <p className="text-label-medium">Loading lyrics...</p>
            </div>
        );
    }

    if (error) {
        return (
            <div className="flex flex-col items-center justify-center h-full gap-2 py-10 text-center opacity-50">
                <p className="text-body-medium">No lyrics found</p>
            </div>
        );
    }

    if (isInstrumental) {
        return (
            <div className="flex flex-col items-center justify-center h-full gap-2 py-10 text-center opacity-70">
                <p className="text-title-medium font-medium">Instrumental</p>
            </div>
        );
    }

    return (
        <div
            ref={containerRef}
            onWheel={handleScroll}
            onTouchStart={handleScroll}
            className="flex-1 overflow-y-auto min-h-0 scrollbar-thin scrollbar-thumb-surface-container-high/50 hover:scrollbar-thumb-surface-container-high fade-mask-y relative"
        >
            {/* Synced Lyrics */}
            {lines && lines.length > 0 && (
                <div className="flex flex-col gap-3 py-4">
                    {lines.map((line, index) => (
                        <motion.div
                            key={`${line.time}-${index}`}
                            ref={index === activeLineIndex ? activeLineRef : null}
                            onClick={() => seek(line.time)}
                            initial={false}
                            animate={{
                                opacity: index === activeLineIndex ? 1 : 0.5,
                                scale: index === activeLineIndex ? 1 : 0.98,
                                x: index === activeLineIndex ? 0 : 0
                            }}
                            className={`
                                cursor-pointer origin-left transition-colors duration-300
                                ${index === activeLineIndex ? 'font-medium' : 'hover:opacity-80'}
                            `}
                        >
                            <p
                                className="text-body-large leading-relaxed"
                                style={{
                                    color: index === activeLineIndex ? primary : undefined
                                }}
                            >
                                {line.text}
                            </p>
                        </motion.div>
                    ))}
                    <div className="h-24" /> {/* Bottom padding */}
                </div>
            )}

            {/* Plain Lyrics */}
            {!lines && plainLyrics && (
                <div className="py-4 whitespace-pre-wrap text-body-medium text-on-surface/80 leading-relaxed">
                    {plainLyrics}
                </div>
            )}
        </div>
    );
}
