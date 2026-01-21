import { useEffect, useRef, useState } from 'react';
import { usePlayerStore } from '../store/playerStore';
import { useCoverArt } from '../hooks/useCoverArt';
import { SquigglySlider } from './SquigglySlider';
import { MarqueeText } from './MarqueeText';
import { motion, AnimatePresence } from 'framer-motion';

// Format seconds to MM:SS
function formatTime(seconds: number): string {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
}

// Spring transition for layout animations
const springTransition = {
    type: "spring",
    stiffness: 350,
    damping: 45,
    mass: 1,
} as const;

// Fade transition for content
const fadeTransition = {
    duration: 0.3,
    ease: [0.4, 0, 0.2, 1] as const,
};

export function PlayerBar() {
    const { status, pause, resume, setVolume, refreshStatus, nextTrack, prevTrack, getCurrentTrackIndex, library, playFile } = usePlayerStore();
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
        console.log("Seek to:", newValue);
    };

    const currentIndex = getCurrentTrackIndex();
    const hasPrev = currentIndex > 0;
    const hasNext = currentIndex >= 0 && currentIndex < library.length - 1;

    const currentLibraryTrack = currentIndex >= 0 ? library[currentIndex] : null;
    const coverUrl = useCoverArt(currentLibraryTrack?.cover_image);

    // State for interactive pill
    const [isHovered, setIsHovered] = useState(false);

    // Calculate progress percentage for background fill in minimal mode
    const progressPercent = track ? (position_secs / track.duration_secs) * 100 : 0;

    // Remove early return to prevent unmounting flash
    // if (!track && state === 'Stopped') return null;

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
                {/* Background ambient glow */}
                <div className="absolute inset-0 bg-gradient-to-r from-indigo-500/10 via-purple-500/10 to-pink-500/10 opacity-50 pointer-events-none" />

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
                            className="absolute inset-0 flex items-center px-6 gap-6"
                        >
                            {/* Left: Cover Art & Track Info - Fixed width to prevent pushing controls */}
                            <div className="flex items-center gap-4 w-[25%] flex-shrink-0 relative z-10">
                                <div className="flex flex-col overflow-hidden min-w-0 flex-1">
                                    <MarqueeText text={track?.title || "Not Playing"} className="text-lg font-bold text-white leading-tight" />
                                    <div className="text-sm text-white/60 leading-tight truncate">{track?.artist || "Pick a song"}</div>
                                </div>
                            </div>

                            {/* Expanded Mode: Background Cover Art with fade */}
                            {coverUrl && (
                                <div className="absolute left-0 top-0 bottom-0 w-[50%] pointer-events-none rounded-l-full overflow-hidden">
                                    <img
                                        src={coverUrl}
                                        alt=""
                                        className="absolute inset-0 w-full h-full object-cover"
                                        style={{
                                            maskImage: 'linear-gradient(to right, rgba(0,0,0,0.6) 0%, rgba(0,0,0,0.4) 40%, rgba(0,0,0,0) 100%)',
                                            WebkitMaskImage: 'linear-gradient(to right, rgba(0,0,0,0.6) 0%, rgba(0,0,0,0.4) 40%, rgba(0,0,0,0) 100%)',
                                        }}
                                    />
                                </div>
                            )}

                            {/* Center: Controls & Squiggly Progress */}
                            <div className="flex-1 flex flex-col items-center justify-center gap-2 relative z-10">
                                <div className="flex items-center gap-6">
                                    <button className="text-white/60 hover:text-white transition-colors p-2" onClick={prevTrack} disabled={!hasPrev}>
                                        <svg className="w-6 h-6 fill-current" viewBox="0 0 24 24"><path d="M6 6h2v12H6zm3.5 6l8.5 6V6z" /></svg>
                                    </button>
                                    <button className="w-12 h-12 bg-indigo-500 text-white rounded-full flex items-center justify-center shadow-lg hover:scale-105 hover:bg-indigo-400 active:scale-95 transition-all" onClick={handlePlayPause}>
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
                                <div className="w-full max-w-md flex items-center gap-3">
                                    <span className="text-xs font-medium text-white/40 tabular-nums w-10 text-right">{formatTime(position_secs)}</span>
                                    <div className="flex-1">
                                        <SquigglySlider value={position_secs} max={track?.duration_secs || 100} onChange={handleSeek} />
                                    </div>
                                    <span className="text-xs font-medium text-white/40 tabular-nums w-10">{track ? formatTime(track.duration_secs) : '0:00'}</span>
                                </div>
                            </div>

                            {/* Right: Volume - Fixed width */}
                            <div className="w-[20%] flex-shrink-0 flex items-center justify-end gap-3 relative z-10">
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
                            {/* Minimal Mode: Vinyl-style Compact Cover - Flush Left */}
                            <div
                                className="relative h-[90%] aspect-square overflow-hidden shadow-lg border border-white/10 flex-shrink-0 ml-0.5 rounded-full"
                                style={{
                                    animation: state === 'Playing' ? 'spin-vinyl 8s linear infinite' : 'none',
                                }}
                            >
                                {coverUrl ? (
                                    <img src={coverUrl ?? undefined} alt="Cover" className="w-full h-full object-cover" />
                                ) : (
                                    <div className="w-full h-full bg-gradient-to-br from-indigo-500 to-purple-500 flex justify-center items-center text-white/50">
                                        <span className="text-xs">♪</span>
                                    </div>
                                )}
                                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-black/80 border border-white/20" />
                            </div>

                            {/* Compact Text */}
                            <div className="flex items-center gap-2 overflow-hidden pr-2 flex-1 min-w-0 relative z-10">
                                <MarqueeText text={track?.title || "Not Playing"} className="text-sm font-bold text-white flex-1 min-w-0" />
                                <span className="text-sm text-white/40 flex-shrink-0">•</span>
                                <span className="text-sm text-white/60 max-w-[80px] truncate flex-shrink-0">{track?.artist || "Artist"}</span>
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
