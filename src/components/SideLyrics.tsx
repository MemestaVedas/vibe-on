import { useEffect, useRef, useMemo } from 'react';
import { motion } from 'motion/react';
import { useLyricsStore } from '../store/lyricsStore';
import { usePlayerStore } from '../store/playerStore';
import { useThemeStore } from '../store/themeStore';
import type { LyricsLine } from '../types';
import { Virtuoso } from 'react-virtuoso';

interface SideLyricsProps {
    variant?: 'carousel' | 'scrollable';
}

export function SideLyrics({ variant = 'carousel' }: SideLyricsProps) {
    const { lines, plainLyrics, isLoading, error, isInstrumental, loadingStatus, lyricsMode } = useLyricsStore();
    const { status, seek } = usePlayerStore();
    const { colors } = useThemeStore();
    const { primary } = colors;

    const virtuosoRef = useRef<any>(null);
    // Track user scrolling to prevent auto-scroll interfering aggressively
    const isUserScrolling = useRef(false);
    const scrollTimeout = useRef<any>(null);

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

    // Enhanced Auto-scroll Logic
    useEffect(() => {
        if (activeLineIndex >= 0 && virtuosoRef.current && !isUserScrolling.current) {
            virtuosoRef.current.scrollToIndex({
                index: activeLineIndex,
                align: 'center',
                behavior: 'smooth'
            });
        }
    }, [activeLineIndex]);

    const renderLineContent = (line: LyricsLine, isActive: boolean) => {
        if (lyricsMode === 'romaji') {
            return line.romaji || line.text;
        }
        if (lyricsMode === 'both' && line.romaji) {
            return (
                <div className="flex flex-col items-center gap-1">
                    <span className={`text-xs font-bold uppercase tracking-wider opacity-60 ${isActive ? 'text-primary' : 'text-on-surface-variant'}`} style={{ color: isActive ? primary : undefined }}>
                        {line.romaji}
                    </span>
                    <span>{line.text}</span>
                </div>
            );
        }
        return line.text;
    };

    if (isLoading) {
        return (
            <div className="flex flex-col items-center justify-center h-full gap-3 py-10 opacity-50 px-4 text-center">
                <div className="w-6 h-6 border-2 border-on-surface/30 border-t-on-surface rounded-full animate-spin shrink-0" />
                <p className="text-label-medium animate-pulse">{loadingStatus || "Loading lyrics..."}</p>
            </div>
        );
    }

    if (error) {
        return (
            <div className="flex flex-col items-center justify-center h-full gap-2 py-10 text-center opacity-50">
                <p className="text-body-medium">No lyrics found</p>
                {plainLyrics && <p className="text-xs opacity-50">Plain text available below</p>}
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

    // fallback for plain lyrics if no synced lines
    if ((!lines || lines.length === 0) && plainLyrics) {
        return (
            <div className="h-full overflow-y-auto no-scrollbar p-6 whitespace-pre-wrap text-body-medium text-on-surface/80 leading-relaxed text-center fade-mask-y">
                {plainLyrics}
            </div>
        );
    }

    // Scrollable List Variant (Simpler List)
    if (variant === 'scrollable') {
        return (
            <Virtuoso
                ref={virtuosoRef}
                data={lines || []}
                className="no-scrollbar h-full fade-mask-y"
                followOutput={(isAtBottom) => {
                    if (isUserScrolling.current) return false;
                    return isAtBottom ? 'smooth' : false
                }}
                itemContent={(index, line) => {
                    const isActive = index === activeLineIndex;
                    return (
                        <div
                            key={`${line.time}-${index}`}
                            onClick={() => seek(line.time)}
                            className={`
                                cursor-pointer p-3 rounded-lg transition-all duration-200 text-lg mb-2
                                ${isActive
                                    ? 'bg-surface-container-highest text-on-surface font-semibold shadow-sm scale-[1.02]'
                                    : 'text-on-surface-variant/70 hover:bg-surface-container-high hover:text-on-surface'
                                }
                            `}
                        >
                            {renderLineContent(line, isActive)}
                        </div>
                    );
                }}
            />
        );
    }

    // Default Carousel Render (Virtuoso-based)
    return (
        <div className="h-full w-full relative fade-mask-y">
            <Virtuoso
                ref={virtuosoRef}
                data={lines || []}
                className="no-scrollbar h-full"
                // Detect scroll to pause auto-scroll temporarily could be implemented via onScroll
                // For now, simpler auto-scroll is sufficient as Virtuoso handles it well
                isScrolling={(isScrolling) => {
                    isUserScrolling.current = isScrolling;
                    if (scrollTimeout.current) clearTimeout(scrollTimeout.current);
                    if (!isScrolling) {
                        // Resume auto-scroll after 2 seconds of no scrolling
                        scrollTimeout.current = setTimeout(() => {
                            isUserScrolling.current = false;
                        }, 2000);
                    }
                }}
                components={{
                    Header: () => <div className="h-[40vh]" />,
                    Footer: () => <div className="h-[40vh]" />
                }}
                itemContent={(index, line) => {
                    const isActive = index === activeLineIndex;
                    return (
                        <motion.div
                            initial={false}
                            animate={{
                                opacity: isActive ? 1 : 0.3,
                                scale: isActive ? 1.05 : 0.95,
                                filter: isActive ? 'blur(0px)' : 'blur(0.5px)',
                            }}
                            transition={{ duration: 0.3 }}
                            className={`
                                py-4 px-6 text-center cursor-pointer transition-colors duration-300
                                ${isActive ? 'font-bold z-10' : 'hover:opacity-60'}
                            `}
                            onClick={() => seek(line.time)}
                        >
                            <div
                                className="text-xl leading-relaxed"
                                style={{
                                    color: isActive ? primary : undefined,
                                    textShadow: isActive ? `0 0 20px ${primary}40` : 'none'
                                }}
                            >
                                {renderLineContent(line, isActive)}
                            </div>
                        </motion.div>
                    );
                }}
            />
        </div>
    );
}
