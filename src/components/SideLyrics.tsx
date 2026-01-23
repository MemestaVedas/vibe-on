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
    const lineRefs = useRef<(HTMLDivElement | null)[]>([]);

    const [offsetY, setOffsetY] = useState(0);
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

    // Calculate vertical offset to center the active line
    useEffect(() => {
        if (activeLineIndex >= 0 && containerRef.current && lineRefs.current[activeLineIndex]) {
            const containerHeight = containerRef.current.clientHeight;
            const activeLine = lineRefs.current[activeLineIndex];

            if (activeLine) {
                // Determine the center position relative to the container
                // We want: containerHeight / 2 = (activeLine.offsetTop + activeLineHeight / 2) + transformY
                // So: transformY = containerHeight / 2 - (activeLine.offsetTop + activeLineHeight / 2)

                const lineMid = activeLine.offsetTop + (activeLine.clientHeight / 2);
                const newOffset = (containerHeight / 2) - lineMid;

                setOffsetY(newOffset);
            }
        }
    }, [activeLineIndex, lines]); // Recalculate when active line changes

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
            className="flex-1 overflow-hidden min-h-0 relative select-none fade-mask-y"
        >
            {/* Synced Lyrics Carousel */}
            {lines && lines.length > 0 && (
                <motion.div
                    className="flex flex-col gap-6 w-full items-center py-10" // Initial padding to ensure first line can start centered?
                    // Actually, if we translate effectively, we don't need massive padding, but some visual buffer is nice. 
                    // However, we rely on offsetTop from the *top of this motion div*.

                    animate={{ y: offsetY }}
                    transition={{ type: 'spring', stiffness: 100, damping: 20, mass: 1 }}
                >
                    {lines.map((line, index) => (
                        <motion.div
                            key={`${line.time}-${index}`}
                            ref={el => lineRefs.current[index] = el}
                            onClick={() => seek(line.time)}
                            initial={false}
                            animate={{
                                opacity: index === activeLineIndex ? 1 : 0.25,
                                scale: index === activeLineIndex ? 1.05 : 0.95,
                            }}
                            transition={{ duration: 0.3 }}
                            className={`
                                cursor-pointer text-center px-6 max-w-full transition-colors duration-300
                                ${index === activeLineIndex ? 'font-bold z-10' : 'hover:opacity-60'}
                            `}
                        >
                            <p
                                className="text-xl md:text-2xl leading-relaxed"
                                style={{
                                    color: index === activeLineIndex ? primary : undefined,
                                    textShadow: index === activeLineIndex ? `0 0 25px ${primary}60` : 'none'
                                }}
                            >
                                {line.text}
                            </p>
                        </motion.div>
                    ))}
                </motion.div>
            )}

            {/* Plain Lyrics Scroll (Fallback) */}
            {!lines && plainLyrics && (
                <div className="h-full overflow-y-auto no-scrollbar p-6 whitespace-pre-wrap text-body-medium text-on-surface/80 leading-relaxed text-center">
                    {plainLyrics}
                </div>
            )}
        </div>
    );
}
