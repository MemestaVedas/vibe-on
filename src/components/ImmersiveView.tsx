import { motion } from 'motion/react';
import { usePlayerStore } from '../store/playerStore';
import { useCoverArt } from '../hooks/useCoverArt';
import { useImageColors } from '../hooks/useImageColors';
import { IconClose, IconPlay, IconPause, IconNext, IconPrevious, IconMusicNote, IconShuffle } from './Icons';
import { SquigglySlider } from './SquigglySlider';
import { SideLyrics } from './SideLyrics';
import { QueueItem } from './RightPanel';

export function ImmersiveView() {
    const { status, toggleImmersiveMode, toggleShuffle, isShuffled, pause, resume, nextTrack, prevTrack, seek, library, queue, playFile } = usePlayerStore();
    const { track, state, position_secs } = status;

    // Get correct cover from library (status.track might not have full path)
    const currentIndex = library.findIndex(t => t.path === track?.path);
    const currentLibraryTrack = currentIndex >= 0 ? library[currentIndex] : null;
    const coverUrl = useCoverArt(currentLibraryTrack?.cover_image || track?.cover_image); // Fallback to track.cover_image

    const colors = useImageColors(coverUrl);

    // If not in immersive mode, we don't render anything (handled by parent usually, but good to have safeguard if we use AnimatePresence in App)
    // Actually, we'll let App handle the unmount or use AnimatePresence there. 
    // If we want exit animations, we should return null here? 
    // No, App.tsx will wrapping it in AnimatePresence. We just define the component.

    // Background gradient style
    const backgroundStyle = {
        background: `linear-gradient(135deg, ${colors.surfaceContainerLowest} 0%, ${colors.surfaceContainer} 100%)`,
    };

    // Dynamic text colors
    // We'll use the generated 'onSurface' etc for accessibility

    const isPlaying = state === 'Playing';

    return (
        <motion.div
            initial={{ opacity: 0, y: '100%' }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="fixed inset-0 z-[100] flex flex-col items-center justify-center overflow-hidden"
            style={backgroundStyle}
        >
            {/* Background Glows/Blobs for extra immersion */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none opacity-40">
                <div
                    className="absolute top-[-20%] left-[-20%] w-[80%] h-[80%] rounded-full blur-[120px] mix-blend-soft-light animate-pulse"
                    style={{ backgroundColor: colors.primaryContainer }}
                />
                <div
                    className="absolute bottom-[-20%] right-[-20%] w-[80%] h-[80%] rounded-full blur-[120px] mix-blend-soft-light animate-pulse"
                    style={{ backgroundColor: colors.tertiaryContainer, animationDelay: '2s' }}
                />
            </div>

            {/* Close Button - Absolutely Positioned */}
            <button
                onClick={toggleImmersiveMode}
                className="absolute top-8 right-8 z-50 p-4 rounded-full bg-black/10 hover:bg-black/20 backdrop-blur-md transition-colors text-white"
                style={{ color: colors.onSurface }}
            >
                <IconClose size={32} />
            </button>

            {/* Content Container - Grid Layout */}
            <div className="relative z-10 w-full h-full flex flex-col xl:flex-row gap-6 p-6 md:p-12 overflow-hidden">

                {/* Left: Queue (Visible on XL screens) */}
                <div className="hidden xl:flex flex-col w-80 shrink-0 gap-4 overflow-hidden rounded-2xl bg-black/5 backdrop-blur-sm border border-white/5 p-4">
                    <h3 className="text-title-medium font-bold px-2" style={{ color: colors.onSurface }}>Up Next</h3>
                    <div className="flex-1 overflow-y-auto no-scrollbar space-y-2">
                        {queue.map((t, i) => (
                            <QueueItem
                                key={`${t.path}-${i}`}
                                track={t}
                                isActive={t.path === track?.path}
                                onClick={() => playFile(t.path)}
                            />
                        ))}
                    </div>
                </div>

                {/* Center: Main Content */}
                <div className="flex-1 flex flex-col items-center justify-center min-w-0">
                    <div className="flex flex-col items-center justify-center gap-8 md:gap-12 w-full max-w-2xl">

                        {/* Album Art */}
                        <div className="relative group shrink-0">
                            <motion.div
                                layoutId="immersive-art"
                                className="w-[30vh] h-[30vh] md:w-[40vh] md:h-[40vh] rounded-[2rem] md:rounded-[3rem] shadow-2xl overflow-hidden"
                                style={{
                                    boxShadow: `0 20px 50px -12px rgba(0,0,0,0.5)`
                                }}
                            >
                                {coverUrl ? (
                                    <img
                                        src={coverUrl}
                                        alt={track?.album}
                                        className="w-full h-full object-cover"
                                    />
                                ) : (
                                    <div
                                        className="w-full h-full flex items-center justify-center"
                                        style={{ backgroundColor: colors.surfaceContainerHighest, color: colors.onSurfaceVariant }}
                                    >
                                        <IconMusicNote size={120} />
                                    </div>
                                )}
                            </motion.div>
                        </div>

                        {/* Metadata & Controls */}
                        <div className="flex flex-col items-center text-center w-full">

                            {/* Text Info */}
                            <div className="mb-8 space-y-2">
                                <motion.h1
                                    className="text-3xl md:text-5xl font-black tracking-tight leading-tight line-clamp-2"
                                    style={{ color: colors.onSurface }}
                                >
                                    {track?.title || "Not Playing"}
                                </motion.h1>
                                <motion.h2
                                    className="text-xl md:text-2xl font-medium opacity-80 line-clamp-1"
                                    style={{ color: colors.onSurfaceVariant }}
                                >
                                    {track?.artist || "Unknown Artist"}
                                </motion.h2>
                            </div>

                            {/* Progress Bar (Squiggly) */}
                            <div className="w-full mb-8 max-w-lg">
                                <SquigglySlider
                                    value={position_secs}
                                    max={track?.duration_secs || 100}
                                    onChange={(val) => seek(val)}
                                    isPlaying={isPlaying}
                                    className="h-12 w-full cursor-pointer"
                                    accentColor={colors.primary}
                                />
                                <div className="flex justify-between mt-2 text-sm font-medium opacity-60" style={{ color: colors.onSurfaceVariant }}>
                                    <span>{formatTime(position_secs)}</span>
                                    <span>{formatTime(track?.duration_secs || 0)}</span>
                                </div>
                            </div>

                            {/* Playback Controls */}
                            <div className="flex items-center gap-8">
                                <button
                                    onClick={toggleShuffle}
                                    className="p-3 rounded-full transition-transform active:scale-95 hover:bg-black/5"
                                    style={{ color: isShuffled ? colors.primary : colors.onSurfaceVariant }}
                                >
                                    <IconShuffle size={32} />
                                </button>

                                <button
                                    onClick={prevTrack}
                                    className="p-3 rounded-full transition-transform active:scale-95 hover:bg-black/5"
                                    style={{ color: colors.onSurface }}
                                >
                                    <IconPrevious size={48} />
                                </button>

                                <button
                                    onClick={isPlaying ? pause : resume}
                                    className="p-6 rounded-[2rem] shadow-xl hover:scale-105 active:scale-95 transition-all"
                                    style={{
                                        backgroundColor: colors.primary,
                                        color: colors.onPrimary
                                    }}
                                >
                                    {isPlaying ? <IconPause size={48} /> : <IconPlay size={48} />}
                                </button>

                                <button
                                    onClick={nextTrack}
                                    className="p-3 rounded-full transition-transform active:scale-95 hover:bg-black/5"
                                    style={{ color: colors.onSurface }}
                                >
                                    <IconNext size={48} />
                                </button>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Right: Lyrics (Visible on XL screens) */}
                <div className="hidden xl:flex flex-col w-96 shrink-0 overflow-hidden rounded-2xl bg-black/5 backdrop-blur-sm border border-white/5 relative">
                    <SideLyrics variant="carousel" />
                </div>

            </div>
        </motion.div>
    );
}

function formatTime(seconds: number) {
    if (!seconds || isNaN(seconds)) return "0:00";
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
}
