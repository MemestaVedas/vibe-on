import { useEffect, useRef, useState, useLayoutEffect } from 'react';
import { usePlayerStore } from '../store/playerStore';
import { useCoverArt } from '../hooks/useCoverArt';
import { useImageColors } from '../hooks/useImageColors'; // Imported
import { SquigglySlider } from './SquigglySlider';
import { motion, AnimatePresence } from 'motion/react';

// Format seconds to MM:SS
function formatTime(seconds: number): string {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
}

// Helper for Marquee Text
function MarqueeText({ text, className = '' }: { text: string; className?: string }) {
    const [isOverflowing, setIsOverflowing] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);
    const textRef = useRef<HTMLDivElement>(null);

    useLayoutEffect(() => {
        if (containerRef.current && textRef.current) {
            setIsOverflowing(textRef.current.scrollWidth > containerRef.current.clientWidth);
        }
    }, [text]);

    return (
        <div ref={containerRef} className={`overflow-hidden relative ${className}`}>
            <div
                ref={textRef}
                className={`whitespace-nowrap ${isOverflowing ? 'animate-marquee' : ''}`}
            >
                {/* Render text twice for seamless loop if overflowing */}
                {isOverflowing ? (
                    <>
                        <span className="mr-8">{text}</span>
                        <span className="mr-8">{text}</span>
                    </>
                ) : (
                    text
                )}
            </div>
            {/* Fade gradients for overflow */}
            {isOverflowing && (
                <>
                    <div className="absolute left-0 top-0 bottom-0 w-4 bg-gradient-to-r from-[#1c1c1e] to-transparent z-10" />
                    <div className="absolute right-0 top-0 bottom-0 w-4 bg-gradient-to-l from-[#1c1c1e] to-transparent z-10" />
                </>
            )}
        </div>
    );
}

// Spring transition for layout animations
const springTransition = {
    type: "spring",
    stiffness: 350,
    damping: 45,
    mass: 1,
};

// Fade transition for content
const fadeTransition = {
    duration: 0.3,
    ease: [0.4, 0, 0.2, 1],
};

export function PlayerBar() {
    const { status, pause, resume, setVolume, refreshStatus, nextTrack, prevTrack, getCurrentTrackIndex, library, playFile, seek } = usePlayerStore();
    const { state, track, position_secs, volume } = status;
    const lastStateRef = useRef(state);

    // Poll for status updates while playing
    useEffect(() => {
        if (state === 'Playing') {
            const interval = setInterval(refreshStatus, 500);
            return () => clearInterval(interval);
        }
    }, [state, refreshStatus]);

    // Auto-play next track when current track ends
    useEffect(() => {
        if (lastStateRef.current === 'Playing' && state === 'Stopped' && track) {
            const isNearEnd = position_secs >= track.duration_secs - 1;
            if (isNearEnd) {
                nextTrack();
            }
        }
        lastStateRef.current = state;
    }, [state, track, position_secs, nextTrack]);

    const handlePlayPause = () => {
        if (state === 'Playing') {
            pause();
        } else if (state === 'Paused') {
            resume();
        } else if (state === 'Stopped' && track) {
            playFile(track.path);
        }
    };

    const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setVolume(parseFloat(e.target.value));
    };

    const handleSeek = (newValue: number) => {
        seek(newValue);
    };

    const currentIndex = getCurrentTrackIndex();
    const hasPrev = currentIndex > 0;
    const hasNext = currentIndex >= 0 && currentIndex < library.length - 1;

    const currentLibraryTrack = currentIndex >= 0 ? library[currentIndex] : null;
    const coverUrl = useCoverArt(currentLibraryTrack?.cover_image);

    // Extract dynamic colors from album art
    const { accent1, accent2, background } = useImageColors(coverUrl);

    // State for interactive pill
    const [isHovered, setIsHovered] = useState(false);

    // Calculate progress percentage for background fill in minimal mode
    const progressPercent = track ? (position_secs / track.duration_secs) * 100 : 0;

    return (
        <motion.div
            layout
            transition={springTransition}
            className="fixed bottom-6 left-1/2 z-50"
            style={{ x: "-50%" }}
            animate={{
                width: isHovered ? "90%" : 384,
                height: isHovered ? 96 : 56,
            }}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
        >
            {/* Hovering Pill Container */}
            <motion.div
                layout
                className="w-full h-full bg-[#1c1c1e]/95 backdrop-blur-lg border border-white/10 rounded-full shadow-2xl relative overflow-hidden"
            >
                {/* Background ambient glow - tint with dynamic color if available */}
                <div
                    className="absolute inset-0 opacity-40 pointer-events-none transition-all duration-700"
                    style={{ background: `linear-gradient(90deg, ${background}80 0%, transparent 50%, ${accent2}40 100%)` }}
                />

                {/* Minimal Mode: Background Progress Fill */}
                <motion.div
                    className="absolute inset-y-0 left-0 bg-white/20 pointer-events-none"
                    animate={{
                        width: `${progressPercent}%`,
                        opacity: isHovered ? 0 : 1
                    }}
                    transition={{ duration: 0.3, ease: "easeOut" }}
                />

                <AnimatePresence mode="wait">
                    {isHovered ? (
                        /* EXPANDED LAYOUT */
                        <motion.div
                            key="expanded"
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            transition={fadeTransition}
                            className="absolute inset-0 flex items-center px-6 gap-6 justify-between"
                        >
                            {/* Left: Cover Art & Track Info (Fixed Width to keep Center centered) */}
                            <div className="flex items-center gap-4 w-[30%] relative z-10 overflow-hidden">
                                <div className="relative w-16 h-16 rounded-full overflow-hidden shadow-lg border-2 border-white/10 flex-shrink-0">
                                    {coverUrl ? (
                                        <img src={coverUrl ?? undefined} alt="Cover" className="w-full h-full object-cover" />
                                    ) : (
                                        <div className="w-full h-full bg-gradient-to-br from-indigo-500 to-purple-500 flex justify-center items-center text-white/50">
                                            <span className="text-2xl">♪</span>
                                        </div>
                                    )}
                                </div>
                                <div className="flex flex-col overflow-hidden w-full">
                                    <MarqueeText
                                        text={track?.title || "Not Playing"}
                                        className="text-lg font-bold text-white leading-tight"
                                    />
                                    <MarqueeText
                                        text={track?.artist || "Pick a song"}
                                        className="text-sm text-white/60 leading-tight"
                                    />
                                </div>
                            </div>

                            {/* Center: Controls & Squiggly Progress (Strictly Centered) */}
                            <div className="flex-1 flex flex-col items-center justify-center gap-2 relative z-10 max-w-[40%]">
                                <div className="flex items-center gap-6">
                                    <button className="text-white/60 hover:text-white transition-colors p-2" onClick={prevTrack} disabled={!hasPrev}>
                                        <svg className="w-6 h-6 fill-current" viewBox="0 0 24 24"><path d="M6 6h2v12H6zm3.5 6l8.5 6V6z" /></svg>
                                    </button>
                                    <button
                                        className="w-12 h-12 text-white rounded-full flex items-center justify-center shadow-lg hover:scale-105 active:scale-95 transition-all"
                                        style={{ backgroundColor: accent1 }} // High-contrast accent color
                                        onClick={handlePlayPause}
                                    >
                                        {state === 'Playing' ? (
                                            <svg className="w-6 h-6 fill-current" viewBox="0 0 24 24"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" /></svg>
                                        ) : (
                                            <svg className="w-6 h-6 fill-current ml-1" viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg>
                                        )}
                                    </button>
                                    <button className="text-white/60 hover:text-white transition-colors p-2" onClick={nextTrack} disabled={!hasNext}>
                                        <svg className="w-6 h-6 fill-current" viewBox="0 0 24 24"><path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z" /></svg>
                                    </button>
                                </div>
                                <div className="w-full flex items-center gap-3">
                                    <span className="text-xs font-medium text-white/40 tabular-nums w-10 text-right">{formatTime(position_secs)}</span>
                                    <div className="flex-1">
                                        <SquigglySlider value={position_secs} max={track?.duration_secs || 100} onChange={handleSeek} isPlaying={state === 'Playing'} />
                                    </div>
                                    <span className="text-xs font-medium text-white/40 tabular-nums w-10">{track ? formatTime(track.duration_secs) : '0:00'}</span>
                                </div>
                            </div>

                            {/* Right: Volume (Fixed Width) */}
                            <div className="w-[30%] flex items-center justify-end gap-3 relative z-10">
                                <svg className="w-5 h-5 text-white/50" viewBox="0 0 24 24"><path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z" fill="currentColor" /></svg>
                                <div className="w-24 flex items-center">
                                    <input type="range" min="0" max="1" step="0.01" value={volume} onChange={handleVolumeChange} className="w-full h-1.5 bg-white/10 rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white" />
                                </div>
                            </div>
                        </motion.div>
                    ) : (
                        /* MINIMAL LAYOUT */
                        <motion.div
                            key="minimal"
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.9 }}
                            transition={fadeTransition}
                            className="absolute inset-0 flex items-center gap-4 pl-1 pr-6"
                        >
                            {/* Compact Cover - Flush Left */}
                            <motion.div
                                className="relative h-[90%] aspect-square rounded-full overflow-hidden shadow-lg border border-white/10 flex-shrink-0 ml-0.5"
                                animate={{ rotate: state === 'Playing' ? 360 : 0 }}
                                transition={{ duration: 10, repeat: Infinity, ease: "linear" }}
                                style={{ animationPlayState: state === 'Playing' ? 'running' : 'paused' }}
                            >
                                {coverUrl ? (
                                    <img src={coverUrl ?? undefined} alt="Cover" className="w-full h-full object-cover" />
                                ) : (
                                    <div className="w-full h-full bg-gradient-to-br from-indigo-500 to-purple-500 flex justify-center items-center text-white/50">
                                        <span className="text-xs">♪</span>
                                    </div>
                                )}
                            </motion.div>
                            {/* Compact Text */}
                            <div className="flex items-center gap-2 whitespace-nowrap overflow-hidden pr-2 flex-1">
                                <span className="text-sm font-bold text-white max-w-[150px] truncate">{track?.title || "Not Playing"}</span>
                                <span className="text-sm text-white/40">•</span>
                                <span className="text-sm text-white/60 max-w-[120px] truncate">{track?.artist || "Artist"}</span>
                            </div>

                            {/* Time Display */}
                            <div className="text-xs font-medium text-white/60 tabular-nums whitespace-nowrap pl-2 z-10">
                                {formatTime(position_secs)} <span className="text-white/30">/</span> {track ? formatTime(track.duration_secs) : '0:00'}
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </motion.div>
        </motion.div>
    );
}
